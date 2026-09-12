import { z } from "zod";
import { goodsItemSchema } from "@/lib/validation/fit-check-schema";

export const goodsItemTemplateInputSchema = goodsItemSchema
  .pick({ length: true, width: true, height: true, weight: true, rotatable: true, stackable: true })
  .extend({
    label: z.string().min(1),
  });

export type GoodsItemTemplateInput = z.infer<typeof goodsItemTemplateInputSchema>;
