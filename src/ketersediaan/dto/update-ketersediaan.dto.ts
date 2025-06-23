import { createZodDto } from '@anatine/zod-nestjs';
import { CreateKetersediaanSchema } from './create-ketersediaan.dto';

export const UpdateKetersediaanSchema = CreateKetersediaanSchema.partial();

export class UpdateKetersediaanDto extends createZodDto(
  UpdateKetersediaanSchema,
) {}
