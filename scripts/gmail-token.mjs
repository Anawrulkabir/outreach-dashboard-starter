// Get a Gmail refresh token for the dashboard's read-only sync.
// Run on your own computer (it opens a browser sign-in):
//
//   GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... node scripts/gmail-token.mjs
//
// The client must be a Google Cloud OAuth client of type "Desktop app".
// Prints GMAIL_REFRESH_TOKEN for your server's .env. See README, "Gmail sync".
import http from "node:http";

const id = process.env.GMAIL_CLIENT_ID;
const secret = process.env.GMAIL_CLIENT_SECRET;
if (!id || !secret) {
  console.error("Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET first.");
  process.exit(1);
}

const PORT = 53682;
const redirect = `http://127.0.0.1:${PORT}`;
const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: id,
    redirect_uri: redirect,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    access_type: "offline",
    prompt: "consent",
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, redirect);
  const code = url.searchParams.get("code");
  if (!code) {
    res.end(url.searchParams.get("error") || "No code in the reply.");
    return;
  }
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: "authorization_code" }),
  });
  const j = await r.json();
  if (!j.refresh_token) {
    res.end("Failed. See the terminal.");
    console.error("No refresh token returned:", j);
  } else {
    res.end("Done. You can close this tab and go back to the terminal.");
    console.log("\nAdd this to the server's .env:\n");
    console.log(`GMAIL_REFRESH_TOKEN=${j.refresh_token}\n`);
  }
  server.close();
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("Open this link, sign in as the Gmail account you send from, and allow read-only access:\n");
  console.log(authUrl + "\n");
});
