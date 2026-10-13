/**
 * Cryptography Service for KeepPass Vault
 * Uses standard Web Crypto API (AES-GCM 256-bit + PBKDF2-SHA256)
 *
 * Security model:
 * - The master key is derived with PBKDF2 (600k iterations for new keys, 100k for legacy users).
 * - The stored password verifier is an HMAC derived from the master key, so checking a guessed
 *   password costs a full PBKDF2 run (the old fast SHA-256 hash is only accepted for legacy
 *   accounts and is replaced on the next successful login).
 * - The cloud-sync auth token is a separate HMAC derived from the same key; the server only stores
 *   its SHA-256 and never sees the password or the key.
 */

/** PBKDF2 iterations for newly created keys (OWASP 2023+ recommendation for PBKDF2-HMAC-SHA256). */
export const KDF_ITERATIONS = 600_000;
/** Iterations used by accounts created before the hardening update. */
export const LEGACY_KDF_ITERATIONS = 100_000;

const VERIFIER_PREFIX = 'v2:';

export class CryptoService {
  /**
   * Generates a cryptographically random salt (16 bytes)
   */
  static generateSalt(): string {
    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    return this.uint8ArrayToBase64(saltBytes);
  }

  /**
   * LEGACY: fast salted SHA-256 hash used by accounts created before the hardening update.
   * Only used to verify (and then upgrade) old accounts — never for new data.
   */
  static async legacyHashPassword(password: string, saltBase64: string): Promise<string> {
    const encoder = new TextEncoder();
    const saltBytes = this.base64ToUint8Array(saltBase64);
    const passBytes = encoder.encode(password);
    
    // Combine salt + password
    const combined = new Uint8Array(saltBytes.length + passBytes.length);
    combined.set(saltBytes, 0);
    combined.set(passBytes, saltBytes.length);

    const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
    return this.uint8ArrayToBase64(new Uint8Array(hashBuffer));
  }

