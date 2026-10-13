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
   * Registers a biometric credential (Face ID or Touch ID) on this device
   */
  static async registerBiometric(): Promise<string> {
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
        // In local/preview environments, omit id or let browser default to current host
      },
      user: {
        id: userId,
        name: 'user@keeppass.local',
        displayName: 'کاربر KeepPass',
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
    };

    const credential = (await navigator.credentials.create({
      publicKey: creationOptions,
    })) as PublicKeyCredential;

    if (!credential) {
      throw new Error('ثبت بیومتریک انجام نشد یا توسط کاربر لغو گردید.');
    }

    // Convert credential ID (ArrayBuffer) to base64
    const rawId = new Uint8Array(credential.rawId);
    let binary = '';
    for (let i = 0; i < rawId.byteLength; i++) {
      binary += String.fromCharCode(rawId[i]);
    }
    return btoa(binary);
  }

  /**
   * Verifies the biometric credential (Prompts Face ID or Fingerprint on screen)
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
      const binary = atob(credentialIdBase64);
      const credIdBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        credIdBytes[i] = binary.charCodeAt(i);
      }
      requestOptions.allowCredentials = [
        {
          id: credIdBytes,
          type: 'public-key',
          transports: ['internal'],
        },
      ];
    }

    const assertion = await navigator.credentials.get({
      publicKey: requestOptions,
    });

    return !!assertion;
  }
}
