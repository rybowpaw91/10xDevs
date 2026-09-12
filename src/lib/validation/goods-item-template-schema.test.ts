import { describe, expect, it } from "vitest";
import { goodsItemTemplateInputSchema } from "./goods-item-template-schema";

describe("goodsItemTemplateInputSchema", () => {
  it("accepts valid input", () => {
    const result = goodsItemTemplateInputSchema.safeParse({
      label: "Pallet box",
      length: 120,
      width: 80,
      height: 60,
      weight: 25,
      rotatable: true,
      stackable: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing label", () => {
    const result = goodsItemTemplateInputSchema.safeParse({
      length: 120,
      width: 80,
      height: 60,
      weight: 25,
      rotatable: true,
      stackable: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty label", () => {
    const result = goodsItemTemplateInputSchema.safeParse({
      label: "",
      length: 120,
      width: 80,
      height: 60,
      weight: 25,
      rotatable: true,
      stackable: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive dimension", () => {
    const result = goodsItemTemplateInputSchema.safeParse({
      label: "Pallet box",
      length: 0,
      width: 80,
      height: 60,
      weight: 25,
      rotatable: true,
      stackable: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative dimension", () => {
    const result = goodsItemTemplateInputSchema.safeParse({
      label: "Pallet box",
      length: 120,
      width: -80,
      height: 60,
      weight: 25,
      rotatable: true,
      stackable: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-boolean rotatable flag", () => {
    const result = goodsItemTemplateInputSchema.safeParse({
      label: "Pallet box",
      length: 120,
      width: 80,
      height: 60,
      weight: 25,
      rotatable: "yes",
      stackable: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing weight", () => {
    const result = goodsItemTemplateInputSchema.safeParse({
      label: "Pallet box",
      length: 120,
      width: 80,
      height: 60,
      rotatable: true,
      stackable: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive weight", () => {
    const result = goodsItemTemplateInputSchema.safeParse({
      label: "Pallet box",
      length: 120,
      width: 80,
      height: 60,
      weight: 0,
      rotatable: true,
      stackable: false,
    });
    expect(result.success).toBe(false);
  });
});
