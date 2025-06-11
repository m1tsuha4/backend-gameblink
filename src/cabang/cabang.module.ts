import { Module } from '@nestjs/common';
import { CabangService } from './cabang.service';
import { CabangController } from './cabang.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CabangController],
  providers: [CabangService],
})
export class CabangModule {}
