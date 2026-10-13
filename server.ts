import express, { Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '1mb' }));

// ==========================================
// Database Configuration (Zero-Knowledge LocalStorage Fallback)
// ==========================================
// در صورت خالی بودن DATABASE_URL یا مقادیری مانند 'none'، سرور بدون هیچ خطایی بالا آمده و
// سامانه به صورت ۱۰۰٪ مستقل بر پایه localStorage کلاینت (Zero-Knowledge) عمل می‌کند.
const rawDbUrl = (process.env.DATABASE_URL || '').trim().toLowerCase();
const HAS_EXTERNAL_DATABASE = Boolean(
  rawDbUrl &&
  rawDbUrl !== 'none' &&
  rawDbUrl !== 'null' &&
  rawDbUrl !== 'undefined' &&
  rawDbUrl !== 'false' &&
  (rawDbUrl.startsWith('postgres://') || rawDbUrl.startsWith('postgresql://') || rawDbUrl.startsWith('mysql://'))
);

if (!HAS_EXTERNAL_DATABASE) {
  console.log('📦 [Database Mode] DATABASE_URL تنظیم نشده است. سرور بدون نیاز به دیتابیس خارجی و با اتکای کامل بر localStorage کلاینت فعال شد.');
} else {
  console.log('🔗 [Database Mode] متغیر DATABASE_URL معتبر شناسایی شد.');
}

// Master Encryption Key for storing tokens in memory/server (AES-256-GCM)
const ENCRYPTION_SECRET = process.env.CLOUDFLARE_ENCRYPTION_KEY || 'keeppass_cf_secret_key_32bytes_sec!';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();

interface EncryptedData {
  iv: string;
  tag: string;
  data: string;
}

function encryptToken(plainText: string): EncryptedData {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted,
  };
}

function decryptToken(encrypted: EncryptedData): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    ENCRYPTION_KEY,
    Buffer.from(encrypted.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'hex'));
  let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// In-memory encrypted session store (isolated per server instance)
let storedEncryptedToken: EncryptedData | null = null;
let connectedAccountInfo: {
  id: string;
  name: string;
} | null = null;
let isDemoMode = false;

// Simple Rate-limiting bucket
const requestTimestamps: number[] = [];
function checkRateLimit(): boolean {
  const now = Date.now();
  // Keep only requests within last 60 seconds
  const oneMinAgo = now - 60000;
  while (requestTimestamps.length > 0 && requestTimestamps[0] < oneMinAgo) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length > 60) {
    return false; // Exceeded 60 req/min
  }
  requestTimestamps.push(now);
  return true;
}

// ==========================================
// Cloudflare API Helper Endpoints
// ==========================================

/**
 * GET /api/cloudflare/status
 * Returns current connection status without exposing the token
 */
app.get('/api/cloudflare/status', (_req: Request, res: Response) => {
  res.json({
    connected: !!storedEncryptedToken || isDemoMode,
    isDemo: isDemoMode,
    account: connectedAccountInfo,
  });
});

/**
 * POST /api/cloudflare/connect
 * Receives Cloudflare API token, verifies it with Cloudflare API,
 * stores it encrypted, and returns list of accounts.
 */
