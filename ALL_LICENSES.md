# Dependency License Inventory

All dependencies are direct dependencies declared in `package.json`
(root), `server/package.json`, or `client/package.json`. Update this file in
the same change as any dependency addition or removal.

## Root (tooling)

| Package | Version | License |
|---|---|---|
| concurrently | ^9.1.0 | MIT |
| eslint | ^9.17.0 | MIT |
| @eslint/js | ^9.17.0 | MIT |
| globals | ^15.14.0 | MIT |
| eslint-plugin-react | ^7.37.3 | MIT |
| eslint-plugin-react-hooks | ^5.1.0 | MIT |
| eslint-config-prettier | ^9.1.0 | MIT |
| prettier | ^3.4.2 | MIT |

## Server (`server/package.json`)

| Package | Version | License |
|---|---|---|
| express | ^4.21.2 | MIT |
| pg | ^8.13.1 | MIT |
| zod | ^3.24.1 | MIT |
| bcryptjs | ^3.0.0 | MIT |
| jsonwebtoken | ^9.0.2 | MIT |
| cookie-parser | ^1.4.7 | MIT |
| helmet | ^8.0.0 | MIT |
| cors | ^2.8.5 | MIT |
| express-rate-limit | ^7.5.0 | MIT |
| pino | ^9.6.0 | MIT |
| pino-http | ^10.4.0 | MIT |
| pino-roll | ^3.1.0 | MIT |
| dotenv | ^16.4.7 | BSD-2-Clause |
| vitest (dev) | ^3.0.0 | MIT |
| @vitest/coverage-v8 (dev) | ^3.0.0 | MIT |

## Client (`client/package.json`)

| Package | Version | License |
|---|---|---|
| react | ^18.3.1 | MIT |
| react-dom | ^18.3.1 | MIT |
| react-router-dom | ^6.28.1 | MIT |
| @tanstack/react-query | ^5.62.0 | MIT |
| lucide-react | ^0.469.0 | ISC |
| @fontsource/inter | ^5.1.0 | OFL-1.1 (font) / MIT (packaging code) |
| @fontsource/dm-serif-display | ^5.1.0 | OFL-1.1 (font) / MIT (packaging code) |
| vite (dev) | ^6.0.0 | MIT |
| @vitejs/plugin-react (dev) | ^4.3.4 | MIT |
| vitest (dev) | ^3.0.0 | MIT |
| @vitest/coverage-v8 (dev) | ^3.0.0 | MIT |
| @testing-library/react (dev) | ^16.1.0 | MIT |
| @testing-library/jest-dom (dev) | ^6.6.3 | MIT |
| @testing-library/user-event (dev) | ^14.5.2 | MIT |
| jsdom (dev) | ^26.0.0 | MIT |

## Notes

- Charts are hand-rolled SVG React components; no charting library dependency
  is introduced (avoids extra license/audit surface — see developer plan
  "Package choices").
- No `supertest`; integration tests use Node 20's built-in `fetch` against a
  real listening server.
- Exact installed versions (post `npm install`) are pinned in
  `package-lock.json`, which is committed as the single lockfile for the
  monorepo.
