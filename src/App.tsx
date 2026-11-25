import React, { useEffect, useRef, useState } from 'react';
import {
  FileSpreadsheet,
  LayoutDashboard,
  Menu,
  Moon,
  Package,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sliders,
  Sun,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginScreen } from './components/LoginScreen';
import {
  AdminDashboard,
  StaffDashboard,
} from './components/RoleDashboards';
import { InventoryView } from './components/InventoryView';
import { PosSalesView } from './components/PosSalesView';
import { SalesHistoryView } from './components/SalesHistoryView';
import { WarrantiesView } from './components/WarrantiesView';
import { RepairsView } from './components/RepairsView';
import { DailyReportsView } from './components/DailyReportsView';
import { TeamManagementView } from './components/TeamManagementView';
import {
  SettingsWorkspaceView,
  type SettingsSection,
} from './components/SettingsWorkspaceView';
import {
  extractCodeToken,
  getLanBridgeBaseUrl,
  playScannerBeep,
  ScannerModal,
  type ScannerContextMode,
} from './components/BarcodeQrToolkit';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  VisualPatchApplier,
  VisualStudioEditor,
} from './components/VisualStudioEditor';
import {
  subscribeAppAppearanceSettings,
  subscribeDeveloperSystemSettings,
  subscribeInstalledAppSettings,
  subscribeLocalStore,
  subscribeLoginPresentationSettings,
  subscribePosSettings,
  subscribeReceiptSettings,
  subscribeVisualCustomizationSettings,
  subscribeWarrantySheetSettings,
} from './lib/localDb';
import {
  adjustProductStock,
  reopenDailyCashRegister,
  saveStoreAppAppearanceSettings,
  saveStoreVisualCustomizationSettings,
  seedInitialStoreCatalog,
  syncDailyReportForDate,
} from './lib/storeOperations';
import {
  darkenHexColor,
  DEFAULT_APP_APPEARANCE_SETTINGS,
  DEFAULT_DEVELOPER_SYSTEM_SETTINGS,
  DEFAULT_INSTALLED_APP_SETTINGS,
  DEFAULT_LOGIN_PRESENTATION_SETTINGS,
  DEFAULT_POS_SETTINGS,
  DEFAULT_RECEIPT_SETTINGS,
  DEFAULT_STAFF_MENU_TABS,
  DEFAULT_VISUAL_CUSTOMIZATION_SETTINGS,
  DEFAULT_WARRANTY_SHEET_SETTINGS,
  applyBackgroundOpacity,
  extractPrimaryHex,
  getLoginFontFamilyCss,
  getTodayDateKey,
  isHexColorDark,
  mixHexWithWhite,
  resolveUserAllowedTabs,
  setActiveAppCurrency,
  type AppAppearanceSettings,
  type AppCurrencyCode,
  type DailyReport,
  type DeveloperSystemSettings,
  type InstalledAppSettings,
  type LoginPresentationSettings,
  type NavTab,
  type PosSettings,
  type Product,
  type ReceiptSettings,
  type RepairTicket,
  type Sale,
  type TeamMember,
  type VisualCustomizationSettings,
  type Warranty,
  type WarrantySheetSettings,
} from './types/store';

const TAB_LABELS: Record<NavTab, string> = {
  dashboard: 'Panel Principal',
  inventory: 'Inventario y QR',
  pos: 'Punto de Venta',
  sales: 'Ventas Realizadas',
  warranties: 'Garantías',
  repairs: 'Reparaciones Técnicas',
  reports: 'Reportes Diarios',
  team: 'Equipo y Roles',
  settings: 'Opciones',
};