  /**
   * Derives an AES-GCM 256-bit CryptoKey from master password and salt using PBKDF2
   */
  static async deriveKey(password: string, saltBase64: string, iterations: number): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const saltBytes = this.base64ToUint8Array(saltBase64);
    const passKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes as unknown as BufferSource,
        iterations,
        hash: 'SHA-256',
      },
      passKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true, // extractable (in memory only) so it can be wrapped for biometric unlock and used for HMAC derivations
      ['encrypt', 'decrypt']
    );
  }

  /** Resolves the iteration count stored for an account (missing = legacy account). */
  static iterationsFor(settings: { kdfIterations?: number } | null | undefined): number {
    const n = settings?.kdfIterations;
    return typeof n === 'number' && n >= 10_000 ? n : LEGACY_KDF_ITERATIONS;
  }

  /** HMAC-SHA256(rawKey, label) — domain-separated values derived from the master key. */
  private static async deriveLabel(key: CryptoKey, label: string): Promise<Uint8Array> {
    const raw = await crypto.subtle.exportKey('raw', key);
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(label));
    return new Uint8Array(sig);
  }

  /** Password verifier stored locally. Brute-forcing it costs a full PBKDF2 run per guess. */
  static async computeVerifier(key: CryptoKey): Promise<string> {
    const bytes = await this.deriveLabel(key, 'keeppass/password-verifier/v2');
    return VERIFIER_PREFIX + this.uint8ArrayToBase64(bytes);
  }

  /** Token that proves ownership of a cloud backup. The server stores only SHA-256(token). */
  static async computeSyncAuthToken(key: CryptoKey): Promise<string> {
    const bytes = await this.deriveLabel(key, 'keeppass/cloud-sync-auth/v1');
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verifies a master password against stored settings.
   * Returns the derived key, and — for legacy accounts — the upgraded verifier to persist.
   */
  static async verifyMasterPassword(
    password: string,
    settings: { salt: string; masterPasswordHash: string; kdfIterations?: number }
  ): Promise<{ ok: boolean; key?: CryptoKey; upgradedVerifier?: string }> {
    const key = await this.deriveKey(password, settings.salt, this.iterationsFor(settings));
    const stored = settings.masterPasswordHash || '';

    if (stored.startsWith(VERIFIER_PREFIX)) {
      const verifier = await this.computeVerifier(key);
      return this.constantTimeEqual(verifier, stored) ? { ok: true, key } : { ok: false };
    }

    // Legacy account: compare against the old fast hash, then upgrade it.
    const legacy = await this.legacyHashPassword(password, settings.salt);
    if (!this.constantTimeEqual(legacy, stored)) return { ok: false };
    return { ok: true, key, upgradedVerifier: await this.computeVerifier(key) };
  }

  static constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  /** Cryptographically secure integer in [0, max) without modulo bias. */
  static secureRandomInt(max: number): number {
    if (max <= 0) return 0;
    const limit = Math.floor(0x100000000 / max) * max;
    const buf = new Uint32Array(1);
    do {
      crypto.getRandomValues(buf);
    } while (buf[0] >= limit);
    return buf[0] % max;
  }

  /**
   * Encrypts plain text or JSON using AES-GCM with a random 96-bit (12-byte) IV
   */
  static async encrypt(plainText: string, key: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
      },
      key,
      encoder.encode(plainText)
    );

    const encryptedBytes = new Uint8Array(encryptedBuffer);
    // Combine IV (12 bytes) + Ciphertext
    const payload = new Uint8Array(iv.length + encryptedBytes.length);
    payload.set(iv, 0);
    payload.set(encryptedBytes, iv.length);

    return this.uint8ArrayToBase64(payload);
  }

  /**
   * Decrypts AES-GCM ciphertext using the CryptoKey
   */
  static async decrypt(encryptedBase64: string, key: CryptoKey): Promise<string> {
    const payload = this.base64ToUint8Array(encryptedBase64);
    if (payload.length < 13) {
      throw new Error('داده‌های رمزنگاری شده نامعتبر هستند.');
    }

    const iv = payload.slice(0, 12);
    const ciphertext = payload.slice(12);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
      },
      key,
      ciphertext as unknown as BufferSource
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }

  /**
   * Exports a CryptoKey to raw base64 string
   */
  static async exportKeyRaw(key: CryptoKey): Promise<string> {
    const rawBuffer = await crypto.subtle.exportKey('raw', key);
    return this.uint8ArrayToBase64(new Uint8Array(rawBuffer));
  }

  /**
   * Imports a raw base64 string back into an AES-GCM CryptoKey
   */
  static async importKeyRaw(rawBase64: string): Promise<CryptoKey> {
    const rawBytes = this.base64ToUint8Array(rawBase64);
    return await crypto.subtle.importKey(
      'raw',
      rawBytes as unknown as BufferSource,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // --- Helper Conversion Functions ---
  static uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  static base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Password Generator
   */
  static generatePassword(options: {
    length?: number;
    useUpper?: boolean;
    useLower?: boolean;
    useNumbers?: boolean;
    useSymbols?: boolean;
    avoidAmbiguous?: boolean;
  } = {}): string {
    const {
      length = 16,
      useUpper = true,
      useLower = true,
      useNumbers = true,
      useSymbols = true,
      avoidAmbiguous = true,
    } = options;

    let upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let lower = 'abcdefghijkmnopqrstuvwxyz';
    let numbers = '23456789';
    let symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!avoidAmbiguous) {
      upper += 'IO';
      lower += 'lo';
      numbers += '01';
    }

    let charPool = '';
    const guaranteedChars: string[] = [];

    if (useUpper) {
      charPool += upper;
      guaranteedChars.push(upper[this.secureRandomInt(upper.length)]);
    }
    if (useLower) {
      charPool += lower;
      guaranteedChars.push(lower[this.secureRandomInt(lower.length)]);
    }
    if (useNumbers) {
      charPool += numbers;
      guaranteedChars.push(numbers[this.secureRandomInt(numbers.length)]);
    }
    if (useSymbols) {
      charPool += symbols;
      guaranteedChars.push(symbols[this.secureRandomInt(symbols.length)]);
    }

    if (!charPool) {
      charPool = lower + numbers;
    }

    const resultChars: string[] = [...guaranteedChars];
    for (let i = guaranteedChars.length; i < length; i++) {
      resultChars.push(charPool[this.secureRandomInt(charPool.length)]);
    }

    // Shuffle characters
    for (let i = resultChars.length - 1; i > 0; i--) {
      const j = this.secureRandomInt(i + 1);
      [resultChars[i], resultChars[j]] = [resultChars[j], resultChars[i]];
    }

    return resultChars.join('');
  }

  /**
   * Password Strength Evaluator
   */
  static evaluateStrength(password: string): {
    score: number; // 0 to 100
    level: 'weak' | 'medium' | 'strong' | 'very-strong';
    label: string;
    color: string;
  } {
    if (!password) {
      return { score: 0, level: 'weak', label: 'بدون رمز', color: 'text-red-400' };
    }

    let score = 0;

    // Length check
    if (password.length >= 8) score += 20;
    if (password.length >= 12) score += 25;
    if (password.length >= 16) score += 15;

    // Diversity checks
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/[0-9]/.test(password)) score += 10;
    if (/[^A-Za-z0-9]/.test(password)) score += 15;

    // Penalty for repeats or sequential
    if (/(.)\1{2,}/.test(password)) score -= 15;
    if (/1234|abcd|password|admin/i.test(password)) score -= 25;

    score = Math.max(5, Math.min(100, score));

    if (score < 40) {
      return { score, level: 'weak', label: 'ضعیف', color: 'text-rose-500' };
    } else if (score < 70) {
      return { score, level: 'medium', label: 'متوسط', color: 'text-amber-500' };
    } else if (score < 88) {
      return { score, level: 'strong', label: 'قوی', color: 'text-blue-500' };
    } else {
      return { score, level: 'very-strong', label: 'بسیار امن', color: 'text-emerald-500' };
    }
  }
}
