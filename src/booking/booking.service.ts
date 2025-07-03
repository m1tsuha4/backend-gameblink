import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MidtransService } from 'src/midtrans/midtrans.service';
import { StatusBooking, StatusPembayaran, StatusPerbaikan } from '@prisma/client';

@Injectable()
export class BookingService {
  constructor(
    private prismaService: PrismaService,
    private midtransService: MidtransService
  ) {}
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
    const { booking_details, tanggal_main } = createBookingDto;

    const bookingDate = new Date(tanggal_main);
    bookingDate.setUTCHours(0, 0, 0, 0);
    
    // Perform pre-booking check
    for (const detail of booking_details) {
      const { unit_id, jam_main } = detail;

      const existingActiveBookingDetail = await this.prismaService.bookingDetail.findFirst({
        where: {
          unit_id: unit_id,
          jam_main: jam_main,
          tanggal: bookingDate,
          booking: {
            status_booking: StatusBooking.Aktif
          }
        }
      });;
      
      if (existingActiveBookingDetail) {
        throw new BadRequestException(`Unit with ID ${unit_id} is already booked for ${jam_main} on ${bookingDate.toISOString().split('T')[0]}. Please choose another time or unit.`);
      }

      const blockedUnitKetersediaan = await this.prismaService.ketersediaan.findFirst({
        where: {
          unit_id: unit_id,
          status_perbaikan: StatusPerbaikan.Pending,

          tanggal_mulai_blokir: {
            lte: bookingDate
          },
          OR: [
            {
              tanggal_selesai_blokir: null,
            },
            {
              tanggal_selesai_blokir: {
                gte: bookingDate
              }
            }
          ]
        }
      });

      if (blockedUnitKetersediaan) {
        throw new BadRequestException( `Unit with ID ${unit_id} is currently unavailable due to pending maintenance from ${blockedUnitKetersediaan.tanggal_mulai_blokir.toISOString().split('T')[0]} ${blockedUnitKetersediaan.jam_mulai_blokir} to ${blockedUnitKetersediaan.tanggal_selesai_blokir?.toISOString().split('T')[0] || 'onwards'} ${blockedUnitKetersediaan.jam_selesai_blokir || ''}.`)
      }
    }

    // If all check pass, create the booking
    try {
      const bookingCode = await this.generateBookingCode();
      const booking = await this.prismaService.booking.create({
        data: {
          ...createBookingDto,
          booking_code: bookingCode,
          booking_details: {
            create: createBookingDto.booking_details
          }
        },
        include: {
          cabang: true,
          booking_details: {
            include: {
              unit: true
            }
          }
        }
      });
      const snap = await this.midtransService.createTransaction(booking);

      return {
        token: snap.token,
        redirect_url: snap.redirect_url,
      };
    } catch (error) {
      // Log the error for debugging purposes
      console.error('Error creating booking:', error);

      // Re-throw specific errors or a generic one
      if (error instanceof BadRequestException) {
        throw error; // Re-throw the validation errors thrown earlier
      }
      throw new BadRequestException('Failed to create booking due to an internal error. Please try again.');
    }
  }

   // New service method for walk-in bookings - MODIFIED HERE
  async createWalkinBooking(createBookingDto: CreateBookingDto) {
    const { booking_details, tanggal_main, metode_pembayaran } = createBookingDto; // Keep metode_pembayaran destructuring

    const bookingDate = new Date(tanggal_main);
    bookingDate.setUTCHours(0, 0, 0, 0);

    // --- Perform pre-booking checks (same as online booking) ---
    for (const detail of booking_details) {
      const { unit_id, jam_main } = detail;

      // Check 1: Overlapping active bookings
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

      // Check 2: Unit availability based on Ketersediaan (Maintenance/Blockage)
      const blockedUnitKetersediaan = await this.prismaService.ketersediaan.findFirst({
        where: {
          unit_id: unit_id,
          status_perbaikan: StatusPerbaikan.Pending,
          tanggal_mulai_blokir: {
            lte: bookingDate,
          },
          OR: [
            {
              tanggal_selesai_blokir: null,
            },
            {
              tanggal_selesai_blokir: {
                gte: bookingDate,
              },
            },
          ],
        },
      });

      if (blockedUnitKetersediaan) {
        throw new BadRequestException(`Unit with ID ${unit_id} is currently unavailable due to pending maintenance from ${blockedUnitKetersediaan.tanggal_mulai_blokir.toISOString().split('T')[0]} ${blockedUnitKetersediaan.jam_mulai_blokir} to ${blockedUnitKetersediaan.tanggal_selesai_blokir?.toISOString().split('T')[0] || 'onwards'} ${blockedUnitKetersediaan.jam_selesai_blokir || ''}.`);
      }
    }

    // --- If all checks pass, create the walk-in booking ---
    try {
      const bookingCode = await this.generateBookingCode();

      const booking = await this.prismaService.booking.create({
        data: {
          ...createBookingDto,
          booking_code: bookingCode,
          tanggal_main: bookingDate,
          tanggal_transaksi: new Date(),
          metode_pembayaran: metode_pembayaran, // Now directly uses whatever the frontend provides
          status_pembayaran: StatusPembayaran.Berhasil, // Still assuming immediate success for walk-in
          status_booking: StatusBooking.Aktif, // Still assuming active immediately for walk-in
          booking_details: {
            create: booking_details.map(detail => ({
              unit_id: detail.unit_id,
              jam_main: detail.jam_main,
              harga: detail.harga,
              tanggal: bookingDate,
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

      return booking; // Returns the created booking object
    } catch (error) {
      console.error('Error creating walk-in booking:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create walk-in booking due to an internal error. Please try again.');
    }
  }

  async findAll(tanggal_main?: string) {
     const where: any = {};

    if (tanggal_main) {
      where.tanggal_main = this.buildDateRange(tanggal_main);
    }
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

    return formatedBooking;
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
