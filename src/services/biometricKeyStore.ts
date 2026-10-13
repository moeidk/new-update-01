/**
 * Biometric Key Store
 *
 * Replaces the old behaviour of writing the raw vault key to localStorage
 * (`keeppass_bio_token_*`), which made the encryption useless for anyone who could read the
 * browser storage.
 *
 * The vault key is now stored only in wrapped (encrypted) form inside IndexedDB:
 *  - mode 'prf'    → wrapped with a secret produced by the Face ID / fingerprint credential
 *                    itself (WebAuthn PRF extension). Without the biometric the key cannot be
 *                    recovered — this is the strong mode (iOS 18+, recent Android/Chrome).
 *  - mode 'device' → fallback for browsers without PRF: wrapped with a non-extractable
 *                    AES key that lives in this browser's IndexedDB. The raw key is never
 *                    readable as text, but the biometric prompt is a local gate only.
 */
import { CryptoService } from './crypto';
import { BiometricService } from './webauthn';

const DB_NAME = 'keeppass-secure';
const DB_VERSION = 1;
const STORE = 'biometric-keys';

export type BiometricKeyMode = 'prf' | 'device';

interface BiometricKeyRecord {
  username: string;
  mode: BiometricKeyMode;
  credentialId: string;
  prfSalt?: string;
  deviceKey?: CryptoKey; // non-extractable wrapping key (device mode only)
  wrapped: string; // base64(iv + AES-GCM(rawVaultKey))
  createdAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB در این مرورگر در دسترس نیست.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'username' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

const clean = (u: string) => u.trim().toLowerCase();

async function wrapRawKey(masterKey: CryptoKey, wrappingKey: CryptoKey): Promise<string> {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', masterKey));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, raw));
  raw.fill(0);
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return CryptoService.uint8ArrayToBase64(out);
}

async function unwrapRawKey(wrapped: string, wrappingKey: CryptoKey): Promise<CryptoKey> {
  const data = CryptoService.base64ToUint8Array(wrapped);
  const iv = data.slice(0, 12);
  const ct = data.slice(12);
  const raw = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, wrappingKey, ct));
  try {
    return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  } finally {
    raw.fill(0);
  }
}

function importPrfKey(prf: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', prf.slice(0, 32), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export class BiometricKeyStore {
  static async get(username: string): Promise<BiometricKeyRecord | undefined> {
    try {
      return await tx<BiometricKeyRecord | undefined>('readonly', (s) => s.get(clean(username)));
    } catch {
      return undefined;
    }
  }

  static async has(username: string): Promise<boolean> {
    return !!(await this.get(username));
  }

  static async remove(username: string): Promise<void> {
    try {
      await tx('readwrite', (s) => s.delete(clean(username)));
    } catch {
      /* ignore */
    }
  }

  private static async put(record: BiometricKeyRecord): Promise<void> {
    await tx('readwrite', (s) => s.put(record));
  }

  /**
   * Wraps the key for an existing credential. With `tryPrf` it tries PRF first (one biometric
   * prompt) and falls back to device mode; without it only device mode is used (no prompt).
   */
  static async wrapForCredential(
    username: string,
    credentialId: string,
    masterKey: CryptoKey,
    opts: { tryPrf: boolean }
  ): Promise<BiometricKeyMode> {
    if (opts.tryPrf) {
      const prfSalt = CryptoService.uint8ArrayToBase64(crypto.getRandomValues(new Uint8Array(32)));
      try {
        const prf = await BiometricService.getPrfOutput(credentialId, prfSalt);
        if (prf) {
          const wrapped = await wrapRawKey(masterKey, await importPrfKey(prf));
          prf.fill(0);
          await this.put({
            username: clean(username),
            mode: 'prf',
            credentialId,
            prfSalt,
            wrapped,
            createdAt: new Date().toISOString(),
          });
          return 'prf';
        }
      } catch (err) {
        // A cancelled prompt must not silently downgrade the protection.
        if (err instanceof DOMException && err.name === 'NotAllowedError') throw err;
        console.warn('[BiometricKeyStore] PRF unavailable, falling back to device mode:', err);
      }
    }

    const deviceKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const wrapped = await wrapRawKey(masterKey, deviceKey);
    await this.put({
      username: clean(username),
      mode: 'device',
      credentialId,
      deviceKey,
      wrapped,
      createdAt: new Date().toISOString(),
    });
    return 'device';
  }

  /** Registers a new biometric credential and stores the wrapped key. */
  static async enroll(username: string, masterKey: CryptoKey): Promise<{ credentialId: string; mode: BiometricKeyMode }> {
    const { credentialId, prfEnabled } = await BiometricService.registerBiometric(clean(username));
    // Some platforms (e.g. iOS) don't report `enabled` at creation but still support PRF on get().
    const mode = await this.wrapForCredential(username, credentialId, masterKey, { tryPrf: prfEnabled !== false });
    return { credentialId, mode };
  }

  /** Prompts the biometric and returns the vault key. */
  static async unlock(username: string): Promise<CryptoKey> {
    const rec = await this.get(username);
    if (!rec) {
      throw new Error('ورود بیومتریک روی این دستگاه فعال نیست. یک‌بار با رمز عبور وارد شوید.');
    }

    if (rec.mode === 'prf' && rec.prfSalt) {
      const prf = await BiometricService.getPrfOutput(rec.credentialId, rec.prfSalt);
      if (!prf) throw new Error('حسگر بیومتریک کلید رمزگشایی را برنگرداند. لطفاً با رمز عبور وارد شوید.');
      try {
        return await unwrapRawKey(rec.wrapped, await importPrfKey(prf));
      } finally {
        prf.fill(0);
      }
    }

    if (rec.mode === 'device' && rec.deviceKey) {
      const ok = await BiometricService.verifyBiometric(rec.credentialId);
      if (!ok) throw new Error('احراز هویت بیومتریک تایید نشد.');
      return unwrapRawKey(rec.wrapped, rec.deviceKey);
    }

    throw new Error('اطلاعات ورود بیومتریک نامعتبر است. لطفاً آن را در تنظیمات دوباره فعال کنید.');
  }
}
