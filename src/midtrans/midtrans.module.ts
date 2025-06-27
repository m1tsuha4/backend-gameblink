import { Module } from '@nestjs/common';
import { MidtransService } from './midtrans.service';
import { MidtransController } from './midtrans.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [MidtransController],
  providers: [MidtransService],
  imports: [PrismaModule],
  exports: [MidtransService],
})
export class MidtransModule {}
