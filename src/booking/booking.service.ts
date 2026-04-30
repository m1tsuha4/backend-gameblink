import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MidtransService } from 'src/midtrans/midtrans.service';
import { BookingType, StatusBooking, StatusPembayaran, StatusPerbaikan } from '@prisma/client';
import { Parser } from 'json2csv';
import * as ExcelJS from 'exceljs';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class BookingService {
  constructor(
    private prismaService: PrismaService,
    private midtransService: MidtransService,
    private redis: RedisService,
  ) { }

  private readonly SLOT_LOCK_TTL_SECONDS = 10 * 60;
  private isTimeBetween(time: string, start: string, end: string): boolean {
    return start <= time && time <= end;
  }
  private async generateBookingCode(): Promise<string> {
    const lastBooking = await this.prismaService.booking.findFirst({
      orderBy: { booking_code: 'desc' },
      where: {
        booking_code: {
          startsWith: 'BK'
        }
      }
    });

    let nextNumber = 1;
    if (lastBooking && lastBooking.booking_code) {
      const lastNumber = parseInt(lastBooking.booking_code.substring(2));
      nextNumber = lastNumber + 1;
    }

    return `BK${nextNumber.toString().padStart(5, '0')}`;
  }

  private buildWhere(
    startDate?: string,
    endDate?: string,
    cabang?: string,
    type?: string,
    metode_pembayaran?: string
  ) {
    const where: any = {};

    if (startDate && endDate) {
      const end = new Date(endDate);
      if (!endDate.includes('T')) {
        end.setUTCHours(23, 59, 59, 999);
      }
      where.tanggal_main = {
        gte: new Date(startDate),
        lte: end,
      };
    }

    if (type) {
      where.booking_type = type;
    }

    if (cabang) {
      where.cabang_id = cabang;
    }

    if (metode_pembayaran) {
      where.metode_pembayaran = metode_pembayaran;
    }

    return where;
  }

  private slotKey(unitId: string, isoDate: string, hhmm: string) {
    const normJam = hhmm.replace('.', ':');
    return `slot:${unitId}:${isoDate}:${normJam}`;
  }

  private async acquireSlotLocks(
    isoDate: string,
    details: { unit_id: string; jam_main: string }[],
    ttlSec: number,
  ) {
    const keys: string[] = [];
    for (const d of details) {
      const key = this.slotKey(d.unit_id, isoDate, d.jam_main);
      const ok = await (this.redis.client as any).set(
        key,
        'HOLD',
        'NX',
        'EX',
        ttlSec
      );
      if (!ok) {
        if (keys.length) await this.redis.client.del(...keys);
        throw new BadRequestException('Slot sedang proses booking, coba jam lain.');
      }
      keys.push(key);
    }
    return keys;
  }

  private async releaseLocks(keys: string[]) {
    if (keys.length) await this.redis.client.del(...keys);
  }

  async create(createBookingDto: CreateBookingDto) {
    const { booking_details, tanggal_main, metode_pembayaran } = createBookingDto;
    
    // Normalize date part for Redis locks and queries
    const dateString = typeof tanggal_main === 'string' ? tanggal_main : new Date(tanggal_main).toISOString();
    const datePart = dateString.split('T')[0];

    // Create the exact DateTime by combining the Play Date with the exact current time (button click)
    const nowIso = new Date().toISOString();
    const timePart = nowIso.split('T')[1];
    const exactTanggalMain = new Date(`${datePart}T${timePart}`);
    
    const startOfDay = new Date(`${datePart}T00:00:00.000Z`);
    const endOfDay = new Date(`${datePart}T23:59:59.999Z`);

    const localIsoDate = datePart;
    const ttlSec = this.SLOT_LOCK_TTL_SECONDS;

    const lockKeys = await this.acquireSlotLocks(
      localIsoDate,
      booking_details.map((b) => ({ unit_id: b.unit_id, jam_main: b.jam_main })),
      ttlSec,
    );

    let releaseImmediately = true;

    try {

      for (const detail of booking_details) {
        const { unit_id, jam_main } = detail;

        const existingBookingDetail = await this.prismaService.bookingDetail.findFirst({
          where: {
            unit_id,
            jam_main,
            tanggal: {
              gte: startOfDay,
              lte: endOfDay,
            },
            booking: {
              status_pembayaran: {
                in: ['Berhasil', 'Pending'],
              },
              status_booking: {
                in: [StatusBooking.Aktif, StatusBooking.TidakAktif],
              },
            },
          },
        });

        if (existingBookingDetail) {
          throw new BadRequestException(
            `Unit with ID ${unit_id} is already booked or waiting for payment for ${jam_main} on ${datePart}. Please choose another time or unit.`
          );
        }


        // 2. Check for blocked availability
        const blockedUnitKetersediaan = await this.prismaService.ketersediaan.findFirst({
          where: {
            unit_id,
            status_perbaikan: StatusPerbaikan.Pending,
            tanggal_mulai_blokir: {
              lte: endOfDay,
            },
            OR: [
              { tanggal_selesai_blokir: null },
              {
                tanggal_selesai_blokir: {
                  gte: startOfDay,
                },
              },
            ],
          },
        });

        if (blockedUnitKetersediaan) {
          const blockStartDate = new Date(blockedUnitKetersediaan.tanggal_mulai_blokir);
          const blockEndDate = blockedUnitKetersediaan.tanggal_selesai_blokir
            ? new Date(blockedUnitKetersediaan.tanggal_selesai_blokir)
            : null;

          const blockStartMidnight = new Date(`${blockStartDate.toISOString().split('T')[0]}T00:00:00.000Z`);
          const blockEndMidnight = blockEndDate ? new Date(`${blockEndDate.toISOString().split('T')[0]}T00:00:00.000Z`) : null;

          const blockStartTime = blockedUnitKetersediaan.jam_mulai_blokir || '00:00';
          const blockEndTime = blockedUnitKetersediaan.jam_selesai_blokir || '23:59';

          let isBlockedByTime = false;
          const isSameDay = blockStartMidnight.getTime() === startOfDay.getTime();

          //  Case 1: Same day as block start
          if (isSameDay) {
            isBlockedByTime = this.isTimeBetween(jam_main, blockStartTime, '23:59');
          }

          // Case 2: No end date and booking is after block start
          else if (!blockEndDate && startOfDay > blockStartMidnight) {
            isBlockedByTime = true; // Block full day
          }

          // Case 3: Has end date
          else if (blockEndMidnight) {
            if (startOfDay > blockStartMidnight && startOfDay < blockEndMidnight) {
              isBlockedByTime = true; // Middle of range
            } else if (startOfDay.getTime() === blockEndMidnight.getTime()) {
              isBlockedByTime = this.isTimeBetween(jam_main, '00:00', blockEndTime);
            }
          }

          if (isBlockedByTime) {
            throw new BadRequestException(
              `Unit with ID ${unit_id} is currently unavailable due to pending maintenance from ${blockedUnitKetersediaan.tanggal_mulai_blokir
                .toISOString()
                .split('T')[0]} ${blockedUnitKetersediaan.jam_mulai_blokir || ''} to ${blockedUnitKetersediaan
                .tanggal_selesai_blokir?.toISOString()
                .split('T')[0] || 'onwards'} ${blockedUnitKetersediaan.jam_selesai_blokir || ''}.`
            );
          }
        }
      }

      const bookingCode = await this.generateBookingCode();
      const booking = await this.prismaService.booking.create({
        data: {
          ...createBookingDto,
          metode_pembayaran: metode_pembayaran,
          booking_code: bookingCode,
          tanggal_main: exactTanggalMain,
          tanggal_transaksi: nowIso,
          booking_type: BookingType.Online,
          status_pembayaran: StatusPembayaran.Pending,
          status_booking: StatusBooking.TidakAktif,
          booking_details: {
            create: createBookingDto.booking_details.map(detail => ({
              ...detail,
              tanggal: exactTanggalMain
            })),
          },
        },
        include: {
          cabang: true,
          booking_details: {
            include: {
              unit: true,
            },
          },
        },
      });

      let snap: { token: string; redirect_url: string } | undefined;
      try {
        snap = await this.midtransService.createTransaction(booking, metode_pembayaran);
        if (!snap?.token || !snap?.redirect_url) {
          throw new Error('Invalid Snap response');
        }
      } catch (e) {
        console.error('Midtrans Transaction Error:', e);
        await this.prismaService.booking.delete({ where: { id: booking.id } });
        throw new BadRequestException('Gagal membuat transaksi Midtrans. Silakan coba lagi.');
      }

      await this.redis.rememberSlotLocks(booking.id, lockKeys, ttlSec);
      releaseImmediately = false;

      return { token: snap.token, redirect_url: snap.redirect_url };
    } catch (error) {
      if (releaseImmediately) {
        await this.releaseLocks(lockKeys);
      }
      console.error('Error creating booking:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create booking due to an internal error. Please try again.');
    }
  }

  async createWalkinBooking(createBookingDto: CreateBookingDto) {
    const { booking_details, tanggal_main, metode_pembayaran } = createBookingDto;

    const dateString = typeof tanggal_main === 'string' ? tanggal_main : new Date(tanggal_main).toISOString();
    const datePart = dateString.split('T')[0];

    // Combine Play Date with exact current transaction time
    const nowIso = new Date().toISOString();
    const timePart = nowIso.split('T')[1];
    const exactTanggalMain = new Date(`${datePart}T${timePart}`);
    
    const startOfDay = new Date(`${datePart}T00:00:00.000Z`);
    const endOfDay = new Date(`${datePart}T23:59:59.999Z`);

    const ttlSec = this.SLOT_LOCK_TTL_SECONDS || 600;
    const lockKeys = await this.acquireSlotLocks(
      datePart,
      booking_details.map((b) => ({ unit_id: b.unit_id, jam_main: b.jam_main })),
      ttlSec,
    );

    let releaseImmediately = true;

    try {
      for (const detail of booking_details) {
        const { unit_id, jam_main } = detail;

        // Check if already booked (including Pending Online bookings)
        const existingActiveBookingDetail = await this.prismaService.bookingDetail.findFirst({
        where: {
          unit_id: unit_id,
          jam_main: jam_main,
          tanggal: {
            gte: startOfDay,
            lte: endOfDay,
          },
          booking: {
            status_pembayaran: {
              in: ['Berhasil', 'Pending'],
            },
            status_booking: {
              in: [StatusBooking.Aktif, StatusBooking.TidakAktif],
            },
          },
        },
      });

      if (existingActiveBookingDetail) {
        throw new BadRequestException(`Unit with ID ${unit_id} is already booked or waiting for payment for ${jam_main} on ${datePart}. Please choose another time or unit.`);
      }

      // Check if blocked
      const blockedUnitKetersediaan = await this.prismaService.ketersediaan.findFirst({
        where: {
          unit_id: unit_id,
          status_perbaikan: StatusPerbaikan.Pending,
          tanggal_mulai_blokir: {
            lte: endOfDay,
          },
          OR: [
            { tanggal_selesai_blokir: null },
            { tanggal_selesai_blokir: { gte: startOfDay } },
          ],
        },
      });

      if (blockedUnitKetersediaan) {
        const blockStartDate = new Date(blockedUnitKetersediaan.tanggal_mulai_blokir);
        const blockEndDate = blockedUnitKetersediaan.tanggal_selesai_blokir
          ? new Date(blockedUnitKetersediaan.tanggal_selesai_blokir)
          : null;

        const blockStartMidnight = new Date(`${blockStartDate.toISOString().split('T')[0]}T00:00:00.000Z`);
        const blockEndMidnight = blockEndDate ? new Date(`${blockEndDate.toISOString().split('T')[0]}T00:00:00.000Z`) : null;

        const blockStartTime = blockedUnitKetersediaan.jam_mulai_blokir || '00:00';
        const blockEndTime = blockedUnitKetersediaan.jam_selesai_blokir || '23:59';

        let isBlockedByTime = false;
        const isSameDay = blockStartMidnight.getTime() === startOfDay.getTime();

        // Case 1: Booking on same day as block start
        if (isSameDay) {
          isBlockedByTime = this.isTimeBetween(jam_main, blockStartTime, '23:59');
        }
        // Case 2: Indefinite block and booking after block start
        else if (!blockEndDate && startOfDay > blockStartMidnight) {
          isBlockedByTime = true;
        }
        //  Case 3: Has end date
        else if (blockEndMidnight) {
          if (startOfDay > blockStartMidnight && startOfDay < blockEndMidnight) {
            isBlockedByTime = true;
          } else if (startOfDay.getTime() === blockEndMidnight.getTime()) {
            isBlockedByTime = this.isTimeBetween(jam_main, '00:00', blockEndTime);
          }
        }

        if (isBlockedByTime) {
          throw new BadRequestException(
            `Unit with ID ${unit_id} is currently unavailable due to pending maintenance from ${blockedUnitKetersediaan.tanggal_mulai_blokir.toISOString().split('T')[0]} ${blockedUnitKetersediaan.jam_mulai_blokir || ''} to ${blockedUnitKetersediaan.tanggal_selesai_blokir?.toISOString().split('T')[0] || 'onwards'} ${blockedUnitKetersediaan.jam_selesai_blokir || ''}.`
          );
        }
      }
    } // closes for loop

    // Proceed with creating the booking
      const bookingCode = await this.generateBookingCode();

      const booking = await this.prismaService.booking.create({
        data: {
          ...createBookingDto,
          booking_code: bookingCode,
          metode_pembayaran,
          tanggal_main: exactTanggalMain,
          status_pembayaran: StatusPembayaran.Berhasil,
          status_booking: StatusBooking.Aktif,
          booking_type: BookingType.Walkin,
          tanggal_transaksi: nowIso,
          booking_details: {
            create: createBookingDto.booking_details.map(detail => ({
              ...detail,
              tanggal: exactTanggalMain
            })),
          },
        },
        include: {
          cabang: true,
          booking_details: {
            include: {
              unit: true,
            },
          },
        },
      });

      return booking;
    } catch (error) {
      console.error('Error creating walk-in booking:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create walk-in booking due to an internal error. Please try again.');
    } finally {
      if (releaseImmediately) {
        await this.releaseLocks(lockKeys);
      }
    }
  }


  async findAll(
    startDate?: string,
    endDate?: string,
    cabang?: string,
    type?: string,
    metode_pembayaran?: string,
    page: number = 1,
    limit?: number, // allow undefined
    search?: string
  ) {
    const where: any = {};

    if (startDate && endDate) {
      const end = new Date(endDate);
      if (!endDate.includes('T')) {
        end.setUTCHours(23, 59, 59, 999);
      }
      where.tanggal_main = {
        gte: new Date(startDate),
        lte: end,
      };
    }

    if (type) {
      where.booking_type = type;
    }

    if (cabang) {
      where.cabang_id = cabang;
    }

    if (metode_pembayaran) {
      where.metode_pembayaran = metode_pembayaran;
    }

    if (search) {
      where.OR = [
        { nama: { contains: search } },
        { nomor_hp: { contains: search } },
        { email: { contains: search } },
        { booking_code: { contains: search } },
      ];
    }

    // Calculate offset based on page and limit 
    let take: number | undefined = undefined;
    let skip: number | undefined = undefined;
    if (limit && limit !== 0 && limit !== Number.POSITIVE_INFINITY) {
      take = parseInt(limit.toString());
      skip = parseInt((page - 1).toString()) * take;
    }

    const totalCount = await this.prismaService.booking.count({ where });

    const booking = await this.prismaService.booking.findMany({
      where,
      include: {
        cabang: true,
        booking_details: {
          include: {
            unit: true
          }
        }
      },
      orderBy: {
        booking_code: 'desc',
      },
      ...(take ? { take } : {}),
      ...(skip ? { skip } : {}),
    });

    if (booking.length === 0) throw new NotFoundException('Booking not found');
    const formatedBooking = booking.map((booking) => ({
      ...booking,
      nama_cabang: booking.cabang?.nama_cabang,
      booking_details: booking.booking_details.map((booking_detail) => ({
        ...booking_detail,
        nama_unit: booking_detail.unit?.nama_unit,
        jam_main: booking_detail.jam_main,
        unit: undefined
      })),
      cabang: undefined,
    }));

    return {
      data: formatedBooking,
      meta: {
        currentPage: page,
        pageSize: take || totalCount,
        totalItems: totalCount,
        totalPage: take ? Math.ceil(totalCount / take) : 1,
      },
    };
  }

  async findOne(id: string) {
    const booking = await this.prismaService.booking.findUnique({
      where: { id },
      include: {
        cabang: true,
        booking_details: {
          include: {
            unit: true
          }
        }
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    const formatedBooking = {
      ...booking,
      nama_cabang: booking.cabang?.nama_cabang,
      booking_details: booking.booking_details.map((booking_detail) => ({
        ...booking_detail,
        nama_unit: booking_detail.unit?.nama_unit,
        jam_main: booking_detail.jam_main,
        unit: undefined
      })),
      cabang: undefined,
    };

    return formatedBooking;
  }

  async update(id: string, updateBookingDto: UpdateBookingDto) {
    const existingBooking = await this.prismaService.booking.findUnique({
      where: {
        id: id,
      },
    });

    if (!existingBooking) {
      throw new NotFoundException('Booking not found');
    }

    // Separate booking_details from other update data
    const { booking_details, ...otherUpdateData } = updateBookingDto;

    // Filter out undefined values from other update data
    const updateData = Object.fromEntries(
      Object.entries(otherUpdateData).filter(
        ([_, value]) => value !== undefined,
      ),
    );

    if (updateData.status_booking === 'Dibatalkan') {
      updateData.status_pembayaran = 'Gagal';
    }

    const shouldReleaseSlotLocks =
      updateData.status_booking === 'Dibatalkan' ||
      updateData.status_pembayaran === 'Gagal';

    // If booking_details is provided, handle it separately
    if (booking_details) {
      const updatedBooking = await this.prismaService.$transaction(async (tx) => {
        // First, delete existing booking details
        await tx.bookingDetail.deleteMany({
          where: { booking_id: id }
        });

        // Then update the booking with new data and create new booking details
        return await tx.booking.update({
          where: { id },
          data: {
            ...updateData,
            booking_details: {
              create: booking_details
            }
          },
          include: {
            cabang: true,
            booking_details: {
              include: {
                unit: true
              }
            },
          },
        });
      });
      if (shouldReleaseSlotLocks) {
        await this.redis.releaseSlotLocksForBooking(id);
      }
      return updatedBooking;
    } else {
      // If no booking_details to update, just update the main booking data
      const updatedBooking = await this.prismaService.booking.update({
        where: { id },
        data: updateData,
        include: {
          cabang: true,
          booking_details: {
            include: {
              unit: true
            }
          },
        },
      });
      if (shouldReleaseSlotLocks) {
        await this.redis.releaseSlotLocksForBooking(id);
      }
      return updatedBooking;
    }
  }

  async remove(id: string) {
    const existingBooking = await this.prismaService.booking.findUnique({
      where: {
        id: id,
      },
    });
    if (!existingBooking) {
      throw new NotFoundException('Booking not found');
    }
    const deleted = await this.prismaService.booking.delete({
      where: { id },
    });
    await this.redis.releaseSlotLocksForBooking(id);
    return deleted;
  }

  async exportBookings(
    startDate?: string,
    endDate?: string,
    cabang?: string,
    type?: string,
    metode_pembayaran?: string,
    format: 'csv' | 'xlsx' = 'csv'
  ): Promise<Buffer> {
    const where = this.buildWhere(startDate, endDate, cabang, type, metode_pembayaran);

    console.log('Export filters (where):', where);

    // Process in chunks to avoid memory overflow
    const CHUNK_SIZE = 1000;
    let skip = 0;
    const allBookings: any[] = [];

    while (true) {
      const bookings = await this.prismaService.booking.findMany({
        where,
        include: {
          cabang: true,
          booking_details: {
            include: {
              unit: true
            }
          }
        },
        orderBy: {
          booking_code: 'desc',
        },
        take: CHUNK_SIZE,
        skip: skip,
      });

      if (bookings.length === 0) break;
      allBookings.push(...bookings);
      skip += CHUNK_SIZE;
    }

    console.log('Found bookings:', allBookings.length);

    if (allBookings.length === 0) throw new NotFoundException('Booking not found');

    // --- Data Transformation ---
    const exportData = allBookings.map((b) => ({
      'ID Booking': b.booking_code,
      Nama: b.nama,
      'Nomor HP': String(b.nomor_hp),
      Email: b.email,
      Cabang: b.cabang?.nama_cabang || '',
      'Tanggal Main': b.tanggal_main ? new Date(b.tanggal_main).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }) : '',
      'Tanggal Transaksi': b.tanggal_transaksi ? new Date(b.tanggal_transaksi).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }) : '',
      'Metode Pembayaran': b.metode_pembayaran || '',
      'Total Harga': `Rp ${b.total_harga ? b.total_harga.toLocaleString('id-ID') : '0'}`,
      'Status Pembayaran': b.status_pembayaran,
      'Status Booking': b.status_booking,
      'Tipe Booking': b.booking_type,
    }));

    if (format === 'csv') {
      const parser = new Parser();
      let csv = parser.parse(exportData);
      csv = 'sep=,\n' + csv;
      return Buffer.from(csv);
    } else {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Bookings');

      worksheet.columns = [
        { header: 'ID Booking', key: 'ID Booking', width: 15 },
        { header: 'Nama', key: 'Nama', width: 20 },
        { header: 'Nomor HP', key: 'Nomor HP', width: 15, style: { numFmt: '@' } },
        { header: 'Email', key: 'Email', width: 25 },
        { header: 'Cabang', key: 'Cabang', width: 15 },
        { header: 'Tanggal Main', key: 'Tanggal Main', width: 15 },
        { header: 'Tanggal Transaksi', key: 'Tanggal Transaksi', width: 18 },
        { header: 'Metode Pembayaran', key: 'Metode Pembayaran', width: 20 },
        { header: 'Total Harga', key: 'Total Harga', width: 15 },
        { header: 'Status Pembayaran', key: 'Status Pembayaran', width: 20 },
        { header: 'Status Booking', key: 'Status Booking', width: 18 },
        { header: 'Tipe Booking', key: 'Tipe Booking', width: 15 },
      ];

      worksheet.addRows(exportData);
      const arrayBuffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(arrayBuffer);
    }
  }
  // mark pending bookings older than 10 minutes as failed
  async expireStalePending() {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

    const staleBookings = await this.prismaService.booking.findMany({
      where: {
        status_pembayaran: 'Pending',
        tanggal_transaksi: { lt: cutoff },
        status_booking: 'TidakAktif',
        metode_pembayaran: 'bank_transfer',
      },
      select: { id: true },
    });

    if (!staleBookings.length) {
      return { success: true, expired: 0 };
    }

    const result = await this.prismaService.booking.updateMany({
      where: {
        status_pembayaran: 'Pending',
        tanggal_transaksi: { lt: cutoff },
      },
      data: {
        status_pembayaran: 'Gagal',
        status_booking: 'Dibatalkan',
      },
    });

    await Promise.all(
      staleBookings.map((booking) => this.redis.releaseSlotLocksForBooking(booking.id)),
    );

    return { success: true, expired: result.count };
  }

  private buildDateRange(dateStr: string) {
    const start = new Date(`${dateStr}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { gte: start, lt: end };
  }
}
