import { CreateCabangSchema } from 'src/cabang/dto/create-cabang.dto';
import { createZodDto } from '@anatine/zod-nestjs';

export const UpdateKetersediaanSchema = CreateCabangSchema.partial();

export class UpdateKetersediaanDto extends createZodDto(UpdateKetersediaanSchema) {}
