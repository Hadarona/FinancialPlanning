import { loadConfig } from "./config.js";
import { createApp } from "./app.js";

const config = loadConfig();
const app = createApp(config);
const server = app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port} (${config.nodeEnv})`);
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down gracefully...`);

  const closeServer = new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });

  try {
    await closeServer;
    await app.locals.cleanup();
    console.log("Shutdown complete.");
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown:", err.message);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export { server };
