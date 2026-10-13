/**
 * Cloudflare Integration Service
 */

export interface CloudflareAccount {
  id: string;
  name: string;
}

export interface CloudflareZone {
  id: string;
  name: string;
}

export interface CloudflareStatus {
  connected: boolean;
  isDemo: boolean;
  account?: { id: string; name: string } | null;
}

export interface DeployResult {
  success: boolean;
  url: string;
  scriptName: string;
  deployedAt: string;
  message: string;
  zoneRouteAdded?: boolean;
  deployMode?: 'embedded' | 'dynamic';
}

export const CLOUDFLARE_TOKEN_TEMPLATE_URL = 
  'https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_kv_storage%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_routes%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22zone%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22account%22%2C%22type%22%3A%22read%22%7D%5D&accountId=*&zoneId=all&name=MySite%20Worker%20Deploy';

export class CloudflareService {
  /**
   * Get current connection status
   */
  static async getStatus(): Promise<CloudflareStatus> {
    try {
      const res = await fetch('/api/cloudflare/status');
      if (!res.ok) throw new Error('Status fetch failed');
      return await res.json();
    } catch {
      return { connected: false, isDemo: false };
    }
  }

  /**
   * Connect with API Token or Demo Mode
   */
  static async connect(token: string, demoMode: boolean = false): Promise<{
    success: boolean;
    accounts: CloudflareAccount[];
    isDemo?: boolean;
  }> {
    const res = await fetch('/api/cloudflare/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, demoMode }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'خطا در اتصال به Cloudflare');
    }

    return data;
  }

  /**
   * Fetch connected accounts
   */
  static async getAccounts(): Promise<CloudflareAccount[]> {
    const res = await fetch('/api/cloudflare/accounts');
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'خطا در دریافت اکانت‌ها');
    }
    return data.accounts || [];
  }

  /**
   * Fetch zones for the selected account
   */
  static async getZones(accountId: string): Promise<CloudflareZone[]> {
    const res = await fetch(`/api/cloudflare/zones?accountId=${encodeURIComponent(accountId)}`);
    const data = await res.json();
    if (!res.ok) {
      return [];
    }
    return data.zones || [];
  }

  /**
   * Trigger deployment to Cloudflare Workers
   * supports Method 1 ('embedded') and Method 2 ('dynamic' remote loader)
   */
  static async deploy(params: {
    accountId: string;
    zoneId?: string;
    scriptName?: string;
    customSubdomain?: string;
    deployMode?: 'embedded' | 'dynamic';
    originUrl?: string;
  }): Promise<DeployResult> {
    const res = await fetch('/api/cloudflare/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'خطا در دیپلوی روی Cloudflare Workers');
    }

    return data;
  }

  /**
   * Disconnect Cloudflare token
   */
  static async disconnect(): Promise<boolean> {
    try {
      const res = await fetch('/api/cloudflare/disconnect', { method: 'POST' });
      return res.ok;
    } catch {
      return false;
    }
  }
}
