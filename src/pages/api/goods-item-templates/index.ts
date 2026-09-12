import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { goodsItemTemplateInputSchema } from "@/lib/validation/goods-item-template-schema";

export const prerender = false;

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

export const GET: APIRoute = async (context) => {
  if (!context.locals.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonResponse({ error: "Supabase is not configured" }, 500);
  }

  const { data, error } = await supabase
    .from("goods_item_templates")
    .select("id, label, length, width, height, weight, rotatable, stackable")
    .order("created_at", { ascending: false })
    .overrideTypes<GoodsItemTemplateRow[], { merge: false }>();

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse(data, 200);
};

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
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
    .insert({ ...parsed.data, user_id: context.locals.user.id })
    .select("id, label, length, width, height, weight, rotatable, stackable")
    .single()
    .overrideTypes<GoodsItemTemplateRow, { merge: false }>();

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse(data, 201);
};
