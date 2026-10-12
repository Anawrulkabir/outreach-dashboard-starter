// Simple password lock. Set DASHBOARD_PASSWORD on the server to turn it on.
// Any username works; only the password is checked.
export function middleware(req) {
  const pass = process.env.DASHBOARD_PASSWORD;
  if (!pass) {
    // A Vercel URL is public, so never serve the data there without a password.
    if (process.env.VERCEL) return new Response("Set DASHBOARD_PASSWORD in Vercel, then redeploy.", { status: 503 });
    return;
  }
  const auth = req.headers.get("authorization") || "";
  // Let the daily Vercel cron through; the sync route checks the same secret.
  const cron = process.env.CRON_SECRET;
  if (cron && req.nextUrl.pathname === "/api/sync" && auth === `Bearer ${cron}`) return;
  if (auth.startsWith("Basic ")) {
    let decoded = "";
    try {
      decoded = atob(auth.slice(6));
    } catch {}
    const given = decoded.slice(decoded.indexOf(":") + 1);
    if (decoded.includes(":") && given === pass) return;
  }
  return new Response("Password required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Outreach", charset="UTF-8"' } });
}
export const config = { matcher: "/((?!_next/static|favicon.ico).*)" };
