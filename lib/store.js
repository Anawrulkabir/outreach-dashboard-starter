import { promises as fs } from "fs";
import path from "path";

const FILE = process.env.DATA_FILE || path.join(process.cwd(), "data", "outreach.json");

export async function readData() {
  return JSON.parse(await fs.readFile(FILE, "utf8"));
}

export async function writeData(data) {
  const tmp = FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, FILE);
}

const EDITABLE = ["sentDate", "followUpSent", "replyDate", "replyType", "notes", "threadId", "subject"];

export async function updateContact(id, patch) {
  const data = await readData();
  const c = data.contacts.find((x) => x.id === id);
  if (!c) return null;
  for (const k of EDITABLE) if (k in patch) c[k] = String(patch[k] ?? "");
  await writeData(data);
  return c;
}
