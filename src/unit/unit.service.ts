import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UnitService {
  constructor(private prismaService: PrismaService) {}
  async create(createUnitDto: CreateUnitDto) {
    return this.prismaService.unit.create({
      data: createUnitDto,
    });
  }

  async findAllByCabang(cabang_id: string) {
    const units = await this.prismaService.unit.findMany({
      where: {
        cabang_id: cabang_id,
      },
      orderBy: {
        nama_unit: 'asc',
      }
    });

    if (units.length === 0) {
      throw new NotFoundException(`No units found for cabang_id: ${cabang_id}`);
    }

    return units;
  }

  async findAll() {
    const unit = await this.prismaService.unit.findMany({
      orderBy: {
        nama_unit: 'asc',
      }
    });

    if (unit.length === 0) throw new NotFoundException('Unit not found');

    return unit;
  }

  async findOne(id: string) {
    const unit = await this.prismaService.unit.findUnique({
      where: { id: id },
    });

    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    return unit;
  }

  async update(id: string, updateUnitDto: UpdateUnitDto) {
    const existingUnit = await this.prismaService.unit.findUnique({
      where: {
        id: id,
      },
    });
    if (!existingUnit) {
      throw new NotFoundException('Unit not found');
    }
    return this.prismaService.unit.update({
      where: { id },
      data: updateUnitDto,
    });
  }

  async remove(id: string) {
    const existingUnit = await this.prismaService.unit.findUnique({
      where: {
        id: id,
      },
    });
    if (!existingUnit) {
      throw new NotFoundException('Unit not found');
    }
    return this.prismaService.unit.delete({
      where: { id },
    });
  }
}
