import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const CreateCabangSchema = z.object({
  nama_cabang: z.string().min(3).max(100),
  alamat_cabang: z.string().min(10).max(1000),
  imageCabang: z.string().optional(),
  status: z.enum(['Aktif', 'Tidak_Aktif']).default('Tidak_Aktif'),
});

export class CreateCabangDto extends createZodDto(CreateCabangSchema) {}
