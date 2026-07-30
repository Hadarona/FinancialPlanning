import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// Test-environment shim (no effect on production code): react-router's data
// router builds `new Request(url, { signal })` from the global
// AbortController. Vitest's jsdom environment injects jsdom's
// AbortController while keeping Node's undici fetch/Request, whose internal
// brand check throws on jsdom AbortSignals — crashing every router
// navigation in tests. In a real browser both classes come from one realm,
// so this mismatch cannot happen. The shim drops the passed signal (the
// Request still exposes its own native, never-aborted signal; we define no
// loaders that rely on navigation cancellation).
const NativeRequest = globalThis.Request;
if (NativeRequest) {
  globalThis.Request = class Request extends NativeRequest {
    constructor(input, init) {
      if (init && "signal" in init) {
        const rest = { ...init };
        delete rest.signal;
        super(input, rest);
      } else {
        super(input, init);
      }
    }
  };
}
