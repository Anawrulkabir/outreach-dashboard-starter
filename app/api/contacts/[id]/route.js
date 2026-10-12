import { updateContact } from "@/lib/store";

export async function PATCH(req, { params }) {
  const { id } = await params;
  const c = await updateContact(id, await req.json());
  if (!c) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(c);
}
