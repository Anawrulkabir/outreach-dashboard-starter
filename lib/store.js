import { promises as fs } from "fs";
import path from "path";
import seed from "@/data/seed.json";

// Two storage backends, picked automatically:
// - Upstash Redis when its REST keys are set (Vercel). The whole dashboard is
//   one JSON value under one key.
// - Otherwise a JSON file (local dev, VPS, Docker).
// Either way the data starts as a copy of data/seed.json.

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_KEY = process.env.REDIS_KEY || "outreach";
const FILE = process.env.DATA_FILE || path.join(process.cwd(), "data", "outreach.json");

export const storage = REDIS_URL && REDIS_TOKEN ? "redis" : "file";

async function redis(...command) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`Redis ${r.status}: ${j.error || "request failed"}`);
  return j.result;
}

async function load() {
  if (storage === "redis") {
    const v = await redis("GET", REDIS_KEY);
    return v ? JSON.parse(v) : null;
  }
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

export async function writeData(data) {
  if (storage === "redis") {
    await redis("SET", REDIS_KEY, JSON.stringify(data));
    return;
  }
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, FILE);
}

export async function readData() {
  const data = await load();
  if (data) return data;
  const fresh = structuredClone(seed);
  await writeData(fresh);
  return fresh;
}

// Run read-modify-write jobs one at a time within this server process.
// (On Vercel each request may run separately; edits are small and quick, and
// the Gmail sync re-reads just before writing, so clashes are very unlikely.)
let queue = Promise.resolve();
export function withLock(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

export const EDITABLE = ["sentDate", "followUpSent", "replyDate", "replyType", "notes", "threadId", "subject", "bounced", "email", "handled"];

// patches: { [contactId]: { field: value } }. Reads the latest data, applies
// only the given fields, and saves. Returns the saved data.
export function applyPatches(patches, extra = {}) {
  return withLock(async () => {
    const data = await readData();
    for (const c of data.contacts) {
      const p = patches[c.id];
      if (!p) continue;
      for (const k of EDITABLE) if (k in p) c[k] = String(p[k] ?? "").trim();
    }
    Object.assign(data, extra);
    await writeData(data);
    return data;
  });
}

export async function updateContact(id, patch) {
  const data = await applyPatches({ [id]: patch });
  return data.contacts.find((x) => x.id === id) || null;
}
