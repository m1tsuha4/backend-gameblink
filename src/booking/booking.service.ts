import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MidtransService } from 'src/midtrans/midtrans.service';
import { BookingType, StatusBooking, StatusPembayaran, StatusPerbaikan } from '@prisma/client';

@Injectable()
export class BookingService {
  constructor(
    private prismaService: PrismaService,
    private midtransService: MidtransService
  ) { }
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
  async create(createBookingDto: CreateBookingDto) {
    const { booking_details, tanggal_main, metode_pembayaran } = createBookingDto;

    const bookingDate = new Date(tanggal_main);
    bookingDate.setHours(0, 0, 0, 0);

    for (const detail of booking_details) {
      const { unit_id, jam_main } = detail;

      // 1. Check if already booked
      const existingActiveBookingDetail = await this.prismaService.bookingDetail.findFirst({
        where: {
          unit_id,
          jam_main,
          tanggal: bookingDate,
          booking: {
            status_booking: StatusBooking.Aktif
          }
        }
      });

      if (existingActiveBookingDetail) {
        throw new BadRequestException(
          `Unit with ID ${unit_id} is already booked for ${jam_main} on ${bookingDate.toISOString().split('T')[0]}. Please choose another time or unit.`
        );
      }

      // 2. Check for blocked availability
      const blockedUnitKetersediaan = await this.prismaService.ketersediaan.findFirst({
        where: {
          unit_id,
          status_perbaikan: StatusPerbaikan.Pending,
          tanggal_mulai_blokir: {
            lte: bookingDate,
          },
          OR: [
            { tanggal_selesai_blokir: null },
            {
              tanggal_selesai_blokir: {
                gte: bookingDate,
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

        const blockStartTime = blockedUnitKetersediaan.jam_mulai_blokir || '00:00';
        const blockEndTime = blockedUnitKetersediaan.jam_selesai_blokir || '23:59';

        blockStartDate.setHours(0, 0, 0, 0);
        if (blockEndDate) blockEndDate.setHours(0, 0, 0, 0);

        let isBlockedByTime = false;
        const isSameDay = blockStartDate.getTime() === bookingDate.getTime();

        // ✅ Case 1: Same day as block start
        if (isSameDay) {
          isBlockedByTime = this.isTimeBetween(jam_main, blockStartTime, '23:59');
        }

        // ✅ Case 2: No end date and booking is after block start
        else if (!blockEndDate && bookingDate > blockStartDate) {
          isBlockedByTime = true; // Block full day
        }

        // ✅ Case 3: Has end date
        else if (blockEndDate) {
          if (bookingDate > blockStartDate && bookingDate < blockEndDate) {
            isBlockedByTime = true; // Middle of range
          } else if (bookingDate.getTime() === blockEndDate.getTime()) {
            isBlockedByTime = this.isTimeBetween(jam_main, '00:00', blockEndTime);
          }
        }

        if (isBlockedByTime) {
          throw new BadRequestException(
            `Unit with ID ${unit_id} is currently unavailable due to pending maintenance from ${blockedUnitKetersediaan.tanggal_mulai_blokir.toISOString().split('T')[0]} ${blockedUnitKetersediaan.jam_mulai_blokir || ''} to ${blockedUnitKetersediaan.tanggal_selesai_blokir?.toISOString().split('T')[0] || 'onwards'} ${blockedUnitKetersediaan.jam_selesai_blokir || ''}.`
          );
        }
      }
    }

    // 3. Proceed with booking creation
    try {
      const bookingCode = await this.generateBookingCode();
      const booking = await this.prismaService.booking.create({
        data: {
          ...createBookingDto,
          metode_pembayaran: metode_pembayaran,
          booking_code: bookingCode,
          booking_type: BookingType.Online,
          booking_details: {
            create: createBookingDto.booking_details,
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

      const snap = await this.midtransService.createTransaction(booking, metode_pembayaran);

      return {
        token: snap.token,
        redirect_url: snap.redirect_url,
      };
    } catch (error) {
      console.error('Error creating booking:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create booking due to an internal error. Please try again.');
    }
  }

  async createWalkinBooking(createBookingDto: CreateBookingDto) {
    const { booking_details, tanggal_main, metode_pembayaran } = createBookingDto;

    const bookingDate = new Date(tanggal_main);
    bookingDate.setHours(0, 0, 0, 0);

    for (const detail of booking_details) {
      const { unit_id, jam_main } = detail;

      // Check if already booked
      const existingActiveBookingDetail = await this.prismaService.bookingDetail.findFirst({
        where: {
          unit_id: unit_id,
          jam_main: jam_main,
          tanggal: bookingDate,
          booking: {
            status_booking: StatusBooking.Aktif,
          },
        },
      });

      if (existingActiveBookingDetail) {
        throw new BadRequestException(`Unit with ID ${unit_id} is already booked for ${jam_main} on ${bookingDate.toISOString().split('T')[0]}. Please choose another time or unit.`);
      }

      // Check if blocked
      const blockedUnitKetersediaan = await this.prismaService.ketersediaan.findFirst({
        where: {
          unit_id: unit_id,
          status_perbaikan: StatusPerbaikan.Pending,
          tanggal_mulai_blokir: {
            lte: bookingDate,
          },
          OR: [
            { tanggal_selesai_blokir: null },
            { tanggal_selesai_blokir: { gte: bookingDate } },
          ],
        },
      });

      if (blockedUnitKetersediaan) {
        const blockStartDate = new Date(blockedUnitKetersediaan.tanggal_mulai_blokir);
        const blockEndDate = blockedUnitKetersediaan.tanggal_selesai_blokir
          ? new Date(blockedUnitKetersediaan.tanggal_selesai_blokir)
          : null;

        const blockStartTime = blockedUnitKetersediaan.jam_mulai_blokir || '00:00';
        const blockEndTime = blockedUnitKetersediaan.jam_selesai_blokir || '23:59';

        blockStartDate.setHours(0, 0, 0, 0);
        if (blockEndDate) blockEndDate.setHours(0, 0, 0, 0);

        let isBlockedByTime = false;
        const isSameDay = blockStartDate.getTime() === bookingDate.getTime();

        // ✅ Case 1: Booking on same day as block start
        if (isSameDay) {
          isBlockedByTime = this.isTimeBetween(jam_main, blockStartTime, '23:59');
        }
        // ✅ Case 2: Indefinite block and booking after block start
        else if (!blockEndDate && bookingDate > blockStartDate) {
          isBlockedByTime = true;
        }
        // ✅ Case 3: Has end date
        else if (blockEndDate) {
          if (bookingDate > blockStartDate && bookingDate < blockEndDate) {
            isBlockedByTime = true;
          } else if (bookingDate.getTime() === blockEndDate.getTime()) {
            isBlockedByTime = this.isTimeBetween(jam_main, '00:00', blockEndTime);
          }
        }

        if (isBlockedByTime) {
          throw new BadRequestException(
            `Unit with ID ${unit_id} is currently unavailable due to pending maintenance from ${blockedUnitKetersediaan.tanggal_mulai_blokir.toISOString().split('T')[0]} ${blockedUnitKetersediaan.jam_mulai_blokir || ''} to ${blockedUnitKetersediaan.tanggal_selesai_blokir?.toISOString().split('T')[0] || 'onwards'} ${blockedUnitKetersediaan.jam_selesai_blokir || ''}.`
          );
        }
      }
    }

    // Proceed with creating the booking
    try {
      const bookingCode = await this.generateBookingCode();

      const booking = await this.prismaService.booking.create({
        data: {
          ...createBookingDto,
          booking_code: bookingCode,
          metode_pembayaran,
          tanggal_main: tanggal_main,
        status_pembayaran: StatusPembayaran.Berhasil,
          status_booking: StatusBooking.Aktif,
          booking_type: BookingType.Walkin,
          tanggal_transaksi: new Date().toISOString(),
        booking_details: {
            create: createBookingDto.booking_details,
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
    }
  }


  async findAll(tanggal_main?: string, cabang?: string, type?: string, page: number = 1, limit: number = 10) {
    const where: any = {};

    if (tanggal_main) {
      where.tanggal_main = this.buildDateRange(tanggal_main);
    }

    if (type) {
      where.booking_type = type;
    }

    if (cabang) {
      where.cabang_id = cabang;
    }

    // Calculate offset based on page and limit 
    const offset = parseInt((page - 1).toString()) * parseInt(limit.toString());
    const limitNumber = parseInt(limit.toString());
    const totalCount = await this.prismaService.booking.count({
      where
    });

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
      skip: offset,
      take: limitNumber
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
        pageSize: limit,
        totalItems: totalCount,
        totalPage: Math.ceil(totalCount / limit),
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

    // If booking_details is provided, handle it separately
    if (booking_details) {
      return await this.prismaService.$transaction(async (tx) => {
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
    } else {
      // If no booking_details to update, just update the main booking data
      return this.prismaService.booking.update({
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
    return this.prismaService.booking.delete({
      where: { id },
    });
  }

  private buildDateRange(dateStr: string) {
    const start = new Date(`${dateStr}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { gte: start, lt: end };
  }
}
