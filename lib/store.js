import { promises as fs } from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "data");
const FILE = process.env.DATA_FILE || path.join(DIR, "outreach.json");
const SEED = process.env.SEED_FILE || path.join(DIR, "seed.json");

// The live file is not in git. On first run it is copied from data/seed.json,
// so a `git pull` on the server never overwrites your edits.
export async function readData() {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    const seed = JSON.parse(await fs.readFile(SEED, "utf8"));
    await writeData(seed);
    return seed;
  }
}

export async function writeData(data) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, FILE);
}

// Run read-modify-write jobs one at a time so a Gmail sync and a button
// click landing together cannot overwrite each other.
let queue = Promise.resolve();
export function withLock(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

const EDITABLE = ["sentDate", "followUpSent", "replyDate", "replyType", "notes", "threadId", "subject", "bounced", "email", "handled"];

export function updateContact(id, patch) {
  return withLock(async () => {
    const data = await readData();
    const c = data.contacts.find((x) => x.id === id);
    if (!c) return null;
    for (const k of EDITABLE) if (k in patch) c[k] = String(patch[k] ?? "").trim();
    await writeData(data);
    return c;
  });
}
