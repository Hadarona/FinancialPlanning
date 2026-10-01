# Budget Together

A personal and shared budgeting app for ILS, in English and Hebrew. The responsive web app and Android app use the same online backend and PostgreSQL database.

## Start on your PC

Install Docker Desktop with Linux containers, then run from PowerShell:

```powershell
./tools/setup-local.ps1
```

Open <http://localhost:4000>, create your account, and adjust the starter plan in **Plan & share**. The initial values are a template, not your actual income or expenses. The setup script generates private database and session secrets in an ignored `.env` file and preserves them on subsequent runs.

For access from your phones and outside home, follow [free private hosting](docs/personal-deployment.md). Your PC must remain powered on, awake and connected. No paid cloud service is required.

## What you can do

- Sign in with a 90-day **Remember me** session, or a one-day session when unchecked.
- Share a budget using email-bound, single-use invitation codes that expire after seven days. Choose editor or viewer access and revoke it at any time.
- Maintain one recurring plan with editable names, income, categories, archive controls and a protected zero-budget **One-off expenses** category.
- Apply a plan change from a selected month onward. Earlier months retain their previous plan. Saving replaces later scheduled plans; expenses and their category history remain visible.
- Track monthly spending and remaining amounts; add or delete expenses and browse every page of transaction history.
- Import `.xlsx` card statements with purchase dates by default. Preview before committing, map categories, skip existing imports, review invalid rows and retain refunds as negative expenses. Both Hebrew domestic and international export sheets are supported. Installments use the billed amount, not the full purchase price.
- View any month, compare up to three months, and explore category bars, spending shares and cumulative spending trends. Charts support keyboard tooltips and accessible data tables. Refunds are included in totals; the donut shows positive net categories only.
- Switch between English and Hebrew, including right-to-left mobile layouts.

Imports accept up to 5 MB / 5,000 transactions and store previews for one hour. Previewing a new file replaces your previous preview. Duplicate detection compares dates, merchant, card, billed amount, notes and the occurrence number of identical rows. Review overlapping exports containing identical repeated purchases carefully: bank exports without a stable transaction ID cannot distinguish every possible overlap.

## Android

The `android/` project builds an installable Android app for Android 11 and later, including Samsung Galaxy S23/S24. It uses the same responsive app through a restricted WebView, an HTTPS server setup screen, persistent cookies, a native Excel document picker and connection-retry screen. It requires an internet connection to your server. It does not run a second database on the phone.

See [Android installation, build and phone checks](docs/android.md).

## Development and verification

Node.js 24, Java 17 and PostgreSQL 17 are used by the verification workflow.

```sh
npm ci
npm run lint
npm run format:check
# Set DATABASE_URL and JWT_SECRET for an isolated test database first.
npm run coverage
npm run build
```

Both frontend and backend enforce **80% lines, statements, branches and functions**. Coverage includes the application source, with database migrations/startup tested through integration journeys instead of instrumentation. Existing unit, integration, security and QA suites remain part of the full run.

Run the full suite in Docker:

```sh
docker compose -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from tests
```

Start the production Compose app, then run browser acceptance tests:

```sh
npx playwright install chromium
npx playwright test
```

The default browser target is `http://127.0.0.1:4000`; set `E2E_BASE_URL` to change it. `E2E_CHANNEL=msedge` can use installed Edge on Windows. Tests use synthetic statements and temporary accounts, never your personal workbook. Run them against a test instance.

GitHub Actions runs coverage inside Docker, browser journeys against the production Docker image, and Android unit tests, lint and APK builds. Download coverage/browser reports and the APK from its artifacts.

## Architecture and data

- `client/`: React, React Query, Vite, responsive SVG charts.
- `server/`: Express API, bcrypt password hashes, HTTP-only session cookies, PostgreSQL repositories and versioned SQL migrations.
- `android/`: Java Android host for the shared web frontend.
- `compose.yaml`: persistent PostgreSQL and non-root application containers, restart policies, health checks and loopback-only web access.
- `docs/`: installation and backup instructions. Older product/design documents describe the original application; this README and the personal deployment guide describe this implementation.

Never commit `.env`, signing keys, personal statements or database backups. Preserve `.env` and the Docker data volume when updating. [Backup and recovery](docs/personal-deployment.md#backup-and-recovery) describes how to protect your data.
