import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MidtransModule } from 'src/midtrans/midtrans.module';

@Module({
  controllers: [BookingController],
  providers: [BookingService],
  imports: [PrismaModule, MidtransModule],
})
export class BookingModule {}
