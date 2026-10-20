import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { validateServerEnvironment } from './environment.mjs';

const sessionLifetime = 12 * 60 * 60 * 1000;
const attemptWindow = 15 * 60 * 1000;
const sessionName = 'orbit_session';

export function isTrustedHost(req, env) {
  const raw = req.headers.host || '';
  if (!raw || /[\s/@\\]/.test(raw)) return false;
  let hostname;
  try { hostname = new URL(`http://${raw}`).hostname.toLowerCase().replace(/^\[|\]$/g, ''); }
  catch { return false; }
  const hosts = ['localhost', '127.0.0.1', '::1', 'terminal.local', env.RAILWAY_PUBLIC_DOMAIN || '', ...(env.APP_ALLOWED_HOSTS || '').split(',')];
  return hosts.some((host) => hostname === host.trim().toLowerCase().replace(/^\[|\]$/g, ''));
}

function loginPage(message = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="dark"><title>Sign in · Orbit</title><style>*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:24px;background:#151515;color:#eee;font-family:system-ui,sans-serif}.card{width:100%;max-width:420px;padding:32px;border:1px solid #383838;border-radius:18px;background:#1d1d1d}h1{font-size:32px;letter-spacing:-1px;margin:0 0 12px}p{color:#b7b7b7;line-height:1.6;font-size:14px}label{display:block;margin:24px 0 9px;font-size:14px}input{display:block;width:100%;font:inherit;background:#151515;border:1px solid #555;border-radius:9px;padding:14px;color:#fff}button{margin-top:16px;width:100%;padding:14px;border:0;border-radius:9px;background:#eee;color:#161616;font:inherit;font-weight:600;cursor:pointer}input:focus-visible,button:focus-visible{outline:2px solid #b3d7af;outline-offset:4px}.error{color:#ffb8b8}.note{margin-top:24px;font-size:12px}</style></head><body><main class="card"><h1>Welcome to Orbit.</h1><p>Sign in to your private task workspace.</p>${message ? `<p class="error" role="alert">${message}</p>` : ''}<form method="post" action="/login"><label for="login-password">Workspace password</label><input id="login-password" name="password" type="password" autocomplete="current-password" required maxlength="1024" autofocus><button type="submit">Sign in</button></form><p class="note">Use the workspace password configured by the owner. Your AI API key is never used to sign in.</p></main></body></html>`;
}

export function createAuth(env, { now = Date.now } = {}) {
  validateServerEnvironment(env);
  const salt = randomBytes(32);
  const passwordHash = scryptSync(env.APP_PASSWORD, salt, 32);
  const secure = env.NODE_ENV === 'production' || Boolean(env.RAILWAY_ENVIRONMENT_ID);
  const sessions = new Map();
  const attempts = new Map();
  const digest = (token) => createHash('sha256').update(token).digest('hex');
  const cookies = (token, expired = false) => `${sessionName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${expired ? 0 : sessionLifetime / 1000}${secure ? '; Secure' : ''}`;
  const tokenFrom = (req) => {
    const pairs = String(req.headers.cookie || '').split(';');
    return pairs.map((part) => part.trim()).find((part) => part.startsWith(`${sessionName}=`))?.slice(sessionName.length + 1) || '';
  };
  const prune = () => {
    for (const [id, expires] of sessions) if (expires <= now()) sessions.delete(id);
    for (const [id, item] of attempts) if (item.until <= now()) attempts.delete(id);
  };
  function authenticated(req) {
    prune();
    const token = tokenFrom(req);
    return /^[A-Za-z0-9_-]{43}$/.test(token) && sessions.has(digest(token));
  }
  const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
  const redirect = (res, location, cookie) => {
    res.writeHead(303, { Location: location, ...(cookie ? { 'Set-Cookie': cookie } : {}) });
    res.end();
  };
  const html = (res, status, message = '') => {
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" });
    res.end(loginPage(message));
  };
  const sameOrigin = (req) => {
    if (req.headers['sec-fetch-site'] === 'cross-site') return false;
    if (!req.headers.origin) return true;
    try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
  };

  async function handle(req, res, next) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { return json(res, 400, { error: 'Invalid request.' }); }
    // The health checker may use an internal Host. Reveal no app data here.
    if (url.pathname === '/healthz' && ['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(req.method === 'HEAD' ? undefined : '{"ok":true}');
    }
    if (!isTrustedHost(req, env)) return json(res, 403, { error: 'Untrusted request host.' });
    if (!['GET', 'HEAD'].includes(req.method) && !sameOrigin(req)) return json(res, 403, { error: 'Cross-origin access is disabled.' });
    if (url.pathname === '/login' && req.method === 'GET') {
      return authenticated(req) ? redirect(res, '/') : html(res, 200);
    }
    if (url.pathname === '/login' && req.method === 'POST') {
      prune();
      const ip = req.socket.remoteAddress || 'unknown';
      const attempt = attempts.get(ip);
      if (attempt && attempt.count >= 8 && attempt.until > now()) {
        req.resume();
        res.setHeader('Retry-After', String(Math.ceil((attempt.until - now()) / 1000)));
        return html(res, 429, 'Too many sign-in attempts. Please try again in 15 minutes.');
      }
      if (!String(req.headers['content-type'] || '').startsWith('application/x-www-form-urlencoded')) return json(res, 415, { error: 'Use the sign-in form.' });
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 4096) return json(res, 413, { error: 'Sign-in request is too large.' });
      }
      const supplied = new URLSearchParams(body).get('password') || '';
      const matches = supplied.length <= 1024 && timingSafeEqual(passwordHash, scryptSync(supplied, salt, 32));
      if (!matches) {
        if (attempts.size >= 1000 && !attempts.has(ip)) attempts.delete(attempts.keys().next().value);
        attempts.set(ip, { count: (attempt?.count || 0) + 1, until: attempt?.until || now() + attemptWindow });
        return html(res, 401, 'Incorrect password. Please try again.');
      }
      attempts.delete(ip);
      if (sessions.size >= 500) sessions.delete(sessions.keys().next().value);
      const token = randomBytes(32).toString('base64url');
      sessions.set(digest(token), now() + sessionLifetime);
      return redirect(res, '/', cookies(token));
    }
    if (url.pathname === '/logout' && req.method === 'POST') {
      const token = tokenFrom(req);
      if (token) sessions.delete(digest(token));
      return redirect(res, '/login', cookies('', true));
    }
    if (!authenticated(req)) {
      if (url.pathname.startsWith('/api/')) return json(res, 401, { error: 'Sign in to access this workspace.' });
      return redirect(res, '/login');
    }
    return next();
  }
  return { handle };
}
