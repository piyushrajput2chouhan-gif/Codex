# Running Orbit continuously

For Railway deployment from your phone, follow [RAILWAY-PHONE.md](RAILWAY-PHONE.md).
This app runs scheduled text-generation tasks in its server process. Closing a
browser does not stop it; stopping or suspending its hosting service does.
No always-on service is created just by building this repository.

## Docker Compose on your own host

Use Docker Engine with Compose and an always-running machine. Inject these
variables through your host's environment or secret manager, then run:

```sh
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 grok-bot
```

Required: `APP_PASSWORD` (at least 16 characters). Required for AI execution:
`AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL`. These are server environment variables;
Orbit does not load a `.env` file. Compose itself can read `.env`, so keep that
file limited to public configuration and inject secrets through the shell or
secret manager. Never write passwords or API keys to files or frontend code.

Open `http://localhost:3000` and sign in with your app password. The default
Compose port is published only to loopback. For a remote machine, use:

```sh
ssh -L 3000:127.0.0.1:3000 user@your-host
```

The image starts briefly as root to initialize ownership of `/app/data`, then
runs the server as the unprivileged `node` user. Container storage must be mounted
at `/app/data`; `DATA_DIR` is fixed to that location in this image. Compose grants
only the capabilities needed for this initialization. Do not override the start
command or entrypoint to run the application as root.

Tasks, schedules, execution history, and outputs persist in the named
`grok-bot-data` volume. Container recreation retains it. `docker compose down -v`
deletes it. Stop the service before backing up the complete volume, including
SQLite journal files, then restart it. Protect backups: prompts and results may
be private. Use one replica and one writer per volume.

`restart: unless-stopped` restarts a crashed container and starts it after host
reboots when Docker starts. Health failures alone do not trigger Docker restarts.
Monitor `/healthz`, logs, disk usage, provider quota, and service availability.
The unauthenticated health endpoint exposes only liveness; task APIs require
sign-in. Provider configuration is not proof of valid credentials or quota: run a
small task to verify execution. Interrupted runs are marked failed. After
restarting, overdue recurring tasks run once and advance to their next future
occurrence; missed intervals are not replayed in a burst.

To apply updated code or environment variables:

```sh
docker compose up --build -d
```

## Building behind this cloud workspace's TLS proxy

A normal Docker host can use the Compose commands above. This workspace's Docker
builder needs its injected proxy hostname and public trust certificate. This
build preserves TLS verification and package-integrity checks:

```sh
mkdir -p /tmp/orbit-docker-config
task_proxy_address=$(node -e "require('node:dns').lookup(new URL(process.env.HTTPS_PROXY).hostname,(err,address)=>{if(err)process.exit(1);process.stdout.write(address)})")
task_proxy_hostname=$(node -e "process.stdout.write(new URL(process.env.HTTPS_PROXY).hostname)")
DOCKER_CONFIG=/tmp/orbit-docker-config docker build \
  --add-host "$task_proxy_hostname:$task_proxy_address" \
  --build-arg HTTP_PROXY --build-arg HTTPS_PROXY --build-arg NO_PROXY \
  --secret "id=build_ca,src=$NODE_EXTRA_CA_CERTS" \
  -t grok-bot-grok-bot .
docker compose up -d --no-build
```

Use this only when the workspace supplies `HTTPS_PROXY` and
`NODE_EXTRA_CA_CERTS`. The public certificate is mounted only during installation;
it and build proxy configuration are not copied into the runtime image. A
runtime behind a proxy needs its own supported proxy and certificate settings.
Never disable TLS verification to work around a connection failure.

## Network access and scope

Use HTTPS before exposing the login to a network. Railway's generated domain
provides HTTPS and is accepted automatically through `RAILWAY_PUBLIC_DOMAIN`.
For another reverse proxy/custom domain, inject its hostname in
`APP_ALLOWED_HOSTS` (comma-separated hostnames without scheme or port), preserve
the original Host header, and prevent direct access to the backend port. The
hostname allowlist is not authentication. This is a single shared workspace;
anyone with the password can access all tasks and use the configured AI account.

The worker calls a compatible text-generation API. It does not browse live
websites, operate accounts, execute shell commands, or run other applications.
Provider requests and hosting can incur charges. At most four tasks execute
concurrently. History has no automatic retention policy; monitor storage growth.
