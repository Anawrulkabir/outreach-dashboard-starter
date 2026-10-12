// The Docker build sets STANDALONE=1 to get a small self-contained server.
// A plain `npm run build && npm start` (PM2) uses the normal output.
export default process.env.STANDALONE ? { output: "standalone" } : {};
