// Simple password lock. Set DASHBOARD_PASSWORD on the server to turn it on.
// Any username works; only the password is checked.
export function middleware(req) {
  const pass = process.env.DASHBOARD_PASSWORD;
  if (!pass) return;
  const auth = req.headers.get("authorization") || "";
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
