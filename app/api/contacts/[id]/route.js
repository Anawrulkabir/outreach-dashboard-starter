import { updateContact } from "@/lib/store";

export async function PATCH(req, { params }) {
  const { id } = await params;
  const patch = await req.json().catch(() => null);
  if (!patch || typeof patch !== "object") return Response.json({ error: "Bad request" }, { status: 400 });
  const c = await updateContact(id, patch);
  if (!c) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(c);
}
