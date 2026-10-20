# Deploy Orbit on Railway from a phone

Use your phone's browser for GitHub and Railway. Desktop-site mode can help when
settings are hidden. This creates a hosted service that can run while your phone
is offline; availability depends on your Railway plan, credits, service settings,
and provider access. Do not assume a free account provides permanent 24/7 uptime.

## 1. Connect the repository

1. Sign in to [Railway](https://railway.com/), create a project, and choose
   **Deploy from GitHub repo** (the label may appear under **New service**).
2. Authorize access to **piyushrajput2chouhan-gif/Codex**, select that repository,
   and set its source branch to **railway-orbit**. The older branches do not
   contain this application.
3. Open the service's **Settings → Source** and set **Root Directory** to
   `/grok-bot`. This is a monorepo: using the repository root builds the wrong app.
4. In the service settings, set the configuration file path to
   `/grok-bot/railway.json` if Railway has not discovered it automatically. The
   file configures the Dockerfile builder and `/healthz` readiness check. Keep
   start/build commands at their Dockerfile defaults.

An initial deployment may fail until the password variable is supplied; that is
expected. Do not publish a domain until variables and the volume are configured.

## 2. Add the persistent volume

From the service/project menu, add a **Volume**, attach it to this Orbit service,
and set its mount path to exactly `/app/data`.

Use **one replica**, disable **Serverless / App Sleeping**, and keep deployment
health checks enabled at `/healthz`. The included configuration requests these
settings; verify the resolved service settings after deployment. A sleeping
service cannot execute scheduled tasks. The volume belongs to this service; a
second service or replica must not write to the same SQLite database.

The image initializes a fresh root-owned volume, then drops privileges before
starting Orbit. Do not add a custom root start command. Deleting the volume
permanently deletes saved tasks and outputs. Railway volumes also affect
redeployment availability; plan for brief restart/deployment interruptions.

## 3. Add environment variables

In the service's **Variables** tab, add the following values. Use Railway's
variable fields for secrets, never the GitHub editor or a checked-in file.

| Variable | Value |
| --- | --- |
| `APP_PASSWORD` | Your own unique password, at least 16 characters; keep it private |
| `AI_API_KEY` | Your NVIDIA API key; keep it private |
| `AI_BASE_URL` | `https://integrate.api.nvidia.com/v1` |
| `AI_MODEL` | `meta/llama-3.3-70b-instruct` |
| `HOST` | `0.0.0.0` |
| `PORT` | `3000` |
| `NODE_ENV` | `production` |
| `DATA_DIR` | `/app/data` |

The URL and model are public settings, not credentials. The selected model must
be available to your NVIDIA account; confirm availability and quota in your
provider console. Another OpenAI-compatible provider can be used by changing all
three AI settings together. Keep the API key on the server.

Railway supplies `RAILWAY_PUBLIC_DOMAIN` when you generate a domain; Orbit accepts
that hostname automatically. You do not need to enter `APP_ALLOWED_HOSTS` for the
generated domain. If you later use a custom domain, add its hostname to
`APP_ALLOWED_HOSTS` in Variables (no `https://`, path, or port).

## 4. Deploy and open on your phone

1. Apply the pending variables/settings and deploy or redeploy the service.
2. Wait until build and deployment are healthy. In **Networking → Public
   Networking**, generate a domain and select target port `3000`. If the domain
   was generated after the service started, redeploy so its automatic hostname
   variable reaches the running process.
3. Open the generated `https://…up.railway.app` address. Sign in with
   `APP_PASSWORD`. Do not use your NVIDIA API key as the login password.
4. Save one small task, run it, and check its saved output. Then save a future
   schedule. Close and reopen the browser to confirm it remains saved.
5. Redeploy once and verify the task and schedule still exist. This confirms
   the SQLite volume is attached correctly. A successful health check alone
   does not verify AI access or persistence.
6. Add the HTTPS site to your phone's home screen if desired. Your phone can
   remain offline while the Railway service handles scheduled tasks.

## Troubleshooting

- **Build uses another app:** verify `/grok-bot` Root Directory and the branch.
- **Password/startup error:** ensure `APP_PASSWORD` is present and at least 16
  characters, then redeploy. Never paste the value into logs or support chats.
- **Health check fails:** verify `/healthz`, `HOST=0.0.0.0`, `PORT=3000`, and the
  service logs. Login is not required for `/healthz`.
- **Forbidden hostname:** verify the generated domain is reflected in
  `RAILWAY_PUBLIC_DOMAIN`; redeploy after generating it. Configure a custom
  hostname with `APP_ALLOWED_HOSTS`.
- **Tasks disappear after deployment:** verify the mounted volume and
  `DATA_DIR=/app/data`. Stop creating important tasks until this is corrected.
- **Task fails with provider error:** verify AI variables, current model
  availability, quota, and Railway outbound connectivity. Never put the key in
  a URL, frontend, or repository.
- **Schedules stop:** check service uptime, sleep settings, billing/credits,
  provider quota, and deployment failures. There is no uptime guarantee here.

Protect your Railway account and volume backups. This is a password-protected
single shared workspace, not separate accounts for multiple users. Review your
hosting usage and provider charges regularly.
