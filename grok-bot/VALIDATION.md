# Railway deployment validation

Validated on 20 October 2026. Code is prepared for Railway; no Railway service has been deployed by this task.

## Passed checks

- **20 Node backend tests**, all passed. Includes password-required startup, anonymous API/asset protection, successful and failed sign-in, logout revocation, rate limiting, session expiry, production cookie attributes, safe external navigation to login, CSRF/origin and Host checks, Railway domain and volume validation, SQLite CRUD/persistence, scheduling/recovery, provider contract, missing settings, failure redaction and readiness gating.
- **10 Chromium browser groups**, all passed on desktop and mobile. Includes real login forms, wrong-password handling, private API access, mobile sign-in/log-out and re-login, saved task persistence, editing/schedules/search, dialogs and keyboard focus, literal HTML/XSS safety, generated provider-fixture results with copy/download, and absence of console errors and overflow. Reports/screenshots are generated under ignored evidence/.
- **Production build** passes with local fonts and icons bundled.
- **Final Docker image** `sha256:5135b7ebb14b39965d3636a6f8c22ea35d4bb1fe38a5e5eae8b7ff17c61a194e` built with TLS and package integrity verification enabled. Verified current login Referrer-Policy, Secure/HttpOnly/SameSite=Strict cookies, protected app/API, minimal public health endpoint, Railway-style hostname handling, and hostile Host rejection.
- **Fresh persistent-volume recovery:** initialized an empty root-owned 0700 volume, verified the actual application and SQLite files use UID 1000, saved a daily task, replaced the entire container, logged in again, and confirmed the same task and exact next-run timestamp remain. Test container and volume were removed.
- **Credential handling:** tests generate fixture credentials only in memory and inject them into fixture processes. No actual provider key or workspace password is written, logged, or committed. Runtime reads configuration only from environment variables; .env files are ignored and not loaded. App passwords and API keys are redacted from errors.

One browser issue was found and fixed: no-referrer caused Chromium sign-in forms to submit Origin:null. Login now uses same-origin referrer policy while rejecting unsafe cross-origin requests. Safe GET navigation from the Railway dashboard is permitted.

## Reproduce

```sh
cd grok-bot
npm ci
npm test
npm run build
python3 scripts/check_browser.py
```

The optional browser suite requires Python Playwright and Chromium. It reserves ports 4181/4182, refuses an occupied fixture port, and cleans its own temporary databases and processes. Production runtime needs only Node and the configured environment variables.

## Required deployment actions

Follow RAILWAY-PHONE.md: use branch railway-orbit, root /grok-bot, configuration /grok-bot/railway.json, one volume at /app/data, one replica with sleeping disabled, a strong APP_PASSWORD secret, the NVIDIA variables and HTTPS generated domain. Check a real task result and persistence after redeployment. Health confirms the server, not model access or a permanent uptime guarantee.

Live NVIDIA inference has not been verified in this cloud: AI_API_KEY is not injected into the running environment, and earlier direct provider connectivity was blocked by its proxy. Generated-fixture success is not a claim of successful live inference. Railway credits, continuous hosting, durable storage, model availability and provider quota remain account prerequisites. This app provides AI text tasks, not live browser/app control, and uses one shared password rather than individual accounts.

The original x.ai/bot source could not be accessed for visual or backend comparison. See SOURCE-INVESTIGATION.md. The existing editorial website remains separate and unchanged.
