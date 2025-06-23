import { Module } from '@nestjs/common';
import { KetersediaanService } from './ketersediaan.service';
import { KetersediaanController } from './ketersediaan.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [KetersediaanController],
  providers: [KetersediaanService],
  imports: [PrismaModule],
})
export class KetersediaanModule {}
