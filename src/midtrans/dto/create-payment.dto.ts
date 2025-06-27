import { createZodDto } from "@anatine/zod-nestjs";
import { z } from "zod";

export const CreatePaymentSchema = z.object({
    order_id: z.string().min(1),
    customerName: z.string().min(1),
    customerEmail: z.string().email(),
    customerPhone: z.string().min(8),
    totalAmount: z.number().positive(),
    items: z.array(
        z.object({
        name: z.string().min(1),
        quantity: z.number().int().positive(),
        price: z.number().int().positive(),
        }),
    ),
})

export class CreatePaymentDto extends createZodDto(CreatePaymentSchema) {}