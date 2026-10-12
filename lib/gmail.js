// Optional Gmail sync (read-only). Needs GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET,
// GMAIL_REFRESH_TOKEN and GMAIL_ADDRESS in the environment. See README.
import { readData, writeData } from "./store";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export function gmailConfigured() {
  return Boolean(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN && process.env.GMAIL_ADDRESS);
}

async function token() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!r.ok) throw new Error("Google sign-in failed: " + (await r.text()));
  return (await r.json()).access_token;
}

async function get(path, t) {
  const r = await fetch(API + path, { headers: { Authorization: "Bearer " + t } });
  if (!r.ok) throw new Error(`Gmail ${r.status}: ${await r.text()}`);
  return r.json();
}

const header = (m, name) => (m.payload?.headers || []).find((h) => h.name.toLowerCase() === name)?.value || "";
const day = (m) => new Date(Number(m.internalDate)).toISOString().slice(0, 10);

export async function syncReplies() {
  const me = process.env.GMAIL_ADDRESS.toLowerCase();
  const t = await token();
  const data = await readData();
  const changes = [];

  for (const c of data.contacts) {
    // 1. Find the sent email if we don't know the thread yet.
    if (!c.threadId && c.email) {
      const to = c.email.split(",")[0].trim();
      const found = await get(`/messages?maxResults=1&q=${encodeURIComponent(`in:sent to:${to}`)}`, t);
      const hit = found.messages?.[0];
      if (!hit) continue;
      const m = await get(`/messages/${hit.id}?format=metadata&metadataHeaders=Subject`, t);
      c.threadId = hit.threadId;
      c.subject = c.subject || header(m, "subject");
      c.sentDate = c.sentDate || day(m);
      changes.push(`${c.name}: found sent email`);
    }
    if (!c.threadId) continue;

    // 2. Read the thread: their messages = replies, my 2nd message = follow-up.
    const th = await get(`/threads/${c.threadId}?format=metadata&metadataHeaders=From`, t);
    const msgs = (th.messages || []).sort((a, b) => a.internalDate - b.internalDate);
    const mine = msgs.filter((m) => header(m, "from").toLowerCase().includes(me));
    const theirs = msgs.filter((m) => !header(m, "from").toLowerCase().includes(me));

    if (mine.length > 1 && !c.followUpSent) {
      c.followUpSent = day(mine[1]);
      changes.push(`${c.name}: follow-up detected`);
    }
    const reply = theirs[0];
    if (reply && !c.replyDate) {
      const from = header(reply, "from");
      c.replyDate = day(reply);
      if (/mailer-daemon|postmaster/i.test(from)) {
        c.notes = (c.notes ? c.notes + "\n" : "") + `Bounced on ${c.replyDate}. Check the address.`;
        changes.push(`${c.name}: bounced`);
      } else {
        changes.push(`${c.name}: new reply`);
      }
    }
  }
  data.lastSync = new Date().toISOString();
  await writeData(data);
  return { changes, data };
}
