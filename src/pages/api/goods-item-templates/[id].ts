import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { goodsItemTemplateInputSchema } from "@/lib/validation/goods-item-template-schema";

export const prerender = false;

const idSchema = z.uuid();

interface GoodsItemTemplateRow {
  id: string;
  label: string;
  length: number;
  width: number;
  height: number;
  weight: number | null;
  rotatable: boolean;
  stackable: boolean;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const DELETE: APIRoute = async (context) => {
  if (!context.locals.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const parsedId = idSchema.safeParse(context.params.id);
  if (!parsedId.success) {
    return jsonResponse({ error: "Invalid template id." }, 400);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonResponse({ error: "Supabase is not configured" }, 500);
  }

  const { data, error } = await supabase
    .from("goods_item_templates")
    .delete()
    .eq("id", parsedId.data)
    .select("id")
    .overrideTypes<{ id: string }[], { merge: false }>();

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  if (data.length === 0) {
    return jsonResponse({ error: "Template not found." }, 404);
  }

  return new Response(null, { status: 204 });
};

export const PATCH: APIRoute = async (context) => {
  if (!context.locals.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const parsedId = idSchema.safeParse(context.params.id);
  if (!parsedId.success) {
    return jsonResponse({ error: "Invalid template id." }, 400);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const parsed = goodsItemTemplateInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: "Validation failed", issues: z.treeifyError(parsed.error) }, 400);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonResponse({ error: "Supabase is not configured" }, 500);
  }

  const { data, error } = await supabase
    .from("goods_item_templates")
    .update(parsed.data)
    .eq("id", parsedId.data)
    .select("id, label, length, width, height, weight, rotatable, stackable")
    .overrideTypes<GoodsItemTemplateRow[], { merge: false }>();

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  if (data.length === 0) {
    return jsonResponse({ error: "Template not found." }, 404);
  }

  return jsonResponse(data[0], 200);
};
