import { Module } from '@nestjs/common';
import { UnitService } from './unit.service';
import { UnitController } from './unit.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [UnitController],
  providers: [UnitService],
  imports: [PrismaModule],
})
export class UnitModule {}
