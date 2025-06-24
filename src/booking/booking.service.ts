import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class BookingService {
  constructor(private prismaService: PrismaService) {}
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
    const bookingCode = await this.generateBookingCode();

    return await this.prismaService.booking.create({
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
