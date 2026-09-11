import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { vehicleProfileInputSchema } from "@/lib/validation/vehicle-profile-schema";

export const prerender = false;

interface VehicleProfileRow {
  id: string;
  label: string;
  length: number;
  width: number;
  height: number;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonResponse({ error: "Supabase is not configured" }, 500);
  }

  const { data, error } = await supabase
    .from("vehicle_profiles")
    .select("id, label, length, width, height")
    .order("created_at", { ascending: false })
    .overrideTypes<VehicleProfileRow[], { merge: false }>();

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

  const parsed = vehicleProfileInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: "Validation failed", issues: z.treeifyError(parsed.error) }, 400);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonResponse({ error: "Supabase is not configured" }, 500);
  }

  const { data, error } = await supabase
    .from("vehicle_profiles")
    .insert({ ...parsed.data, user_id: context.locals.user.id })
    .select("id, label, length, width, height")
    .single()
    .overrideTypes<VehicleProfileRow, { merge: false }>();

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse(data, 201);
};
