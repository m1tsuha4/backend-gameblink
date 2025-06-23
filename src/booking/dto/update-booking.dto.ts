import { createZodDto } from '@anatine/zod-nestjs';
import { CreateBookingSchema } from './create-booking.dto';

export const UpdateBookingSchema = CreateBookingSchema.partial();

export class UpdateBookingDto extends createZodDto(UpdateBookingSchema) {}