function WorkspaceApp() {
  const {
    user,
    profile,
    loading,
    actualRole,
    activeViewRole,
    setActiveViewRole,
    signOut,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>('app');
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    try {
      return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const drawerSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerContext, setScannerContext] =
    useState<ScannerContextMode>('general');
  const [scannerStartMode, setScannerStartMode] =
    useState<'camera' | 'wifi'>('camera');

  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [repairs, setRepairs] = useState<RepairTicket[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>(
    DEFAULT_RECEIPT_SETTINGS
  );
  const [loginPresentation, setLoginPresentation] =
    useState<LoginPresentationSettings>(DEFAULT_LOGIN_PRESENTATION_SETTINGS);
  const [appAppearance, setAppAppearance] = useState<AppAppearanceSettings>(
    DEFAULT_APP_APPEARANCE_SETTINGS
  );
  const [visualCustomization, setVisualCustomization] =
    useState<VisualCustomizationSettings>(DEFAULT_VISUAL_CUSTOMIZATION_SETTINGS);
  const [installedApp, setInstalledApp] = useState<InstalledAppSettings>(
    DEFAULT_INSTALLED_APP_SETTINGS
  );
  const [developerSystem, setDeveloperSystem] = useState<DeveloperSystemSettings>(
    DEFAULT_DEVELOPER_SYSTEM_SETTINGS
  );
  const [posSettings, setPosSettings] = useState<PosSettings>(
    DEFAULT_POS_SETTINGS
  );
  const [warrantySheetSettings, setWarrantySheetSettings] =
    useState<WarrantySheetSettings>(DEFAULT_WARRANTY_SHEET_SETTINGS);
  const [visualEditorOpen, setVisualEditorOpen] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Cross-module action bridges
  const [pendingEditProduct, setPendingEditProduct] = useState<Product | null>(null);
  const [pendingNewCode, setPendingNewCode] = useState<string | null>(null);
  const [incomingInventoryScan, setIncomingInventoryScan] = useState<{
    code: string;
    seq: number;
  } | null>(null);
  const [queuedPosProduct, setQueuedPosProduct] = useState<{
    product: Product;
    seq: number;
  } | null>(null);
  const [phoneScanBanner, setPhoneScanBanner] = useState<{
    message: string;
    kind: 'ok' | 'error';
  } | null>(null);
  const [focusedWarranty, setFocusedWarranty] = useState<Warranty | null>(null);
  const [focusedRepair, setFocusedRepair] = useState<RepairTicket | null>(null);
  const [prefillRepairWarranty, setPrefillRepairWarranty] = useState<Warranty | null>(
    null
  );

  const productsLatestRef = useRef<Product[]>([]);
  const allowedTabsLatestRef = useRef<NavTab[]>([]);
  const developerSettingsLatestRef = useRef(developerSystem);
  const scanSeqRef = useRef(0);

  useEffect(() => {
    productsLatestRef.current = products;
  }, [products]);

  useEffect(() => {
    developerSettingsLatestRef.current = developerSystem;
  }, [developerSystem]);

  useEffect(() => {
    const unsubLoginPresentation =
      subscribeLoginPresentationSettings(setLoginPresentation);
    const unsubAppAppearance = subscribeAppAppearanceSettings(setAppAppearance);
    const unsubVisualCustomization =
      subscribeVisualCustomizationSettings(setVisualCustomization);
    const unsubInstalledApp = subscribeInstalledAppSettings(setInstalledApp);
    const unsubDeveloperSystem =
      subscribeDeveloperSystemSettings(setDeveloperSystem);
    const unsubPosSettings = subscribePosSettings(setPosSettings);
    const unsubWarrantySheetSettings = subscribeWarrantySheetSettings(
      setWarrantySheetSettings
    );
    return () => {
      unsubLoginPresentation();
      unsubAppAppearance();
      unsubVisualCustomization();
      unsubInstalledApp();
      unsubDeveloperSystem();
      unsubPosSettings();
      unsubWarrantySheetSettings();
    };
  }, []);

  useEffect(() => {
    const isDark = themeMode === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.body.classList.toggle('dark-theme', isDark);
    try {
      localStorage.setItem('theme', themeMode);
    } catch {
      // Ignore unavailable localStorage
    }
  }, [themeMode]);

  useEffect(() => {
    const handleThemeSync = (event: Event) => {
      const next = (event as CustomEvent<'light' | 'dark'>).detail;
      if (next === 'dark' || next === 'light') {
        setThemeMode(next);
      }
    };
    window.addEventListener('tecnova-theme-sync', handleThemeSync);
    return () => {
      window.removeEventListener('tecnova-theme-sync', handleThemeSync);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const isDark = themeMode === 'dark';
    root.style.setProperty(
      '--app-bg',
      isDark
        ? 'linear-gradient(135deg, #020617 0%, #0f172a 44%, #111827 74%, #1e1b4b 100%)'
        : appAppearance.canvasBgColor ||
            DEFAULT_APP_APPEARANCE_SETTINGS.canvasBgColor
    );
    root.style.setProperty(
      '--app-surface-opacity',
      String(
        (appAppearance.surfaceOpacityPercent ??
          DEFAULT_APP_APPEARANCE_SETTINGS.surfaceOpacityPercent) / 100
      )
    );
    root.style.setProperty(
      '--app-font-sans',
      getLoginFontFamilyCss(appAppearance.fontStyle)
    );
    const accent = extractPrimaryHex(appAppearance.accentColor || '#1d4ed8', '#1d4ed8');
    root.style.setProperty('--color-blue-700', accent);
    root.style.setProperty('--color-blue-600', accent);
    root.style.setProperty('--color-blue-800', darkenHexColor(accent, 0.16));
    root.style.setProperty('--color-blue-50', mixHexWithWhite(accent, 0.92));
    root.style.setProperty('--color-blue-100', mixHexWithWhite(accent, 0.84));
    setActiveAppCurrency(
      appAppearance.currencyCode,
      appAppearance.exchangeRateNio ?? 36.62
    );
  }, [appAppearance, themeMode]);

  useEffect(() => {
    if (appAppearance.currencyCode !== 'NIO') return;
    const fetchNioRate = async () => {
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        if (!res.ok) return;
        const data = (await res.json()) as { rates?: { NIO?: number } };
        const rate = data?.rates?.NIO;
        if (rate && typeof rate === 'number' && rate > 0) {
          if (appAppearance.exchangeRateNio !== rate) {
            await saveStoreAppAppearanceSettings({
              ...appAppearance,
              exchangeRateNio: Number(rate.toFixed(4)),
            });
          }
        }
      } catch {
        // ignore network error
      }
    };
    void fetchNioRate();
  }, [appAppearance]);

  useEffect(() => {
    const effectiveName =
      installedApp.installedName || appAppearance.appName || 'TECNOVA';
    const effectiveShort =
      installedApp.installedShortName || appAppearance.shortName || 'TECNOVA';
    document.title = `${effectiveName} — Gestión de Tienda`;

    const themeMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]'
    );
    if (themeMeta) {
      themeMeta.content = installedApp.themeColor || '#0f172a';
    }

    const appleTitleMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-title"]'
    );
    if (appleTitleMeta) {
      appleTitleMeta.content = effectiveShort;
    }

    const appleIconLink = document.querySelector<HTMLLinkElement>(
      'link[rel="apple-touch-icon"]'
    );
    if (appleIconLink) {
      appleIconLink.href =
        installedApp.appleTouchIcon180DataUrl || '/apple-touch-icon.png';
    }

    const faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (faviconLink) {
      if (installedApp.icon192DataUrl || installedApp.logoDataUrl) {
        faviconLink.type = 'image/png';
        faviconLink.href =
          installedApp.icon192DataUrl || installedApp.logoDataUrl;
      } else {
        faviconLink.type = 'image/svg+xml';
        faviconLink.href = '/icon.svg';
      }
    }

    const origin = window.location.origin;
    const dynamicManifest = {
      id: `${origin}/`,
      name: effectiveName,
      short_name: effectiveShort,
      description:
        installedApp.description || DEFAULT_INSTALLED_APP_SETTINGS.description,
      theme_color: installedApp.themeColor || '#0f172a',
      background_color: installedApp.backgroundColor || '#f8fafc',
      display: installedApp.displayMode || 'standalone',
      start_url: `${origin}/`,
      scope: `${origin}/`,
      icons: [
        {
          src: installedApp.icon192DataUrl || `${origin}/pwa-192x192.png`,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: installedApp.icon512DataUrl || `${origin}/pwa-512x512.png`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src:
            installedApp.iconMaskable512DataUrl ||
            installedApp.icon512DataUrl ||
            `${origin}/pwa-maskable-512x512.png`,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    };

    const blob = new Blob([JSON.stringify(dynamicManifest)], {
      type: 'application/manifest+json',
    });
    const manifestUrl = URL.createObjectURL(blob);

    let manifestLink = document.querySelector<HTMLLinkElement>(
      'link[rel="manifest"]'
    );
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestUrl;

    return () => {
      URL.revokeObjectURL(manifestUrl);
    };
  }, [installedApp, appAppearance.appName, appAppearance.shortName]);

  useEffect(() => {
    if (!user || !profile) {
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    let settledCount = 0;
    const markSettled = () => {
      settledCount += 1;
      if (settledCount >= 5) setDataLoading(false);
    };

    const unsubProducts = subscribeLocalStore<Product>('products', (list) => {
      setProducts(list);
      markSettled();
    });

    const unsubSales = subscribeLocalStore<Sale>('sales', (list) => {
      setSales(list);
      markSettled();
    });

    const unsubWarranties = subscribeLocalStore<Warranty>(
      'warranties',
      (list) => {
        setWarranties(list);
        markSettled();
      }
    );

    const unsubRepairs = subscribeLocalStore<RepairTicket>('repairs', (list) => {
      setRepairs(list);
      markSettled();
    });

    const unsubReports = subscribeLocalStore<DailyReport>(
      'dailyReports',
      (list) => {
        setReports(list);
        markSettled();
      }
    );

    const unsubUsers = subscribeLocalStore<TeamMember>('accounts', (list) => {
      const sorted = [...list].sort((a, b) =>
        a.displayName.localeCompare(b.displayName)
      );
      setTeamMembers(sorted);
    });

    const unsubReceipt = subscribeReceiptSettings((settings) => {
      setReceiptSettings(settings);
    });

    return () => {
      unsubProducts();
      unsubSales();
      unsubWarranties();
      unsubRepairs();
      unsubReports();
      unsubUsers();
      unsubReceipt();
    };
  }, [user, profile]);

  const allowedTabs: NavTab[] =
    (actualRole === 'admin' || actualRole === 'developer') &&
    activeViewRole === 'staff'
      ? DEFAULT_STAFF_MENU_TABS
      : resolveUserAllowedTabs(
          actualRole,
          profile?.allowedTabs,
          profile?.username
        );

  const effectiveViewRole: 'admin' | 'staff' =
    activeViewRole === 'admin' || activeViewRole === 'developer'
      ? 'admin'
      : 'staff';

  const isFullDeveloper =
    actualRole === 'developer' && activeViewRole === 'developer';

  const canUseVisualEditor = isFullDeveloper;

  useEffect(() => {
    if (!canUseVisualEditor && visualEditorOpen) {
      setVisualEditorOpen(false);
    }
  }, [canUseVisualEditor, visualEditorOpen]);

  useEffect(() => {
    if (user && !allowedTabs.includes(activeTab) && allowedTabs.length > 0) {
      setActiveTab(allowedTabs[0]);
    }
  }, [user, activeTab, allowedTabs]);

  useEffect(() => {
    setMenuDrawerOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (!user || !profile) return;
    const bridgeBase = getLanBridgeBaseUrl();
    if (!bridgeBase) return;
    let es: EventSource | null = null;
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 1500);

    void fetch(`${bridgeBase}/api/lan-scanner/info`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((res) => {
        if (!res.ok) throw new Error('Lan bridge unavailable');
        return res.json();
      })
      .then(() => {
        if (cancelled) return;
        es = new EventSource(`${bridgeBase}/api/lan-scanner/stream`);
        es.addEventListener('scan', handleScanEvent);
      })
      .catch(() => {
        // The LAN bridge is optional; the app remains fully usable without it.
      })
      .finally(() => window.clearTimeout(timeoutId));
    const handleScanEvent = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(String(event.data || '{}')) as {
          code?: string;
          mode?: 'pos' | 'inventory';
        };
        const rawCode = String(payload.code || '').trim();
        const token = extractCodeToken(rawCode);
        if (!token) return;

        const targetMode = payload.mode === 'pos' ? 'pos' : 'inventory';
        const tabs = allowedTabsLatestRef.current;

        if (targetMode === 'pos') {
          if (!tabs.includes('pos')) return;
          const lower = token.toLowerCase();
          const match = productsLatestRef.current.find(
            (p) =>
              p.active &&
              (p.barcode.toLowerCase() === lower ||
                p.sku.toLowerCase() === lower ||
                p.qrCodeData.toLowerCase() === lower)
          );
          if (!match) {
            playScannerBeep('error');
            setPhoneScanBanner({
              kind: 'error',
              message: `Teléfono POS: código ${token} no encontrado en inventario.`,
            });
            return;
          }
          const allowNegative = Boolean(
            developerSettingsLatestRef.current.allowNegativeStockSale
          );
          if (!allowNegative && match.stock <= 0) {
            playScannerBeep('error');
            setPhoneScanBanner({
              kind: 'error',
              message: `Teléfono POS: "${match.name}" sin stock disponible.`,
            });
            return;
          }
          scanSeqRef.current += 1;
          setQueuedPosProduct({ product: match, seq: scanSeqRef.current });
          setActiveTab('pos');
          playScannerBeep('ok');
          setPhoneScanBanner({
            kind: 'ok',
            message: `Escaneado desde teléfono -> POS: ${match.name} (+1)`,
          });
        } else {
          if (!tabs.includes('inventory')) return;
          scanSeqRef.current += 1;
          setIncomingInventoryScan({ code: token, seq: scanSeqRef.current });
          setActiveTab('inventory');
          playScannerBeep('ok');
          setPhoneScanBanner({
            kind: 'ok',
            message: `Escaneado desde teléfono -> Inventario: ${token}`,
          });
        }
      } catch {
        // ignore malformed SSE packet
      }
    };

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
      if (es) {
        es.removeEventListener('scan', handleScanEvent);
        es.close();
      }
    };
  }, [user, profile]);

  useEffect(() => {
    if (!phoneScanBanner) return;
    const t = setTimeout(() => setPhoneScanBanner(null), 4000);
    return () => clearTimeout(t);
  }, [phoneScanBanner]);

  if (loading) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-6">
        <div
          aria-hidden="true"
          className="fixed inset-0 z-0 pointer-events-none glass-atmosphere-orbs"
        />
        <div className="relative z-10 bg-white border border-white/70 rounded-2xl p-8 max-w-sm w-full space-y-4">
          <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-2/3 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen settings={loginPresentation} />;
  }

  if (profile && !profile.active) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-6">
        <div
          aria-hidden="true"
          className="fixed inset-0 z-0 pointer-events-none glass-atmosphere-orbs"
        />
        <div className="relative z-10 bg-white border border-white/70 rounded-2xl p-8 max-w-md w-full space-y-4">
          <h1 className="text-lg font-semibold text-slate-900">Cuenta suspendida</h1>
          <p className="text-sm text-slate-600">
            Tu acceso operativo ha sido desactivado temporalmente por el administrador de la tienda.
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  const baseNavItems: {
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'dashboard', label: 'Panel Principal', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventario y QR', icon: Package },
    { id: 'pos', label: 'Punto de Venta', icon: ShoppingCart },
    { id: 'sales', label: 'Ventas Realizadas', icon: Receipt },
    { id: 'warranties', label: 'Garantías', icon: ShieldCheck },
    { id: 'repairs', label: 'Reparaciones', icon: Wrench },
    { id: 'reports', label: 'Reportes Diarios', icon: FileSpreadsheet },
    { id: 'team', label: 'Equipo y Roles', icon: Users },
    { id: 'settings', label: 'Opciones', icon: Settings },
  ];

  const customNavOrder =
    visualCustomization.navOrder || DEFAULT_VISUAL_CUSTOMIZATION_SETTINGS.navOrder;
  const allNavItems = [...baseNavItems]
    .sort((a, b) => {
      const idxA = customNavOrder.indexOf(a.id);
      const idxB = customNavOrder.indexOf(b.id);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    })
    .map((item) => ({
      ...item,
      label: visualCustomization.navLabels?.[item.id] || item.label,
    }));

  const navItems = allNavItems.filter((item) => allowedTabs.includes(item.id));
  allowedTabsLatestRef.current = allowedTabs;

  const normalizedMenuQuery = menuSearchQuery
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const filteredNavItems = normalizedMenuQuery
    ? navItems.filter((item) =>
        item.label
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .includes(normalizedMenuQuery)
      )
    : navItems;

  const openScannerForContext = (ctx: ScannerContextMode) => {
    setScannerContext(ctx);
    setScannerStartMode('camera');
    setScannerOpen(true);
  };

  const safeNavigate = (tab: NavTab) => {
    if (allowedTabs.includes(tab)) {
      setActiveTab(tab);
    }
  };

  const todayReport = reports.find((r) => r.dateKey === getTodayDateKey());
  const actorName = profile?.displayName || user.displayName || 'Usuario';

  const handleAdjustStock = async (product: Product, delta: number) => {
    await adjustProductStock(product, delta, user.uid);
  };

  setActiveAppCurrency(
    appAppearance.currencyCode,
    appAppearance.exchangeRateNio ?? 36.62
  );

  const isGlobalDark = themeMode === 'dark';
  const effectiveCanvasBg = isGlobalDark
    ? 'linear-gradient(135deg, #020617 0%, #0f172a 44%, #111827 74%, #1e1b4b 100%)'
    : appAppearance.canvasBgColor ||
      DEFAULT_APP_APPEARANCE_SETTINGS.canvasBgColor;
  const effectiveSidebarBg = isGlobalDark
    ? '#0f172a'
    : appAppearance.sidebarBgColor || '#ffffff';
  const effectiveHeaderBg = isGlobalDark
    ? '#0f172a'
    : appAppearance.headerBgColor || '#ffffff';
  const isSidebarDark = isGlobalDark || isHexColorDark(effectiveSidebarBg);
  const isHeaderDark = isGlobalDark || isHexColorDark(effectiveHeaderBg);
  const isPrimaryDark = isHexColorDark(appAppearance.primaryColor);
  const surfaceOpacity =
    appAppearance.surfaceOpacityPercent ??
    DEFAULT_APP_APPEARANCE_SETTINGS.surfaceOpacityPercent;

  return (
    <div
      id="app-shell"
      className="min-h-screen relative flex flex-col"
      style={{
        background: effectiveCanvasBg,
        backgroundAttachment: 'fixed',
      }}
    >
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none glass-atmosphere-orbs no-print"
      />

      {/* Unified Floating Navigation Menu (all views) */}
      {menuDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start p-3 sm:p-4 bg-slate-950/45 backdrop-blur-xs no-print"
          onClick={() => setMenuDrawerOpen(false)}
        >
          <div
            className={`w-72 h-fit max-h-[calc(100vh-2rem)] rounded-2xl border flex flex-col backdrop-blur-2xl backdrop-saturate-150 shadow-2xl overflow-hidden ${
              isSidebarDark ? 'border-white/15' : 'border-white/75'
            }`}
            style={{
              background: applyBackgroundOpacity(
                effectiveSidebarBg,
                isGlobalDark ? Math.max(76, surfaceOpacity) : surfaceOpacity
              ),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`h-14 px-4 flex items-center justify-between border-b shrink-0 ${
                isSidebarDark ? 'border-white/10' : 'border-slate-200/70'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {appAppearance.showLogoInSidebar && appAppearance.logoDataUrl && (
                  <img
                    src={appAppearance.logoDataUrl}
                    alt={appAppearance.appName}
                    className="h-6 w-auto object-contain shrink-0"
                  />
                )}
                <span
                  className={`text-sm font-bold truncate ${
                    isSidebarDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {appAppearance.appName || 'TECNOVA'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMenuDrawerOpen(false)}
                className={`p-1.5 rounded-lg cursor-pointer ${
                  isSidebarDark
                    ? 'text-slate-300 hover:bg-white/10'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
                aria-label="Cerrar menú"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search bar inside drawer */}
            <div className="px-2.5 pt-2.5 pb-1 shrink-0">
              <div
                onClick={() => drawerSearchInputRef.current?.focus()}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors ${
                  isSidebarDark
                    ? 'bg-white/5 border-white/15 text-slate-200'
                    : 'bg-white/55 border-white/75 text-slate-700'
                }`}
              >
                <Search className="w-3.5 h-3.5 shrink-0 opacity-70" />
                <input
                  ref={drawerSearchInputRef}
                  type="text"
                  value={menuSearchQuery}
                  onChange={(e) => setMenuSearchQuery(e.target.value)}
                  placeholder="Buscar módulo..."
                  className={`w-full bg-transparent text-xs focus:outline-none ${
                    isSidebarDark
                      ? 'text-white placeholder:text-slate-400'
                      : 'text-slate-900 placeholder:text-slate-500'
                  }`}
                  aria-label="Buscar en el menú"
                />
                {menuSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setMenuSearchQuery('')}
                    className="p-0.5 rounded hover:bg-black/10 shrink-0 cursor-pointer"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="w-3.5 h-3.5 opacity-70" />
                  </button>
                )}
              </div>
            </div>

            <nav
              data-visual-scope="shell"
              className="p-2.5 space-y-0.5 overflow-y-auto flex flex-col"
            >
              {filteredNavItems.length === 0 ? (
                <div className="px-3 py-4 text-center space-y-1.5">
                  <p
                    className={`text-xs ${
                      isSidebarDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    Sin módulos para "{menuSearchQuery}"
                  </p>
                  <button
                    type="button"
                    onClick={() => setMenuSearchQuery('')}
                    className="text-[11px] font-medium text-blue-600 hover:underline cursor-pointer"
                  >
                    Mostrar todos
                  </button>
                </div>
              ) : (
                filteredNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-nav-tab={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setMenuDrawerOpen(false);
                      }}
                      style={
                        active
                          ? {
                              background: applyBackgroundOpacity(
                                appAppearance.primaryColor || '#0f172a',
                                Math.max(75, surfaceOpacity)
                              ),
                              color: isPrimaryDark ? '#ffffff' : '#0f172a',
                            }
                          : undefined
                      }
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-colors cursor-pointer ${
                        active
                          ? 'shadow-sm'
                          : isSidebarDark
                            ? 'text-slate-300 hover:bg-white/10 hover:text-white'
                            : 'text-slate-700 hover:bg-white/60 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })
              )}
            </nav>
            <div
              className={`px-3 py-2.5 border-t space-y-2 shrink-0 ${
                isSidebarDark ? 'border-white/10' : 'border-slate-200/70'
              }`}
            >
              {(actualRole === 'admin' ||
                (actualRole === 'developer' && developerSystem.showDevRoleSwitcher)) && (
                <div
                  className={`grid grid-cols-2 gap-1 p-1 rounded-lg ${
                    isSidebarDark ? 'bg-white/10' : 'bg-slate-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveViewRole(actualRole)}
                    className={`py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                      activeViewRole === actualRole
                        ? 'bg-white text-slate-900 shadow-xs'
                        : isSidebarDark
                          ? 'text-slate-300 hover:text-white'
                          : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {actualRole === 'developer' ? 'Desarrollador' : 'Admin'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveViewRole('staff')}
                    className={`py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                      activeViewRole === 'staff'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : isSidebarDark
                          ? 'text-slate-300 hover:text-white'
                          : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Usuario
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className={`text-xs font-semibold truncate ${
                      isSidebarDark ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {actorName}
                  </p>
                  <p
                    className={`text-[10px] truncate ${
                      isSidebarDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    @{profile?.username || 'usuario'} ·{' '}
                    {activeViewRole === 'developer'
                      ? 'Desarrollador'
                      : activeViewRole === 'admin'
                        ? 'Administrador'
                        : 'Usuario Operativo'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'))
                    }
                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                      isSidebarDark
                        ? 'bg-white/5 border-white/15 text-amber-300 hover:bg-white/10'
                        : 'bg-white/60 border-white/80 text-indigo-600 hover:bg-white/85'
                    }`}
                    title={
                      themeMode === 'dark'
                        ? 'Cambiar a modo claro'
                        : 'Cambiar a modo oscuro'
                    }
                    aria-label={
                      themeMode === 'dark'
                        ? 'Cambiar a modo claro'
                        : 'Cambiar a modo oscuro'
                    }
                  >
                    {themeMode === 'dark' ? (
                      <Sun className="w-3.5 h-3.5" />
                    ) : (
                      <Moon className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="text-xs text-red-600 font-medium px-2 py-1 rounded-md hover:bg-red-50 cursor-pointer"
                  >
                    Salir
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header
          className={`h-16 border-b px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30 backdrop-blur-2xl backdrop-saturate-150 no-print ${
            isHeaderDark
              ? 'border-white/15 shadow-[0_8px_28px_-12px_rgba(2,6,23,0.4)]'
              : 'border-white/70 shadow-[0_8px_28px_-14px_rgba(15,23,42,0.10)]'
          }`}
          style={{
            background: applyBackgroundOpacity(
              effectiveHeaderBg,
              isGlobalDark ? Math.max(72, surfaceOpacity) : surfaceOpacity
            ),
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMenuDrawerOpen(true)}
              className={`inline-flex items-center gap-2 px-2.5 py-1.5 -ml-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                isHeaderDark
                  ? 'border-white/15 bg-white/5 text-slate-200 hover:text-white hover:bg-white/10'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
              aria-label="Abrir menú"
              title="Abrir menú de módulos"
            >
              <Menu className="w-4 h-4" />
              <span className="hidden sm:inline">Menú</span>
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm truncate">
              <span
                className={`hidden sm:inline ${
                  isHeaderDark ? 'text-slate-400' : 'text-slate-400'
                }`}
              >
                {appAppearance.shortName || appAppearance.appName || 'TECNOVA'}
              </span>
              <span
                className={`hidden sm:inline ${
                  isHeaderDark ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                /
              </span>
              <span
                className={`font-semibold truncate ${
                  isHeaderDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {visualCustomization.navLabels?.[activeTab] || TAB_LABELS[activeTab]}
              </span>
            </div>
          </div>

          {canUseVisualEditor && (
            <button
              type="button"
              onClick={() => setVisualEditorOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                visualEditorOpen
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-xs'
                  : isHeaderDark
                    ? 'bg-white/10 text-cyan-300 border-cyan-500/40 hover:bg-white/15'
                    : 'bg-slate-950 text-cyan-300 border-cyan-500/40 hover:bg-slate-900'
              }`}
              title="Modo exclusivo del desarrollador para mover botones, editar textos y ajustar la interfaz sin código"
            >
              <Sliders className="w-3.5 h-3.5" />
              {visualEditorOpen ? 'Editando Diseño' : 'Editor Visual'}
            </button>
          )}
        </header>

        {/* Viewport Container */}
        <main className="flex-1 p-4 sm:p-8 w-full mx-auto max-w-[1600px]">
          {dataLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-28 bg-white border border-slate-200 rounded-xl p-5 space-y-3"
                >
                  <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
                  <div className="h-7 w-32 bg-slate-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div key={activeTab} data-visual-scope={activeTab}>
              {activeTab === 'dashboard' &&
                allowedTabs.includes('dashboard') &&
                (effectiveViewRole === 'admin' ? (
                  <AdminDashboard
                    profile={profile}
                    products={products}
                    sales={sales}
                    repairs={repairs}
                    warranties={warranties}
                    todayReport={todayReport}
                    allowedTabs={allowedTabs}
                    onNavigate={safeNavigate}
                    onOpenScanner={() => openScannerForContext('general')}
                    onSeedCatalog={() => seedInitialStoreCatalog(user.uid, actorName)}
                    onSyncDailyReport={(closeDay) =>
                      syncDailyReportForDate(
                        getTodayDateKey(),
                        sales,
                        repairs,
                        user.uid,
                        actorName,
                        closeDay
                      )
                    }
                    onReopenCashRegister={async (
                      adminUsername,
                      adminPassword,
                      reason
                    ) => {
                      await reopenDailyCashRegister({
                        dateKey: getTodayDateKey(),
                        allSales: sales,
                        allRepairs: repairs,
                        adminUsername,
                        adminPassword,
                        reason,
                      });
                    }}
                    requireAdminToReopenCash={
                      developerSystem.requireAdminToReopenCash
                    }
                    isDeveloper={isFullDeveloper}
                  />
                ) : (
                  <StaffDashboard
                    profile={profile}
                    products={products}
                    sales={sales}
                    repairs={repairs}
                    warranties={warranties}
                    allowedTabs={allowedTabs}
                    onNavigate={safeNavigate}
                    onOpenScanner={() => openScannerForContext('general')}
                  />
                ))}

              {activeTab === 'inventory' && allowedTabs.includes('inventory') && (
                <InventoryView
                  products={products}
                  uid={user.uid}
                  viewRole={effectiveViewRole}
                  onAdjustStock={handleAdjustStock}
                  onOpenScanner={() => openScannerForContext('inventory')}
                  pendingEditProduct={pendingEditProduct}
                  pendingNewCode={pendingNewCode}
                  onClearPending={() => {
                    setPendingEditProduct(null);
                    setPendingNewCode(null);
                  }}
                  incomingScan={incomingInventoryScan}
                  onConsumeIncomingScan={() => setIncomingInventoryScan(null)}
                  developerSettings={developerSystem}
                />
              )}

              {activeTab === 'pos' && allowedTabs.includes('pos') && (
                <PosSalesView
                  products={products}
                  sales={sales}
                  repairs={repairs}
                  warranties={warranties}
                  uid={user.uid}
                  sellerName={actorName}
                  viewRole={effectiveViewRole}
                  isDeveloper={isFullDeveloper}
                  currentUsername={profile?.username || ''}
                  receiptSettings={receiptSettings}
                  currencyCode={appAppearance.currencyCode}
                  onChangeCurrency={(nextCode: AppCurrencyCode) => {
                    setActiveAppCurrency(
                      nextCode,
                      appAppearance.exchangeRateNio ?? 36.62
                    );
                    void saveStoreAppAppearanceSettings({
                      ...appAppearance,
                      currencyCode: nextCode,
                    });
                  }}
                  onOpenScanner={() => openScannerForContext('pos')}
                  onOpenReceiptSettings={
                    isFullDeveloper && allowedTabs.includes('settings')
                      ? () => {
                          setSettingsSection('receipt');
                          setActiveTab('settings');
                        }
                      : undefined
                  }
                  queuedProduct={queuedPosProduct}
                  onConsumeQueuedProduct={() => setQueuedPosProduct(null)}
                  developerSettings={developerSystem}
                  posSettings={posSettings}
                  warrantySheetSettings={warrantySheetSettings}
                />
              )}

              {activeTab === 'sales' && allowedTabs.includes('sales') && (
                <SalesHistoryView
                  sales={sales}
                  products={products}
                  repairs={repairs}
                  warranties={warranties}
                  receiptSettings={receiptSettings}
                  warrantySheetSettings={warrantySheetSettings}
                  uid={user.uid}
                  actorName={actorName}
                  viewRole={effectiveViewRole}
                  isDeveloper={isFullDeveloper}
                  currentUsername={profile?.username || ''}
                  requireAdminToCancelSale={
                    developerSystem.requireAdminToCancelSale ?? true
                  }
                  onOpenPos={
                    allowedTabs.includes('pos')
                      ? () => setActiveTab('pos')
                      : undefined
                  }
                  onOpenReceiptSettings={
                    isFullDeveloper && allowedTabs.includes('settings')
                      ? () => {
                          setSettingsSection('receipt');
                          setActiveTab('settings');
                        }
                      : undefined
                  }
                />
              )}

              {activeTab === 'warranties' && allowedTabs.includes('warranties') && (
                <WarrantiesView
                  warranties={warranties}
                  products={products}
                  sales={sales}
                  receiptSettings={receiptSettings}
                  warrantySheetSettings={warrantySheetSettings}
                  uid={user.uid}
                  focusedWarranty={focusedWarranty}
                  onClearFocusedWarranty={() => setFocusedWarranty(null)}
                  onCreateRepairFromWarranty={(w) => {
                    if (!allowedTabs.includes('repairs')) return;
                    setPrefillRepairWarranty(w);
                    setActiveTab('repairs');
                  }}
                />
              )}

              {activeTab === 'repairs' && allowedTabs.includes('repairs') && (
                <RepairsView
                  repairs={repairs}
                  warranties={warranties}
                  uid={user.uid}
                  actorName={actorName}
                  viewRole={effectiveViewRole}
                  prefillWarranty={prefillRepairWarranty}
                  onClearPrefillWarranty={() => setPrefillRepairWarranty(null)}
                  focusedRepair={focusedRepair}
                  onClearFocusedRepair={() => setFocusedRepair(null)}
                />
              )}

              {activeTab === 'reports' && allowedTabs.includes('reports') && (
                <DailyReportsView
                  reports={reports}
                  sales={sales}
                  repairs={repairs}
                  uid={user.uid}
                  actorName={actorName}
                  viewRole={effectiveViewRole}
                  isDeveloper={isFullDeveloper}
                  requireAdminToReopenCash={
                    developerSystem.requireAdminToReopenCash
                  }
                />
              )}

              {activeTab === 'team' && allowedTabs.includes('team') && (
                <TeamManagementView
                  members={teamMembers}
                  currentUid={user.uid}
                  isDeveloper={isFullDeveloper}
                />
              )}

              {activeTab === 'settings' &&
                actualRole === 'developer' &&
                activeViewRole === 'developer' &&
                allowedTabs.includes('settings') && (
                <SettingsWorkspaceView
                  appSettings={appAppearance}
                  receiptSettings={receiptSettings}
                  loginSettings={loginPresentation}
                  installedSettings={installedApp}
                  developerSettings={developerSystem}
                  posSettings={posSettings}
                  warrantySettings={warrantySheetSettings}
                  visualCustomization={visualCustomization}
                  developerProfile={profile}
                  section={settingsSection}
                  onChangeSection={setSettingsSection}
                  onOpenVisualEditor={() => setVisualEditorOpen(true)}
                  onOpenPhoneScanner={() => {
                    setScannerContext('general');
                    setScannerStartMode('wifi');
                    setScannerOpen(true);
                  }}
                  onSeedCatalog={() => seedInitialStoreCatalog(user.uid, actorName)}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Global Real-time Barcode & QR Scanner Modal */}
      <ScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        initialContext={scannerContext}
        initialScanMode={scannerStartMode}
        products={products}
        warranties={warranties}
        repairs={repairs}
        onAdjustStock={handleAdjustStock}
        onOpenEditProduct={(product) => {
          if (!allowedTabs.includes('inventory')) return;
          setPendingEditProduct(product);
          setActiveTab('inventory');
        }}
        onCreateNewFromCode={(code) => {
          if (!allowedTabs.includes('inventory')) return;
          setPendingNewCode(code);
          setActiveTab('inventory');
        }}
        onAddToPos={(product) => {
          if (!allowedTabs.includes('pos')) return;
          scanSeqRef.current += 1;
          setQueuedPosProduct({ product, seq: scanSeqRef.current });
          setActiveTab('pos');
        }}
        onLocateWarranty={(w) => {
          if (!allowedTabs.includes('warranties')) return;
          setFocusedWarranty(w);
          setActiveTab('warranties');
        }}
        onLocateRepair={(r) => {
          if (!allowedTabs.includes('repairs')) return;
          setFocusedRepair(r);
          setActiveTab('repairs');
        }}
      />

      {phoneScanBanner && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl border shadow-lg text-xs font-medium flex items-center gap-2 ${
            phoneScanBanner.kind === 'ok'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
              : 'bg-red-950 text-red-100 border-red-700'
          }`}
        >
          <span>{phoneScanBanner.message}</span>
          <button
            type="button"
            onClick={() => setPhoneScanBanner(null)}
            className="p-0.5 rounded hover:bg-white/10"
            aria-label="Cerrar notificación"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <OfflineIndicator visible={developerSystem.showOfflineBanner} />

      <VisualPatchApplier
        settings={visualCustomization}
        isEditMode={canUseVisualEditor && visualEditorOpen}
      />

      {canUseVisualEditor && (
        <VisualStudioEditor
          isOpen={visualEditorOpen}
          activeTab={activeTab}
          settings={visualCustomization}
          onNavigateTab={safeNavigate}
          onSaveSettings={saveStoreVisualCustomizationSettings}
          onClose={() => setVisualEditorOpen(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <WorkspaceApp />
      </AuthProvider>
    </ErrorBoundary>
  );
}
