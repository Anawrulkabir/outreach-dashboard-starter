"use client";

import { useMemo, useState } from "react";
import { statusOf, ORDER, REPLY_TYPES, TIME_ZONE, today, iso, nice, parse, daysBetween } from "@/lib/status";

const firstEmail = (c) => c.email.split(",")[0].trim();
const gmailLink = (c) => (c.threadId ? `https://mail.google.com/mail/u/0/#all/${c.threadId}` : "");
const gmailSearch = (c) => `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(`to:${firstEmail(c)} OR from:${firstEmail(c)}`)}`;

export default function Dashboard({ initial, gmail }) {
  const [data, setData] = useState(initial);
  const [syncMsg, setSyncMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const now = today();

  const rows = useMemo(
    () => data.contacts.map((c) => ({ ...c, st: statusOf(c, now) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data]
  );

  async function save(id, patch) {
    setData((d) => ({ ...d, contacts: d.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
    const r = await fetch(`/api/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) alertSave();
  }
  function alertSave() {
    setSyncMsg("Could not save. Check the server.");
  }

  async function sync() {
    setBusy(true);
    setSyncMsg("Checking Gmail…");
    const r = await fetch("/api/sync", { method: "POST" });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setSyncMsg(j.error);
    setData(j.data);
    setSyncMsg(j.changes.length ? j.changes.join(" · ") : "No new replies.");
  }

  const count = (keys) => rows.filter((r) => keys.includes(r.st.key)).length;
  const sent = rows.filter((r) => r.sentDate).length;
  const replies = rows.filter((r) => r.replyDate || r.replyType).length;

  // "Do next": things needing action now, then upcoming dates.
  const todo = [];
  rows.filter((r) => r.st.key === "new-reply").forEach((r) => todo.push({ when: "Now", what: `Read and classify ${r.name}'s reply`, hot: true }));
  rows.filter((r) => r.st.key === "bounced").forEach((r) => todo.push({ when: "Now", what: `${r.name}: email bounced. Fix the address and resend.`, hot: true }));
  rows.filter((r) => r.st.key === "replied" && !r.st.done && r.replyType !== "Declined").forEach((r) => todo.push({ when: "Now", what: `${r.name}: ${r.st.next}`, hot: true }));
  const due = rows.filter((r) => r.st.key === "follow-up-due");
  if (due.length) todo.push({ when: "Today", what: `Follow up with ${due.map((r) => r.name).join(", ")}`, hot: true });
  const upcoming = {};
  rows.filter((r) => ["waiting", "followed-up"].includes(r.st.key) && r.st.due).forEach((r) => {
    const k = iso(r.st.due);
    (upcoming[k] ||= []).push(r);
  });
  Object.keys(upcoming).sort().forEach((k) => {
    const list = upcoming[k];
    const verb = list[0].st.key === "waiting" ? "Follow up with" : "Close if still silent:";
    todo.push({ when: nice(k), what: `${verb} ${list.map((r) => r.name.split(" ").slice(-1)[0]).join(", ")} (only if no reply)` });
  });
  data.waves.forEach((w) => {
    const left = rows.filter((r) => r.wave === w.wave && !r.sentDate).length;
    if (left) todo.push({ when: `Wave ${w.wave}`, what: `${w.plan} (${left} not sent)` });
  });

  return (
    <main>
      <header>
        <div>
          <h1>PhD Outreach</h1>
          <p className="muted">{now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</p>
        </div>
        {gmail ? (
          <button className="primary" onClick={sync} disabled={busy}>Check Gmail</button>
        ) : (
          <span className="muted small">Gmail sync off</span>
        )}
      </header>
      {(syncMsg || data.lastSync) && (
        <p className="sync small">{syncMsg || `Last Gmail check: ${new Date(data.lastSync).toLocaleString("en-GB", { timeZone: TIME_ZONE, dateStyle: "medium", timeStyle: "short" })}`}</p>
      )}

      <section className="stats">
        <Stat n={sent} label="Sent" />
        <Stat n={replies} label="Replies" accent={replies > 0} />
        <Stat n={count(["follow-up-due"])} label="Follow-ups due" accent={count(["follow-up-due"]) > 0} />
        <Stat n={count(["planned"])} label="Not sent" />
      </section>

      <section className="card">
        <h2>Do next</h2>
        <ol className="todo">
          {todo.map((t, i) => (
            <li key={i} className={t.hot ? "hot" : ""}>
              <span className="when">{t.when}</span>
              <span>{t.what}</span>
            </li>
          ))}
        </ol>
      </section>

      {data.waves.map((w) => {
        const list = rows.filter((r) => r.wave === w.wave).sort((a, b) => ORDER.indexOf(a.st.key) - ORDER.indexOf(b.st.key));
        const sentN = list.filter((r) => r.sentDate).length;
        return (
          <details key={w.wave} className="wave" open={w.wave < 3}>
            <summary>
              <h2>{w.title}</h2>
              <span className="muted small">{sentN}/{list.length} sent</span>
            </summary>
            <p className="muted small plan">{w.plan}</p>
            {list.map((c) => (
              <Contact key={c.id} c={c} now={now} save={save} />
            ))}
          </details>
        );
      })}

      <section className="card small">
        <h2>Reply playbook</h2>
        <dl className="play">
          <dt>Interested</dt><dd>Reply within 24 hours with the small first task and a call time.</dd>
          <dt>Send more</dt><dd>Send exactly what they asked for within 48 hours.</dd>
          <dt>No room, try X</dt><dd>Thank them, then email X and mention who referred you.</dd>
          <dt>Declined</dt><dd>Two-line thank-you. Close it.</dd>
          <dt>No reply</dt><dd>One follow-up after 12 days, in the same thread. Close 14 days later.</dd>
        </dl>
      </section>
    </main>
  );
}

function Stat({ n, label, accent }) {
  return (
    <div className={"stat" + (accent ? " accent" : "")}>
      <b>{n}</b>
      <span>{label}</span>
    </div>
  );
}

function Contact({ c, now, save }) {
  const { st } = c;
  const sent = parse(c.sentDate);
  const t = iso(now);
  return (
    <details className={`contact s-${st.key}`}>
      <summary>
        <div className="who">
          <strong>{c.name}</strong>
          <span className="muted small">{c.university}</span>
        </div>
        <span className={`pill p-${st.key}`}>{st.label}</span>
      </summary>
      <div className="meta small">
        {sent ? <span>Sent {nice(sent)} · day {daysBetween(sent, now)}</span> : <span>Not sent yet</span>}
        {c.followUpSent && <span>Follow-up {nice(c.followUpSent)}</span>}
        {c.replyDate && <span>Reply {nice(c.replyDate)}</span>}
      </div>
      <p className="next">→ {st.next}</p>

      <div className="body">
        <p className="small"><span className="muted">Paper: </span>{c.paper}</p>
        {c.subject && <p className="small"><span className="muted">Subject: </span>{c.subject}</p>}
        <p className="small links">
          <a href={`mailto:${firstEmail(c)}`}>{firstEmail(c)}</a>
          {c.website && <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer">Lab site</a>}
          {gmailLink(c) ? (
            <a href={gmailLink(c)} target="_blank" rel="noreferrer">Open in Gmail</a>
          ) : (
            c.sentDate && <a href={gmailSearch(c)} target="_blank" rel="noreferrer">Find in Gmail</a>
          )}
        </p>

        <div className="actions">
          {!c.sentDate && <button onClick={() => save(c.id, { sentDate: t })}>Mark sent today</button>}
          {c.sentDate && !c.replyDate && !c.replyType && !c.followUpSent && !c.bounced && (
            <button onClick={() => save(c.id, { followUpSent: t })}>Follow-up sent today</button>
          )}
          {c.bounced && !c.replyType && (
            <button onClick={() => save(c.id, { bounced: "", threadId: "", sentDate: t, followUpSent: "" })}>Resent today</button>
          )}
          {c.sentDate && !c.replyDate && <button onClick={() => save(c.id, { replyDate: t })}>Got a reply</button>}
          {c.sentDate && (
            <select value={c.replyType} onChange={(e) => save(c.id, { replyType: e.target.value, replyDate: c.replyDate || t })}>
              <option value="">Reply type…</option>
              {REPLY_TYPES.map((r) => <option key={r}>{r}</option>)}
            </select>
          )}
          {c.replyType && !c.handled && <button onClick={() => save(c.id, { handled: t })}>Handled</button>}
        </div>

        <textarea
          key={c.notes}
          defaultValue={c.notes}
          placeholder="Notes (what they said, what you promised, dates)"
          onBlur={(e) => e.target.value !== c.notes && save(c.id, { notes: e.target.value })}
        />

        <details className="fix small">
          <summary>Edit details</summary>
          {[["sentDate", "Sent"], ["followUpSent", "Follow-up sent"], ["replyDate", "Reply received"], ["handled", "Reply handled"]].map(([k, l]) => (
            <label key={k}>
              {l}
              <input type="date" value={c[k] || ""} onChange={(e) => save(c.id, { [k]: e.target.value })} />
            </label>
          ))}
          {[["email", "Email"], ["threadId", "Gmail thread ID"]].map(([k, l]) => (
            <label key={k}>
              {l}
              <input key={c[k]} defaultValue={c[k] || ""} onBlur={(e) => e.target.value.trim() !== (c[k] || "") && save(c.id, { [k]: e.target.value.trim() })} />
            </label>
          ))}
        </details>
      </div>
    </details>
  );
}
