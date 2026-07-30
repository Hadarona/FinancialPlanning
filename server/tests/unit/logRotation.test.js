import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { describe, it, expect, afterEach } from "vitest";
import { createLoggers } from "../../src/logging/logger.js";

/**
 * D-SEC-B5: rotation/retention bounds log-file growth. This drives the real
 * production logger code path (pino + pino-roll) with tiny bounds so the
 * proof does not need to write 25 MB: files must rotate once the size cap is
 * hit, and the retention count must delete the oldest files.
 */
describe("log rotation and retention (D-SEC-B5)", () => {
  let logDir;

  afterEach(async () => {
    if (logDir) {
      await fs.rm(logDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("rotates once the size bound is hit and never keeps more than the retention count", async () => {
    logDir = path.join(os.tmpdir(), `budgeting-app-logrotate-${randomUUID()}`);
    const keep = 3;
    const loggers = createLoggers({
      logDir,
      logRotateSize: "10k",
      logRotateKeep: keep,
    });

    // 20 paced batches x 50 entries (~8.6k per batch) >> 10k total: forces
    // many rotations. Pacing matters — pino-roll evaluates the size bound
    // per flushed chunk in its worker transport, so a single synchronous
    // burst would arrive as one oversized chunk and defeat the proof.
    for (let batch = 0; batch < 20; batch += 1) {
      for (let i = 0; i < 50; i += 1) {
        loggers.requestLogger.info(
          {
            requestId: `rotation-proof-${batch}-${i}`,
            method: "GET",
            route: "/api/v1/health",
            status: 200,
          },
          "request completed",
        );
      }
      await sleep(30);
    }
    await loggers.close();

    const files = (await fs.readdir(logDir)).filter((name) => name.startsWith("requests.log"));
    // Rotation happened (more than one file in the family)...
    expect(files.length).toBeGreaterThan(1);
    // ...and retention bounded the family: at most `keep` completed files
    // plus the currently-active one.
    expect(files.length).toBeLessThanOrEqual(keep + 1);

    // Every kept file respects the size bound, allowing one flush batch of
    // overshoot (pino-roll rotates after a chunk crosses the threshold).
    for (const name of files) {
      const { size } = await fs.stat(path.join(logDir, name));
      expect(size).toBeLessThan(20 * 1024);
    }
  }, 20000);
});
