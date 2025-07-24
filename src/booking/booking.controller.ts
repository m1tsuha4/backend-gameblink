import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res
} from '@nestjs/common';
import { BookingService } from './booking.service';
import {
  CreateBookingDto,
  CreateBookingSchema,
} from './dto/create-booking.dto';
import {
  UpdateBookingDto,
  UpdateBookingSchema,
} from './dto/update-booking.dto';
import { Response } from 'express';

@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateBookingSchema))
    createBookingDto: CreateBookingDto,
  ) {
    return this.bookingService.create(createBookingDto);
  }

  @Post('walkin')
  createWalkinBooking(
    @Body(new ZodValidationPipe(CreateBookingSchema))
    createBookingDto: CreateBookingDto,
  ) {
    return this.bookingService.createWalkinBooking(createBookingDto);
  }

  @Get()
  findAll(
     @Query('tanggal_main') tanggal_main: string,
     @Query('cabang') cabang: string,
     @Query('type') type: string,
     @Query('metode_pembayaran') metode_pembayaran: string,
     @Query('page') page: number = 1,
     @Query('limit') limit: number,
     @Query('search') search: string // <-- Add search param
  ) {
    return this.bookingService.findAll(
      tanggal_main,
      cabang,
      type,
      metode_pembayaran,
      page,
      limit,
      search // <-- Pass search param
    );
  }

   @Get('export')
   async exportBookings(
    @Query('tanggal_main') tanggal_main: string,
    @Query('cabang') cabang: string,
    @Query('type') type: string,
    @Query('metode_pembayaran') metode_pembayaran: string,
    @Query('format') format: 'csv' | 'xlsx' = 'csv',
    @Res() res: Response,
  ) {
    const fileBuffer = await this.bookingService.exportBookings(
      tanggal_main,
      cabang,
      type,
      metode_pembayaran,
      format,
    );

    const filename = `bookings_export.${format === 'csv' ? 'csv' : 'xlsx'}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(fileBuffer);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bookingService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateBookingSchema))
    updateBookingDto: UpdateBookingDto,
  ) {
    return this.bookingService.update(id, updateBookingDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bookingService.remove(id);
  }
}
