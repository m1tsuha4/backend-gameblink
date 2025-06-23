import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class BookingService {
  constructor(private prismaService: PrismaService) {}
  async create(createBookingDto: CreateBookingDto) {
    return await this.prismaService.booking.create({
      data: createBookingDto,
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
        unit: true,
      },
    });

    if (booking.length === 0) throw new NotFoundException('Booking not found');
    const formatedBooking = booking.map((booking) => ({
      ...booking,
      nama_cabang: booking.cabang?.nama_cabang,
      nama_unit: booking.unit?.nama_unit,
      cabang: undefined,
      unit: undefined,
    }));

    return formatedBooking;
  }

  async findOne(id: string) {
    const booking = await this.prismaService.booking.findUnique({
      where: { id },
      include: {
        cabang: true,
        unit: true,
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    const formatedBooking = {
      ...booking,
      nama_cabang: booking.cabang?.nama_cabang,
      nama_unit: booking.unit?.nama_unit,
      cabang: undefined,
      unit: undefined,
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

    const updateData = Object.fromEntries(
      Object.entries(updateBookingDto).filter(
        ([_, value]) => value !== undefined,
      ),
    );

    return this.prismaService.booking.update({
      where: { id },
      data: updateData,
      include: {
        cabang: true,
        unit: true,
      },
    });
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
