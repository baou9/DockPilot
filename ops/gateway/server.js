import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { spawn } from "node:child_process";

const PORT = process.env.PORT || 8080;
const API_PORT = process.env.API_PORT || 3001;
const UI_PORT = process.env.UI_PORT || 3000;

const apiProc = spawn("node", ["/app/api/build/index.js"], {
  env: { ...process.env, PORT: API_PORT },
  stdio: "inherit"
});

const uiProc = spawn("node", ["/app/ui/.output/server/index.mjs"], {
  env: {
    ...process.env,
    PORT: UI_PORT,
    NITRO_PORT: UI_PORT,
    HOST: "0.0.0.0",
    NITRO_HOST: "0.0.0.0"
  },
  stdio: "inherit"
});

const handleExit = (name, code, signal) => {
  const reason = signal ? `signal ${signal}` : `code ${code}`;
  console.error(`${name} process exited with ${reason}`);
  stopChildren("SIGTERM");
  process.exit(code ?? 1);
};

apiProc.on("exit", (code, signal) => handleExit("API", code, signal));
uiProc.on("exit", (code, signal) => handleExit("UI", code, signal));
apiProc.on("error", (error) => {
  console.error("API process failed to start", error);
  stopChildren("SIGTERM");
  process.exit(1);
});
uiProc.on("error", (error) => {
  console.error("UI process failed to start", error);
  stopChildren("SIGTERM");
  process.exit(1);
});

const stopChildren = signal => {
  if (apiProc.pid) {
    apiProc.kill(signal);
  }
  if (uiProc.pid) {
    uiProc.kill(signal);
  }
};

process.on("SIGTERM", () => stopChildren("SIGTERM"));
process.on("SIGINT", () => stopChildren("SIGINT"));

const app = express();

app.get("/healthz", (_req, res) => res.status(200).send("ok"));

app.use("/api", createProxyMiddleware({
  target: `http://127.0.0.1:${API_PORT}`,
  changeOrigin: true,
  pathRewrite: { "^/api": "" }
}));

app.use("/", createProxyMiddleware({
  target: `http://127.0.0.1:${UI_PORT}`,
  changeOrigin: true
}));

app.listen(PORT, () => {
  console.log(`Gateway listening on :${PORT} (UI on :${UI_PORT}, API on :${API_PORT})`);
});
