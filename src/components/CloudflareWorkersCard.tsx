import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  ExternalLink, 
  KeyRound, 
  Layers, 
  Globe, 
  Server, 
  Rocket, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Unlink, 
  Check, 
  Copy, 
  Sparkles,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { 
  CloudflareService, 
  CloudflareAccount, 
  CloudflareZone, 
  DeployResult,
  CLOUDFLARE_TOKEN_TEMPLATE_URL 
} from '../services/cloudflare';

export const CloudflareWorkersCard: React.FC = () => {
  // Connection states
  const [tokenInput, setTokenInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [connectSuccess, setConnectSuccess] = useState('');

  // Configuration states
  const [accounts, setAccounts] = useState<CloudflareAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [zones, setZones] = useState<CloudflareZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [workerName, setWorkerName] = useState('keeppass-vault');

  // Deploy states
  const [deployMode, setDeployMode] = useState<'dynamic' | 'embedded'>('dynamic');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [deployError, setDeployError] = useState('');
  const [isCopiedUrl, setIsCopiedUrl] = useState(false);

  // Check initial connection status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const status = await CloudflareService.getStatus();
      if (status.connected) {
        setIsConnected(true);
        setIsDemoMode(status.isDemo);
        await loadAccountsAndZones();
      }
    } catch (e) {
      console.warn('Initial CF status check failed:', e);
    }
  };

  const loadAccountsAndZones = async () => {
    try {
      const accList = await CloudflareService.getAccounts();
      setAccounts(accList);
      if (accList.length > 0) {
        const initialAccId = accList[0].id;
        setSelectedAccountId(initialAccId);
        loadZones(initialAccId);
      }
    } catch (err: unknown) {
      console.warn('Load accounts note:', err);
    }
  };

  const loadZones = async (accId: string) => {
    try {
      const zoneList = await CloudflareService.getZones(accId);
      setZones(zoneList);
    } catch {
      setZones([]);
    }
  };

  // Step 1: Open Cloudflare Template URL
  const handleOpenTemplateUrl = () => {
    window.open(CLOUDFLARE_TOKEN_TEMPLATE_URL, '_blank', 'noopener,noreferrer');
  };

  // Step 2: Connect Token
  const handleConnect = async (isDemo = false) => {
    setConnectError('');
    setConnectSuccess('');
    setIsConnecting(true);

    try {
      const result = await CloudflareService.connect(tokenInput, isDemo);
      setIsConnected(true);
      setIsDemoMode(!!result.isDemo);
      setAccounts(result.accounts);
      setConnectSuccess(isDemo ? 'حالت دمو فعال شد.' : 'اتصال به Cloudflare با موفقیت تایید شد.');

      if (result.accounts.length > 0) {
        const firstId = result.accounts[0].id;
        setSelectedAccountId(firstId);
        loadZones(firstId);
      }
      setTokenInput('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در برقراری ارتباط.';
      setConnectError(msg);
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    await CloudflareService.disconnect();
    setIsConnected(false);
    setIsDemoMode(false);
    setAccounts([]);
    setZones([]);
    setSelectedAccountId('');
    setSelectedZoneId('');
    setDeployResult(null);
    setDeployError('');
    setConnectSuccess('');
  };

  // Step 6: Deploy
  const handleDeploy = async () => {
    if (!selectedAccountId) {
      setDeployError('لطفاً یک اکانت را انتخاب کنید.');
      return;
    }

    setIsDeploying(true);
    setDeployError('');
    setDeployResult(null);

    try {
      const res = await CloudflareService.deploy({
        accountId: selectedAccountId,
        zoneId: selectedZoneId || undefined,
        scriptName: workerName.trim(),
        deployMode,
      });
      setDeployResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در عملیات دیپلوی.';
      setDeployError(msg);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!deployResult?.url) return;
    try {
      await navigator.clipboard.writeText(deployResult.url);
      setIsCopiedUrl(true);
      setTimeout(() => setIsCopiedUrl(false), 2000);
    } catch {
      setIsCopiedUrl(true);
    }
  };

  return (
    <div 
      className="p-5 sm:p-6 rounded-2xl bg-[#0F1524] border border-[#1F2B47] space-y-6 text-[#E7EDFA] relative overflow-hidden"
      style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
    >
      {/* Glow Ambient */}
      <div className="absolute top-0 right-0 w-44 h-44 bg-[#F38020]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-44 h-44 bg-[#4F7CFF]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1F2B47]/80" style={{ borderColor: 'var(--ui-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#F38020] to-[#FAAE40] flex items-center justify-center text-white shadow-lg shadow-[#F38020]/20 shrink-0">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base sm:text-lg text-white">اتصال به Cloudflare Workers</h3>
              {isConnected ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  {isDemoMode ? 'متصل (دمو)' : 'متصل'}
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  نیازمند اتصال
                </span>
              )}
            </div>
            <p className="text-xs text-[#94A2C2] mt-0.5" style={{ color: 'var(--ui-text-secondary)' }}>
              دیپلوی وب‌اپلیکیشن روی شبکه لبه جهانی کلودفلر با زیردامنه رایگان یا دامنه اختصاصی
            </p>
          </div>
        </div>

        {isConnected && (
          <button
            type="button"
            onClick={handleDisconnect}
            className="self-start sm:self-auto py-1.5 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-400 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
          >
            <Unlink className="w-3.5 h-3.5" />
            قطع اتصال
          </button>
        )}
      </div>

      {/* ==================================================== */}
      {/* Phase 1: Not Connected Yet (Steps 1 & 2) */}
      {/* ==================================================== */}
      {!isConnected ? (
        <div className="space-y-4">
          {/* Step 1: Create Token with Pre-configured Template */}
          <div className="p-4 rounded-xl bg-[#121A2C] border border-[#1F2B47] space-y-3" style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <span className="w-5 h-5 rounded-full bg-[#F38020]/20 text-[#F38020] flex items-center justify-center text-[11px]">۱</span>
                گام اول: ساخت API Token در Cloudflare
              </div>
            </div>

            <p className="text-xs text-[#94A2C2] leading-relaxed" style={{ color: 'var(--ui-text-secondary)' }}>
              در صفحه Cloudflare فقط دکمه‌های <strong>Continue</strong> و <strong>Create Token</strong> را بزنید، سپس توکن تولیدشده را کپی کرده و در کادر زیر وارد کنید. تمام مجوزها از پیش تنظیم شده‌اند.
            </p>

            <button
              type="button"
              onClick={handleOpenTemplateUrl}
              className="py-2.5 px-4 rounded-xl bg-[#F38020] hover:bg-[#E07015] text-white font-bold text-xs shadow-md shadow-[#F38020]/25 transition cursor-pointer flex items-center gap-2"
            >
              <span>ساخت API Token در Cloudflare</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          {/* Step 2: Paste and Connect */}
          <div className="p-4 rounded-xl bg-[#121A2C] border border-[#1F2B47] space-y-3" style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}>
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <span className="w-5 h-5 rounded-full bg-[#4F7CFF]/20 text-[#4F7CFF] flex items-center justify-center text-[11px]">۲</span>
              گام دوم: وارد کردن API Token
            </div>

            <div className="relative">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="API Token تولیدشده را اینجا Paste کنید..."
                className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#F38020] dir-ltr text-left"
                style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleConnect(false)}
                disabled={isConnecting || !tokenInput.trim()}
                className="py-2 px-5 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#8A5CFF] text-white font-bold text-xs shadow-md shadow-[#4F7CFF]/25 hover:opacity-95 transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {isConnecting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    در حال اعتبارسنجی و اتصال...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    اتصال به Cloudflare
                  </>
                )}
              </button>

              {/* Demo Mode Fallback */}
              <button
                type="button"
                onClick={() => handleConnect(true)}
                disabled={isConnecting}
                className="text-xs text-[#38E1FF] hover:underline transition cursor-pointer flex items-center gap-1 font-medium"
              >
                <Sparkles className="w-3.5 h-3.5" />
                تست آزمایشی (بدون توکن زنده)
              </button>
            </div>

            {connectError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{connectError}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ==================================================== */
        /* Phase 2: Connected (Steps 3, 4, 5, 6 & Deploy Status) */
        /* ==================================================== */
        <div className="space-y-4">
          {connectSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{connectSuccess}</span>
            </div>
          )}

          {/* Config Grid: Account, Zone, Worker Name */}
          <div className="p-4 rounded-xl bg-[#121A2C] border border-[#1F2B47] space-y-4" style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Step 3: Account Selection */}
              <div>
                <label className="block font-bold text-white mb-1.5 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-[#4F7CFF]/20 text-[#4F7CFF] flex items-center justify-center text-[10px]">۳</span>
                  انتخاب اکانت Cloudflare *
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => {
                    setSelectedAccountId(e.target.value);
                    loadZones(e.target.value);
                  }}
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#4F7CFF]"
                  style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.id.slice(0, 8)}...)
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 4: Zone Selection (Optional) */}
              <div>
                <label className="block font-bold text-white mb-1.5 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-[#8A5CFF]/20 text-[#8A5CFF] flex items-center justify-center text-[10px]">۴</span>
                  دامنه یا Zone (اختیاری)
                </label>
                <select
                  value={selectedZoneId}
                  onChange={(e) => setSelectedZoneId(e.target.value)}
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#4F7CFF]"
                  style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                >
                  <option value="">زیردامنه رایگان workers.dev (پیش‌فرض)</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Step 5: Worker Name */}
            <div>
              <label className="block font-bold text-white mb-1.5 flex items-center gap-1.5 text-xs">
                <span className="w-4 h-4 rounded-full bg-[#38E1FF]/20 text-[#38E1FF] flex items-center justify-center text-[10px]">۵</span>
                نام اسکریپت Worker (Worker Name)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  placeholder="keeppass-vault"
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#F38020] dir-ltr text-left"
                  style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                />
              </div>
              <p className="text-[11px] text-[#94A2C2] mt-1" style={{ color: 'var(--ui-text-secondary)' }}>
                آدرس نهایی شما: <span className="font-mono text-white dir-ltr">https://{workerName || 'keeppass-vault'}.your-subdomain.workers.dev</span>
              </p>
            </div>

            {/* Step 5.5: Architecture Method Selector (روش ۱ در برابر روش ۲) */}
            <div className="p-3.5 rounded-xl bg-[#0F1524] border border-[#1F2B47] space-y-2.5" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-400" />
                  شیوه دریافت آپدیت‌ها در کلودفلر:
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                  {deployMode === 'dynamic' ? 'روش ۲ (لودر پویا)' : 'روش ۱ (مستقل)'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* Method 2 Option */}
                <button
                  type="button"
                  onClick={() => setDeployMode('dynamic')}
                  className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                    deployMode === 'dynamic'
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                      : 'bg-[#121A2C] border-[#1F2B47] text-[#94A2C2] hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1">
                      <span>روش ۲: لودر پویا و خودکار (پیشنهادی)</span>
                    </span>
                    <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${deployMode === 'dynamic' ? 'border-amber-400 bg-amber-400' : 'border-slate-600'}`}>
                      {deployMode === 'dynamic' && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                    </span>
                  </div>
                  <p className="text-[10px] leading-relaxed opacity-80">
                    ورکر آپدیت‌های جدید (مثل نسخه ۴) را بدون نیاز به دیپلوی مجدد از ریپازیتوری لود می‌کند.
                  </p>
                </button>

                {/* Method 1 Option */}
                <button
                  type="button"
                  onClick={() => setDeployMode('embedded')}
                  className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                    deployMode === 'embedded'
                      ? 'bg-[#4F7CFF]/15 border-[#4F7CFF]/40 text-[#38E1FF]'
                      : 'bg-[#121A2C] border-[#1F2B47] text-[#94A2C2] hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1">
                      <span>روش ۱: استقرار مستقل و ثابت</span>
                    </span>
                    <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${deployMode === 'embedded' ? 'border-[#38E1FF] bg-[#38E1FF]' : 'border-slate-600'}`}>
                      {deployMode === 'embedded' && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                    </span>
                  </div>
                  <p className="text-[10px] leading-relaxed opacity-80">
                    کامل‌ترین استقلال؛ تمام کدها درون خود ورکر بسته‌بندی شده و برای هر نسخه دیپلوی اجرا می‌شود.
                  </p>
                </button>
              </div>
            </div>

            {/* Step 6: Deploy Trigger Button */}
            <div className="pt-2 border-t border-[#1F2B47]/70 flex items-center justify-between gap-3" style={{ borderColor: 'var(--ui-border)' }}>
              <div className="text-xs text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>
                آماده برای استقرار مستقیم روی شبکه سراسری Cloudflare
              </div>
              <button
                type="button"
                onClick={handleDeploy}
                disabled={isDeploying || !selectedAccountId}
                className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-[#F38020] to-[#FAAE40] text-white font-bold text-xs shadow-lg shadow-[#F38020]/25 hover:opacity-95 transition disabled:opacity-50 cursor-pointer flex items-center gap-2 shrink-0"
              >
                {isDeploying ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    در حال ساخت و آپلود Worker...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    Deploy to Cloudflare Workers
                  </>
                )}
              </button>
            </div>

            {deployError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deployError}</span>
              </div>
            )}
          </div>

          {/* Deployment Success Card & Live Link */}
          {deployResult && (
            <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-[#121A2C] border border-emerald-500/30 space-y-3.5 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  دیپلوی با موفقیت به پایان رسید!
                </div>
                <span className="text-[11px] text-[#94A2C2] font-mono dir-ltr">
                  {new Date(deployResult.deployedAt).toLocaleTimeString('fa-IR')}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#0F1524] border border-[#1F2B47] flex items-center justify-between gap-2" style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}>
                <span className="font-mono text-xs text-white truncate dir-ltr text-left">
                  {deployResult.url}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="p-1.5 rounded-lg bg-[#1F2B47] hover:bg-[#2C3C61] text-[#94A2C2] hover:text-white transition cursor-pointer"
                    title="کپی آدرس سایت"
                  >
                    {isCopiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <a
                  href={deployResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-500/25 transition inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>مشاهده سایت آنلاین</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                {deployResult.zoneRouteAdded && (
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    مسیر دامنه اختصاصی متصل شد
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Security Note */}
      <div className="pt-2 text-[11px] text-[#5D6B8F] flex items-center gap-2">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
        <span>توکن Cloudflare شما هرگز در فرانت‌اند افشا نمی‌شود و به صورت رمزنگاری‌شده با استاندارد AES-256-GCM در سرور نگهداری می‌گردد.</span>
      </div>
    </div>
  );
};
