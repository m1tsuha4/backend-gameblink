import { Ketersediaan } from './entities/ketersediaan.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateKetersediaanDto } from './dto/create-ketersediaan.dto';
import { UpdateKetersediaanDto } from './dto/update-ketersediaan.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class KetersediaanService {
  constructor(private prismaService: PrismaService) {}
  async create(createKetersediaanDto: CreateKetersediaanDto) {
    return this.prismaService.ketersediaan.create({
      data: createKetersediaanDto
    });
  }

  async findAll() {
    const ketersediaan = await this.prismaService.ketersediaan.findMany({
      include: {
        cabang: true,
        unit: true
      }
    });

    if (ketersediaan.length === 0) 
      throw new NotFoundException('Ketersediaan not found');
    
    const formatedKetersediaan = ketersediaan.map(ketersediaan => ({
      ...ketersediaan,
      nama_cabang: ketersediaan.cabang?.nama_cabang,
      nama_unit: ketersediaan.unit?.nama_unit,
      cabang: undefined,
      unit: undefined
    }));

    return formatedKetersediaan;
  }

  async findOne(id: number) {
    const Ketersediaan = await this.prismaService.ketersediaan.findUnique({ where: { id_ketersediaan: id } });

    if (!Ketersediaan) {
      throw new NotFoundException('Ketersediaan not found');
    }

    return Ketersediaan;
  }

  async update(id: number, updateKetersediaanDto: UpdateKetersediaanDto) {
    const existingKetersediaan = await this.prismaService.ketersediaan.findUnique({
      where: {
        id_ketersediaan: id,
      },
    });
    
    if (!existingKetersediaan) {
      throw new NotFoundException('Ketersediaan not found');
    }
    
    // Filter out undefined values to avoid Prisma issues
    const updateData = Object.fromEntries(
      Object.entries(updateKetersediaanDto).filter(([_, value]) => value !== undefined)
    );
    
    return this.prismaService.ketersediaan.update({
      where: { id_ketersediaan: id },
      data: updateData,
      include: {
        cabang: true,
        unit: true
      }
    });
  }


  async remove(id: number) {
    const existingKetersediaan = await this.prismaService.ketersediaan.findUnique({
      where: {
        id_ketersediaan: id,
      },
    });
    if(!existingKetersediaan) throw new NotFoundException('Ketersediaan not found');
    
    return this.prismaService.ketersediaan.delete({
      where: { id_ketersediaan: id },
    });
  }
}
