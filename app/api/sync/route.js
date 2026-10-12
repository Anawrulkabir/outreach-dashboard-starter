import { gmailConfigured, syncReplies } from "@/lib/gmail";

export async function POST() {
  if (!gmailConfigured()) return Response.json({ error: "Gmail sync is not set up. See README." }, { status: 400 });
  try {
    return Response.json(await syncReplies());
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 500 });
  }
}
