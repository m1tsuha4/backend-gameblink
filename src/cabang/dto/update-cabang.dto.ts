import { CreateCabangSchema } from './create-cabang.dto';
import { createZodDto } from '@anatine/zod-nestjs';

export const UpdateCabangSchema = CreateCabangSchema.partial();

export class UpdateCabangDto extends createZodDto(UpdateCabangSchema) {}
