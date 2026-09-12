import { z } from "zod";
import { vehicleDimensionsSchema } from "@/lib/validation/fit-check-schema";

export const vehicleProfileInputSchema = vehicleDimensionsSchema.extend({
  label: z.string().min(1),
  maxPayload: z.number().positive(),
});

export type VehicleProfileInput = z.infer<typeof vehicleProfileInputSchema>;
