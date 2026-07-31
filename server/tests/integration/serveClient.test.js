import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

/**
 * D-DOC-F2: with SERVE_CLIENT=true, Express serves the built client and
 * refreshing any supported SPA route returns index.html, while /api routes
 * keep their JSON contract (they are never swallowed by the fallback).
 *
 * Uses a stub client/dist under a temp repoRoot so the test does not depend
 * on a real `npm run build` having run first; the real built app is
 * exercised by the clean-room validation and `npm run smoke`.
 */
describe("SERVE_CLIENT static serving + SPA fallback", () => {
  let server;
  let cleanup;
  let baseUrl;
  let tmpRoot;

  const INDEX_HTML = "<!doctype html><title>Budgeting App</title><div id=root></div>";

  beforeAll(async () => {
    tmpRoot = path.join(os.tmpdir(), `budgeting-app-serve-client-${randomUUID()}`);
    const distDir = path.join(tmpRoot, "client", "dist", "assets");
    await fs.mkdir(distDir, { recursive: true });
    await fs.writeFile(path.join(tmpRoot, "client", "dist", "index.html"), INDEX_HTML);
    await fs.writeFile(path.join(distDir, "app.js"), "console.log('stub asset')");

    const { loadConfig } = await import("../../src/config.js");
    const config = loadConfig({
      ...process.env,
      NODE_ENV: "test",
      LOG_DIR: path.join(tmpRoot, "logs"),
    });

    const { createApp } = await import("../../src/app.js");
    // Point the static root at the stub dist; serveClient on.
    const app = createApp({ ...config, serveClient: true, repoRoot: tmpRoot });
    cleanup = app.locals.cleanup;

    server = app.listen(0);
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  }, 30000);

  afterAll(async () => {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await cleanup();
    await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
  });

  it("serves index.html at the root", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Budgeting App");
  });

  it("falls back to index.html for every SPA route (refresh works; removed routes render the SPA NotFound page)", async () => {
    // /budget/new and /budget/:month/edit were removed by CR1-8: the server
    // still serves the SPA shell and the client router renders NotFound.
    for (const route of [
      "/login",
      "/register",
      "/budget",
      "/budget/new",
      "/budget/2026-07/edit",
      "/insights",
    ]) {
      const res = await fetch(`${baseUrl}${route}`);
      expect(res.status, route).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/text\/html/);
      expect(await res.text()).toContain("Budgeting App");
    }
  });

  it("serves real static assets directly, not the fallback", async () => {
    const res = await fetch(`${baseUrl}/assets/app.js`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("stub asset");
  });

  it("never swallows /api routes: unknown API paths keep the JSON 404 envelope", async () => {
    const res = await fetch(`${baseUrl}/api/v1/no-such-endpoint`);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("keeps API endpoints functional alongside static serving", async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("ok");
  });
});
