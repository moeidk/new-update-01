/**
 * KeepPass Vault — Cloudflare Worker (API + static assets)
 *
 * Replaces the old Express `server.ts`, which never ran on Cloudflare (only the static `dist`
 * folder was deployed), so cloud backup and the Telegram proxy did not work in production.
 *
 * Routes (everything else is served from ./dist by the ASSETS binding):
 *   GET  /api/health
 *   GET  /api/vault/status/:username   → { hasBackup, lastSync, salt, kdfIterations }
 *   POST /api/vault/pull               → encrypted backup, only with the owner's auth token
 *   POST /api/vault/sync               → store encrypted backup, only with the owner's auth token
 *   POST /api/telegram/send            → validated proxy to the Telegram Bot API
 *
 * Zero-knowledge: the browser encrypts everything with a key derived from the master password.
 * The server stores ciphertext, the public PBKDF2 salt/iterations, and SHA-256(authToken) where
 * authToken is an HMAC derived from the key. It never sees the password or the key.
 */

export interface Env {
  ASSETS: Fetcher;
  /** KV namespace holding encrypted vault backups. Optional so the site still works without it. */
  VAULTS?: KVNamespace;
}

const MAX_BODY_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_FAILED_ATTEMPTS = 20;
const FAILED_WINDOW_SECONDS = 15 * 60;
const TOKEN_RE = /^[0-9a-f]{64}$/;

interface VaultRecord {
  v: 1;
  salt: string;
  kdfIterations: number;
  encryptedPayload: string;
  schemaVersion: number;
  authHash: string;
  createdAt: string;
  updatedAt: string;
}

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS },
  });
}

const fail = (status: number, error: string) => json({ error }, status);

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const enc = new TextEncoder();
  return crypto.subtle.timingSafeEqual(enc.encode(a), enc.encode(b));
}

function normalizeUsername(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const u = raw.trim().toLowerCase();
  if (u.length < 1 || u.length > 64) return null;
  if (/[\u0000-\u001f\u007f]/.test(u)) return null;
  return u;
}

/** KV keys use a hash of the username so any (Unicode) username is safe and not listable. */
async function vaultKey(username: string): Promise<string> {
  return `vault:${await sha256Hex(`keeppass-user:${username}`)}`;
}

