import { gmailConfigured, syncReplies } from "@/lib/gmail";

export const maxDuration = 60; // seconds; Gmail sync makes many small requests

async function run(full) {
  if (!gmailConfigured()) return Response.json({ error: "Gmail sync is not set up. See README." }, { status: 400 });
  try {
    const result = await syncReplies();
    return Response.json(full ? result : { changes: result.changes });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 500 });
  }
}

// "Check Gmail" button (behind the password lock).
export async function POST() {
  return run(true);
}

// Daily Vercel cron (vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET".
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return run(false);
}
