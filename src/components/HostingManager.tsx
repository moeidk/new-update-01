import { JalaliDatePicker } from './JalaliDatePicker';
import React, { useState, useMemo } from 'react';
import { 
  Globe, 
  Server, 
  Shield, 
  Plus, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Send, 
  Search, 
  ExternalLink, 
  Trash2, 
  Edit3, 
  DollarSign, 
  Download, 
  X,
  Layers,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';
import { HostingDomainItem, HostingType, UserProfile } from '../types';
import { HostingService } from '../services/hostingService';
import { TelegramService } from '../services/telegramService';
import { compareJalaliDates, getCurrentJalali } from '../utils/jalali';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { FormattedNumberInput } from './FormattedNumberInput';

interface HostingManagerProps {
  currentUser: UserProfile;
  hostingItems: HostingDomainItem[];
  setHostingItems: React.Dispatch<React.SetStateAction<HostingDomainItem[]>>;
  onOpenSettingsTab?: () => void;
}

export const HostingManager: React.FC<HostingManagerProps> = ({
  currentUser,
  hostingItems,
  setHostingItems,
  onOpenSettingsTab,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | HostingType>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HostingDomainItem | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<HostingType>('domain');
  const [formProvider, setFormProvider] = useState('');
  const [formRenewalDate, setFormRenewalDate] = useState('');
  const [formCost, setFormCost] = useState<number>(0);
  const [formPeriod, setFormPeriod] = useState<'monthly' | 'yearly' | 'multi-year'>('yearly');
  const [formAutoRenew, setFormAutoRenew] = useState(false);
  const [formDnsOrIp, setFormDnsOrIp] = useState('');
  const [formLoginUrl, setFormLoginUrl] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Status action banners
  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Stats
  const stats = useMemo(() => HostingService.getStats(hostingItems), [hostingItems]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setActionNotice({ message, type });
    setTimeout(() => setActionNotice(null), 4000);
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormType('domain');
    setFormProvider('');
    setFormRenewalDate(getCurrentJalali().str);
    setFormCost(150000);
    setFormPeriod('yearly');
    setFormAutoRenew(false);
    setFormDnsOrIp('');
    setFormLoginUrl('');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: HostingDomainItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormType(item.type);
    setFormProvider(item.provider);
    setFormRenewalDate(item.renewalDate);
    setFormCost(item.cost || 0);
    setFormPeriod(item.period);
    setFormAutoRenew(item.autoRenew);
    setFormDnsOrIp(item.dnsOrIp || '');
    setFormLoginUrl(item.loginUrl || '');
    setFormNotes(item.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showNotification('نام دامنه یا سرویس الزامی است', 'error');
      return;
    }

    const payload: Partial<HostingDomainItem> = {
      ...(editingItem ? { id: editingItem.id } : {}),
      name: formName.trim(),
      type: formType,
      provider: formProvider.trim() || 'سایر',
      renewalDate: formRenewalDate.trim(),
      cost: formCost,
      period: formPeriod,
      autoRenew: formAutoRenew,
      dnsOrIp: formDnsOrIp.trim(),
      loginUrl: formLoginUrl.trim(),
      notes: formNotes.trim(),
    };

    const updated = HostingService.saveHostingItem(currentUser.username, payload);
    setHostingItems(updated);
    setIsModalOpen(false);
    showNotification(editingItem ? 'سرویس با موفقیت ویرایش شد' : 'سرویس جدید با موفقیت افزوده شد');
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`آیا از حذف سرویس "${name}" اطمینان دارید؟`)) {
      const updated = HostingService.deleteHostingItem(currentUser.username, id);
      setHostingItems(updated);
      showNotification('سرویس با موفقیت حذف شد');
    }
  };

  const handleRenew = (id: string, name: string) => {
    const updated = HostingService.renewHostingItem(currentUser.username, id);
    setHostingItems(updated);
    showNotification(`تمدید سرویس "${name}" ثبت شد و تاریخ سررسید به دوره بعدی به‌روزرسانی شد`);
  };

  const handleSendTelegram = async (item: HostingDomainItem) => {
    const tgSettings = TelegramService.getSettings(currentUser.username);
    if (!tgSettings.botToken || !tgSettings.chatId) {
      showNotification('لطفاً ابتدا در تب تنظیمات، توکن و شناسه چت تلگرام خود را وارد کنید.', 'error');
      if (onOpenSettingsTab) onOpenSettingsTab();
      return;
    }

    showNotification(`در حال ارسال هشدار تمدید "${item.name}" به تلگرام...`);
    const res = await TelegramService.sendHostingAlert(tgSettings, item);
    if (res.success) {
      showNotification(`هشدار با موفقیت به تلگرام شما ارسال شد!`);
    } else {
      showNotification(res.message, 'error');
    }
  };

  const handleExportCSV = () => {
    const csv = HostingService.exportToCSV(hostingItems);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `hosting-domains-${currentUser.username}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('فایل اکسل/CSV دامنه‌ها با موفقیت دریافت شد');
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    return hostingItems.filter((item) => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.dnsOrIp && item.dnsOrIp.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.notes && item.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = selectedTypeFilter === 'all' || item.type === selectedTypeFilter;
      const matchesStatus = selectedStatusFilter === 'all' || item.status === selectedStatusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [hostingItems, searchTerm, selectedTypeFilter, selectedStatusFilter]);

  const getTypeIcon = (type: HostingType) => {
    switch (type) {
      case 'domain':
        return <Globe className="w-4 h-4 text-[#38E1FF]" />;
      case 'host':
        return <Server className="w-4 h-4 text-emerald-400" />;
      case 'vps':
        return <Layers className="w-4 h-4 text-purple-400" />;
      case 'ssl':
        return <Shield className="w-4 h-4 text-amber-400" />;
      default:
        return <Globe className="w-4 h-4 text-[#4F7CFF]" />;
    }
  };

  const getTypeLabel = (type: HostingType) => {
    switch (type) {
      case 'domain': return 'دامنه اینترنتی';
      case 'host': return 'هاست میزبانی';
      case 'vps': return 'سرور مجازی/ابری';
      case 'ssl': return 'گواهی SSL';
      default: return 'سایر سرویس‌ها';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      {actionNotice && (
        <div className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold transition-all shadow-lg animate-in fade-in duration-200 ${
          actionNotice.type === 'success' 
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
            : 'bg-red-500/10 border border-red-500/30 text-red-300'
        }`}>
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{actionNotice.message}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-white/60 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div 
        className="p-6 rounded-3xl border border-[#1F2B47] bg-gradient-to-br from-[#121A2C] via-[#0F1524] to-[#0A0D14] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl"
        style={{ borderColor: 'var(--ui-border)' }}
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-xl bg-[#38E1FF]/10 text-[#38E1FF] border border-[#38E1FF]/20">
              <Globe className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-white" style={{ color: 'var(--ui-text-primary)' }}>
              مدیریت سررسید هاست، دامنه‌ها و سرورها
            </h1>
          </div>
          <p className="text-xs text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>
            پایش دقیق موعدهای تمدید سالانه و ماهانه، جلوگیری از مسدود شدن دامنه‌ها و ارسال هشدار خودکار به تلگرام
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={openAddModal}
            className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#38E1FF] hover:from-[#3b6ee9] hover:to-[#28ccf0] text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-[#4F7CFF]/20 cursor-pointer transition transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت سرویس جدید</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="py-2.5 px-3.5 rounded-xl bg-[#0F1524] hover:bg-[#182239] border border-[#1F2B47] text-[#94A2C2] hover:text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
            title="خروجی اکسل و CSV"
          >
            <Download className="w-4 h-4 text-[#38E1FF]" />
            <span className="hidden sm:inline">خروجی اکسل</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Services */}
        <div 
          className="p-4 sm:p-5 rounded-2xl bg-[#121A2C] border border-[#1F2B47] flex items-center justify-between"
          style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
        >
          <div>
            <span className="text-[11px] font-bold text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>
              کل دامنه‌ها و سرویس‌ها
            </span>
            <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1 tabular-nums">
              {formatNumber(stats.totalCount)}
            </div>
            <span className="text-[10px] text-emerald-400 font-medium">
              {formatNumber(stats.activeCount)} سرویس فعال و معتبر
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#4F7CFF]/10 text-[#4F7CFF] flex items-center justify-center border border-[#4F7CFF]/20">
            <Globe className="w-5 h-5" />
          </div>
        </div>

        {/* Expiring Soon */}
        <div 
          className="p-4 sm:p-5 rounded-2xl bg-[#121A2C] border border-[#1F2B47] flex items-center justify-between"
          style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
        >
          <div>
            <span className="text-[11px] font-bold text-amber-400">
              نزدیک به سررسید تمدید
            </span>
            <div className="text-xl sm:text-2xl font-black font-mono text-amber-300 mt-1 tabular-nums">
              {formatNumber(stats.expiringCount)}
            </div>
            <span className="text-[10px] text-[#94A2C2]">
              موعد تا ۳۰ روز آینده
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Expired */}
        <div 
          className="p-4 sm:p-5 rounded-2xl bg-[#121A2C] border border-[#1F2B47] flex items-center justify-between"
          style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
        >
          <div>
            <span className="text-[11px] font-bold text-red-400">
              منقضی شده (معوقه)
            </span>
            <div className="text-xl sm:text-2xl font-black font-mono text-red-400 mt-1 tabular-nums">
              {formatNumber(stats.expiredCount)}
            </div>
            <span className="text-[10px] text-red-300/80">
              نیازمند تمدید فوری
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/20">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* Total Cost */}
        <div 
          className="p-4 sm:p-5 rounded-2xl bg-[#121A2C] border border-[#1F2B47] flex items-center justify-between"
          style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
        >
          <div>
            <span className="text-[11px] font-bold text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>
              بودجه کل تمدید دوره‌ای
            </span>
            <div className="text-lg sm:text-xl font-black font-mono text-[#38E1FF] mt-1 tabular-nums">
              {formatCurrency(stats.totalCost)}
            </div>
            <span className="text-[10px] text-[#94A2C2]">
              هزینه کلی سرویس‌های ثبت شده
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#38E1FF]/10 text-[#38E1FF] flex items-center justify-center border border-[#38E1FF]/20">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div 
        className="p-4 rounded-2xl bg-[#121A2C] border border-[#1F2B47] flex flex-col md:flex-row md:items-center justify-between gap-3"
        style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
      >
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#5D6B8F] absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجو در نام دامنه، ثبت‌کننده، آدرس سرور یا یادداشت..."
            className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl pr-10 pl-4 py-2.5 text-xs text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
            style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Type Filter */}
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value as any)}
            className="bg-[#0F1524] border border-[#1F2B47] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#4F7CFF] cursor-pointer"
            style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
          >
            <option value="all">همه دسته‌ها</option>
            <option value="domain">فقط دامنه‌ها</option>
            <option value="host">فقط هاست‌ها</option>
            <option value="vps">فقط سرورها (VPS)</option>
            <option value="ssl">گواهینامه‌های SSL</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
            className="bg-[#0F1524] border border-[#1F2B47] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#4F7CFF] cursor-pointer"
            style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="active">سرویس‌های معتبر</option>
            <option value="expiring">نزدیک سررسید</option>
            <option value="expired">منقضی شده</option>
          </select>
        </div>
      </div>

      {/* Services List / Grid */}
      {filteredItems.length === 0 ? (
        <div 
          className="p-12 rounded-3xl border border-[#1F2B47] bg-[#121A2C] text-center flex flex-col items-center justify-center gap-3"
          style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
        >
          <div className="w-14 h-14 rounded-2xl bg-[#0F1524] border border-[#1F2B47] flex items-center justify-center text-[#5D6B8F]">
            <Globe className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-white">هیچ دامنه یا هاستی با این فیلتر یافت نشد</h3>
          <p className="text-xs text-[#94A2C2] max-w-sm">
            می‌توانید با دکمه زیر اولین سرویس اینترنتی خود را اضافه نمایید تا تاریخ سررسید و هشدارهای آن فعال شود.
          </p>
          <button
            onClick={openAddModal}
            className="mt-2 py-2 px-4 rounded-xl bg-[#4F7CFF] hover:bg-[#3d6bf0] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت سرویس جدید</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const diffDays = compareJalaliDates(item.renewalDate);
            const isExpired = diffDays < 0;
            const isExpiring = diffDays >= 0 && diffDays <= 30;

            return (
              <div
                key={item.id}
                className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between group ${
                  isExpired
                    ? 'bg-red-500/5 border-red-500/30 hover:border-red-500/50'
                    : isExpiring
                    ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50'
                    : 'bg-[#121A2C] border-[#1F2B47] hover:border-[#4F7CFF]/50'
                }`}
                style={{ backgroundColor: !isExpired && !isExpiring ? 'var(--ui-surface)' : undefined }}
              >
                <div>
                  {/* Card Header: Type badge & Status */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-[#0F1524] border border-[#1F2B47]">
                        {getTypeIcon(item.type)}
                      </span>
                      <span className="text-[11px] font-bold text-[#94A2C2]" style={{ color: 'var(--ui-text-secondary)' }}>
                        {getTypeLabel(item.type)}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isExpired
                        ? 'bg-red-500/10 text-red-400 border-red-500/30'
                        : isExpiring
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    }`}>
                      {isExpired ? `منقضی (${Math.abs(diffDays)} روز قبل)` : isExpiring ? `${diffDays} روز تا انقضا` : 'معتبر و فعال'}
                    </span>
                  </div>

                  {/* Domain / Service Title */}
                  <div className="mb-2">
                    <h3 className="text-base font-black text-white group-hover:text-[#38E1FF] transition font-mono tracking-wide" dir="ltr">
                      {item.name}
                    </h3>
                    <div className="text-xs text-[#94A2C2] mt-0.5 flex items-center gap-1.5">
                      <span>ثبت در:</span>
                      <strong className="text-white font-medium">{item.provider}</strong>
                    </div>
                  </div>

                  {/* Metadata Rows */}
                  <div className="mt-3.5 space-y-2 text-xs py-3 border-y border-[#1F2B47]/60" style={{ borderColor: 'var(--ui-border)' }}>
                    {/* Renewal Date */}
                    <div className="flex items-center justify-between">
                      <span className="text-[#94A2C2] flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#4F7CFF]" />
                        <span>سررسید تمدید:</span>
                      </span>
                      <span className="font-mono font-bold text-white tabular-nums">
                        {item.renewalDate}
                      </span>
                    </div>

                    {/* Cost */}
                    <div className="flex items-center justify-between">
                      <span className="text-[#94A2C2] flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                        <span>هزینه تمدید:</span>
                      </span>
                      <span className="font-mono font-bold text-[#38E1FF] tabular-nums">
                        {formatCurrency(item.cost)}
                        <span className="text-[10px] text-[#94A2C2] font-sans mr-1">
                          ({item.period === 'monthly' ? 'ماهانه' : item.period === 'multi-year' ? 'چندساله' : 'سالانه'})
                        </span>
                      </span>
                    </div>

                    {/* IP / DNS if provided */}
                    {item.dnsOrIp && (
                      <div className="flex items-center justify-between">
                        <span className="text-[#94A2C2] text-[11px]">آدرس سرور / IP:</span>
                        <span className="font-mono text-[11px] text-[#94A2C2] truncate max-w-[160px]" dir="ltr">
                          {item.dnsOrIp}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Notes snippet */}
                  {item.notes && (
                    <p className="mt-2 text-[11px] text-[#94A2C2] line-clamp-1 italic">
                      {item.notes}
                    </p>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="mt-4 pt-3 border-t border-[#1F2B47] flex items-center justify-between gap-1.5" style={{ borderColor: 'var(--ui-border)' }}>
                  <div className="flex items-center gap-1.5">
                    {/* Mark Renewed Button */}
                    <button
                      onClick={() => handleRenew(item.id, item.name)}
                      className="py-1.5 px-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                      title="ثبت تمدید برای یک دوره بعدی"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>تمدید شد</span>
                    </button>

                    {/* Send Telegram Alert */}
                    <button
                      onClick={() => handleSendTelegram(item)}
                      className="p-1.5 rounded-lg bg-[#0F1524] hover:bg-[#182239] text-[#38E1FF] border border-[#1F2B47] cursor-pointer transition"
                      title="ارسال هشدار مشخصات این سرویس به تلگرام"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>

                    {/* Login Link if provided */}
                    {item.loginUrl && (
                      <a
                        href={item.loginUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-[#0F1524] hover:bg-[#182239] text-[#94A2C2] hover:text-white border border-[#1F2B47] cursor-pointer transition"
                        title="ورود به پنل مدیریت این سرویس"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-1.5 rounded-lg text-[#94A2C2] hover:text-white hover:bg-white/5 cursor-pointer transition"
                      title="ویرایش سرویس"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(item.id, item.name)}
                      className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer transition"
                      title="حذف سرویس"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="w-full max-w-lg bg-[#121A2C] border border-[#1F2B47] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-[#1F2B47] flex items-center justify-between" style={{ borderColor: 'var(--ui-border)' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#4F7CFF]/10 text-[#4F7CFF] flex items-center justify-center border border-[#4F7CFF]/20">
                  <Globe className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  {editingItem ? 'ویرایش اطلاعات سرویس / دامنه' : 'ثبت دامنه یا هاست جدید'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-[#94A2C2] hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                  نام دامنه یا عنوان سرویس *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: siteirdood.ir یا سرور ابری آلمان"
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
                  style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                    نوع سرویس
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as HostingType)}
                    className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#4F7CFF]"
                    style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                  >
                    <option value="domain">دامنه اینترنتی (Domain)</option>
                    <option value="host">هاست میزبانی (Web Hosting)</option>
                    <option value="vps">سرور ابری یا مجازی (VPS)</option>
                    <option value="ssl">گواهینامه امنیتی SSL</option>
                    <option value="other">سایر سرویس‌های شبکه</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                    شرکت ثبت‌کننده / هاستینگ
                  </label>
                  <input
                    type="text"
                    value={formProvider}
                    onChange={(e) => setFormProvider(e.target.value)}
                    placeholder="مثال: ایرنیک، ایران‌سرور، Hetzner..."
                    className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
                    style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                    تاریخ سررسید تمدید (شمسی) *
                  </label>
                  <JalaliDatePicker
                    required
                    value={formRenewalDate}
                    onChange={setFormRenewalDate}
                    className="bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs"
                    style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                    دوره تمدید
                  </label>
                  <select
                    value={formPeriod}
                    onChange={(e) => setFormPeriod(e.target.value as any)}
                    className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#4F7CFF]"
                    style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                  >
                    <option value="yearly">سالانه (۱۲ ماه)</option>
                    <option value="monthly">ماهانه</option>
                    <option value="multi-year">چندساله (۲ تا ۵ سال)</option>
                  </select>
                </div>
              </div>

              {/* Renewal Cost with Live Comma Separator and English Numerals */}
              <div>
                <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                  هزینه تمدید دوره‌ای (تومان) *
                </label>
                <FormattedNumberInput
                  value={formCost}
                  onChange={(val) => setFormCost(val)}
                  placeholder="مثال: 65,000"
                  unitLabel="تومان"
                  className="bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                    آدرس IP سرور یا نیم‌سرورها
                  </label>
                  <input
                    type="text"
                    value={formDnsOrIp}
                    onChange={(e) => setFormDnsOrIp(e.target.value)}
                    placeholder="185.143... یا ns1.cloudflare.com"
                    className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs text-white font-mono placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
                    style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                    لینک ورود به پنل
                  </label>
                  <input
                    type="url"
                    value={formLoginUrl}
                    onChange={(e) => setFormLoginUrl(e.target.value)}
                    placeholder="https://client.domain.com"
                    className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2.5 text-xs text-white font-mono placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
                    style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A2C2] mb-1">
                  توضیحات و یادداشت‌ها
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="نام کاربری پنل، کد مشتری، نام سرور..."
                  className="w-full bg-[#0F1524] border border-[#1F2B47] rounded-xl px-4 py-2 text-xs text-white placeholder-[#5D6B8F] focus:outline-none focus:border-[#4F7CFF]"
                  style={{ backgroundColor: 'var(--ui-surface-subtle)', borderColor: 'var(--ui-border)' }}
                />
              </div>

              {/* Form Action Buttons */}
              <div className="pt-3 border-t border-[#1F2B47] flex items-center justify-end gap-2.5" style={{ borderColor: 'var(--ui-border)' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-[#94A2C2] text-xs font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-[#4F7CFF] to-[#38E1FF] text-white text-xs font-bold shadow-lg shadow-[#4F7CFF]/20 cursor-pointer"
                >
                  {editingItem ? 'ذخیره تغییرات' : 'ثبت نهایی سرویس'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
