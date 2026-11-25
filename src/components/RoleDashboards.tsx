import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Cpu,
  FileSpreadsheet,
  Layers,
  Lock,
  PackagePlus,
  QrCode,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Unlock,
  Wrench,
  Zap,
} from 'lucide-react';
import { AdminCashAuthModal } from './AdminCashAuthModal';
import {
  PRODUCT_CATEGORIES,
  formatCurrency,
  getActiveAppCurrencyOption,
  getTodayDateKey,
  type DailyReport,
  type NavTab,
  type Product,
  type RepairTicket,
  type Sale,
  type UserProfile,
  type Warranty,
} from '../types/store';

export type { NavTab };

const CATEGORY_GRADIENTS: Record<
  string,
  { bar: string; dot: string; text: string; hex: string }
> = {
  Smartphones: {
    bar: 'from-cyan-400 via-sky-500 to-blue-600',
    dot: 'bg-cyan-400',
    text: 'text-cyan-300',
    hex: '#22d3ee',
  },
  Accesorios: {
    bar: 'from-fuchsia-400 via-pink-500 to-rose-500',
    dot: 'bg-fuchsia-400',
    text: 'text-fuchsia-300',
    hex: '#e879f9',
  },
  'Cargadores y Cables': {
    bar: 'from-amber-400 via-orange-500 to-red-500',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
    hex: '#fbbf24',
  },
  Audio: {
    bar: 'from-violet-400 via-purple-500 to-indigo-600',
    dot: 'bg-violet-400',
    text: 'text-violet-300',
    hex: '#a78bfa',
  },
  'Pantallas y Repuestos': {
    bar: 'from-emerald-400 via-teal-500 to-cyan-500',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
    hex: '#34d399',
  },
  Protección: {
    bar: 'from-lime-400 via-emerald-500 to-teal-600',
    dot: 'bg-lime-400',
    text: 'text-lime-300',
    hex: '#a3e635',
  },
};

const REPAIR_STAGE_STYLES: {
  status: string;
  label: string;
  barClass: string;
  textClass: string;
  hex: string;
}[] = [
  {
    status: 'Recibido',
    label: 'Recibido',
    barClass: 'bg-sky-400',
    textClass: 'text-sky-300',
    hex: '#38bdf8',
  },
  {
    status: 'En Diagnóstico',
    label: 'Diagnóstico',
    barClass: 'bg-violet-400',
    textClass: 'text-violet-300',
    hex: '#a78bfa',
  },
  {
    status: 'Esperando Repuesto',
    label: 'Repuesto',
    barClass: 'bg-amber-400',
    textClass: 'text-amber-300',
    hex: '#fbbf24',
  },
  {
    status: 'En Reparación',
    label: 'En Proceso',
    barClass: 'bg-fuchsia-400',
    textClass: 'text-fuchsia-300',
    hex: '#e879f9',
  },
  {
    status: 'Listo para Entrega',
    label: 'Listo',
    barClass: 'bg-emerald-400',
    textClass: 'text-emerald-300',
    hex: '#34d399',
  },
];

function compactCurrency(value: number, symbol: string): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${symbol}${(value / 1_000).toFixed(1)}k`;
  return `${symbol}${Math.round(value).toLocaleString()}`;
}

function buildSparklinePoints(values: number[], width: number, height: number): string {
  if (values.length === 0) return `0,${height} ${width},${height}`;
  const max = Math.max(1, ...values);
  const stepX = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((val, idx) => {
      const x = idx * stepX;
      const y = height - 4 - (val / max) * (height - 10);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function OrbitalPulseGauge({
  primaryPct,
  secondaryPct,
  tertiaryPct,
  centerValue,
  centerLabel,
}: {
  primaryPct: number;
  secondaryPct: number;
  tertiaryPct: number;
  centerValue: string;
  centerLabel: string;
}) {
  const clamp = (n: number) => Math.max(6, Math.min(100, Math.round(n)));
  const r1 = 68;
  const r2 = 54;
  const r3 = 40;
  const c1 = 2 * Math.PI * r1;
  const c2 = 2 * Math.PI * r2;
  const c3 = 2 * Math.PI * r3;

  return (
    <div className="relative w-44 h-44 flex items-center justify-center shrink-0">
      <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90 drop-shadow-[0_0_16px_rgba(34,211,238,0.28)]">
        <defs>
          <linearGradient id="orbitalCyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient id="orbitalFuchsia" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e879f9" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id="orbitalEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>

        <circle cx="80" cy="80" r={r1} fill="none" stroke="rgba(148,163,184,0.14)" strokeWidth="7" />
        <circle
          cx="80"
          cy="80"
          r={r1}
          fill="none"
          stroke="url(#orbitalCyan)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(c1 * clamp(primaryPct)) / 100} ${c1}`}
        />

        <circle cx="80" cy="80" r={r2} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="6" />
        <circle
          cx="80"
          cy="80"
          r={r2}
          fill="none"
          stroke="url(#orbitalFuchsia)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(c2 * clamp(secondaryPct)) / 100} ${c2}`}
        />

        <circle cx="80" cy="80" r={r3} fill="none" stroke="rgba(148,163,184,0.10)" strokeWidth="5" />
        <circle
          cx="80"
          cy="80"
          r={r3}
          fill="none"
          stroke="url(#orbitalEmerald)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(c3 * clamp(tertiaryPct)) / 100} ${c3}`}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
        <span className="text-[11px] font-medium text-cyan-300">{centerLabel}</span>
        <span className="text-base font-bold font-mono tabular-nums text-white mt-0.5 truncate max-w-[104px]">
          {centerValue}
        </span>
      </div>
    </div>
  );
}

interface DonutSlice {
  id: string;
  label: string;
  value: number;
  color: string;
  dotClass: string;
  textClass: string;
}

