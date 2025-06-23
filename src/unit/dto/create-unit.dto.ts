import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const CreateUnitSchema = z.object({
  nama_unit: z.string().min(3).max(100),
  cabang_id: z.string().uuid().optional(),
  jenis_konsol: z.string().min(3).max(100),
  harga: z.number().min(1),
});

export class CreateUnitDto extends createZodDto(CreateUnitSchema) {}