async function readJsonBody<T>(request: Request): Promise<T | null> {
  const len = Number(request.headers.get('Content-Length') || '0');
  if (len > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Rejects cross-site browser requests (another website calling our API with a visitor's browser). */
function isSameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get('Origin');
  return !origin || origin === url.origin;
}

// ---------------------------------------------------------------------------
// Failed-attempt throttling (per username), best-effort via KV TTL
// ---------------------------------------------------------------------------
async function isLocked(kv: KVNamespace, key: string): Promise<boolean> {
  const n = Number((await kv.get(`fail:${key}`)) || '0');
  return n >= MAX_FAILED_ATTEMPTS;
}

async function recordFailure(kv: KVNamespace, key: string): Promise<void> {
  const n = Number((await kv.get(`fail:${key}`)) || '0') + 1;
  await kv.put(`fail:${key}`, String(n), { expirationTtl: FAILED_WINDOW_SECONDS });
}

async function clearFailures(kv: KVNamespace, key: string): Promise<void> {
  await kv.delete(`fail:${key}`);
}

// ---------------------------------------------------------------------------
// Vault endpoints
// ---------------------------------------------------------------------------
async function handleVaultStatus(env: Env, rawUsername: string): Promise<Response> {
  if (!env.VAULTS) return json({ hasBackup: false, lastSync: null, cloudEnabled: false });
  const username = normalizeUsername(decodeURIComponent(rawUsername));
  if (!username) return fail(400, 'نام کاربری نامعتبر است.');

  const rec = await env.VAULTS.get<VaultRecord>(await vaultKey(username), 'json');
  if (!rec) return json({ hasBackup: false, lastSync: null, cloudEnabled: true });

  return json({
    hasBackup: true,
    lastSync: rec.updatedAt,
    salt: rec.salt,
    kdfIterations: rec.kdfIterations,
    schemaVersion: rec.schemaVersion,
    cloudEnabled: true,
  });
}

async function handleVaultPull(request: Request, env: Env): Promise<Response> {
  if (!env.VAULTS) return fail(503, 'فضای ابری روی سرور فعال نشده است.');
  const body = await readJsonBody<{ username?: string; authToken?: string }>(request);
  const username = normalizeUsername(body?.username);
  const authToken = typeof body?.authToken === 'string' ? body.authToken : '';
  if (!username || !TOKEN_RE.test(authToken)) return fail(400, 'درخواست نامعتبر است.');

  const key = await vaultKey(username);
  if (await isLocked(env.VAULTS, key)) {
    return fail(429, 'تلاش‌های ناموفق زیاد بود. لطفاً ۱۵ دقیقه دیگر دوباره امتحان کنید.');
  }

  const rec = await env.VAULTS.get<VaultRecord>(key, 'json');
  if (!rec) return fail(404, `هیچ نسخه پشتیبان ابری برای کاربر «${username}» یافت نشد.`);

  if (!timingSafeEqualHex(await sha256Hex(authToken), rec.authHash)) {
    await recordFailure(env.VAULTS, key);
    return fail(403, 'رمز عبور برای این حساب ابری صحیح نیست.');
  }
  await clearFailures(env.VAULTS, key);

  return json({
    success: true,
    vault: {
      salt: rec.salt,
      kdfIterations: rec.kdfIterations,
      encryptedPayload: rec.encryptedPayload,
      schemaVersion: rec.schemaVersion,
      updatedAt: rec.updatedAt,
    },
  });
}

async function handleVaultSync(request: Request, env: Env): Promise<Response> {
  if (!env.VAULTS) return fail(503, 'فضای ابری روی سرور فعال نشده است.');
  const body = await readJsonBody<{
    username?: string;
    authToken?: string;
    newAuthToken?: string;
    salt?: string;
    kdfIterations?: number;
    encryptedPayload?: string;
    schemaVersion?: number;
  }>(request);
  if (!body) return fail(413, 'حجم یا قالب داده ارسالی نامعتبر است.');

  const username = normalizeUsername(body.username);
  const authToken = typeof body.authToken === 'string' ? body.authToken : '';
  const newAuthToken = typeof body.newAuthToken === 'string' ? body.newAuthToken : authToken;
  const salt = typeof body.salt === 'string' ? body.salt : '';
  const encryptedPayload = typeof body.encryptedPayload === 'string' ? body.encryptedPayload : '';
  const kdfIterations = Number(body.kdfIterations);

  if (
    !username ||
    !TOKEN_RE.test(authToken) ||
    !TOKEN_RE.test(newAuthToken) ||
    !/^[A-Za-z0-9+/=]{16,128}$/.test(salt) ||
    !/^[A-Za-z0-9+/=]+$/.test(encryptedPayload) ||
    !Number.isInteger(kdfIterations) ||
    kdfIterations < 10_000 ||
    kdfIterations > 10_000_000
  ) {
    return fail(400, 'اطلاعات ارسالی جهت همگام‌سازی ناقص یا نامعتبر است.');
  }

  const key = await vaultKey(username);
  if (await isLocked(env.VAULTS, key)) {
    return fail(429, 'تلاش‌های ناموفق زیاد بود. لطفاً ۱۵ دقیقه دیگر دوباره امتحان کنید.');
  }

  const existing = await env.VAULTS.get<VaultRecord>(key, 'json');
  if (existing && !timingSafeEqualHex(await sha256Hex(authToken), existing.authHash)) {
    await recordFailure(env.VAULTS, key);
    return fail(403, 'این نام کاربری در فضای ابری متعلق به حساب دیگری است یا رمز عبور آن تغییر کرده است.');
  }

  const now = new Date().toISOString();
  const record: VaultRecord = {
    v: 1,
    salt,
    kdfIterations,
    encryptedPayload,
    schemaVersion: Number(body.schemaVersion) || 3,
    authHash: await sha256Hex(newAuthToken),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await env.VAULTS.put(key, JSON.stringify(record));
  if (existing) await clearFailures(env.VAULTS, key);

  return json({ success: true, updatedAt: now });
}

// ---------------------------------------------------------------------------
// Telegram proxy (lets users in networks where api.telegram.org is blocked receive alerts)
// ---------------------------------------------------------------------------
async function handleTelegramSend(request: Request): Promise<Response> {
  const body = await readJsonBody<{ botToken?: string; chatId?: string | number; text?: string }>(request);
  const botToken = typeof body?.botToken === 'string' ? body.botToken.trim() : '';
  const chatId = body?.chatId !== undefined ? String(body.chatId).trim() : '';
  const text = typeof body?.text === 'string' ? body.text : '';

  if (!/^\d{5,15}:[A-Za-z0-9_-]{30,50}$/.test(botToken)) return fail(400, 'توکن ربات تلگرام نامعتبر است.');
  if (!/^(-?\d{1,20}|@[A-Za-z0-9_]{5,32})$/.test(chatId)) return fail(400, 'شناسه چت تلگرام نامعتبر است.');
  if (!text || text.length > 4096) return fail(400, 'متن پیام خالی یا بیش از حد طولانی است.');

  const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  const data = (await tgRes.json().catch(() => ({}))) as Record<string, unknown>;
  return json({ ok: data.ok === true, description: data.description }, tgRes.ok ? 200 : 502);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (!pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    try {
      if (request.method === 'POST' && !isSameOrigin(request, url)) {
        return fail(403, 'درخواست از مبدأ نامعتبر.');
      }

      if (pathname === '/api/health' && request.method === 'GET') {
        return json({ ok: true, cloudSync: !!env.VAULTS });
      }

      const statusMatch = pathname.match(/^\/api\/vault\/status\/([^/]+)$/);
      if (statusMatch && request.method === 'GET') return handleVaultStatus(env, statusMatch[1]);

      if (pathname === '/api/vault/pull' && request.method === 'POST') return handleVaultPull(request, env);
      if (pathname === '/api/vault/sync' && request.method === 'POST') return handleVaultSync(request, env);
      if (pathname === '/api/telegram/send' && request.method === 'POST') return handleTelegramSend(request);

      return fail(404, 'مسیر API یافت نشد.');
    } catch (err) {
      console.error('API error', err);
      return fail(500, 'خطای داخلی سرور.');
    }
  },
} satisfies ExportedHandler<Env>;