function NeonDonutChart({
  slices,
  centerTitle,
  centerSubtitle,
}: {
  slices: DonutSlice[];
  centerTitle: string;
  centerSubtitle: string;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const total = slices.reduce((acc, s) => acc + s.value, 0);
  const radius = 58;
  const circumference = 2 * Math.PI * radius;

  const segments = useMemo(() => {
    if (total <= 0) return [];
    let accumulated = 0;
    return slices
      .filter((s) => s.value > 0)
      .map((slice) => {
        const fraction = slice.value / total;
        const dashLength = Math.max(0, fraction * circumference - 3);
        const offset = -(accumulated * circumference);
        accumulated += fraction;
        return {
          ...slice,
          fraction,
          dashLength,
          offset,
        };
      });
  }, [slices, total, circumference]);

  const activeSlice = hoveredId ? slices.find((s) => s.id === hoveredId) : null;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="rgba(148,163,184,0.14)"
            strokeWidth="16"
          />
          {segments.map((seg) => {
            const isHovered = hoveredId === seg.id;
            return (
              <circle
                key={seg.id}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={isHovered ? 20 : 16}
                strokeLinecap="round"
                strokeDasharray={`${seg.dashLength} ${circumference}`}
                strokeDashoffset={seg.offset}
                onMouseEnter={() => setHoveredId(seg.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="cursor-pointer transition-all duration-150"
                style={{
                  filter: isHovered ? `drop-shadow(0 0 8px ${seg.color})` : undefined,
                }}
              />
            );
          })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
          <span className="text-[11px] font-medium text-slate-400">
            {activeSlice ? activeSlice.label : centerSubtitle}
          </span>
          <span className="text-sm font-bold font-mono tabular-nums text-white mt-0.5 truncate max-w-[100px]">
            {activeSlice ? formatCurrency(activeSlice.value) : centerTitle}
          </span>
          {activeSlice && total > 0 && (
            <span className={`text-[11px] font-mono tabular-nums ${activeSlice.textClass}`}>
              {((activeSlice.value / total) * 100).toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 w-full space-y-2.5">
        {slices.map((slice) => {
          const pct = total > 0 ? (slice.value / total) * 100 : 0;
          const isHovered = hoveredId === slice.id;
          return (
            <div
              key={slice.id}
              onMouseEnter={() => setHoveredId(slice.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border transition-colors cursor-default ${
                isHovered
                  ? 'bg-white/10 border-white/25'
                  : 'bg-white/[0.03] border-white/10'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${slice.dotClass}`} />
                <span className="text-xs font-medium text-slate-200 truncate">
                  {slice.label}
                </span>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold font-mono tabular-nums text-white">
                  {formatCurrency(slice.value)}
                </p>
                <p className={`text-[11px] font-mono tabular-nums ${slice.textClass}`}>
                  {pct.toFixed(1)}%
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminDashboard({
  profile,
  products,
  sales,
  repairs,
  warranties,
  todayReport,
  allowedTabs,
  onNavigate,
  onOpenScanner,
  onSeedCatalog,
  onSyncDailyReport,
  onReopenCashRegister,
  requireAdminToReopenCash = true,
  isDeveloper = false,
}: {
  profile: UserProfile | null;
  products: Product[];
  sales: Sale[];
  repairs: RepairTicket[];
  warranties: Warranty[];
  todayReport: DailyReport | undefined;
  allowedTabs?: NavTab[];
  onNavigate: (tab: NavTab) => void;
  onOpenScanner: () => void;
  onSeedCatalog: () => Promise<void>;
  onSyncDailyReport: (closeDay: boolean) => Promise<void>;
  onReopenCashRegister: (
    adminUsername: string,
    adminPassword: string,
    reason: string
  ) => Promise<void>;
  requireAdminToReopenCash?: boolean;
  isDeveloper?: boolean;
}) {
  const [seeding, setSeeding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [chartMode, setChartMode] = useState<'revenue_profit' | 'revenue' | 'tickets'>(
    'revenue_profit'
  );
  const [paymentScope, setPaymentScope] = useState<'today' | 'all'>('today');
  const [categoryMetric, setCategoryMetric] = useState<'units' | 'retail'>('units');
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);
  const isCashClosed = todayReport?.status === 'Cerrado';

  const canSee = (tab: NavTab) => !allowedTabs || allowedTabs.includes(tab);
  const todayKey = getTodayDateKey();
  const currencyOpt = getActiveAppCurrencyOption();

  const metrics = useMemo(() => {
    const completedSales = sales.filter((s) => s.status === 'Completada');
    const todaySales = completedSales.filter((s) => s.dateKey === todayKey);
    const todayRevenue = todaySales.reduce((acc, s) => acc + s.total, 0);
    const todayProfit = todaySales.reduce((acc, s) => acc + s.profit, 0);

    const inventoryCostValue = products.reduce(
      (acc, p) => acc + p.stock * p.costPrice,
      0
    );
    const inventoryRetailValue = products.reduce(
      (acc, p) => acc + p.stock * p.salePrice,
      0
    );
    const totalUnits = products.reduce((acc, p) => acc + p.stock, 0);
    const inStockCount = products.filter((p) => p.active && p.stock > 0).length;
    const inStockPct = products.length > 0 ? (inStockCount / products.length) * 100 : 0;
    const lowStock = products.filter((p) => p.active && p.stock <= p.minStock);

    const activeRepairs = repairs.filter(
      (r) => r.status !== 'Entregado' && r.status !== 'Cancelado'
    );
    const readyRepairsCount = activeRepairs.filter(
      (r) => r.status === 'Listo para Entrega'
    ).length;
    const activeWarranties = warranties.filter((w) => w.status === 'Vigente');

    const scopedSales = paymentScope === 'today' ? todaySales : completedSales;
    const cashScoped = scopedSales
      .filter((s) => s.paymentMethod === 'Efectivo')
      .reduce((a, s) => a + s.total, 0);
    const cardScoped = scopedSales
      .filter((s) => s.paymentMethod === 'Tarjeta')
      .reduce((a, s) => a + s.total, 0);
    const transferScoped = scopedSales
      .filter((s) => s.paymentMethod === 'Transferencia')
      .reduce((a, s) => a + s.total, 0);
    const mixedScoped = scopedSales
      .filter((s) => s.paymentMethod === 'Mixto')
      .reduce((a, s) => a + s.total, 0);

    // 7-day history with revenue, profit & ticket count
    const last7Days: {
      dateKey: string;
      label: string;
      shortDay: string;
      revenue: number;
      profit: number;
      count: number;
    }[] = [];

    for (let i = 6; i >= 0; i--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const dk = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
        dt.getDate()
      ).padStart(2, '0')}`;
      const daySales = completedSales.filter((s) => s.dateKey === dk);
      const rev = daySales.reduce((a, s) => a + s.total, 0);
      const prof = daySales.reduce((a, s) => a + s.profit, 0);
      last7Days.push({
        dateKey: dk,
        label: dt.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }),
        shortDay: dt.toLocaleDateString('es-MX', { weekday: 'short' }),
        revenue: rev,
        profit: prof,
        count: daySales.length,
      });
    }

    const maxDailyRevenue = Math.max(1, ...last7Days.map((d) => d.revenue));
    const maxDailyCount = Math.max(1, ...last7Days.map((d) => d.count));
    const weekRevenue = last7Days.reduce((acc, d) => acc + d.revenue, 0);
    const weekProfit = last7Days.reduce((acc, d) => acc + d.profit, 0);

    // Category distribution
    const allDashboardCategories: string[] = [...PRODUCT_CATEGORIES];
    const seenDashCats = new Set(allDashboardCategories.map((c) => c.toLowerCase()));
    for (const p of products) {
      if (p.category && !seenDashCats.has(p.category.toLowerCase())) {
        seenDashCats.add(p.category.toLowerCase());
        allDashboardCategories.push(p.category);
      }
    }
    const categoryStats = allDashboardCategories.map((category) => {
      const catProducts = products.filter((p) => p.category === category);
      const units = catProducts.reduce((acc, p) => acc + p.stock, 0);
      const retail = catProducts.reduce((acc, p) => acc + p.stock * p.salePrice, 0);
      return {
        category,
        skuCount: catProducts.length,
        units,
        retail,
      };
    });

    const maxCategoryUnits = Math.max(1, ...categoryStats.map((c) => c.units));
    const maxCategoryRetail = Math.max(1, ...categoryStats.map((c) => c.retail));

    // Repair stage breakdown
    const repairStages = REPAIR_STAGE_STYLES.map((st) => ({
      ...st,
      count: activeRepairs.filter((r) => r.status === st.status).length,
    }));

    return {
      todaySalesCount: todaySales.length,
      todayRevenue,
      todayProfit,
      marginPct: todayRevenue > 0 ? (todayProfit / todayRevenue) * 100 : 0,
      inventoryCostValue,
      inventoryRetailValue,
      totalUnits,
      inStockPct,
      lowStock,
      activeRepairs,
      readyRepairsCount,
      activeWarrantiesCount: activeWarranties.length,
      cashScoped,
      cardScoped,
      transferScoped,
      mixedScoped,
      last7Days,
      maxDailyRevenue,
      maxDailyCount,
      weekRevenue,
      weekProfit,
      categoryStats,
      maxCategoryUnits,
      maxCategoryRetail,
      repairStages,
    };
  }, [products, sales, repairs, warranties, todayKey, paymentScope]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await onSeedCatalog();
    } finally {
      setSeeding(false);
    }
  };

  const handleSync = async (closeDay: boolean) => {
    setSyncing(true);
    try {
      await onSyncDailyReport(closeDay);
    } finally {
      setSyncing(false);
    }
  };

  const activeDay =
    hoveredDayIdx !== null
      ? metrics.last7Days[hoveredDayIdx]
      : metrics.last7Days[metrics.last7Days.length - 1];

  const profitSparkline = buildSparklinePoints(
    metrics.last7Days.map((d) => d.revenue),
    120,
    38
  );

  const paymentSlices: DonutSlice[] = [
    {
      id: 'cash',
      label: 'Efectivo',
      value: metrics.cashScoped,
      color: '#10b981',
      dotClass: 'bg-emerald-400',
      textClass: 'text-emerald-300',
    },
    {
      id: 'card',
      label: 'Tarjeta',
      value: metrics.cardScoped,
      color: '#22d3ee',
      dotClass: 'bg-cyan-400',
      textClass: 'text-cyan-300',
    },
    {
      id: 'transfer',
      label: 'Transferencia',
      value: metrics.transferScoped,
      color: '#a78bfa',
      dotClass: 'bg-violet-400',
      textClass: 'text-violet-300',
    },
    {
      id: 'mixed',
      label: 'Mixto',
      value: metrics.mixedScoped,
      color: '#fbbf24',
      dotClass: 'bg-amber-400',
      textClass: 'text-amber-300',
    },
  ];

  const totalScopedPayments = paymentSlices.reduce((acc, s) => acc + s.value, 0);

  // Build SVG polyline for revenue spline inside 7-day chart
  const trendPolylinePoints = metrics.last7Days
    .map((day, idx) => {
      const x = ((idx + 0.5) / 7) * 700;
      const ratio =
        chartMode === 'tickets'
          ? day.count / metrics.maxDailyCount
          : day.revenue / metrics.maxDailyRevenue;
      const y = 178 - Math.max(0.03, ratio) * 146;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const trendAreaPoints = `50,184 ${trendPolylinePoints} 650,184`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      {/* FUTURISTIC COMMAND HERO */}
      <section className="relative overflow-hidden rounded-2xl bg-slate-950 text-white border border-cyan-500/30 p-6 lg:p-8 shadow-xl">
        {/* Top prismatic light bar */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400" />

        {/* Subtle geometric matrix grid backdrop */}
        <svg
          aria-hidden="true"
          className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
        >
          <defs>
            <pattern id="futuristicGridAdmin" width="36" height="36" patternUnits="userSpaceOnUse">
              <path
                d="M 36 0 L 0 0 0 36"
                fill="none"
                stroke="rgba(56, 189, 248, 0.28)"
                strokeWidth="0.75"
              />
            </pattern>
            <radialGradient id="heroGlowAdmin" cx="78%" cy="35%" r="58%">
              <stop offset="0%" stopColor="rgba(217, 70, 239, 0.35)" />
              <stop offset="48%" stopColor="rgba(6, 182, 212, 0.18)" />
              <stop offset="100%" stopColor="rgba(2, 6, 23, 0)" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#futuristicGridAdmin)" />
          <rect width="100%" height="100%" fill="url(#heroGlowAdmin)" />
        </svg>

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-cyan-300">
              <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Centro de Comando Ejecutivo</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="font-mono tabular-nums text-fuchsia-300">{todayKey}</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="text-emerald-300">
                {todayReport?.status === 'Cerrado' ? 'Caja cerrada' : 'Turno operativo activo'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-fuchsia-300 bg-clip-text text-transparent text-balance">
              Supervisión Futurista de Tienda Móvil
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed">
              Bienvenido, <span className="font-semibold text-white">{profile?.displayName || 'Administrador'}</span>. Visualización en tiempo real de ingresos, utilidades, flujo de cobros y disponibilidad por categoría.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              {products.length === 0 && (
                <button
                  type="button"
                  disabled={seeding}
                  onClick={handleSeed}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 to-sky-400 hover:from-cyan-200 hover:to-sky-300 rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <PackagePlus className="w-4 h-4" />
                  {seeding ? 'Cargando catálogo...' : 'Cargar Catálogo Inicial'}
                </button>
              )}

              {canSee('pos') && (
                <button
                  type="button"
                  onClick={() => onNavigate('pos')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 rounded-lg shadow-lg shadow-fuchsia-950/50 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Abrir Punto de Venta
                </button>
              )}

              <button
                type="button"
                onClick={onOpenScanner}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-cyan-200 bg-white/10 hover:bg-white/15 border border-cyan-400/30 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                Escanear Barra / QR
              </button>

              <button
                type="button"
                disabled={syncing}
                onClick={() => handleSync(false)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-200 bg-white/5 hover:bg-white/10 border border-white/15 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                {syncing ? 'Sincronizando...' : 'Actualizar Reporte Hoy'}
              </button>
            </div>
          </div>

          {/* Right Orbital HUD Visualizer */}
          <div className="flex flex-col sm:flex-row items-center gap-5 bg-white/[0.04] border border-white/10 rounded-2xl p-4 backdrop-blur-sm shrink-0">
            <OrbitalPulseGauge
              primaryPct={metrics.marginPct || 18}
              secondaryPct={metrics.inStockPct}
              tertiaryPct={
                metrics.activeRepairs.length > 0
                  ? (metrics.readyRepairsCount / metrics.activeRepairs.length) * 100
                  : 100
              }
              centerLabel="Ingresos 7d"
              centerValue={compactCurrency(metrics.weekRevenue, currencyOpt.symbol)}
            />

            <div className="space-y-2.5 min-w-[175px]">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-2 text-slate-300">
                  <span className="w-2 h-2 rounded-sm bg-cyan-400" />
                  Margen hoy
                </span>
                <span className="font-mono font-bold tabular-nums text-cyan-300">
                  {metrics.marginPct.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-2 text-slate-300">
                  <span className="w-2 h-2 rounded-sm bg-fuchsia-400" />
                  Stock activo
                </span>
                <span className="font-mono font-bold tabular-nums text-fuchsia-300">
                  {metrics.inStockPct.toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-2 text-slate-300">
                  <span className="w-2 h-2 rounded-sm bg-emerald-400" />
                  Utilidad 7d
                </span>
                <span className="font-mono font-bold tabular-nums text-emerald-300">
                  {compactCurrency(metrics.weekProfit, currencyOpt.symbol)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* EXTRAVAGANT CHROMATIC KPI TELEMETRY DECK */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Ventas de Hoy */}
        <div className="relative overflow-hidden rounded-2xl bg-slate-950 text-white border border-cyan-500/30 p-5">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 to-blue-500" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-cyan-300">Ventas de Hoy</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-white mt-2">
                {formatCurrency(metrics.todayRevenue)}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shrink-0">
              <Zap className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="text-xs text-slate-400 font-mono tabular-nums">
              {metrics.todaySalesCount} tickets hoy
            </p>
            <svg viewBox="0 0 120 38" className="w-24 h-8 overflow-visible shrink-0">
              <polyline
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={profitSparkline}
              />
            </svg>
          </div>
        </div>

        {/* KPI 2: Ganancia Bruta Hoy */}
        <div className="relative overflow-hidden rounded-2xl bg-slate-950 text-white border border-emerald-500/30 p-5">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-emerald-300">Ganancia Bruta Hoy</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-emerald-300 mt-2">
                {formatCurrency(metrics.todayProfit)}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono tabular-nums">
              <span className="text-slate-400">Margen neto</span>
              <span className="text-emerald-300 font-semibold">{metrics.marginPct.toFixed(1)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                style={{ width: `${Math.min(100, Math.max(4, metrics.marginPct))}%` }}
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 transition-all duration-300"
              />
            </div>
          </div>
        </div>

        {/* KPI 3: Valor Inventario */}
        <div className="relative overflow-hidden rounded-2xl bg-slate-950 text-white border border-fuchsia-500/30 p-5">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fuchsia-400 via-violet-500 to-indigo-500" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-fuchsia-300">Valor Inventario (Costo)</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-white mt-2">
                {formatCurrency(metrics.inventoryCostValue)}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-fuchsia-500/15 border border-fuchsia-400/30 flex items-center justify-center text-fuchsia-300 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono tabular-nums">
              <span className="text-slate-400">{metrics.totalUnits} uds</span>
              <span className="text-fuchsia-300 truncate max-w-[140px]">
                Venta {compactCurrency(metrics.inventoryRetailValue, currencyOpt.symbol)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden flex">
              <div
                style={{
                  width: `${
                    metrics.inventoryRetailValue > 0
                      ? Math.min(
                          95,
                          Math.max(
                            15,
                            (metrics.inventoryCostValue / metrics.inventoryRetailValue) * 100
                          )
                        )
                      : 50
                  }%`,
                }}
                className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-400"
              />
            </div>
          </div>
        </div>

        {/* KPI 4: Taller y Garantías */}
        <div className="relative overflow-hidden rounded-2xl bg-slate-950 text-white border border-amber-500/30 p-5">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-amber-300">Taller y Garantías</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-white mt-2">
                {metrics.activeRepairs.length}{' '}
                <span className="text-xs font-sans font-normal text-slate-400">órdenes</span>
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
              <Wrench className="w-4 h-4" />
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <p className="text-xs text-slate-300 font-mono tabular-nums">
              {metrics.activeWarrantiesCount} garantías · {metrics.lowStock.length} stock bajo
            </p>
            <div className="grid grid-cols-5 gap-1 h-2">
              {metrics.repairStages.map((st) => (
                <div
                  key={st.status}
                  title={`${st.label}: ${st.count}`}
                  className={`rounded-sm ${st.count > 0 ? st.barClass : 'bg-white/10'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: COLORFUL INTERACTIVE CHARTS (7-DAY DUAL CHART + PAYMENT DONUT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Chart 1: 7-Day Colorful Gradient Bars + Glowing Spline Area */}
        <div className="lg:col-span-7 rounded-2xl bg-slate-950 text-white border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  Pulso Cromático de Ingresos y Utilidad (7 Días)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pase el cursor sobre cualquier día para inspeccionar ingresos, ganancia y tickets
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setChartMode('revenue_profit')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    chartMode === 'revenue_profit'
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Ingreso + Ganancia
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('revenue')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    chartMode === 'revenue'
                      ? 'bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Solo Ingresos
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('tickets')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    chartMode === 'tickets'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Tickets
                </button>
              </div>
            </div>

            {/* Active Day Inspection Bar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10">
              <div className="flex items-center gap-2 text-xs">
                <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
                <span className="font-medium text-slate-300 capitalize">{activeDay.label}</span>
                <span className="font-mono text-slate-500">({activeDay.dateKey})</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
                <span className="text-cyan-300">
                  Venta: <strong className="text-white">{formatCurrency(activeDay.revenue)}</strong>
                </span>
                <span className="text-emerald-300">
                  Utilidad: <strong className="text-emerald-300">{formatCurrency(activeDay.profit)}</strong>
                </span>
                <span className="text-amber-300">{activeDay.count} tickets</span>
              </div>
            </div>

            {/* SVG + Bar Chart Canvas */}
            <div className="mt-5 relative">
              <svg
                viewBox="0 0 700 210"
                className="w-full h-52 overflow-visible"
                role="img"
                aria-label="Gráfico colorido de ingresos y ganancias de los últimos 7 días"
              >
                <defs>
                  <linearGradient id="adminBarCyan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0.85" />
                  </linearGradient>
                  <linearGradient id="adminBarToday" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f0abfc" />
                    <stop offset="50%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                  <linearGradient id="adminBarProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity="0.85" />
                  </linearGradient>
                  <linearGradient id="adminBarTickets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#ea580c" stopOpacity="0.9" />
                  </linearGradient>
                  <linearGradient id="adminAreaGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e879f9" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid Lines */}
                {[38, 86, 134, 184].map((y) => (
                  <line
                    key={y}
                    x1="12"
                    y1={y}
                    x2="688"
                    y2={y}
                    stroke="rgba(148,163,184,0.14)"
                    strokeDasharray="4 4"
                  />
                ))}

                {/* Glowing Area Under Curve */}
                <polygon points={trendAreaPoints} fill="url(#adminAreaGlow)" />

                {/* Bars per day */}
                {metrics.last7Days.map((day, idx) => {
                  const colCenter = ((idx + 0.5) / 7) * 700;
                  const isToday = day.dateKey === todayKey;
                  const isHovered = hoveredDayIdx === idx;
                  const primaryRatio =
                    chartMode === 'tickets'
                      ? day.count / metrics.maxDailyCount
                      : day.revenue / metrics.maxDailyRevenue;
                  const primaryHeight = Math.max(8, primaryRatio * 146);
                  const profitRatio = Math.max(0, day.profit) / metrics.maxDailyRevenue;
                  const profitHeight = Math.max(6, profitRatio * 146);

                  return (
                    <g
                      key={day.dateKey}
                      onMouseEnter={() => setHoveredDayIdx(idx)}
                      onMouseLeave={() => setHoveredDayIdx(null)}
                      className="cursor-pointer"
                    >
                      {/* Invisible full-column hover target */}
                      <rect
                        x={colCenter - 44}
                        y={16}
                        width={88}
                        height={190}
                        rx={10}
                        fill={isHovered ? 'rgba(255,255,255,0.05)' : 'transparent'}
                      />

                      {chartMode === 'revenue_profit' ? (
                        <>
                          <rect
                            x={colCenter - 20}
                            y={184 - primaryHeight}
                            width={18}
                            height={primaryHeight}
                            rx={5}
                            fill={isToday ? 'url(#adminBarToday)' : 'url(#adminBarCyan)'}
                          />
                          <rect
                            x={colCenter + 2}
                            y={184 - profitHeight}
                            width={18}
                            height={profitHeight}
                            rx={5}
                            fill="url(#adminBarProfit)"
                          />
                        </>
                      ) : (
                        <rect
                          x={colCenter - 16}
                          y={184 - primaryHeight}
                          width={32}
                          height={primaryHeight}
                          rx={6}
                          fill={
                            chartMode === 'tickets'
                              ? 'url(#adminBarTickets)'
                              : isToday
                                ? 'url(#adminBarToday)'
                                : 'url(#adminBarCyan)'
                          }
                        />
                      )}

                      <text
                        x={colCenter}
                        y={24}
                        textAnchor="middle"
                        fill={isToday || isHovered ? '#f0abfc' : '#94a3b8'}
                        fontSize="11"
                        fontFamily="var(--font-mono)"
                      >
                        {chartMode === 'tickets'
                          ? `${day.count}`
                          : compactCurrency(day.revenue, currencyOpt.symbol)}
                      </text>

                      <text
                        x={colCenter}
                        y={202}
                        textAnchor="middle"
                        fill={isToday ? '#22d3ee' : '#cbd5e1'}
                        fontSize="11"
                        fontWeight={isToday ? '700' : '500'}
                      >
                        {day.shortDay}
                      </text>
                    </g>
                  );
                })}

                {/* Glowing Trend Polyline */}
                <polyline
                  fill="none"
                  stroke="#f0abfc"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={trendPolylinePoints}
                />

                {/* Glowing Nodes */}
                {metrics.last7Days.map((day, idx) => {
                  const x = ((idx + 0.5) / 7) * 700;
                  const ratio =
                    chartMode === 'tickets'
                      ? day.count / metrics.maxDailyCount
                      : day.revenue / metrics.maxDailyRevenue;
                  const y = 178 - Math.max(0.03, ratio) * 146;
                  return (
                    <circle
                      key={`node-${day.dateKey}`}
                      cx={x}
                      cy={y}
                      r={hoveredDayIdx === idx ? 5.5 : 3.8}
                      fill="#020617"
                      stroke="#22d3ee"
                      strokeWidth="2.2"
                      className="pointer-events-none"
                    />
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="w-3 h-3 rounded-sm bg-gradient-to-b from-cyan-400 to-blue-600" />
                Ingresos
              </span>
              {chartMode === 'revenue_profit' && (
                <span className="flex items-center gap-2 text-slate-300">
                  <span className="w-3 h-3 rounded-sm bg-gradient-to-b from-emerald-400 to-teal-600" />
                  Ganancia bruta
                </span>
              )}
              <span className="flex items-center gap-2 text-slate-300">
                <span className="w-3 h-1 rounded-sm bg-fuchsia-400" />
                Curva de tendencia
              </span>
            </div>

            {canSee('reports') && (
              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-300 hover:text-cyan-200 whitespace-nowrap cursor-pointer"
              >
                Abrir reportes detallados
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Chart 2: Neon Payment Donut Chart */}
        <div className="lg:col-span-5 rounded-2xl bg-slate-950 text-white border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-fuchsia-400" />
                  Distribución de Cobros
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mezcla de métodos de pago registrados
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setPaymentScope('today')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                    paymentScope === 'today'
                      ? 'bg-fuchsia-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentScope('all')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                    paymentScope === 'all'
                      ? 'bg-fuchsia-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Histórico
                </button>
              </div>
            </div>

            <div className="mt-6">
              {totalScopedPayments === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <p className="text-sm text-slate-300">
                    Aún no hay cobros completados {paymentScope === 'today' ? 'en la jornada de hoy' : 'registrados'}.
                  </p>
                  {paymentScope === 'today' && sales.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaymentScope('all')}
                      className="px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 rounded-lg transition-colors cursor-pointer"
                    >
                      Ver gráfico histórico total
                    </button>
                  )}
                </div>
              ) : (
                <NeonDonutChart
                  slices={paymentSlices}
                  centerTitle={formatCurrency(totalScopedPayments)}
                  centerSubtitle={paymentScope === 'today' ? 'Total Hoy' : 'Total Histórico'}
                />
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              Estado de caja:{' '}
              <strong className={isCashClosed ? 'text-amber-300' : 'text-emerald-300'}>
                {todayReport?.status || 'Abierto'}
              </strong>
            </span>
            <button
              type="button"
              disabled={syncing}
              onClick={() => {
                if (isCashClosed) {
                  if (requireAdminToReopenCash && !isDeveloper) {
                    setReopenModalOpen(true);
                  } else {
                    void handleSync(false);
                  }
                } else {
                  void handleSync(true);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                isCashClosed
                  ? 'text-slate-950 bg-gradient-to-r from-amber-300 via-cyan-300 to-emerald-300 hover:from-amber-200 hover:to-emerald-200'
                  : 'text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300'
              }`}
            >
              {isCashClosed ? (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  {isDeveloper ? 'Abrir Caja (Desarrollador)' : 'Abrir Caja (Admin)'}
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  Cerrar Caja del Día
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ROW 3: CATEGORY SPECTRUM BARS + REPAIR PIPELINE & LOW STOCK RADAR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Chart 3: Colorful Category Inventory Map */}
        <div className="lg:col-span-6 rounded-2xl bg-slate-950 text-white border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Mapa Cromático por Categoría
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Concentración de stock y valor de venta en catálogo
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setCategoryMetric('units')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                    categoryMetric === 'units'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Unidades
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryMetric('retail')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                    categoryMetric === 'retail'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Valor Venta
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {metrics.categoryStats.map((cat) => {
                const style = CATEGORY_GRADIENTS[cat.category] || CATEGORY_GRADIENTS.Smartphones;
                const pct =
                  categoryMetric === 'units'
                    ? (cat.units / metrics.maxCategoryUnits) * 100
                    : (cat.retail / metrics.maxCategoryRetail) * 100;

                return (
                  <div key={cat.category} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex items-center gap-2 font-medium text-slate-200 truncate">
                        <span className={`w-2 h-2 rounded-sm shrink-0 ${style.dot}`} />
                        {cat.category}
                        <span className="text-slate-500 font-mono tabular-nums">
                          ({cat.skuCount} SKU)
                        </span>
                      </span>
                      <span className={`font-mono font-semibold tabular-nums shrink-0 ${style.text}`}>
                        {categoryMetric === 'units'
                          ? `${cat.units} uds`
                          : formatCurrency(cat.retail)}
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-white/[0.07] overflow-hidden">
                      <div
                        style={{ width: `${Math.max(cat.units > 0 ? 6 : 0, Math.round(pct))}%` }}
                        className={`h-full rounded-full bg-gradient-to-r ${style.bar} transition-all duration-300`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {canSee('inventory') && (
            <div className="mt-5 pt-4 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => onNavigate('inventory')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300 hover:text-emerald-200 cursor-pointer"
              >
                Explorar inventario completo
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right: Technical Pipeline Spectrum & Critical Stock Radar */}
        <div className="lg:col-span-6 rounded-2xl bg-slate-950 text-white border border-slate-800 p-6 flex flex-col justify-between space-y-6">
          {/* Repair Pipeline Visual */}
          <div>
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-400" />
                  Flujo del Banco Técnico ({metrics.activeRepairs.length})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Distribución por etapa y equipos con reposición urgente
                </p>
              </div>
              {canSee('repairs') && (
                <button
                  type="button"
                  onClick={() => onNavigate('repairs')}
                  className="text-xs font-medium text-amber-300 hover:text-amber-200 whitespace-nowrap cursor-pointer"
                >
                  Gestionar taller
                </button>
              )}
            </div>

            {/* Segmented Stage Bar */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
              {metrics.repairStages.map((st) => (
                <div
                  key={st.status}
                  className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`w-2 h-2 rounded-sm ${st.barClass}`} />
                    <span className={`text-base font-bold font-mono tabular-nums ${st.textClass}`}>
                      {st.count}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1 truncate">{st.label}</p>
                </div>
              ))}
            </div>

            {metrics.activeRepairs.length > 0 && (
              <div className="mt-4 divide-y divide-white/10">
                {metrics.activeRepairs.slice(0, 3).map((r) => (
                  <div key={r.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
                        {r.deviceBrand} {r.deviceModel} · {r.customerName}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400">{r.ticketCode}</p>
                    </div>
                    <span className="text-xs font-medium text-cyan-300 shrink-0">
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Low Stock Radar */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                Radar de Stock Crítico ({metrics.lowStock.length})
              </h3>
              {canSee('inventory') && (
                <button
                  type="button"
                  onClick={() => onNavigate('inventory')}
                  className="text-xs font-medium text-cyan-300 hover:text-cyan-200 cursor-pointer"
                >
                  Reponer stock
                </button>
              )}
            </div>

            {metrics.lowStock.length === 0 ? (
              <div className="py-3 flex items-center gap-3 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Todos los artículos superan el nivel mínimo configurado.</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {metrics.lowStock.slice(0, 3).map((p) => {
                  const ratio = p.minStock > 0 ? Math.min(100, (p.stock / p.minStock) * 100) : 0;
                  return (
                    <div key={p.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium text-slate-200 truncate">
                          {p.name}{' '}
                          <span className="font-mono text-slate-500">· {p.sku}</span>
                        </span>
                        <span className="font-mono font-bold tabular-nums text-amber-300 shrink-0">
                          {p.stock} / {p.minStock} uds
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          style={{ width: `${Math.max(8, ratio)}%` }}
                          className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <AdminCashAuthModal
        isOpen={reopenModalOpen}
        dateKey={todayKey}
        defaultAdminUsername={
          profile?.role === 'admin' || profile?.role === 'developer'
            ? profile.username
            : ''
        }
        onClose={() => setReopenModalOpen(false)}
        onAuthorize={onReopenCashRegister}
      />
    </motion.div>
  );
}

export function StaffDashboard({
  profile,
  products,
  sales,
  repairs,
  warranties,
  allowedTabs,
  onNavigate,
  onOpenScanner,
}: {
  profile: UserProfile | null;
  products: Product[];
  sales: Sale[];
  repairs: RepairTicket[];
  warranties: Warranty[];
  allowedTabs?: NavTab[];
  onNavigate: (tab: NavTab) => void;
  onOpenScanner: () => void;
}) {
  const canSee = (tab: NavTab) => !allowedTabs || allowedTabs.includes(tab);
  const todayKey = getTodayDateKey();
  const currencyOpt = getActiveAppCurrencyOption();

  const metrics = useMemo(() => {
    const completedSales = sales.filter((s) => s.status === 'Completada');
    const myTodaySales = completedSales.filter(
      (s) => s.dateKey === todayKey && s.sellerUid === profile?.uid
    );
    const myTodayRevenue = myTodaySales.reduce((acc, s) => acc + s.total, 0);

    const activeRepairs = repairs.filter(
      (r) => r.status !== 'Entregado' && r.status !== 'Cancelado'
    );
    const readyRepairs = activeRepairs.filter((r) => r.status === 'Listo para Entrega');
    const availableProducts = products.filter((p) => p.stock > 0);
    const lowStockCount = products.filter((p) => p.active && p.stock <= p.minStock).length;
    const activeWarrantiesCount = warranties.filter((w) => w.status === 'Vigente').length;

    const last7Days: {
      dateKey: string;
      shortDay: string;
      storeTotal: number;
      myTotal: number;
    }[] = [];

    for (let i = 6; i >= 0; i--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const dk = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
        dt.getDate()
      ).padStart(2, '0')}`;
      const daySales = completedSales.filter((s) => s.dateKey === dk);
      const storeTotal = daySales.reduce((a, s) => a + s.total, 0);
      const myTotal = daySales
        .filter((s) => s.sellerUid === profile?.uid)
        .reduce((a, s) => a + s.total, 0);
      last7Days.push({
        dateKey: dk,
        shortDay: dt.toLocaleDateString('es-MX', { weekday: 'short' }),
        storeTotal,
        myTotal,
      });
    }

    const maxChartValue = Math.max(
      1,
      ...last7Days.map((d) => Math.max(d.storeTotal, d.myTotal))
    );

    const repairSlices: DonutSlice[] = REPAIR_STAGE_STYLES.map((st) => ({
      id: st.status,
      label: st.label,
      value: activeRepairs.filter((r) => r.status === st.status).length,
      color: st.hex,
      dotClass: st.barClass,
      textClass: st.textClass,
    }));

    return {
      myTodaySales,
      myTodayRevenue,
      activeRepairs,
      readyRepairs,
      availableProducts,
      lowStockCount,
      activeWarrantiesCount,
      last7Days,
      maxChartValue,
      repairSlices,
    };
  }, [products, sales, repairs, warranties, todayKey, profile?.uid]);

  const sparkPoints = buildSparklinePoints(
    metrics.last7Days.map((d) => d.myTotal),
    120,
    38
  );

  const catalogReadyPct =
    products.length > 0 ? (metrics.availableProducts.length / products.length) * 100 : 0;
  const repairReadyPct =
    metrics.activeRepairs.length > 0
      ? (metrics.readyRepairs.length / metrics.activeRepairs.length) * 100
      : 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      {/* FUTURISTIC STAFF COMMAND HERO */}
      <section className="relative overflow-hidden rounded-2xl bg-slate-950 text-white border border-cyan-500/30 p-6 lg:p-8 shadow-xl">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-emerald-400 via-cyan-400 to-fuchsia-500" />
        <svg
          aria-hidden="true"
          className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
        >
          <defs>
            <pattern id="futuristicGridStaff" width="36" height="36" patternUnits="userSpaceOnUse">
              <path
                d="M 36 0 L 0 0 0 36"
                fill="none"
                stroke="rgba(34, 211, 238, 0.28)"
                strokeWidth="0.75"
              />
            </pattern>
            <radialGradient id="heroGlowStaff" cx="80%" cy="35%" r="55%">
              <stop offset="0%" stopColor="rgba(16, 185, 129, 0.3)" />
              <stop offset="50%" stopColor="rgba(56, 189, 248, 0.16)" />
              <stop offset="100%" stopColor="rgba(2, 6, 23, 0)" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#futuristicGridStaff)" />
          <rect width="100%" height="100%" fill="url(#heroGlowStaff)" />
        </svg>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-cyan-300">
              <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Estación de Mostrador y Servicio Técnico</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="font-mono tabular-nums text-emerald-300">{todayKey}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-emerald-300 bg-clip-text text-transparent">
              Hola, {profile?.displayName || 'Especialista'}
            </h1>

            <p className="text-sm text-slate-300">
              Control rápido de ventas en mostrador, escaneo de códigos QR/barras, garantías IMEI y seguimiento de reparaciones.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              {canSee('pos') && (
                <button
                  type="button"
                  onClick={() => onNavigate('pos')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300 hover:from-cyan-200 hover:to-emerald-200 rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Nueva Venta
                </button>
              )}
              <button
                type="button"
                onClick={onOpenScanner}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-cyan-200 bg-white/10 hover:bg-white/15 border border-cyan-400/30 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                Escanear Código
              </button>
            </div>
          </div>

          <div className="flex items-center gap-5 bg-white/[0.04] border border-white/10 rounded-2xl p-4 shrink-0">
            <OrbitalPulseGauge
              primaryPct={catalogReadyPct}
              secondaryPct={repairReadyPct}
              tertiaryPct={metrics.myTodaySales.length > 0 ? 85 : 25}
              centerLabel="Mis Ventas"
              centerValue={compactCurrency(metrics.myTodayRevenue, currencyOpt.symbol)}
            />
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-300">Catálogo con stock</span>
                <span className="font-mono font-bold tabular-nums text-cyan-300">
                  {catalogReadyPct.toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-300">Equipos listos</span>
                <span className="font-mono font-bold tabular-nums text-fuchsia-300">
                  {metrics.readyRepairs.length}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-300">Garantías activas</span>
                <span className="font-mono font-bold tabular-nums text-emerald-300">
                  {metrics.activeWarrantiesCount}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4-CARD CHROMATIC KPI SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="relative overflow-hidden rounded-2xl bg-slate-950 text-white border border-cyan-500/30 p-5">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 to-blue-500" />
          <p className="text-xs font-medium text-cyan-300">Mis Ventas de Hoy</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-white mt-2">
            {formatCurrency(metrics.myTodayRevenue)}
          </p>
          <div className="mt-3 flex items-end justify-between gap-2">
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {metrics.myTodaySales.length} tickets emitidos
            </span>
            <svg viewBox="0 0 120 38" className="w-20 h-7 overflow-visible shrink-0">
              <polyline
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2.2"
                strokeLinecap="round"
                points={sparkPoints}
              />
            </svg>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-slate-950 text-white border border-emerald-500/30 p-5">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
          <p className="text-xs font-medium text-emerald-300">Catálogo Disponible</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-white mt-2">
            {metrics.availableProducts.length}
          </p>
          <p className="text-xs text-slate-400 mt-3 font-mono tabular-nums">
            {metrics.lowStockCount} productos con stock bajo
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-slate-950 text-white border border-fuchsia-500/30 p-5">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fuchsia-400 to-violet-500" />
          <p className="text-xs font-medium text-fuchsia-300">Órdenes en Taller</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-white mt-2">
            {metrics.activeRepairs.length}
          </p>
          <p className="text-xs text-slate-400 mt-3 font-mono tabular-nums">
            {metrics.readyRepairs.length} listos para entrega
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-slate-950 text-white border border-amber-500/30 p-5">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 to-rose-500" />
          <p className="text-xs font-medium text-amber-300">Garantías Activas</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-white mt-2">
            {metrics.activeWarrantiesCount}
          </p>
          <p className="text-xs text-slate-400 mt-3">
            Verificación rápida por IMEI o QR
          </p>
        </div>
      </div>

      {/* COLORFUL CHARTS FOR STAFF */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 rounded-2xl bg-slate-950 text-white border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/10">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  Actividad Comercial (7 Días)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Comparativo entre mis ventas y el total de la tienda
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-300 shrink-0">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400" />
                  Tienda
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-fuchsia-400" />
                  Mis ventas
                </span>
              </div>
            </div>

            <div className="mt-5">
              <svg viewBox="0 0 700 190" className="w-full h-48 overflow-visible">
                <defs>
                  <linearGradient id="staffStoreBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0.8" />
                  </linearGradient>
                  <linearGradient id="staffMyBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f0abfc" />
                    <stop offset="100%" stopColor="#9333ea" stopOpacity="0.85" />
                  </linearGradient>
                </defs>
                {[34, 80, 126, 166].map((y) => (
                  <line
                    key={y}
                    x1="12"
                    y1={y}
                    x2="688"
                    y2={y}
                    stroke="rgba(148,163,184,0.14)"
                    strokeDasharray="4 4"
                  />
                ))}
                {metrics.last7Days.map((day, idx) => {
                  const cx = ((idx + 0.5) / 7) * 700;
                  const storeH = Math.max(8, (day.storeTotal / metrics.maxChartValue) * 134);
                  const myH = Math.max(6, (day.myTotal / metrics.maxChartValue) * 134);
                  return (
                    <g key={day.dateKey}>
                      <rect
                        x={cx - 19}
                        y={166 - storeH}
                        width={17}
                        height={storeH}
                        rx={5}
                        fill="url(#staffStoreBar)"
                      />
                      <rect
                        x={cx + 2}
                        y={166 - myH}
                        width={17}
                        height={myH}
                        rx={5}
                        fill="url(#staffMyBar)"
                      />
                      <text
                        x={cx}
                        y={184}
                        textAnchor="middle"
                        fill={day.dateKey === todayKey ? '#22d3ee' : '#cbd5e1'}
                        fontSize="11"
                      >
                        {day.shortDay}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl bg-slate-950 text-white border border-slate-800 p-6">
          <div className="pb-4 border-b border-white/10">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Wrench className="w-4 h-4 text-fuchsia-400" />
              Etapas del Taller Técnico
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Distribución actual de equipos recibidos
            </p>
          </div>

          <div className="mt-5 space-y-3">
            {REPAIR_STAGE_STYLES.map((st) => {
              const count = metrics.activeRepairs.filter((r) => r.status === st.status).length;
              const pct =
                metrics.activeRepairs.length > 0
                  ? (count / metrics.activeRepairs.length) * 100
                  : 0;
              return (
                <div key={st.status} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-200 font-medium">{st.status}</span>
                    <span className={`font-mono font-bold tabular-nums ${st.textClass}`}>
                      {count} equipos
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      style={{ width: `${Math.max(count > 0 ? 8 : 0, Math.round(pct))}%` }}
                      className={`h-full rounded-full ${st.barClass}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2-COLUMN OPERATIONAL WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-2xl bg-slate-950 text-white border border-slate-800 p-6 space-y-4">
          <h2 className="text-base font-semibold text-white">
            Accesos Operativos Directos
          </h2>
          <div className="divide-y divide-white/10">
            <button
              type="button"
              onClick={onOpenScanner}
              className="w-full py-3.5 flex items-center justify-between text-left hover:bg-white/5 px-2 -mx-2 rounded-lg transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <QrCode className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white">
                    Escáner Barra / QR en Tiempo Real
                  </p>
                  <p className="text-xs text-slate-400">
                    Sumar stock o subir producto nuevo al escanear
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>

            {canSee('repairs') && (
              <button
                type="button"
                onClick={() => onNavigate('repairs')}
                className="w-full py-3.5 flex items-center justify-between text-left hover:bg-white/5 px-2 -mx-2 rounded-lg transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Wrench className="w-4 h-4 text-fuchsia-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-white">
                      Recepción y Diagnóstico Técnico
                    </p>
                    <p className="text-xs text-slate-400">
                      Actualizar fallas, refacciones y estado de reparación
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            )}

            {canSee('warranties') && (
              <button
                type="button"
                onClick={() => onNavigate('warranties')}
                className="w-full py-3.5 flex items-center justify-between text-left hover:bg-white/5 px-2 -mx-2 rounded-lg transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-white">
                      Validar Garantía de Cliente
                    </p>
                    <p className="text-xs text-slate-400">
                      Búsqueda por IMEI, teléfono o código GAR
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 rounded-2xl bg-slate-950 text-white border border-slate-800 p-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <h2 className="text-base font-semibold text-white">
                Cola de Servicio Técnico
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Equipos actualmente en diagnóstico o reparación
              </p>
            </div>
            {canSee('repairs') && (
              <button
                type="button"
                onClick={() => onNavigate('repairs')}
                className="text-xs font-medium text-cyan-300 hover:text-cyan-200 whitespace-nowrap cursor-pointer"
              >
                Ver todas
              </button>
            )}
          </div>

          {metrics.activeRepairs.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-slate-300">No hay equipos pendientes en taller.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/10 mt-2">
              {metrics.activeRepairs.slice(0, 5).map((r) => (
                <div key={r.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {r.deviceBrand} {r.deviceModel} · {r.customerName}
                    </p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      <span className="font-mono">{r.ticketCode}</span> · {r.issueDescription}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-medium text-cyan-300">{r.status}</span>
                    <p className="text-[11px] font-mono tabular-nums text-slate-400 mt-0.5">
                      Est. {formatCurrency(r.estimatedCost)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
