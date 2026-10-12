// Optional Gmail sync (read-only). Needs GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET,
// GMAIL_REFRESH_TOKEN and GMAIL_ADDRESS in the environment. See README.
import { readData, writeData, withLock } from "./store";
import { localISO } from "./status";

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
// Calendar day in the server's time zone (set TZ=Asia/Dhaka), not UTC.
const day = (m) => localISO(new Date(Number(m.internalDate)));

export function syncReplies() {
  return withLock(runSync);
}

async function runSync() {
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
      c.threadId = hit.threadId;
      changes.push(`${c.name}: found sent email`);
    }
    if (!c.threadId) continue;

    // 2. Read the thread: my 1st message = sent, my 2nd = follow-up, theirs = reply.
    const th = await get(`/threads/${c.threadId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`, t);
    const msgs = (th.messages || []).sort((a, b) => Number(a.internalDate) - Number(b.internalDate));
    const mine = msgs.filter((m) => header(m, "from").toLowerCase().includes(me));
    const theirs = msgs.filter((m) => !header(m, "from").toLowerCase().includes(me));

    if (mine[0]) {
      if (!c.sentDate) c.sentDate = day(mine[0]);
      if (!c.subject) c.subject = header(mine[0], "subject");
    }

    if (mine.length > 1 && !c.followUpSent) {
      c.followUpSent = day(mine[1]);
      changes.push(`${c.name}: follow-up detected`);
    }
    // Only count messages after the current send (so a bounce from an old
    // address is ignored once you have resent).
    const since = c.sentDate || "";
    const isBounce = (m) => /mailer-daemon|postmaster/i.test(header(m, "from"));
    const bounce = theirs.find((m) => isBounce(m) && day(m) >= since);
    const reply = theirs.find((m) => !isBounce(m));
    if (reply && !c.replyDate) {
      c.replyDate = day(reply);
      changes.push(`${c.name}: new reply`);
    } else if (bounce && !c.bounced && !c.replyDate) {
      c.bounced = day(bounce);
      changes.push(`${c.name}: bounced`);
    }
  }
  data.lastSync = new Date().toISOString();
  await writeData(data);
  return { changes, data };
}
