import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close((err) => (err ? reject(err) : resolve(port)));
    });
    probe.once("error", reject);
  });
}

async function waitForHealth(port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
      if (res.status === 200) {
        return res;
      }
    } catch {
      // Not listening yet.
    }
    if (Date.now() > deadline) {
      throw new Error("server did not become healthy in time");
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/**
 * D-RESP-B5 (and D-FND-B6): a real `node src/index.js` process must close
 * its HTTP listener on SIGTERM, flush its file logs rather than truncate
 * them, and exit 0 without accepting further work.
 */
describe("graceful shutdown", () => {
  it(
    "SIGTERM closes the listener, flushes logs, and exits 0",
    async () => {
      const port = await getFreePort();
      const logDir = path.join(os.tmpdir(), `budgeting-app-shutdown-${randomUUID()}`);

      const child = spawn(process.execPath, ["src/index.js"], {
        cwd: serverDir,
        env: {
          ...process.env,
          PORT: String(port),
          LOG_DIR: logDir,
          NODE_ENV: "development",
          // DATABASE_URL / JWT_SECRET come from the repo-root .env via
          // config.js; nothing here queries the database.
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });

      const exited = new Promise((resolve) => {
        child.once("exit", (code, signal) => resolve({ code, signal }));
      });

      try {
        await waitForHealth(port);

        child.kill("SIGTERM");
        const { code, signal } = await exited;

        // Clean exit, not a signal kill.
        expect(signal).toBeNull();
        expect(code).toBe(0);
        expect(stdout).toContain("Shutdown complete.");

        // The port no longer accepts work.
        await expect(fetch(`http://127.0.0.1:${port}/api/v1/health`)).rejects.toThrow();

        // The request log survived shutdown with the health request(s) in it
        // (flushed, not truncated).
        const files = await fs.readdir(logDir);
        const requestLogs = files.filter((name) => name.startsWith("requests.log"));
        expect(requestLogs.length).toBeGreaterThan(0);
        let combined = "";
        for (const name of requestLogs) {
          combined += await fs.readFile(path.join(logDir, name), "utf8");
        }
        expect(combined).toContain("/api/v1/health");
      } finally {
        if (child.exitCode === null) {
          child.kill("SIGKILL");
        }
        await fs.rm(logDir, { recursive: true, force: true }).catch(() => {});
        if (stderr.includes("Error") && child.exitCode !== 0) {
          // Surface the child's own error output on failure for diagnosis.
          console.error(stderr);
        }
      }
    },
    45000,
  );
});
