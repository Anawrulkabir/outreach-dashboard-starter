import { readData } from "@/lib/store";
import { gmailConfigured } from "@/lib/gmail";
import Dashboard from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await readData();
  return <Dashboard initial={data} gmail={gmailConfigured()} />;
}
