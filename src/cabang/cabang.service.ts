import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCabangDto } from './dto/create-cabang.dto';
import { UpdateCabangDto } from './dto/update-cabang.dto';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CabangService {
  constructor(private prismaService: PrismaService) {}

  async create(dto: CreateCabangDto) {
    const existing = await this.prismaService.cabang.findUnique({
      where: {
        nama_cabang: dto.nama_cabang,
      },
    });
    if (existing) {
      throw new ConflictException('Cabang already in use');
    }
    return this.prismaService.cabang.create({
      data: {
        nama_cabang: dto.nama_cabang,
        alamat_cabang: dto.alamat_cabang,
        imageCabang: `/uploads/cabang/${dto.imageCabang}`,
        status: dto.status
      },
    });
  }

  async findAll() {
     const cabang = await this.prismaService.cabang.findMany({
      include: {
        _count: {
          select: {
            Unit: true
          }
        }
      }
    });

    if (cabang.length === 0) 
      throw new NotFoundException('Cabang not found');

    // Transform the response to include unit count in a more readable format
    const cabangWithUnitCount = cabang.map(branch => ({
      ...branch,
      jumlah_unit: branch._count.Unit,
      _count: undefined // Remove the _count object from response
    }));

    return cabangWithUnitCount;
  }

  async findOne(id: string) {
    const cabang = await this.prismaService.cabang.findUnique({
      where: {
        id: id,
      }
    });
    if (!cabang) throw new NotFoundException('Cabang not found');
    return cabang;
  }

  async update(id: string, dto: UpdateCabangDto) {
    const existingCabang = await this.prismaService.cabang.findUnique({
      where: {
        id: id,
      }
    });
    if (!existingCabang) throw new NotFoundException('Cabang not found');

    return this.prismaService.cabang.update({
      where: { id },
      data: {
        nama_cabang: dto.nama_cabang,
        alamat_cabang: dto.alamat_cabang,
        imageCabang: `/uploads/cabang/${dto.imageCabang}`,
        status: dto.status
      }
    });
  }

  async remove(id: string) {
    const notFound = await this.prismaService.cabang.findUnique({
      where: { id },
    });
    if (!notFound) {
      throw new ConflictException('Cabang not found');
    }
    return this.prismaService.cabang.delete({
      where: { id },
    });
  }
}
