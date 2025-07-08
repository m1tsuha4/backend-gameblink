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
     @Query('page') page: number = 1,
     @Query('limit') limit: number = 10
  ) {
    return this.bookingService.findAll(tanggal_main, cabang, type, page, limit);
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
