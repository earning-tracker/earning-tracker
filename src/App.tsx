/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sun,
  Moon,
  HelpCircle,
  Heart,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  Copy,
  Check,
  X,
  Sparkles,
  Download,
  AlertTriangle,
  Info,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  BellRing,
  Smartphone
} from 'lucide-react';

// API CONSTANTS
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwPhh1elVTFVWgtV1JoSAITR0KwfSJxQiznAbolboa6SfFUaKBXa6QQXu7LuHtVbCs/exec';

const HALF_AMOUNT = 400;
const FULL_AMOUNT = 800;
const STORAGE_KEY = 'income_tracker_entries_v1';
const CURRENT_APP_VERSION = '1.0.0';
const CURRENT_VERSION_CODE = 1;

interface Entry {
  id: string;
  date: string;
  type: string; // 'HALF' | 'FULL' | 'EXTRA'
  amount: number;
  extraAmount: number;
}

interface AnnouncementData {
  enabled: boolean;
  title: string;
  message: string;
}

export default function App() {
  // STATE MANAGEMENT
  const [entries, setEntries] = useState<Entry[]>([]);
  const [extraAmountInput, setExtraAmountInput] = useState<string>('');
  const [selectedMonthOffset, setSelectedMonthOffset] = useState<number>(0);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Loading & Processing States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<string>('Loading...');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Toast state
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  }>({ show: false, message: '', type: 'info' });

  // Modal States
  const [showSupportModal, setShowSupportModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [upiCopied, setUpiCopied] = useState<boolean>(false);

  // Announcement & Config API States
  const [announcement, setAnnouncement] = useState<AnnouncementData | null>(null);
  const [showAnnouncementBanner, setShowAnnouncementBanner] = useState<boolean>(true);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // DATE UTILITY FUNCTIONS
  const getTodayString = useCallback((): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const toCanonicalDateStr = useCallback((raw: any): string => {
    if (!raw) return getTodayString();
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
      }
      if (trimmed.includes('T')) {
        const datePart = trimmed.split('T')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          return datePart;
        }
      }
      if (trimmed.includes('/') || trimmed.includes('-')) {
        const delim = trimmed.includes('/') ? '/' : '-';
        const p = trimmed.split(delim);
        if (p.length === 3) {
          if (p[0].length === 4) {
            return `${p[0]}-${p[1].padStart(2, '0')}-${p[2].substring(0, 2).padStart(2, '0')}`;
          }
          if (p[2].length >= 4) {
            const year = p[2].substring(0, 4);
            const num1 = parseInt(p[0], 10);
            const num2 = parseInt(p[1], 10);
            if (!isNaN(num1) && !isNaN(num2)) {
              if (num1 > 12) {
                return `${year}-${String(num2).padStart(2, '0')}-${String(num1).padStart(2, '0')}`;
              }
              return `${year}-${String(num2).padStart(2, '0')}-${String(num1).padStart(2, '0')}`;
            }
          }
        }
      }
    }

    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    return getTodayString();
  }, [getTodayString]);

  const formatDateDisplay = useCallback(
    (dateStr: string): string => {
      const canonical = toCanonicalDateStr(dateStr);
      const todayStr = getTodayString();

      const parts = canonical.split('-');
      if (parts.length !== 3) return canonical;

      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);

      const dateObj = new Date(year, month, day);
      if (isNaN(dateObj.getTime())) return canonical;

      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
      const formatted = dateObj.toLocaleDateString('en-IN', options);

      if (canonical === todayStr) {
        return `Today, ${formatted}`;
      }
      return formatted;
    },
    [getTodayString, toCanonicalDateStr]
  );

  const formatCurrency = useCallback((val: number): string => {
    return '₹' + Number(val || 0).toLocaleString('en-IN');
  }, []);

  // TOAST & LOADER HELPERS
  const showToast = useCallback(
    (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setToast({ show: true, message, type });
      toastTimeoutRef.current = setTimeout(() => {
        setToast((prev) => ({ ...prev, show: false }));
      }, 2600);
    },
    []
  );

  const showLoader = useCallback((msg = 'Processing...') => {
    setLoadingText(msg);
    setIsLoading(true);
  }, []);

  const hideLoader = useCallback(() => {
    setIsLoading(false);
  }, []);

  // LOCAL STORAGE READ & WRITE
  const loadEntriesFromLocal = useCallback((): Entry[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const todayStr = getTodayString();
          return parsed
            .map((item: any) => ({
              ...item,
              date: toCanonicalDateStr(item.date)
            }))
            .filter((item: Entry) => item.date !== todayStr);
        }
      }
    } catch (e) {
      console.error('Error reading localStorage:', e);
    }
    return [];
  }, [getTodayString, toCanonicalDateStr]);

  const saveEntriesLocally = useCallback(
    (data: Entry[]) => {
      const sanitized = data.map((item) => ({
        ...item,
        date: toCanonicalDateStr(item.date)
      }));

      const todayStr = getTodayString();
      const historicalOnly = sanitized.filter((item) => item.date !== todayStr);

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(historicalOnly));
      } catch (e) {
        console.error('Error saving to localStorage:', e);
      }

      setEntries(sanitized);
    },
    [getTodayString, toCanonicalDateStr]
  );

  // FETCH SHEET DATA
  const fetchFromSheet = useCallback(
    async (options: { isSilent?: boolean } = {}) => {
      const isSilent = !!options.isSilent;
      try {
        if (!isSilent) showLoader('Fetching latest data from Sheet...');
        const res = await fetch(APPS_SCRIPT_URL, { method: 'GET' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const sanitized: Entry[] = data.map((item: any, idx: number) => ({
              id: String(item.id || item.Id || Date.now() + idx),
              date: toCanonicalDateStr(item.date || item.Date),
              type: String(item.type || item.Type || 'FULL').toUpperCase(),
              amount: Number(item.amount || item.Amount || 0),
              extraAmount: Number(item.extraAmount || item.ExtraAmount || item.extra || 0)
            }));
            saveEntriesLocally(sanitized);
          }
        }
      } catch (err) {
        console.warn('Apps Script fetch note:', err);
      } finally {
        if (!isSilent) hideLoader();
        setIsInitializing(false);
      }
    },
    [hideLoader, saveEntriesLocally, showLoader, toCanonicalDateStr]
  );

  // SYNC TO APPS SCRIPT
  const syncToAppsScript = useCallback(async (payload: any) => {
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Error syncing to Apps Script:', err);
    }
  }, []);

  // FETCH ANNOUNCEMENT API
  const fetchAnnouncement = useCallback(async () => {
    try {
      const url = `${APPS_SCRIPT_URL}?type=announcement`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.enabled === 'boolean') {
          setAnnouncement(data);
        }
      }
    } catch (e) {
      console.warn('Announcement API note:', e);
    }
  }, []);

  // INITIAL LOAD
  useEffect(() => {
    // 1. Initial theme load
    const savedTheme = (localStorage.getItem('app-theme') as 'light' | 'dark') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    // 2. Load historical entries from local storage first for instant render
    const cached = loadEntriesFromLocal();
    setEntries(cached);

    // 3. Fetch APIs in background
    fetchFromSheet({ isSilent: true });
    fetchAnnouncement();
    fetchConfig();
  }, [fetchAnnouncement, fetchConfig, fetchFromSheet, loadEntriesFromLocal]);

  // TODAY ENTRY GETTER
  const getTodayEntry = useCallback((): Entry | undefined => {
    const today = getTodayString();
    return entries.find((item) => toCanonicalDateStr(item.date) === today);
  }, [entries, getTodayString, toCanonicalDateStr]);

  // LOG ADDITION
  const addEntry = useCallback(
    async (type: 'HALF' | 'FULL' | 'EXTRA') => {
      if (isProcessing || isInitializing) return;

      const today = getTodayString();
      if (getTodayEntry()) {
        showToast("Today's log is already recorded!", 'warning');
        return;
      }

      let amount = 0;
      let extra = 0;

      if (type === 'HALF') {
        amount = HALF_AMOUNT;
      } else if (type === 'FULL') {
        amount = FULL_AMOUNT;
      } else if (type === 'EXTRA') {
        const rawVal = extraAmountInput.trim();
        const extraVal = parseFloat(rawVal) || 0;

        if (!rawVal || extraVal <= 0) {
          showToast('Enter a valid extra amount', 'warning');
          return;
        }
        extra = extraVal;
        amount = FULL_AMOUNT + extra;
      }

      setIsProcessing(true);
      showLoader('Saving log...');

      const newEntry: Entry = {
        id: Date.now().toString(),
        date: today,
        type: type,
        amount: amount,
        extraAmount: extra
      };

      const updated = [newEntry, ...entries];
      saveEntriesLocally(updated);
      setExtraAmountInput('');

      try {
        await syncToAppsScript({
          action: 'add',
          type: type,
          amount: amount,
          extraAmount: extra,
          date: today,
          id: newEntry.id
        });
      } catch (err) {
        console.error('Sync error:', err);
      } finally {
        hideLoader();
        setIsProcessing(false);
        showToast(`Saved: ${type} (${formatCurrency(amount)})`, 'success');
      }
    },
    [
      extraAmountInput,
      formatCurrency,
      getTodayEntry,
      getTodayString,
      hideLoader,
      isInitializing,
      isProcessing,
      saveEntriesLocally,
      showLoader,
      showToast,
      syncToAppsScript,
      entries
    ]
  );

  // LOG DELETION
  const deleteTodayEntry = useCallback(async () => {
    if (isProcessing || isInitializing) return;

    const today = getTodayString();
    const todayEntry = getTodayEntry();

    if (!todayEntry) {
      showToast('No entry found for today', 'warning');
      return;
    }

    setIsProcessing(true);
    showLoader('Deleting log...');

    const filtered = entries.filter((item) => toCanonicalDateStr(item.date) !== today);
    saveEntriesLocally(filtered);

    try {
      await syncToAppsScript({
        action: 'delete',
        date: today,
        id: todayEntry.id
      });
    } catch (err) {
      console.error('Delete sync error:', err);
    } finally {
      hideLoader();
      setIsProcessing(false);
      showToast("Today's entry deleted", 'error');
    }
  }, [
    entries,
    getTodayEntry,
    getTodayString,
    hideLoader,
    isInitializing,
    isProcessing,
    saveEntriesLocally,
    showLoader,
    showToast,
    syncToAppsScript,
    toCanonicalDateStr
  ]);

  // TOGGLE THEME
  const toggleTheme = useCallback(() => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('app-theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  }, [theme]);

  // EXPOSE GLOBAL WINDOW FUNCTIONS FOR FULL COMPATIBILITY
  useEffect(() => {
    (window as any).SCRIPT_URL = APPS_SCRIPT_URL;
    (window as any).addEntry = addEntry;
    (window as any).deleteTodayEntry = deleteTodayEntry;
    (window as any).fetchFromSheet = fetchFromSheet;
    (window as any).showToast = showToast;
    (window as any).showLoader = showLoader;
    (window as any).hideLoader = hideLoader;
    (window as any).getTodayEntry = getTodayEntry;
  }, [addEntry, deleteTodayEntry, fetchFromSheet, showToast, showLoader, hideLoader, getTodayEntry]);

  // CALCULATION FOR MONTHLY ANALYTICS
  const todayStr = getTodayString();
  const dateParts = todayStr.split('-');
  const currYear = parseInt(dateParts[0], 10);
  const currMonth = parseInt(dateParts[1], 10);

  const targetDateObj = new Date(currYear, currMonth - 1 - selectedMonthOffset, 1);
  const targetYear = targetDateObj.getFullYear();
  const targetMonth = targetDateObj.getMonth() + 1;
  const targetMonthKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;

  const monthName = !isNaN(targetDateObj.getTime())
    ? targetDateObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : targetMonthKey;

  const targetMonthEntries = entries.filter((item) => {
    const canonical = toCanonicalDateStr(item.date);
    return canonical.startsWith(targetMonthKey);
  });

  let monthIncomeSum = 0;
  let monthExtraSum = 0;
  targetMonthEntries.forEach((item) => {
    monthIncomeSum += item.amount || 0;
    monthExtraSum += item.extraAmount || 0;
  });

  // CHART COMPUTATIONS
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
  const weeklyRanges = [
    { label: '1–7', start: 1, end: 7 },
    { label: '8–14', start: 8, end: 14 },
    { label: '15–21', start: 15, end: 21 },
    { label: '22–28', start: 22, end: 28 },
    { label: `29–${lastDayOfTargetMonth}`, start: 29, end: lastDayOfTargetMonth }
  ];

  const weeklyTotals = weeklyRanges.map((range) => {
    let sum = 0;
    targetMonthEntries.forEach((item) => {
      const day = parseInt(toCanonicalDateStr(item.date).split('-')[2], 10);
      if (day >= range.start && day <= range.end) {
        sum += item.amount || 0;
      }
    });
    return sum;
  });

  const maxWeeklyIncome = Math.max(...weeklyTotals, 0);

  // MONTHLY SUMMARY COMPUTATION
  const monthGroupMap: { [key: string]: { count: number; total: number; extra: number } } = {};
  entries.forEach((item) => {
    const canonical = toCanonicalDateStr(item.date);
    const key = canonical.substring(0, 7);
    if (!monthGroupMap[key]) {
      monthGroupMap[key] = { count: 0, total: 0, extra: 0 };
    }
    monthGroupMap[key].count += 1;
    monthGroupMap[key].total += item.amount || 0;
    monthGroupMap[key].extra += item.extraAmount || 0;
  });
  const sortedMonthKeys = Object.keys(monthGroupMap).sort().reverse();

  // HISTORY ENTRIES COMPUTATION
  const sortedHistoryEntries = [...entries]
    .map((item, idx) => ({ item, originalIndex: idx }))
    .sort((a, b) => {
      const dateA = toCanonicalDateStr(a.item.date);
      const dateB = toCanonicalDateStr(b.item.date);
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      const idA = Number(a.item.id);
      const idB = Number(b.item.id);
      if (!isNaN(idA) && !isNaN(idB) && idA !== idB) return idB - idA;
      return a.originalIndex - b.originalIndex;
    });

  // CALENDAR COMPUTATION
  let firstWorkingDateStr: string | null = null;
  entries.forEach((item) => {
    const canonical = toCanonicalDateStr(item.date);
    if (canonical) {
      if (!firstWorkingDateStr || canonical < firstWorkingDateStr) {
        firstWorkingDateStr = canonical;
      }
    }
  });

  const monthEntryMap: { [dateStr: string]: string } = {};
  entries.forEach((item) => {
    const canonical = toCanonicalDateStr(item.date);
    if (canonical && canonical.startsWith(targetMonthKey)) {
      monthEntryMap[canonical] = item.type;
    }
  });

  const firstDayOfWeek = new Date(targetYear, targetMonth - 1, 1).getDay();
  const calendarDaysList: { dayNum: number; dateStr: string; isToday: boolean; status: 'working' | 'leave' | 'neutral' }[] = [];

  for (let day = 1; day <= lastDayOfTargetMonth; day++) {
    const dayStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = dayStr === todayStr;
    const hasEntry = Boolean(monthEntryMap[dayStr]);

    let status: 'working' | 'leave' | 'neutral' = 'neutral';
    if (firstWorkingDateStr && dayStr >= firstWorkingDateStr) {
      if (hasEntry) {
        status = 'working';
      } else if (dayStr <= todayStr) {
        status = 'leave';
      }
    }

    calendarDaysList.push({ dayNum: day, dateStr: dayStr, isToday, status });
  }

  const todayEntry = getTodayEntry();
  const isUpdateAvailable =
    config &&
    (config.versionCode > CURRENT_VERSION_CODE ||
      (config.apkUrl && config.apkUrl.trim().length > 0 && config.versionName !== CURRENT_APP_VERSION));

  return (
    <div className="w-full min-h-screen flex justify-center items-start px-3 sm:px-4 py-5 pb-16 transition-colors duration-200">
      {/* Toast Notification Container */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm pointer-events-none">
        <div
          id="toast"
          className={`px-5 py-3 rounded-full text-center font-medium text-xs sm:text-sm shadow-lg transition-all duration-300 pointer-events-auto border flex items-center justify-center gap-2 ${
            toast.show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6 pointer-events-none'
          } ${
            toast.type === 'success'
              ? 'bg-[var(--md-sys-color-success-container)] text-[var(--md-sys-color-on-success-container)] border-[var(--md-sys-color-success)]'
              : toast.type === 'warning'
              ? 'bg-[var(--md-sys-color-warning-container)] text-[var(--md-sys-color-on-warning-container)] border-[var(--md-sys-color-warning)]'
              : toast.type === 'error'
              ? 'bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)] border-[var(--md-sys-color-error)]'
              : 'bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] border-[var(--md-sys-color-outline-variant)]'
          }`}
        >
          <span id="toastMessage">{toast.message}</span>
        </div>
      </div>

      {/* Centered M3 Circular Loader Overlay */}
      {isLoading && (
        <div
          id="loader"
          className="fixed inset-0 z-50 bg-[var(--md-sys-color-surface)]/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 transition-opacity duration-200"
        >
          <div className="w-10 h-10 border-4 border-[var(--md-sys-color-outline-variant)] border-t-[var(--md-sys-color-primary)] rounded-full animate-spin" />
          <div id="loaderText" className="text-sm font-semibold text-[var(--md-sys-color-on-surface)]">
            {loadingText}
          </div>
        </div>
      )}

      {/* Main Wrapper Container */}
      <div className="w-full max-w-md flex flex-col gap-4">
        {/* Header Bar */}
        <header className="app-header py-1">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)]">
                  Earning Tracker
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]">
                  M3
                </span>
              </div>
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-0.5">
                Log work shifts & track earnings
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="helpBtn"
                onClick={() => setShowHelpModal(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)] active:scale-95 transition-all duration-150 outline-none"
                aria-label="Help and usage guide"
                title="Help & Guide"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
              <button
                type="button"
                id="themeToggleBtn"
                onClick={toggleTheme}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)] active:scale-95 transition-all duration-150 outline-none"
                aria-label="Toggle dark or light theme"
                title="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </header>

        {/* 1. ANNOUNCEMENT API BANNER (Material 3 Component) */}
        {announcement && announcement.enabled && showAnnouncementBanner && (
          <div className="relative overflow-hidden rounded-3xl p-4 bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)] border border-[var(--md-sys-color-tertiary)]/20 shadow-sm transition-all duration-200">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-2xl bg-[var(--md-sys-color-tertiary)] text-[var(--md-sys-color-on-tertiary)] flex items-center justify-center flex-shrink-0 mt-0.5">
                <BellRing className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex-1 pr-6">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--md-sys-color-tertiary)]">
                    Announcement
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[var(--md-sys-color-on-tertiary-container)]">
                  {announcement.title || 'Announcement'}
                </h3>
                <p className="text-xs mt-1 text-[var(--md-sys-color-on-tertiary-container)]/90 leading-relaxed">
                  {announcement.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAnnouncementBanner(false)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-[var(--md-sys-color-on-tertiary-container)] hover:bg-black/10 transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 2. PRIMARY MONTHLY ANALYTICS DASHBOARD CARD */}
        <div
          id="analyticsCard"
          className="analytics-card rounded-3xl p-5 sm:p-6 bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]/60 shadow-sm flex flex-col gap-4"
        >
          <div className="flex justify-between items-center">
            <span id="analyticsMonthTitle" className="text-sm sm:text-base font-bold text-[var(--md-sys-color-on-surface)]">
              {monthName}
            </span>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]">
              Monthly Analytics
            </span>
          </div>

          <div className="analytics-hero text-center py-1">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                id="prevMonthBtn"
                onClick={() => setSelectedMonthOffset((prev) => Math.min(prev + 1, 3))}
                disabled={selectedMonthOffset >= 3}
                className={`w-9 h-9 rounded-full border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)] text-[var(--md-sys-color-on-surface)] flex items-center justify-center transition-all ${
                  selectedMonthOffset >= 3 ? 'opacity-0 pointer-events-none' : 'hover:bg-[var(--md-sys-color-surface-container-highest)] active:scale-90'
                }`}
                title="Previous month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex-1 flex flex-col items-center">
                <div id="analyticsTotalIncome" className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--md-sys-color-primary)]">
                  {formatCurrency(monthIncomeSum)}
                </div>
                <div id="totalIncome" className="hidden">
                  <span id="total-income">{monthIncomeSum}</span>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--md-sys-color-on-surface-variant)] mt-1">
                  Total Income
                </span>
              </div>

              <button
                type="button"
                id="nextMonthBtn"
                onClick={() => setSelectedMonthOffset((prev) => Math.max(prev - 1, 0))}
                disabled={selectedMonthOffset <= 0}
                className={`w-9 h-9 rounded-full border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)] text-[var(--md-sys-color-on-surface)] flex items-center justify-center transition-all ${
                  selectedMonthOffset <= 0 ? 'opacity-0 pointer-events-none' : 'hover:bg-[var(--md-sys-color-surface-container-highest)] active:scale-90'
                }`}
                title="Next month"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Vertical Bar Chart */}
          <div id="chartContainer" className="flex justify-between items-end h-28 pt-2 px-1 gap-2 border-t border-[var(--md-sys-color-outline-variant)]/40">
            {weeklyRanges.map((range, idx) => {
              const amount = weeklyTotals[idx];
              const isMax = maxWeeklyIncome > 0 && amount === maxWeeklyIncome;
              let heightPct = 6;
              if (maxWeeklyIncome > 0) {
                heightPct = amount > 0 ? Math.max(12, Math.round((amount / maxWeeklyIncome) * 100)) : 6;
              }

              return (
                <div key={range.label} className="flex-1 flex flex-col items-center h-full justify-end gap-1.5">
                  <span className={`text-[10px] sm:text-[11px] font-medium transition-colors ${isMax ? 'font-bold text-[var(--md-sys-color-primary)]' : 'text-[var(--md-sys-color-on-surface-variant)]'}`}>
                    {amount > 0 ? formatCurrency(amount) : '₹0'}
                  </span>
                  <div className="w-3.5 sm:w-4 h-16 bg-[var(--md-sys-color-surface-container-highest)] rounded-full flex items-end overflow-hidden">
                    <div
                      className={`w-full rounded-full transition-all duration-500 ${isMax ? 'bg-[var(--md-sys-color-primary)]' : 'bg-[var(--md-sys-color-secondary)]/70'}`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-[var(--md-sys-color-on-surface-variant)]">
                    {range.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Grid summary */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[var(--md-sys-color-outline-variant)]/40 text-center">
            <div className="flex flex-col items-center">
              <span id="analyticsTotalDays" className="text-base sm:text-lg font-bold text-[var(--md-sys-color-on-surface)]">
                {targetMonthEntries.length} {targetMonthEntries.length === 1 ? 'Day' : 'Days'}
              </span>
              <div id="totalDays" className="hidden">
                <span id="total-days">{targetMonthEntries.length}</span>
              </div>
              <span className="text-xs font-medium text-[var(--md-sys-color-on-surface-variant)]">
                Total Days
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span id="analyticsExtraIncome" className="text-base sm:text-lg font-bold text-[var(--md-sys-color-on-surface)]">
                {formatCurrency(monthExtraSum)}
              </span>
              <div id="extraIncome" className="hidden">
                <span id="extra-income">{monthExtraSum}</span>
              </div>
              <span className="text-xs font-medium text-[var(--md-sys-color-on-surface-variant)]">
                Extra Income
              </span>
            </div>
          </div>
        </div>

        {/* 3. MONTHLY ATTENDANCE CALENDAR CARD */}
        <div id="attendanceCard" className="rounded-3xl p-4 sm:p-5 bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]/60 shadow-sm flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-sm sm:text-base font-bold text-[var(--md-sys-color-on-surface)]">
              Monthly Attendance
            </span>
            <span id="attendanceMonthBadge" className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)]">
              {monthName}
            </span>
          </div>

          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] leading-snug">
            Attendance tracking starts from your first saved entry.
          </p>

          <div className="grid grid-cols-7 gap-1 text-center font-semibold text-[11px] text-[var(--md-sys-color-on-surface-variant)] py-1">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          <div id="attendanceGrid" className="grid grid-cols-7 gap-1">
            {/* Blank padding cells before 1st day */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`blank-${i}`} className="aspect-square bg-transparent" />
            ))}

            {/* Calendar days */}
            {calendarDaysList.map((item) => {
              let cellStyle = 'bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)]';
              if (item.status === 'working') {
                cellStyle = 'bg-[var(--md-sys-color-success-container)] text-[var(--md-sys-color-on-success-container)] font-bold';
              } else if (item.status === 'leave') {
                cellStyle = 'bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)] font-bold';
              }

              return (
                <div
                  key={item.dateStr}
                  className={`aspect-square rounded-xl text-xs font-medium flex items-center justify-center relative transition-transform duration-100 ${cellStyle} ${
                    item.isToday ? 'ring-2 ring-[var(--md-sys-color-primary)] font-black' : ''
                  }`}
                  title={`${item.dateStr}${item.isToday ? ' (Today)' : ''}`}
                >
                  {item.dayNum}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-4 pt-2 border-t border-[var(--md-sys-color-outline-variant)]/40 text-[11px] font-medium text-[var(--md-sys-color-on-surface-variant)] flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[var(--md-sys-color-success-container)] border border-[var(--md-sys-color-success)]" />
              <span>Working Day</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[var(--md-sys-color-error-container)] border border-[var(--md-sys-color-error)]" />
              <span>Leave Day</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm ring-2 ring-[var(--md-sys-color-primary)] bg-transparent" />
              <span>Today</span>
            </div>
          </div>
        </div>

        {/* 4. ACTIONS SECTION CARD */}
        <div className="rounded-3xl p-4 sm:p-5 bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]/60 shadow-sm flex flex-col gap-3.5">
          <span className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">
            Record Today's Log
          </span>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="extraAmount" className="text-xs font-medium text-[var(--md-sys-color-on-surface-variant)]">
              Extra Income Amount (optional)
            </label>
            <input
              type="number"
              id="extraAmount"
              data-id="extra-amount"
              value={extraAmountInput}
              onChange={(e) => setExtraAmountInput(e.target.value)}
              placeholder="e.g. 200"
              min="0"
              step="50"
              disabled={isInitializing || !!todayEntry || isProcessing}
              className="w-full h-12 px-4 rounded-2xl bg-[var(--md-sys-color-surface-container-lowest)] border border-[var(--md-sys-color-outline-variant)] text-sm text-[var(--md-sys-color-on-surface)] focus:outline-none focus:border-[var(--md-sys-color-primary)] focus:ring-2 focus:ring-[var(--md-sys-color-primary)]/20 transition-all disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <button
              id="btnHalf"
              data-id="btn-half"
              onClick={() => addEntry('HALF')}
              disabled={isInitializing || !!todayEntry || isProcessing}
              className="min-h-[52px] p-2.5 rounded-2xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)] hover:bg-[var(--md-sys-color-warning-container)]/30 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5 disabled:opacity-45 disabled:pointer-events-none"
              title="Half Shift = ₹400"
            >
              <span className="text-xs font-bold text-[var(--md-sys-color-on-surface)]">HALF</span>
              <span className="text-[11px] font-semibold text-[var(--md-sys-color-warning)]">₹400</span>
            </button>

            <button
              id="btnFull"
              data-id="btn-full"
              onClick={() => addEntry('FULL')}
              disabled={isInitializing || !!todayEntry || isProcessing}
              className="min-h-[52px] p-2.5 rounded-2xl bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] hover:opacity-90 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5 disabled:opacity-45 disabled:pointer-events-none shadow-sm"
              title="Full Shift = ₹800"
            >
              <span className="text-xs font-bold">FULL</span>
              <span className="text-[11px] font-semibold opacity-90">₹800</span>
            </button>

            <button
              id="btnExtra"
              data-id="btn-extra"
              onClick={() => addEntry('EXTRA')}
              disabled={isInitializing || !!todayEntry || isProcessing}
              className="min-h-[52px] p-2.5 rounded-2xl bg-[var(--md-sys-color-tertiary)] text-[var(--md-sys-color-on-tertiary)] hover:opacity-90 active:scale-95 transition-all flex flex-col items-center justify-center gap-0.5 disabled:opacity-45 disabled:pointer-events-none shadow-sm"
              title="Extra = ₹800 + entered amount"
            >
              <span className="text-xs font-bold">ADD EXTRA</span>
              <span className="text-[11px] font-semibold opacity-90">₹800 + Extra</span>
            </button>
          </div>

          <div
            id="todayBanner"
            className={`text-xs py-2.5 px-3.5 rounded-xl font-semibold text-center flex items-center justify-center gap-2 transition-all ${
              isInitializing
                ? 'bg-[var(--md-sys-color-surface-container-low)] text-[var(--md-sys-color-on-surface-variant)]'
                : todayEntry
                ? 'bg-[var(--md-sys-color-success-container)] text-[var(--md-sys-color-on-success-container)] border border-[var(--md-sys-color-success)]/30'
                : 'bg-[var(--md-sys-color-surface-container-lowest)] text-[var(--md-sys-color-on-surface-variant)] border border-[var(--md-sys-color-outline-variant)]/50'
            }`}
          >
            {isInitializing ? (
              <span>Verifying today's log status...</span>
            ) : todayEntry ? (
              <span>
                Today's Entry Logged: <strong>{todayEntry.type}</strong> ({formatCurrency(todayEntry.amount)})
              </span>
            ) : (
              <span>Ready to log entry for today</span>
            )}
          </div>
        </div>

         
        

        {/* 6. MONTHLY SUMMARY CARD */}
        <div className="rounded-3xl p-4 sm:p-5 bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]/60 shadow-sm flex flex-col gap-3">
          <span className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">
            Monthly Summary
          </span>

          <div id="monthlySummary" data-id="monthly-summary" className="flex flex-col gap-2">
            {sortedMonthKeys.length === 0 ? (
              <div className="text-center py-6 px-4 text-xs text-[var(--md-sys-color-on-surface-variant)] bg-[var(--md-sys-color-surface-container-lowest)] rounded-2xl border border-dashed border-[var(--md-sys-color-outline-variant)]">
                No summary available
              </div>
            ) : (
              sortedMonthKeys.map((key) => {
                const parts = key.split('-');
                const year = parts[0];
                const monthNum = parseInt(parts[1], 10) - 1;
                const dObj = new Date(parseInt(year, 10), monthNum, 1);
                const monthLabel = !isNaN(dObj.getTime())
                  ? dObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
                  : key;

                const data = monthGroupMap[key];

                return (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[var(--md-sys-color-surface-container-lowest)] border border-[var(--md-sys-color-outline-variant)]/40 hover:bg-[var(--md-sys-color-surface-container-low)] transition-colors"
                  >
                    <span className="text-xs font-bold text-[var(--md-sys-color-on-surface)]">
                      {monthLabel}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                        {data.count} {data.count === 1 ? 'day' : 'days'}
                      </span>
                      <span className="text-xs font-extrabold text-[var(--md-sys-color-primary)]">
                        {formatCurrency(data.total)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 7. HISTORY CARD */}
        <div className="rounded-3xl p-4 sm:p-5 bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]/60 shadow-sm flex flex-col gap-3">
          <span className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">
            History
          </span>

          <div id="historyList" data-id="history-list" className="flex flex-col gap-2.5">
            {sortedHistoryEntries.length === 0 ? (
              <div className="text-center py-6 px-4 text-xs text-[var(--md-sys-color-on-surface-variant)] bg-[var(--md-sys-color-surface-container-lowest)] rounded-2xl border border-dashed border-[var(--md-sys-color-outline-variant)]">
                No history recorded
              </div>
            ) : (
              sortedHistoryEntries.map(({ item }) => {
                const canonicalDate = toCanonicalDateStr(item.date);
                const isToday = canonicalDate === todayStr;

                let badgeClass = 'bg-[var(--md-sys-color-success-container)] text-[var(--md-sys-color-on-success-container)]';
                if (item.type === 'HALF') badgeClass = 'bg-[var(--md-sys-color-warning-container)] text-[var(--md-sys-color-on-warning-container)]';
                if (item.type === 'EXTRA') badgeClass = 'bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]';

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[var(--md-sys-color-surface-container-lowest)] border border-[var(--md-sys-color-outline-variant)]/40 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${badgeClass}`}>
                        {item.type}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-[var(--md-sys-color-on-surface)]">
                          {formatDateDisplay(canonicalDate)}
                        </span>
                        {item.extraAmount > 0 && (
                          <span className="text-[10px] font-medium text-[var(--md-sys-color-tertiary)]">
                            +{formatCurrency(item.extraAmount)} extra
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-extrabold text-[var(--md-sys-color-on-surface)]">
                        {formatCurrency(item.amount)}
                      </span>
                      {isToday && (
                        <button
                          type="button"
                          onClick={deleteTodayEntry}
                          className="px-2.5 py-1 rounded-xl bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)] hover:bg-[var(--md-sys-color-error)] hover:text-[var(--md-sys-color-on-error)] text-[10px] font-bold transition-all active:scale-95"
                          title="Delete today's entry"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 8. SUPPORT PROJECT CARD */}
        <div
          id="supportCard"
          onClick={() => setShowSupportModal(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setShowSupportModal(true);
            }
          }}
          className="rounded-3xl p-4 bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]/60 shadow-sm hover:border-[var(--md-sys-color-primary)] hover:shadow-md active:scale-98 cursor-pointer transition-all flex items-center justify-between gap-3 mt-1"
          aria-label="Support This Project"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-error)] flex items-center justify-center text-lg flex-shrink-0">
              ❤️
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--md-sys-color-on-surface)]">
                Support This Project
              </h3>
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] leading-snug">
                If this tracker has been helpful to you, consider supporting its development.
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[var(--md-sys-color-on-surface-variant)] flex-shrink-0" />
        </div>

        {/* Footer */}
        <footer className="text-center py-4 border-t border-[var(--md-sys-color-outline-variant)]/40 mt-2">
          <p className="text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)]">
            © 2026 Shammon
          </p>
        </footer>
      </div>

      {/* SUPPORT MODAL DIALOG */}
      {showSupportModal && (
        <div
          id="supportModalOverlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSupportModal(false);
          }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] p-5 shadow-2xl relative flex flex-col gap-3">
            <button
              type="button"
              id="closeSupportModalBtn"
              onClick={() => setShowSupportModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)] flex items-center justify-center hover:opacity-80 transition-opacity"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 id="supportModalTitle" className="text-lg font-bold text-[var(--md-sys-color-on-surface)] flex items-center gap-2">
              ❤️ Support This Project
            </h2>

            <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] flex flex-col gap-2 leading-relaxed">
              <p>This tracker helps you keep track of:</p>
              <ul className="list-disc pl-5 font-semibold text-[var(--md-sys-color-on-surface)] space-y-0.5">
                <li>Total Income & Daily History</li>
                <li>Working Days & Attendance</li>
                <li>Extra Income & Shift Summary</li>
              </ul>
              <p>Every contribution helps keep the project running and updated. ❤️</p>

              {/* QR & UPI Section */}
              <div className="p-4 rounded-2xl bg-[var(--md-sys-color-surface-container-lowest)] border border-[var(--md-sys-color-outline-variant)]/60 flex flex-col items-center gap-3 text-center mt-1">
                <div className="w-32 h-32 rounded-xl bg-white p-2 border border-gray-200 flex flex-col items-center justify-center">
                  <img
                    src="https://raw.githubusercontent.com/earning-tracker/earning-tracker/refs/heads/main/my-qr.svg"
                    alt="UPI QR Code"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="text-[11px] font-bold text-[var(--md-sys-color-on-surface-variant)]">
                  Scan QR Code to pay via UPI
                </span>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--md-sys-color-surface-container-high)] text-xs font-bold text-[var(--md-sys-color-on-surface)]">
                  <span>UPI ID: <strong id="upiIdText">6391226574@ikwik</strong></span>
                  <button
                    type="button"
                    id="copyUpiBtn"
                    onClick={() => {
                      navigator.clipboard.writeText('6391226574@ikwik');
                      setUpiCopied(true);
                      showToast('UPI ID copied to clipboard!', 'success');
                      setTimeout(() => setUpiCopied(false), 2000);
                    }}
                    className="px-2 py-0.5 rounded-full bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] text-[10px] font-extrabold flex items-center gap-1 hover:opacity-90 active:scale-95 transition-all"
                  >
                    {upiCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{upiCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                id="maybeLaterBtn"
                onClick={() => setShowSupportModal(false)}
                className="w-full h-10 rounded-2xl bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)] font-bold text-xs hover:opacity-90 active:scale-95 transition-all"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HELP MODAL DIALOG */}
      {showHelpModal && (
        <div
          id="helpModalOverlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHelpModal(false);
          }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)] p-5 shadow-2xl relative flex flex-col gap-3">
            <button
              type="button"
              id="closeHelpModalBtn"
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)] flex items-center justify-center hover:opacity-80 transition-opacity"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 id="helpModalTitle" className="text-lg font-bold text-[var(--md-sys-color-on-surface)] flex items-center gap-2">
              How to Use Tracker 💡
            </h2>

            <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] flex flex-col gap-3 leading-relaxed">
              <div className="p-3 rounded-2xl bg-[var(--md-sys-color-surface-container-lowest)] border border-[var(--md-sys-color-outline-variant)]/40 flex flex-col gap-1">
                <h4 className="font-bold text-[var(--md-sys-color-on-surface)] flex items-center gap-1.5">
                  <span>📅</span> 1. Logging Daily Attendance
                </h4>
                <p>Select today's shift status with one tap:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-[var(--md-sys-color-on-surface)] font-medium">
                  <li><strong>Full Day (FULL):</strong> ₹800 base rate.</li>
                  <li><strong>Half Day (HALF):</strong> ₹400 half rate.</li>
                  <li><strong>Extra Income (ADD EXTRA):</strong> ₹800 base + custom overtime/extra amount.</li>
                </ul>
              </div>

              <div className="p-3 rounded-2xl bg-[var(--md-sys-color-surface-container-lowest)] border border-[var(--md-sys-color-outline-variant)]/40 flex flex-col gap-1">
                <h4 className="font-bold text-[var(--md-sys-color-on-surface)] flex items-center gap-1.5">
                  <span>📊</span> 2. Monthly View & Charts
                </h4>
                <p>Use navigation arrows to toggle between recent months. View earnings breakdown across weekly date ranges.</p>
              </div>

              <div className="p-3 rounded-2xl bg-[var(--md-sys-color-surface-container-lowest)] border border-[var(--md-sys-color-outline-variant)]/40 flex flex-col gap-1">
                <h4 className="font-bold text-[var(--md-sys-color-on-surface)] flex items-center gap-1.5">
                  <span>☁️</span> 3. Auto Sync & Storage
                </h4>
                <p>Data saves instantly in local storage and synchronizes automatically with Google Sheets.</p>
              </div>
            </div>

            <button
              type="button"
              id="gotItHelpBtn"
              onClick={() => setShowHelpModal(false)}
              className="w-full h-11 rounded-2xl bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-bold text-xs hover:opacity-90 active:scale-95 transition-all mt-1 shadow-sm"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
