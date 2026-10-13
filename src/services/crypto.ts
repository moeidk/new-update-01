/**
 * Cryptography Service for KeepPass Vault
 * Uses standard Web Crypto API (AES-GCM 256-bit + PBKDF2)
 */

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
   * Hashes a password with salt using SHA-256 for password verification
   */
  static async hashPassword(password: string, saltBase64: string): Promise<string> {
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
  static async deriveKey(password: string, saltBase64: string): Promise<CryptoKey> {
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
        iterations: 100000,
        hash: 'SHA-256',
      },
      passKey,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true, // extractable for biometric unlock caching if enabled
      ['encrypt', 'decrypt']
    );
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
      guaranteedChars.push(upper[Math.floor(Math.random() * upper.length)]);
    }
    if (useLower) {
      charPool += lower;
      guaranteedChars.push(lower[Math.floor(Math.random() * lower.length)]);
    }
    if (useNumbers) {
      charPool += numbers;
      guaranteedChars.push(numbers[Math.floor(Math.random() * numbers.length)]);
    }
    if (useSymbols) {
      charPool += symbols;
      guaranteedChars.push(symbols[Math.floor(Math.random() * symbols.length)]);
    }

    if (!charPool) {
      charPool = lower + numbers;
    }

    const randomArray = new Uint32Array(length);
    crypto.getRandomValues(randomArray);

    const resultChars: string[] = [...guaranteedChars];
    for (let i = guaranteedChars.length; i < length; i++) {
      const idx = randomArray[i] % charPool.length;
      resultChars.push(charPool[idx]);
    }

    // Shuffle characters
    for (let i = resultChars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
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
