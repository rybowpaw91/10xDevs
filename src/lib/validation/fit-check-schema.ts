import { z } from "zod";

export const TOTAL_UNIT_CAP = 200;

export const goodsItemSchema = z.object({
  id: z.string().min(1),
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  quantity: z.number().int().min(1),
  rotatable: z.boolean(),
  stackable: z.boolean(),
});

export const vehicleDimensionsSchema = z.object({
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const fitCheckRequestSchema = z
  .object({
    items: z.array(goodsItemSchema).min(1),
    vehicle: vehicleDimensionsSchema,
  })
  .refine((data) => data.items.reduce((sum, item) => sum + item.quantity, 0) <= TOTAL_UNIT_CAP, {
    message: `Total quantity across all items must not exceed ${TOTAL_UNIT_CAP} units.`,
    path: ["items"],
  });

export type FitCheckRequestInput = z.infer<typeof fitCheckRequestSchema>;
