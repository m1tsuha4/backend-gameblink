import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';

export const CreateCategorySchema = z.object({
  name: z
    .string()
    .min(3, { message: 'Category must be at least 3 characters' }),
});

export class CreateCategoryDto extends createZodDto(CreateCategorySchema) {}
