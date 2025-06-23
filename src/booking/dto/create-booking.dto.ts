import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const CreateBookingSchema = z.object({
  nama: z.string().min(3).max(100),
  nomor_hp: z.string().min(3).max(100),
  email: z.string().min(3).max(100),
  cabang_id: z.string().uuid().optional(),
  unit_id: z.string().uuid().optional(),
  tanggal_main: z.string(),
  jam_main: z.string(),
  tanggal_transaksi: z.string(),
  metode_pembayaran: z.string(),
  total_harga: z.number().min(1),
  status_pembayaran: z.enum(['Berhasil', 'Gagal', 'Pending']),
  status_booking: z.enum(['Aktif', 'Selesai', 'Dibatalkan']),
});

export class CreateBookingDto extends createZodDto(CreateBookingSchema) {}
