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
  const parsedId = idSchema.safeParse(context.params.id);
  if (!parsedId.success) {
    return jsonResponse({ error: "Invalid profile id." }, 400);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonResponse({ error: "Supabase is not configured" }, 500);
  }

  const { data, error } = await supabase
    .from("vehicle_profiles")
    .delete()
    .eq("id", parsedId.data)
    .select("id")
    .overrideTypes<{ id: string }[], { merge: false }>();

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  if (data.length === 0) {
    return jsonResponse({ error: "Profile not found." }, 404);
  }

  return new Response(null, { status: 204 });
};
