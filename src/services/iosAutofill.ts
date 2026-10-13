/**
 * iOS Safari & Apple Keychain AutoFill Helper Service
 * Manages Credential Management API (PasswordCredential) and iOS Safari AutoFill interactions.
 */

export class IOSAutoFillService {
  /**
   * Checks if user is on iOS device (iPhone, iPad, iPod)
   */
  static isIOSDevice(): boolean {
    if (typeof window === 'undefined' || !navigator) return false;
    const ua = navigator.userAgent || '';
    const platform = (navigator as unknown as { userAgentData?: { platform?: string }; platform?: string }).platform || '';
    return (
      /iPad|iPhone|iPod/.test(ua) ||
      (platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
      /iPhone|iPad/i.test(navigator.vendor || '')
    );
  }

  /**
   * Checks if the Credential Management API (PasswordCredential) is supported
   */
  static isCredentialApiSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'credentials' in navigator &&
      typeof (window as unknown as { PasswordCredential?: unknown }).PasswordCredential === 'function'
    );
  }

  /**
   * Attempts to save/update the master password credential into browser/iCloud Keychain
   * so that iPhone prompts "Save Password in iCloud Keychain?"
   */
  static async saveMasterPasswordToKeychain(password: string, username = 'کاربر گاوصندوق'): Promise<boolean> {
    try {
      if (!this.isCredentialApiSupported()) {
        console.info('PasswordCredential API not supported in this browser context.');
        return false;
      }

      const PasswordCred = (window as unknown as { PasswordCredential: new (data: { id: string; password: string; name?: string }) => Credential }).PasswordCredential;
      const cred = new PasswordCred({
        id: username,
        password: password,
        name: 'KeepPass Vault',
      });

      await navigator.credentials.store(cred);
      return true;
    } catch (err) {
      console.warn('Could not store credential via navigator.credentials.store:', err);
      return false;
    }
  }

  /**
   * Attempts to request stored credential from iCloud Keychain via Credential Management API
   */
  static async requestStoredCredential(): Promise<{ username?: string; password?: string } | null> {
    try {
      if (!this.isCredentialApiSupported()) return null;

      const cred = (await navigator.credentials.get({
        password: true,
        mediation: 'optional',
      } as unknown as CredentialRequestOptions)) as unknown as { id?: string; password?: string } | null;

      if (cred && cred.password) {
        return {
          username: cred.id,
          password: cred.password,
        };
      }
      return null;
    } catch (err) {
      console.warn('Failed to retrieve credential via navigator.credentials.get:', err);
      return null;
    }
  }

  /**
   * Alias for requestStoredCredential
   */
  static async requestPasswordFromKeychain(): Promise<{ username?: string; password?: string } | null> {
    return this.requestStoredCredential();
  }
}
