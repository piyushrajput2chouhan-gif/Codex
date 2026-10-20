# Orbit — password-protected AI tasks

Save tasks, schedule AI text generation, and keep results in a private shared-password workspace. This is an independent implementation of the requested workflow, not an exact clone or recovered xAI backend. The original x.ai/bot inspection was blocked by the cloud proxy; see SOURCE-INVESTIGATION.md.

## Deploy from your phone

Use **[RAILWAY-PHONE.md](RAILWAY-PHONE.md)**. The GitHub repository is `piyushrajput2chouhan-gif/Codex`, branch `railway-orbit`, service root `/grok-bot`, configuration path `/grok-bot/railway.json`. Add a Railway volume mounted at `/app/data` and the variables listed in the guide. No local terminal is required.

## Environment variables

| Name | Purpose |
| --- | --- |
| `APP_PASSWORD` | Required private workspace password, 16–1024 characters. Inject as a secret. |
| `AI_API_KEY` | NVIDIA/OpenAI-compatible provider key. Inject as a secret. |
| `AI_BASE_URL` | `https://integrate.api.nvidia.com/v1` |
| `AI_MODEL` | `meta/llama-3.3-70b-instruct` |
| `HOST` | `0.0.0.0` on Railway, `127.0.0.1` for local use |
| `PORT` | `3000` on Railway, or your chosen local port |
| `NODE_ENV` | `production` on Railway |
| `DATA_DIR` | `/app/data` on Railway, backed by the attached volume |

The server reads these only from its process environment. It never reads `.env` files; the ignored local files from older setup are not used. No default key, password, provider URL or model is supplied by application code. Never write passwords or keys into files, README examples, commands, Git, or chat. `.env` variants are ignored; `.env.example` contains public reference values only.

## Authentication

All workspace pages, assets, and APIs require a signed-in session. The app refuses startup without a sufficiently long `APP_PASSWORD`. Password verification uses scrypt and a constant-time comparison. Random sessions are held in memory, expire after 12 hours, and are revoked on logout or server restart. Cookies are HttpOnly, SameSite=Strict, and Secure in production/on Railway. Login attempts are rate-limited; cross-origin writes and unknown hosts are rejected. `/healthz` is public and returns only a minimal health result.

Railway's generated public hostname is accepted via `RAILWAY_PUBLIC_DOMAIN`. For a custom domain set `APP_ALLOWED_HOSTS` to its hostname (no scheme/path/port). Use Railway HTTPS. This is a single-owner/shared-password workspace, not separate user accounts or MFA.

## Local development

Requires Node 24.15+ and npm. Inject `APP_PASSWORD` and the AI variables into the same terminal environment, then:

```sh
cd grok-bot
npm ci
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

The development command starts the API on loopback port 3001 and Vite on 4173. Sign in with `APP_PASSWORD`. See RUN-LOCALLY.md for hidden local password/key prompts. Stop only your own dev process before switching to production:

```sh
npm run build
npm start
```

Production serves the interface and API together; the default local binding is 127.0.0.1:3001 unless HOST/PORT are set.

`npm run check:ai` makes one minimal real model request using an in-memory task, then prints only success or a sanitized error. It does not print keys, passwords, headers, environment values, or model output. `npm run ready` checks inference before launching the development workflow; it also requires APP_PASSWORD for the server. Never treat configured variables or a healthy HTTP process as proof that live inference succeeds.

## Scheduling and storage

Tasks, schedules, run history and results persist in SQLite. On Railway startup requires the volume metadata and DATA_DIR to match `/app/data`; one replica must own that volume. The container initializes a fresh root-owned volume, then drops to UID 1000 before starting the server. Back up the complete stopped database volume, including journal files.

Manual, one-time, hourly, daily and weekly tasks are supported. Daily/weekly are fixed 24-hour/7-day intervals. The worker checks every second, permits at most four concurrent runs, and prevents overlap for one task. After downtime, an overdue recurring task runs once and advances to its next future slot; interrupted runs are marked failed. Deleting a task deletes its history. Results can be copied or downloaded after login.

The model performs text generation only: no live browsing, app control, email sending, shell execution, or external transactions. Public hosting does not add these capabilities.

## Validation

```sh
npm test
npm run build
python3 scripts/check_browser.py
```

The browser suite needs Python Playwright and Chromium; these are development checks, not runtime dependencies. Tests use generated credentials and provider fixtures, never actual keys. See VALIDATION.md for results and remaining limitations. DEPLOYMENT.md covers Docker, always-on hosting, persistent storage and backups. Railway availability, volumes and credits depend on your plan; permanent free 24/7 hosting is not promised.
