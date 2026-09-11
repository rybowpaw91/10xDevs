import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const idSchema = z.uuid();

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
