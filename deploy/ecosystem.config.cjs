// PM2 config. From the project folder:
//   npm ci && npm run build && pm2 start deploy/ecosystem.config.cjs && pm2 save
// Secrets (password, Gmail keys) go in .env, which Next.js loads at start.
module.exports = {
  apps: [
    {
      name: "outreach",
      cwd: __dirname + "/..",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      env: { NODE_ENV: "production", TZ: "Asia/Dhaka" },
      max_memory_restart: "300M",
    },
  ],
};
