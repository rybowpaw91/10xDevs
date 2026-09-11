import { z } from "zod";
import { vehicleDimensionsSchema } from "@/lib/validation/fit-check-schema";

export const vehicleProfileInputSchema = vehicleDimensionsSchema.extend({
  label: z.string().min(1),
});

export type VehicleProfileInput = z.infer<typeof vehicleProfileInputSchema>;
