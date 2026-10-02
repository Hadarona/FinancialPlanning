# Personal deployment: no hosting subscription

## Recommended arrangement

Run Docker Desktop on a PC you keep awake, and use Tailscale Personal for private HTTPS access from your computers and phones. As checked on 1 October 2026, [Tailscale Personal is free for non-commercial use](https://tailscale.com/pricing). Each accessing device needs Tailscale. This avoids router port forwarding and a public database.

Electricity and your existing internet connection still have their usual costs. If the PC sleeps, reboots or loses its connection, the app will be unavailable until it returns. Configure Windows sleep settings and Docker Desktop to start with your Windows session. Docker restart policies restart the containers when Docker resumes; they cannot start Docker before Windows or keep a sleeping PC online.

## First local start

1. Install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/), enable its WSL 2/Linux-container prerequisites, and restart Windows if requested. Docker Personal is intended for eligible personal use; check its current license during installation.
2. Open PowerShell in the repository and run `./tools/setup-local.ps1`.
3. Visit `http://localhost:4000`. Create an account and update the template values in **Plan & share**.
4. Keep the generated `.env` private. Re-running setup preserves it and the data volume.

## Enable access away from home

1. Install [Tailscale for Windows](https://tailscale.com/docs/install/windows) and sign in to your personal account. Install Tailscale on the S23 and S24, and connect them to the same private network. Invite other household users through Tailscale if they need access.
2. In an administrator terminal, use [Tailscale Serve](https://tailscale.com/docs/reference/tailscale-cli/serve):

   ```powershell
   tailscale serve --bg http://127.0.0.1:4000
   tailscale serve status
   ```

   Follow Tailscale's prompt to enable HTTPS if necessary. Copy the resulting `https://...ts.net` address.

3. Edit `.env` in the repository: set `APP_ORIGIN=https://YOUR-EXACT-HOST.ts.net` and `COOKIE_SECURE=true`. Use the exact origin without a trailing slash. Run `docker compose up -d` to apply the change.
4. Use that HTTPS address on PC and in the Android app's first-run server screen. Keep Tailscale connected on each device. Use HTTPS from then on; secure sessions are intentionally unavailable over the old local HTTP address.
5. Register a separate budgeting account for each person. In **Plan & share**, create an invitation for their account email, send them the code yourself, and have them paste it into **Join budget**. Select the shared budget from the menu.

Tailscale membership grants network access. Budget app membership separately controls which budgets a person can read or edit. Public Tailscale Funnel is not required. No account registration, network publishing or Windows power-setting changes happen automatically in the setup script.

If you use another HTTPS host, deploy the same Docker image and PostgreSQL, set `APP_ORIGIN` and `COOKIE_SECURE=true`, and provide a persistent database. Free cloud products often sleep, cap usage or change their plans; this repository does not promise an always-on free cloud allocation.

## Updates

Back up first, pull the approved release, then run `docker compose up -d --build`. Migrations run before the server begins serving requests. Do not use `docker compose down -v`: that deletes the database volume. Normal `docker compose down` preserves it.

## Backup and recovery

Run the backup helper from PowerShell:

```powershell
./tools/backup.ps1
```

It writes a PostgreSQL custom-format backup into the ignored `backups/` directory. Store a second encrypted copy away from this PC. The backup contains financial data, account password hashes and membership information. Save `.env` separately in a password manager.

To restore, first make a backup of the current database and stop the application (`docker compose stop app`). Copy the chosen backup into the database container and restore it explicitly:

```powershell
docker compose cp ./backups/CHOSEN-BACKUP.dump db:/tmp/budget-restore.dump
docker compose exec -T db pg_restore -U budget -d budget --clean --if-exists --no-owner /tmp/budget-restore.dump
docker compose up -d app
```

`--clean` replaces the current database objects with the backup. Do this only when you intend to restore that snapshot. Log in and verify your latest months and shared memberships afterward. Rotating `JWT_SECRET` signs out every session; keep the new secret private.

## Troubleshooting

- **Phone cannot connect:** check that the PC is awake, Docker containers are healthy (`docker compose ps`), both devices are connected to Tailscale, and the address begins with HTTPS.
- **Request origin is not allowed:** `APP_ORIGIN` must exactly match the HTTPS address used in the app. Restart the app container after editing `.env`.
- **Import rejected:** use an `.xlsx` file, not an older `.xls`. Review flagged dates, currency and zero amounts. The attached-style export uses **Purchase date** by default, even when billing occurs later.
- **Budget changed while editing:** reload the plan before saving to avoid overwriting another person's change.
- **Forgotten password:** email delivery/password reset is not configured. The self-host administrator must handle account recovery. Existing sessions last at most 90 days with Remember me; logout clears the session cookie on that device.
