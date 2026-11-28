const path = require("node:path");

const cwd = __dirname;
const log = (name) => path.join(cwd, "logs", name);
const common = {
  cwd,
  interpreter: "node",
  autorestart: true,
  min_uptime: "10s",
  max_restarts: 10,
  restart_delay: 2_000,
  kill_timeout: 10_000,
  time: true,
};

module.exports = {
  apps: [
    {
      ...common,
      name: "nexus-web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "1G",
      env: { NODE_ENV: "production" },
      error_file: log("web-error.log"),
      out_file: log("web-out.log"),
    },
    {
      ...common,
      name: "nexus-realtime",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "services/realtime/src/server.mts",
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "512M",
      env: { NODE_ENV: "production", REALTIME_PORT: "3001" },
      error_file: log("realtime-error.log"),
      out_file: log("realtime-out.log"),
    },
    {
      ...common,
      name: "nexus-worker",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "scripts/play-count-worker.mts",
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "512M",
      env: { NODE_ENV: "production" },
      error_file: log("worker-error.log"),
      out_file: log("worker-out.log"),
    },
  ],
};
