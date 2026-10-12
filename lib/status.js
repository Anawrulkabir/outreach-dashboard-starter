export const FOLLOW_UP_DAYS = 12; // same as the tracker's Weights tab
export const CLOSE_AFTER_DAYS = 14; // after the follow-up

export const REPLY_TYPES = ["Interested", "Send more", "No room - try X", "Declined"];

const NEXT_FOR_REPLY = {
  Interested: "Reply within 24 hours. Propose the small first task and offer a call time.",
  "Send more": "Send exactly what they asked for within 48 hours.",
  "No room - try X": "Thank them, then email the person they suggested and mention who referred you.",
  Declined: "Send a two-line thank-you. Close this one.",
};

export function today() {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}
export function parse(s) {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function addDays(date, n) {
  return new Date(date.getTime() + n * 86400000);
}
export function iso(date) {
  return date ? date.toISOString().slice(0, 10) : "";
}
export function nice(s) {
  const d = typeof s === "string" ? parse(s) : s;
  if (!d) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
export function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

// Returns { key, label, next, due } for one contact.
export function statusOf(c, now = today()) {
  const sent = parse(c.sentDate);
  if (!sent) {
    return { key: "planned", label: "Not sent", next: "Read the paper yourself, draft the email, then send.", due: null };
  }
  if (c.replyType) {
    return { key: "replied", label: c.replyType, next: NEXT_FOR_REPLY[c.replyType] || "Reply to them.", due: null };
  }
  if (c.replyDate) {
    return { key: "new-reply", label: "New reply", next: "Read the reply and pick its type below.", due: null };
  }
  const fu = parse(c.followUpSent);
  if (fu) {
    const close = addDays(fu, CLOSE_AFTER_DAYS);
    if (now >= close) return { key: "closed", label: "No reply", next: "Close it. No more emails to this professor.", due: null };
    return { key: "followed-up", label: "Followed up", next: `Wait. Close it on ${nice(close)} if there is still no reply.`, due: close };
  }
  const due = addDays(sent, FOLLOW_UP_DAYS);
  if (now >= due) return { key: "follow-up-due", label: "Follow-up due", next: "Send one short follow-up in the same thread today.", due };
  return { key: "waiting", label: "Waiting", next: `Wait. Follow up on ${nice(due)} if no reply.`, due };
}

export const ORDER = ["new-reply", "follow-up-due", "replied", "waiting", "followed-up", "planned", "closed"];
