import { createZodDto } from '@anatine/zod-nestjs';
import { CreateUnitSchema } from './create-unit.dto';

export const UpdateUnitSchema = CreateUnitSchema.partial();

export class UpdateUnitDto extends createZodDto(UpdateUnitSchema) {}
