# Run Orbit on your computer with NVIDIA

This route uses your computer's network and environment variables rather than
the Codex cloud proxy. Your computer must stay awake and connected for schedules
to run. Closing the browser is fine; closing the server process stops the worker.

## 1. Get the application and Node

Clone `https://github.com/piyushrajput2chouhan-gif/Codex.git` at branch `railway-orbit` and open its `grok-bot` directory, or download that branch as a ZIP from GitHub. The following examples assume your terminal is already in the application folder.

Install a current Node.js **24.x** release (at least 24.15) from
https://nodejs.org/en/download. Open a new terminal afterward. Check:

```sh
node --version
npm --version
```

Open the terminal in the extracted app folder, where `package.json` is located.
These commands do not require Docker or Python.

## 2. macOS or Linux

Start Bash first (`bash`), then run the following commands in that Bash session.
If you extracted elsewhere, change the `cd` path accordingly:

```bash
npm ci
npm run build

export AI_BASE_URL='https://integrate.api.nvidia.com/v1'
export AI_MODEL='meta/llama-3.3-70b-instruct'
export HOST='127.0.0.1'
export PORT='3000'
read -r -s -p 'Choose workspace password (16+ characters, hidden): ' APP_PASSWORD
printf '\n'
export APP_PASSWORD
read -r -s -p 'NVIDIA API key (hidden): ' AI_API_KEY
printf '\n'
export AI_API_KEY

npm run check:ai && npm start
```

Enter your NVIDIA key only when the hidden prompt appears. Its value is not
part of the command text or shell history and is not written to a file.

If successful, the check prints:

```text
AI readiness check passed: a real model response was received.
```

Then the server starts. Open `http://localhost:3000` and sign in using your workspace password.

## 3. Windows PowerShell

Open PowerShell and run the following. Adjust the `cd` path if necessary:

```powershell
npm.cmd ci
npm.cmd run build

$env:AI_BASE_URL = 'https://integrate.api.nvidia.com/v1'
$env:AI_MODEL = 'meta/llama-3.3-70b-instruct'
$env:HOST = '127.0.0.1'
$env:PORT = '3000'
$workspacePassword = Read-Host 'Workspace password (16+ characters)' -AsSecureString
$env:APP_PASSWORD = [System.Net.NetworkCredential]::new('', $workspacePassword).Password
Remove-Variable workspacePassword
$secureKey = Read-Host 'NVIDIA API key' -AsSecureString
$env:AI_API_KEY = [System.Net.NetworkCredential]::new('', $secureKey).Password
Remove-Variable secureKey

npm.cmd run check:ai
if ($LASTEXITCODE -eq 0) { npm.cmd start }
```

The key is entered at a hidden local prompt, not saved in a command or file.
The application reads it only from the process environment. `npm.cmd` also avoids
PowerShell's npm script execution-policy issue without changing that policy.

After the readiness check succeeds and the server starts, open
`http://localhost:3000` in your own browser.

## 4. Verify a real task

1. Enter `Write a three-item checklist for planning my day` and save it.
2. Select **Run now** and wait for **Completed**.
3. Open the result and confirm generated text is shown.
4. For recurring work, edit the task and choose an hourly, daily, or weekly
   schedule. Times use your browser's timezone.
5. Reload the page to confirm the task and result remain saved.

SQLite storage is in `data/` beside the application. Preserve that directory.
The app and provider check never print the API key, request headers, environment
values, or model output to terminal logs. The readiness check makes one minimal
real inference request and uses an in-memory task, so it does not add test tasks
to your workspace. Provider quota and availability still depend on your account.

Stop the server with Ctrl+C. To remove the key from this terminal's environment
afterward, run `unset AI_API_KEY` in Bash or `Remove-Item Env:AI_API_KEY` in
PowerShell. A new terminal needs the hidden prompt again. Never put passwords or keys in `.env`, source, README, Git, or chat. The server reads all AI settings only from environment variables; it does not load `.env`.

## Free hosting limitations

Render free web services can sleep when idle and do not provide the durable disk
this SQLite app needs. That makes them unsuitable for reliable 24/7 tasks and
persistent saves. Do not try to work around sleeping with self-pings.

Railway trial/free-credit availability and resource limits can change. Check
https://railway.com/pricing before relying on it; always-on compute and a
persistent volume are not guaranteed to remain free. Render's limitations are
documented at https://render.com/docs/free. The current cloud proxy prevented
checking those pricing pages live during this task.

The app now has shared-password login. For a phone-only Railway deployment with persistent storage and HTTPS, follow RAILWAY-PHONE.md. It does not provide separate user accounts. The current Docker packaging and host setup
notes are in `DEPLOYMENT.md`, but a free preview is not equivalent to an always-on
deployment with durable saved tasks.

## If the local provider check fails

- Missing setting: repeat the environment-variable commands in the same terminal
  that launches the app.
- HTTP 401/403 from NVIDIA: check the key's validity, NVIDIA account access, and
  availability of the selected model. Never print or share the key to diagnose it.
- Network/proxy error: check your computer's internet connection and any managed
  HTTPS proxy/trust configuration. Do not disable TLS verification.
- Port 3000 already in use: choose another local `PORT`, then open that port in
  your browser.

The cloud's latest `npm run ready` execution exited 2 with a missing AI_API_KEY
error before a provider request. A previous separate NVIDIA connectivity check
failed at the cloud proxy with CONNECT403; a local check is needed to establish
your computer's access.
