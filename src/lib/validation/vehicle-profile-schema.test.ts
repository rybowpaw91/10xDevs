import { describe, expect, it } from "vitest";
import { vehicleProfileInputSchema } from "./vehicle-profile-schema";

describe("vehicleProfileInputSchema", () => {
  it("accepts valid input", () => {
    const result = vehicleProfileInputSchema.safeParse({
      label: "My van",
      length: 250,
      width: 160,
      height: 135,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing label", () => {
    const result = vehicleProfileInputSchema.safeParse({
      length: 250,
      width: 160,
      height: 135,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty label", () => {
    const result = vehicleProfileInputSchema.safeParse({
      label: "",
      length: 250,
      width: 160,
      height: 135,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive dimension", () => {
    const result = vehicleProfileInputSchema.safeParse({
      label: "My van",
      length: 0,
      width: 160,
      height: 135,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative dimension", () => {
    const result = vehicleProfileInputSchema.safeParse({
      label: "My van",
      length: 250,
      width: -160,
      height: 135,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric dimension", () => {
    const result = vehicleProfileInputSchema.safeParse({
      label: "My van",
      length: "250",
      width: 160,
      height: 135,
    });
    expect(result.success).toBe(false);
  });
});