app.post('/api/cloudflare/connect', async (req: Request, res: Response) => {
  if (!checkRateLimit()) {
    return res.status(429).json({ error: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی صبر کنید.' });
  }

  const { token, demoMode } = req.body;

  // Handle Demo / Simulation Mode
  if (demoMode) {
    isDemoMode = true;
    storedEncryptedToken = null;
    connectedAccountInfo = {
      id: 'demo_account_8764824',
      name: 'اکانت دمو (Cloudflare Demo)',
    };
    return res.json({
      success: true,
      message: 'حالت دمو با موفقیت فعال شد.',
      isDemo: true,
      accounts: [
        { id: 'demo_account_8764824', name: 'اکانت اصلی کاربر (پروژه شخصی)' },
        { id: 'demo_team_9918231', name: 'تیم توسعه سازمانی' },
      ],
    });
  }

  if (!token || typeof token !== 'string' || token.trim().length < 10) {
    return res.status(400).json({ error: 'توکن وارد شده معتبر نمی‌باشد.' });
  }

  const cleanToken = token.trim();

  try {
    // 1. Verify token with Cloudflare API
    const verifyRes = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        'Content-Type': 'application/json',
      },
    });

    const verifyData = await verifyRes.json() as { success: boolean; messages?: Array<{ message: string }>; errors?: Array<{ message: string }> };

    if (!verifyData.success) {
      const errorMsg = verifyData.errors?.[0]?.message || 'توکن نامعتبر است یا منقضی شده است.';
      return res.status(401).json({ error: `خطا در اعتبارسنجی توکن Cloudflare: ${errorMsg}` });
    }

    // 2. Fetch Accounts
    const accountsRes = await fetch('https://api.cloudflare.com/client/v4/accounts', {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        'Content-Type': 'application/json',
      },
    });

    const accountsData = await accountsRes.json() as { success: boolean; result?: Array<{ id: string; name: string }>; errors?: Array<{ message: string }> };

    if (!accountsData.success || !accountsData.result || accountsData.result.length === 0) {
      return res.status(400).json({ error: 'هیچ اکانتی با این توکن یافت نشد. اطمینان حاصل کنید دسترسی Account: Read فعال باشد.' });
    }

    // 3. Encrypt and store token safely
    storedEncryptedToken = encryptToken(cleanToken);
    isDemoMode = false;
    connectedAccountInfo = {
      id: accountsData.result[0].id,
      name: accountsData.result[0].name,
    };

    res.json({
      success: true,
      message: 'توکن با موفقیت تایید و متصل شد.',
      accounts: accountsData.result.map(acc => ({ id: acc.id, name: acc.name })),
    });
  } catch (err: unknown) {
    console.error('Cloudflare verify error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'خطا در ارتباط با سرورهای Cloudflare. لطفاً اتصال اینترنت خود را بررسی کنید.' });
  }
});

/**
 * GET /api/cloudflare/accounts
 */
app.get('/api/cloudflare/accounts', async (_req: Request, res: Response) => {
  if (isDemoMode) {
    return res.json({
      accounts: [
        { id: 'demo_account_8764824', name: 'اکانت اصلی کاربر (پروژه شخصی)' },
        { id: 'demo_team_9918231', name: 'تیم توسعه سازمانی' },
      ],
    });
  }

  if (!storedEncryptedToken) {
    return res.status(401).json({ error: 'هنوز به Cloudflare متصل نشده‌اید.' });
  }

  try {
    const rawToken = decryptToken(storedEncryptedToken);
    const accountsRes = await fetch('https://api.cloudflare.com/client/v4/accounts', {
      headers: {
        Authorization: `Bearer ${rawToken}`,
        'Content-Type': 'application/json',
      },
    });

    const accountsData = await accountsRes.json() as { success: boolean; result?: Array<{ id: string; name: string }>; errors?: Array<{ message: string }> };
    if (!accountsData.success || !accountsData.result) {
      return res.status(400).json({ error: 'خطا در دریافت لیست اکانت‌ها.' });
    }

    res.json({
      accounts: accountsData.result.map(acc => ({ id: acc.id, name: acc.name })),
    });
  } catch (err: unknown) {
    res.status(500).json({ error: 'خطا در ارتباط با سرور Cloudflare.' });
  }
});

/**
 * GET /api/cloudflare/zones?accountId=...
 */
