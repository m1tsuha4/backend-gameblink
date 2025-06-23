import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const CreateKetersediaanSchema = z.object({
  cabang_id: z.string().uuid().optional(),
  unit_id: z.string().uuid().optional(),
  tanggal_mulai_blokir: z.string(), // Accept as string (ISO format)
  jam_mulai_blokir: z.string(),
  tanggal_selesai_blokir: z.string(), // Accept as string (ISO format)
  jam_selesai_blokir: z.string(),
  keterangan: z.string().min(3).max(1000),
});

export class CreateKetersediaanDto extends createZodDto(
  CreateKetersediaanSchema,
) {}
