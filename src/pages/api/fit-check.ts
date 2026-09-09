import type { APIRoute } from "astro";
import { z } from "zod";
import { runFitCheck } from "@/lib/services/packing/packer";
import { fitCheckRequestSchema } from "@/lib/validation/fit-check-schema";

export const prerender = false;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async (context) => {
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const parsed = fitCheckRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: "Validation failed", issues: z.treeifyError(parsed.error) }, 400);
  }

  const result = runFitCheck(parsed.data);
  return jsonResponse(result, 200);
};
