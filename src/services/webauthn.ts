/**
 * WebAuthn Biometric Service for Face ID (iPhone) & Touch ID / Fingerprint
 */
import { BiometricType } from '../types';

export class BiometricService {
  /**
   * Detects device type and operating system to provide accurate Persian labeling
   */
  static getDeviceBiometricLabel(): { type: BiometricType; labelFa: string; subLabelFa: string } {
    if (typeof window === 'undefined') {
      return { type: 'generic', labelFa: 'احراز هویت بیومتریک', subLabelFa: 'اثر انگشت یا تشخیص چهره' };
    }

    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isMac = /macintosh|mac os x/.test(ua) && !isIOS;
    const isAndroid = /android/.test(ua);

    if (isIOS) {
      return {
        type: 'face-id',
        labelFa: 'فیس‌آیدی آیفون (Face ID)',
        subLabelFa: 'تشخیص چهره سریع در گوشی آیفون',
      };
    }

    if (isAndroid) {
      return {
        type: 'fingerprint',
        labelFa: 'حسگر اثر انگشت موبایل',
        subLabelFa: 'سنسور اثر انگشت گوشی هوشمند',
      };
    }

    if (isMac) {
      return {
        type: 'touch-id',
        labelFa: 'تاچ‌آیدی (Touch ID)',
        subLabelFa: 'اثر انگشت در مک‌بوک / اپل',
      };
    }

    return {
      type: 'generic',
      labelFa: 'اثر انگشت / فیس‌آیدی',
      subLabelFa: 'حسگر بیومتریک ویندوز هلو / دستگاه',
    };
  }

  /**
   * Checks if the device has a platform authenticator (Face ID / Fingerprint sensor)
   */
  static async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (!window.PublicKeyCredential) return false;

    try {
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      }
      return false;
    } catch (e) {
      console.warn('Biometric check failed:', e);
      return false;
    }
  }

  /**
   * Registers a biometric credential (Face ID / Touch ID / fingerprint) on this device.
   * Requests the WebAuthn PRF extension so the credential can later produce a secret
   * that encrypts the vault key (true cryptographic binding to the biometric).
   */
  static async registerBiometric(username = 'user'): Promise<{ credentialId: string; prfEnabled: boolean }> {
    if (!window.PublicKeyCredential) {
      throw new Error('دستگاه شما از احراز هویت بیومتریک (WebAuthn) در این مرورگر پشتیبانی نمی‌کند.');
    }

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const creationOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'KeepPass Vault',
      },
      user: {
        id: userId,
        name: `${username}@keeppass`,
        displayName: `KeepPass – ${username}`,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },  // ES256
        { alg: -257, type: 'public-key' } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Internal device: Face ID or Touch ID
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
      extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
    };

    const credential = (await navigator.credentials.create({
      publicKey: creationOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
      throw new Error('ثبت بیومتریک انجام نشد یا توسط کاربر لغو گردید.');
    }

    const ext = credential.getClientExtensionResults() as { prf?: { enabled?: boolean } };
    return {
      credentialId: bytesToBase64(new Uint8Array(credential.rawId)),
      prfEnabled: ext.prf?.enabled === true,
    };
  }

  /**
   * Prompts the biometric and asks the authenticator for a PRF output bound to `prfSaltBase64`.
   * Returns null when the authenticator/browser does not support PRF.
   */
  static async getPrfOutput(credentialIdBase64: string, prfSaltBase64: string): Promise<Uint8Array | null> {
    if (!window.PublicKeyCredential) {
      throw new Error('مرورگر از وب‌آتن پشتیبانی نمی‌کند.');
    }

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'required',
        allowCredentials: [
          { id: base64ToBytes(credentialIdBase64), type: 'public-key', transports: ['internal', 'hybrid'] },
        ],
        extensions: {
          prf: { eval: { first: base64ToBytes(prfSaltBase64) } },
        } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null;

    if (!assertion) {
      throw new Error('احراز هویت بیومتریک لغو شد.');
    }

    const ext = assertion.getClientExtensionResults() as {
      prf?: { results?: { first?: ArrayBuffer | ArrayBufferView } };
    };
    const first = ext.prf?.results?.first;
    if (!first) return null;
    const bytes = first instanceof ArrayBuffer
      ? new Uint8Array(first)
      : new Uint8Array(first.buffer, first.byteOffset, first.byteLength);
    return bytes.length >= 32 ? bytes.slice(0, 32) : null;
  }

  /**
   * Verifies the biometric credential (Prompts Face ID or Fingerprint on screen).
   * Note: this is a local user-presence check only; it is not tied to the vault key.
   */
  static async verifyBiometric(credentialIdBase64?: string): Promise<boolean> {
    if (!window.PublicKeyCredential) {
      throw new Error('مرورگر از وب‌آتن پشتیبانی نمی‌کند.');
    }

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const requestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      userVerification: 'required',
    };

    if (credentialIdBase64) {
      requestOptions.allowCredentials = [
        {
          id: base64ToBytes(credentialIdBase64),
          type: 'public-key',
          transports: ['internal', 'hybrid'],
        },
      ];
    }

    const assertion = await navigator.credentials.get({
      publicKey: requestOptions,
    });

    return !!assertion;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
