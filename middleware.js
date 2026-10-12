// Simple password lock. Set DASHBOARD_PASSWORD on the server to turn it on.
export function middleware(req) {
  const pass = process.env.DASHBOARD_PASSWORD;
  if (!pass) return;
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Basic ")) {
    const [, given] = atob(auth.slice(6)).split(":");
    if (given === pass) return;
  }
  return new Response("Password required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Outreach"' } });
}
export const config = { matcher: "/((?!_next/static|favicon.ico).*)" };