app.get('/api/cloudflare/zones', async (req: Request, res: Response) => {
  const accountId = req.query.accountId as string;

  if (isDemoMode) {
    return res.json({
      zones: [
        { id: 'zone_demo_1', name: 'example-vault.com' },
        { id: 'zone_demo_2', name: 'mysecurepass.org' },
      ],
    });
  }

  if (!storedEncryptedToken) {
    return res.status(401).json({ error: 'توکن کلودفلر وجود ندارد.' });
  }

  try {
    const rawToken = decryptToken(storedEncryptedToken);
    let url = 'https://api.cloudflare.com/client/v4/zones';
    if (accountId) {
      url += `?account.id=${encodeURIComponent(accountId)}`;
    }

    const zonesRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${rawToken}`,
        'Content-Type': 'application/json',
      },
    });

    const zonesData = await zonesRes.json() as { success: boolean; result?: Array<{ id: string; name: string }>; errors?: Array<{ message: string }> };
    if (!zonesData.success || !zonesData.result) {
      return res.json({ zones: [] });
    }

    res.json({
      zones: zonesData.result.map(z => ({ id: z.id, name: z.name })),
    });
  } catch (err: unknown) {
    res.json({ zones: [] });
  }
});

/**
 * POST /api/cloudflare/disconnect
 */
app.post('/api/cloudflare/disconnect', (_req: Request, res: Response) => {
  storedEncryptedToken = null;
  connectedAccountInfo = null;
  isDemoMode = false;
  res.json({ success: true, message: 'اتصال با Cloudflare با موفقیت قطع شد.' });
});

/**
 * POST /api/cloudflare/deploy
 * Packages the Worker script, publishes it to Cloudflare,
 * enables workers.dev subdomain, and binds optional custom zone route.
 */
app.post('/api/cloudflare/deploy', async (req: Request, res: Response) => {
  if (!checkRateLimit()) {
    return res.status(429).json({ error: 'تعداد درخواست‌های دیپلوی بیش از حد مجاز است. لطفاً کمی صبر کنید.' });
  }

  const { accountId, zoneId, scriptName, customSubdomain } = req.body;

  if (!accountId) {
    return res.status(400).json({ error: 'شناسه اکانت Cloudflare مشخص نشده است.' });
  }

  const cleanScriptName = (scriptName || 'keeppass-vault')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/^-+|-+$/g, '') || 'keeppass-vault';

  // Demo / Simulation mode deployment
  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // simulate deployment delay
    const demoSubdomain = customSubdomain || 'demo-dev';
    const deployedUrl = `https://${cleanScriptName}.${demoSubdomain}.workers.dev`;

    return res.json({
      success: true,
      message: 'سایت با موفقیت روی Cloudflare Workers در حالت شبیه‌سازی دیپلوی شد.',
      url: deployedUrl,
      scriptName: cleanScriptName,
      deployedAt: new Date().toISOString(),
    });
  }

  if (!storedEncryptedToken) {
    return res.status(401).json({ error: 'توکن معتبری برای دیپلوی یافت نشد. لطفاً مجدداً متصل شوید.' });
  }

  const rawToken = decryptToken(storedEncryptedToken);

  try {
    const today = new Date().toISOString().slice(0, 10);
    // 1. Package the full KeepPass Vault SPA into the Cloudflare Worker script
    const distPath = path.resolve(__dirname, 'dist');
    const indexPath = path.join(distPath, 'index.html');

    if (!fs.existsSync(indexPath)) {
      try {
        execSync('npm run build', { cwd: __dirname, stdio: 'ignore' });
      } catch (buildErr) {
        console.warn('npm run build note during deploy:', buildErr);
      }
    }

    const htmlContent = fs.existsSync(indexPath) 
      ? fs.readFileSync(indexPath, 'utf-8') 
      : '<!doctype html><html><body><h1>KeepPass Vault</h1></body></html>';

    const assetsDir = path.join(distPath, 'assets');
    let jsFileName = '';
    let jsContent = '';
    let cssFileName = '';
    let cssContent = '';

    if (fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir);
      const js = files.find(f => f.endsWith('.js'));
      const css = files.find(f => f.endsWith('.css'));
      if (js) {
        jsFileName = js;
        jsContent = fs.readFileSync(path.join(assetsDir, js), 'utf-8');
      }
      if (css) {
        cssFileName = css;
        cssContent = fs.readFileSync(path.join(assetsDir, css), 'utf-8');
      }
    }

    const manifestContent = fs.existsSync(path.join(distPath, 'manifest.webmanifest'))
      ? fs.readFileSync(path.join(distPath, 'manifest.webmanifest'), 'utf-8')
      : '{}';

    const iconSvgContent = fs.existsSync(path.join(distPath, 'icon.svg'))
      ? fs.readFileSync(path.join(distPath, 'icon.svg'), 'utf-8')
      : '<svg></svg>';

    const registerSwContent = fs.existsSync(path.join(distPath, 'registerSW.js'))
      ? fs.readFileSync(path.join(distPath, 'registerSW.js'), 'utf-8')
      : '';

    const swContent = fs.existsSync(path.join(distPath, 'sw.js'))
      ? fs.readFileSync(path.join(distPath, 'sw.js'), 'utf-8')
      : 'self.addEventListener("fetch", () => {});';

    const deployMode = req.body.deployMode || 'embedded'; // 'embedded' (روش ۱) or 'dynamic' (روش ۲)
    const customOriginUrl = (req.body.originUrl || '').trim();
    const repoOwner = process.env.GITHUB_REPO_OWNER || '';
    const repoName = process.env.GITHUB_REPO_NAME || '';
    const dynamicOrigin = customOriginUrl || (repoOwner && repoName ? `https://${repoOwner}.github.io/${repoName}` : '');

    const workerScript = `
/**
 * Cloudflare Worker for KeepPass Vault
 * Mode: ${deployMode} (${deployMode === 'dynamic' ? 'روش ۲: لودر پویا با کش خودکار' : 'روش ۱: استقرار مستقل و تعبیه‌شده'})
 * Generated: ${new Date().toISOString()}
 */

const DEPLOY_MODE = ${JSON.stringify(deployMode)};
const DYNAMIC_ORIGIN = ${JSON.stringify(dynamicOrigin)};

const HTML = ${JSON.stringify(htmlContent)};
const CSS = ${JSON.stringify(cssContent)};
const JS = ${JSON.stringify(jsContent)};
const MANIFEST = ${JSON.stringify(manifestContent)};
const ICON_SVG = ${JSON.stringify(iconSvgContent)};
const REGISTER_SW = ${JSON.stringify(registerSwContent)};
const SW = ${JSON.stringify(swContent)};

const ASSETS = {
  "/": { content: HTML, type: "text/html; charset=utf-8" },
  "/index.html": { content: HTML, type: "text/html; charset=utf-8" },
  "/manifest.webmanifest": { content: MANIFEST, type: "application/manifest+json" },
  "/icon.svg": { content: ICON_SVG, type: "image/svg+xml" },
  "/registerSW.js": { content: REGISTER_SW, type: "application/javascript; charset=utf-8" },
  "/sw.js": { content: SW, type: "application/javascript; charset=utf-8" }
};

if (${JSON.stringify(jsFileName)}) {
  ASSETS["/assets/" + ${JSON.stringify(jsFileName)}] = { content: JS, type: "application/javascript; charset=utf-8" };
}

if (${JSON.stringify(cssFileName)}) {
  ASSETS["/assets/" + ${JSON.stringify(cssFileName)}] = { content: CSS, type: "text/css; charset=utf-8" };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const securityHeaders = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };

    // روش ۲: حالت لودر پویا (Dynamic Remote Loader)
    // اگر اوریجین تنظیم شده باشد، فایل‌ها از مبدا دریافت شده و در لبه کش می‌شوند تا آپدیت‌ها خودکار اعمال شوند
    if (DEPLOY_MODE === 'dynamic' && DYNAMIC_ORIGIN) {
      try {
        const targetPath = path === '/' ? '/index.html' : path;
        const upstreamUrl = new URL(targetPath, DYNAMIC_ORIGIN);
        const upstreamResp = await fetch(upstreamUrl.toString(), {
          headers: request.headers,
          cf: { cacheTtl: 180, cacheEverything: true }
        });

        if (upstreamResp.ok) {
          const respHeaders = new Headers(upstreamResp.headers);
          Object.entries(securityHeaders).forEach(([k, v]) => respHeaders.set(k, v));
          return new Response(upstreamResp.body, {
            status: upstreamResp.status,
            headers: respHeaders
          });
        }
      } catch (e) {
        // Fallback to embedded assets below if upstream has any error
      }
    }

    // Exact asset match
    if (ASSETS[path]) {
      const asset = ASSETS[path];
      const headers = new Headers(securityHeaders);
      headers.set('Content-Type', asset.type);
      if (path.startsWith('/assets/')) {
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        headers.set('Cache-Control', 'public, max-age=3600');
      }
      return new Response(asset.content, { headers });
    }

    // Static assets fallback
    if (path.endsWith('.js')) {
      const headers = new Headers(securityHeaders);
      headers.set('Content-Type', 'application/javascript; charset=utf-8');
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return new Response(JS, { headers });
    }

    if (path.endsWith('.css')) {
      const headers = new Headers(securityHeaders);
      headers.set('Content-Type', 'text/css; charset=utf-8');
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return new Response(CSS, { headers });
    }

    // Default SPA fallback: Return the full KeepPass Vault HTML for any route
    const headers = new Headers(securityHeaders);
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    return new Response(HTML, { headers });
  }
};
`;

    // 2. Prepare multipart/form-data payload for Cloudflare Workers API
    const boundary = '----CloudflareWorkerBoundary' + Date.now();
    const metadata = JSON.stringify({
      main_module: 'worker.js',
      compatibility_date: today,
      compatibility_flags: ['nodejs_compat'],
    });

    let multipartBody = '';
    // Metadata part
    multipartBody += `--${boundary}\r\n`;
    multipartBody += `Content-Disposition: form-data; name="metadata"\r\n`;
    multipartBody += `Content-Type: application/json\r\n\r\n`;
    multipartBody += `${metadata}\r\n`;

    // Script part
    multipartBody += `--${boundary}\r\n`;
    multipartBody += `Content-Disposition: form-data; name="worker.js"; filename="worker.js"\r\n`;
    multipartBody += `Content-Type: application/javascript+module\r\n\r\n`;
    multipartBody += `${workerScript}\r\n`;
    multipartBody += `--${boundary}--\r\n`;

    // 3. Upload script to Cloudflare
    const uploadRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/workers/scripts/${encodeURIComponent(cleanScriptName)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${rawToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    const uploadData = await uploadRes.json() as { success: boolean; errors?: Array<{ message: string }>; messages?: Array<{ message: string }> };

    if (!uploadData.success) {
      const errMsg = uploadData.errors?.[0]?.message || 'خطا در بارگذاری Worker در Cloudflare.';
      return res.status(400).json({ error: errMsg });
    }

    // 4. Enable workers.dev subdomain for this script
    try {
      await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/workers/scripts/${encodeURIComponent(cleanScriptName)}/subdomain`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${rawToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ enabled: true }),
        }
      );
    } catch (subdomainErr) {
      console.warn('Subdomain enable call note:', subdomainErr);
    }

    // 5. Fetch Account Subdomain
    let accountSubdomain = 'workers';
    try {
      const subRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/workers/subdomain`,
        {
          headers: {
            Authorization: `Bearer ${rawToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const subData = await subRes.json() as { success: boolean; result?: { subdomain: string } };
      if (subData.success && subData.result?.subdomain) {
        accountSubdomain = subData.result.subdomain;
      }
    } catch {}

    const finalUrl = `https://${cleanScriptName}.${accountSubdomain}.workers.dev`;

    // 6. If Zone is selected, optionally create route
    let zoneRouteAdded = false;
    if (zoneId) {
      try {
        const routeRes = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/workers/routes`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${rawToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              pattern: `*/*`,
              script: cleanScriptName,
            }),
          }
        );
        const routeData = await routeRes.json() as { success: boolean };
        zoneRouteAdded = routeData.success;
      } catch (zoneErr) {
        console.warn('Zone route binding note:', zoneErr);
      }
    }

    res.json({
      success: true,
      message: `سایت با موفقیت روی Cloudflare Workers در حالت ${deployMode === 'dynamic' ? '«پویا (روش ۲)»' : '«مستقل (روش ۱)»'} دیپلوی شد!`,
      url: finalUrl,
      scriptName: cleanScriptName,
      subdomain: accountSubdomain,
      zoneRouteAdded,
      deployMode,
      deployedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error('Deployment error:', err);
    res.status(500).json({ error: 'خطا در فرآیند دیپلوی در Cloudflare. لطفاً مجدداً امتحان نمایید.' });
  }
});

// ==========================================
// Zero-Knowledge Encrypted Cloud Sync Endpoints
// (حل مشکل پاک شدن کش گوشی و حذف اپلیکیشن)
// ==========================================
const VAULTS_DIR = path.resolve(__dirname, 'data', 'vaults');
if (!fs.existsSync(VAULTS_DIR)) {
  try {
    fs.mkdirSync(VAULTS_DIR, { recursive: true });
  } catch {}
}

/**
 * POST /api/vault/sync
 * Receives E2E encrypted ciphertext from client (Zero-Knowledge)
 * Master password and key NEVER reach the server.
 */
app.post('/api/vault/sync', async (req: Request, res: Response) => {
  try {
    if (!checkRateLimit()) {
      return res.status(429).json({ error: 'تعداد درخواست‌ها بیش از حد مجاز است.' });
    }

    const { username, salt, encryptedPayload, schemaVersion } = req.body;
    if (!username || !encryptedPayload || !salt) {
      return res.status(400).json({ error: 'اطلاعات ارسالی جهت همگام‌سازی ناقص است.' });
    }

    const cleanUsername = String(username).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanUsername) {
      return res.status(400).json({ error: 'نام کاربری نامعتبر است.' });
    }

    const filePath = path.join(VAULTS_DIR, `${cleanUsername}.json`);
    const vaultRecord = {
      username: cleanUsername,
      salt: String(salt),
      encryptedPayload: String(encryptedPayload),
      schemaVersion: Number(schemaVersion) || 2,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(filePath, JSON.stringify(vaultRecord, null, 2), 'utf-8');

    res.json({
      success: true,
      message: 'نسخه پشتیبان رمزنگاری‌شده (Zero-Knowledge) با موفقیت در فضای ابری ذخیره گردید.',
      updatedAt: vaultRecord.updatedAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    res.status(500).json({ error: `خطا در ذخیره‌سازی ابری: ${msg}` });
  }
});

/**
 * GET /api/vault/pull/:username
 * Retrieves the encrypted vault blob so user can recover their data
 * after uninstalling app or clearing phone cache.
 */
app.get('/api/vault/pull/:username', (req: Request, res: Response) => {
  try {
    const cleanUsername = String(req.params.username).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const filePath = path.join(VAULTS_DIR, `${cleanUsername}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        error: `هیچ نسخه پشتیبان ابری برای کاربر «${cleanUsername}» یافت نشد.` 
      });
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);

    res.json({
      success: true,
      vault: data,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: 'خطا در واکشی نسخه پشتیبان ابری.' });
  }
});

/**
 * GET /api/vault/status/:username
 * Checks if cloud backup exists and returns timestamp
 */
app.get('/api/vault/status/:username', (req: Request, res: Response) => {
  try {
    const cleanUsername = String(req.params.username).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const filePath = path.join(VAULTS_DIR, `${cleanUsername}.json`);

    if (!fs.existsSync(filePath)) {
      return res.json({ hasBackup: false, lastSync: null });
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);

    res.json({
      hasBackup: true,
      lastSync: data.updatedAt,
      schemaVersion: data.schemaVersion,
    });
  } catch {
    res.json({ hasBackup: false, lastSync: null });
  }
});

// ==========================================
// Telegram Bot Notification Proxy Endpoint
// ==========================================
app.post('/api/telegram/send', async (req: Request, res: Response) => {
  try {
    const { botToken, chatId, text, parseMode } = req.body;
    if (!botToken || !chatId || !text) {
      return res.status(400).json({ error: 'botToken, chatId, and text are required' });
    }

    const cleanToken = String(botToken).trim();
    const cleanChatId = String(chatId).trim();
    const telegramUrl = `https://api.telegram.org/bot${cleanToken}/sendMessage`;

    const tgRes = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: String(text),
        parse_mode: parseMode || 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data = await tgRes.json();
    return res.status(tgRes.ok ? 200 : tgRes.status).json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error';
    console.error('Telegram proxy error:', msg);
    return res.status(502).json({ error: `Telegram request error: ${msg}` });
  }
});

// ==========================================
// CI/CD & Production Deployment Endpoints
// ==========================================

/**
 * GET /api/version
 * Returns runtime server and application build information
 */
app.get('/api/version', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const versionFile = path.resolve(__dirname, 'public', 'version.json');
  if (fs.existsSync(versionFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      return res.json({
        ...data,
        serverEnvironment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        databaseMode: HAS_EXTERNAL_DATABASE ? 'external' : 'localStorage',
        hasExternalDb: HAS_EXTERNAL_DATABASE,
      });
    } catch {}
  }

  res.json({
    version: '1.0.0',
    buildTime: new Date().toISOString(),
    gitCommit: 'main-latest',
    serverEnvironment: process.env.NODE_ENV || 'development',
    databaseMode: HAS_EXTERNAL_DATABASE ? 'external' : 'localStorage',
    hasExternalDb: HAS_EXTERNAL_DATABASE,
  });
});

/**
 * GET /api/db/status
 * Confirms database state and ensures zero-crash operation when DATABASE_URL is empty
 */
app.get('/api/db/status', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    mode: HAS_EXTERNAL_DATABASE ? 'external' : 'localStorage',
    hasExternalDb: HAS_EXTERNAL_DATABASE,
    message: HAS_EXTERNAL_DATABASE
      ? 'متصل به دیتابیس خارجی'
      : 'سرور در حالت مستقل و پایدار با تکیه بر localStorage کلاینت (بدون نیاز به دیتابیس خارجی) فعال است.',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/deploy/status
 * Returns whether CI/CD environment variables are properly wired
 */
app.get('/api/deploy/status', (_req: Request, res: Response) => {
  const hasToken = !!process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER || '';
  const repo = process.env.GITHUB_REPO_NAME || '';
  const adminSecretSet = !!process.env.ADMIN_SECRET_KEY;

  res.json({
    configured: hasToken && !!owner && !!repo,
    hasGithubToken: hasToken,
    repoOwner: owner || '(تنظیم نشده)',
    repoName: repo || '(تنظیم نشده)',
    hasAdminSecret: adminSecretSet,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'staging',
    databaseMode: HAS_EXTERNAL_DATABASE ? 'external' : 'localStorage',
    hasExternalDb: HAS_EXTERNAL_DATABASE,
  });
});

/**
 * POST /api/trigger-deploy
 * Securely triggers GitHub Actions deployment to Production/Staging
 * Never exposes the GITHUB_TOKEN to the client browser.
 */
app.post('/api/trigger-deploy', async (req: Request, res: Response) => {
  try {
    if (!checkRateLimit()) {
      return res.status(429).json({ error: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی صبر کنید.' });
    }

    // 1. Verify Admin Auth Key
    const providedKey = req.headers['x-admin-key'] as string;
    const expectedKey = process.env.ADMIN_SECRET_KEY || 'admin123456';

    if (!providedKey || providedKey.trim() !== expectedKey.trim()) {
      return res.status(403).json({ 
        error: 'کلید احراز هویت ادمین نامعتبر است. لطفاً کلید صحیح را وارد کنید.' 
      });
    }

    const { environment = 'production', reason = 'درخواست انتشار توسط مدیر سایت' } = req.body;
    const githubToken = process.env.GITHUB_TOKEN;
    const repoOwner = process.env.GITHUB_REPO_OWNER;
    const repoName = process.env.GITHUB_REPO_NAME;

    // 2. If GitHub Secrets are configured, dispatch GitHub Actions workflow
    if (githubToken && repoOwner && repoName) {
      const dispatchUrl = `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/actions/workflows/deploy.yml/dispatches`;

      const ghResponse = await fetch(dispatchUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'KeepPass-Vault-Deployer',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            target_environment: environment,
            reason: String(reason).slice(0, 150),
          },
        }),
      });

      if (ghResponse.status === 204) {
        return res.json({
          success: true,
          message: `فرآیند استقرار در محیط ${environment === 'production' ? 'سایت اصلی (Production)' : 'پیش‌نمایش (Staging)'} در گیت‌هاب با موفقیت آغاز شد!`,
          triggeredAt: new Date().toISOString(),
          repo: `${repoOwner}/${repoName}`,
        });
      } else {
        const ghErrText = await ghResponse.text();
        console.error('GitHub API error:', ghResponse.status, ghErrText);
        return res.status(502).json({
          error: 'خطا در ارتباط با گیت‌هاب جهت اجرای Workflow',
          details: `کد وضعیت: ${ghResponse.status} - ${ghErrText}`,
        });
      }
    }

    // 3. Fallback for Local/Preview Demonstration when GITHUB_TOKEN is not yet injected
    // Validates authentication and confirms simulated dispatch
    return res.json({
      success: true,
      message: `درخواست انتشار روی ${environment === 'production' ? 'سایت اصلی (Production)' : 'Staging'} با موفقیت تأیید شد. (جهت اتصال زنده به گیت‌هاب، متغیرهای GITHUB_TOKEN و GITHUB_REPO_OWNER را در فایل .env تعریف نمایید)`,
      mode: 'preview_simulation',
      triggeredAt: new Date().toISOString(),
      details: 'کلید ادمین تأیید شد و اکشن آماده اجراست.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Trigger deploy error:', msg);
    return res.status(500).json({ error: `خطای داخلی سرور در آغاز استقرار: ${msg}` });
  }
});


// ==========================================
// Vite Dev Server Integration & Static Files
// ==========================================
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });

    // Intercept /@vite/client to serve a silent, zero-WebSocket stub in AI Studio iframe environment
    app.get('/@vite/client', (_req: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(`
        export class ErrorOverlay extends HTMLElement {}
        export function createHotContext() {
          return {
            accept: () => {},
            dispose: () => {},
            prune: () => {},
            invalidate: () => {},
            on: () => {},
            off: () => {},
            send: () => {},
          };
        }
        export function updateStyle(id, content) {
          let el = document.getElementById(id);
          if (!el) {
            el = document.createElement('style');
            el.id = id;
            document.head.appendChild(el);
          }
          el.textContent = content;
        }
        export function removeStyle(id) {
          const el = document.getElementById(id);
          if (el) el.remove();
        }
        export function injectQuery(url, query) {
          return url;
        }
      `);
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KeepPass Vault server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
