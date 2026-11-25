import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Ban,
  Camera,
  CheckCircle2,
  Coins,
  Minus,
  Package,
  Percent,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Search,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  APP_CURRENCY_OPTIONS,
  DEFAULT_DEVELOPER_SYSTEM_SETTINGS,
  DEFAULT_POS_SETTINGS,
  DEFAULT_WARRANTY_SHEET_SETTINGS,
  formatCurrency,
  getCurrencyOption,
  PAYMENT_METHODS,
  PRODUCT_CATEGORIES,
  type AppCurrencyCode,
  type DeveloperSystemSettings,
  type PaymentMethod,
  type PosImageFit,
  type PosSettings,
  type Product,
  type ReceiptSettings,
  type RepairTicket,
  type Sale,
  type UserRole,
  type Warranty,
  type WarrantySheetSettings,
} from '../types/store';
import { processPosSale } from '../lib/storeOperations';
import { subscribeCustomProductCategories } from '../lib/localDb';
import { extractCodeToken, QrCodeImg } from './BarcodeQrToolkit';
import { CancelSaleModal, CancelSalePanel } from './CancelSaleSection';
import { ReceiptPreviewModal } from './ReceiptPreviewModal';
import { WarrantySheetModal } from './WarrantySheetModal';

export interface PosCartItem {
  product: Product;
  quantity: number;
  imei: string;
}

function PosProductImage({
  src,
  alt,
  compact = false,
  fitMode = 'cover',
}: {
  src?: string;
  alt: string;
  compact?: boolean;
  fitMode?: PosImageFit;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 ${
          compact ? 'rounded-lg border border-slate-200' : ''
        }`}
      >
        <Smartphone className={compact ? 'w-4 h-4' : 'w-6 h-6'} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`w-full h-full bg-slate-100 ${
        fitMode === 'contain' ? 'object-contain p-1' : 'object-cover'
      } ${compact ? 'rounded-lg border border-slate-200' : ''}`}
    />
  );
}

function playPosBeep(kind: 'add' | 'sale') {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = kind === 'sale' ? 880 : 660;
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + (kind === 'sale' ? 0.16 : 0.08)
    );
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (kind === 'sale' ? 0.17 : 0.09));
  } catch {
    // Ignore audio context errors
  }
}

export function PosSalesView({
  products,
  sales,
  repairs,
  warranties = [],
  uid,
  sellerName,
  viewRole,
  isDeveloper = false,
  currentUsername = '',
  receiptSettings,
  currencyCode,
  onChangeCurrency,
  onOpenScanner,
  onOpenReceiptSettings,
  queuedProduct,
  onConsumeQueuedProduct,
  developerSettings = DEFAULT_DEVELOPER_SYSTEM_SETTINGS,
  posSettings = DEFAULT_POS_SETTINGS,
  warrantySheetSettings = DEFAULT_WARRANTY_SHEET_SETTINGS,
}: {
  products: Product[];
  sales: Sale[];
  repairs: RepairTicket[];
  warranties?: Warranty[];
  uid: string;
  sellerName: string;
  viewRole: UserRole;
  isDeveloper?: boolean;
  currentUsername?: string;
  receiptSettings: ReceiptSettings;
  currencyCode: AppCurrencyCode;
  onChangeCurrency?: (code: AppCurrencyCode) => void;
  onOpenScanner: () => void;
  onOpenReceiptSettings?: () => void;
  queuedProduct: { product: Product; seq: number } | null;
  onConsumeQueuedProduct: () => void;
  developerSettings?: DeveloperSystemSettings;
  posSettings?: PosSettings;
  warrantySheetSettings?: WarrantySheetSettings;
}) {
  const activeCurrency = getCurrencyOption(currencyCode);
  const [subTab, setSubTab] = useState<'pos' | 'history' | 'cancel'>('pos');
  const [cancelModalSale, setCancelModalSale] = useState<Sale | null>(null);
  const [historyFeedback, setHistoryFeedback] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todos');
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    posSettings.defaultPaymentMethod || 'Efectivo'
  );
  const [showDiscountPanel, setShowDiscountPanel] = useState(false);
  const [discountMode, setDiscountMode] = useState<'amount' | 'percent'>('amount');
  const [discountInput, setDiscountInput] = useState<string>('');
  const [cashTenderedInput, setCashTenderedInput] = useState<string>('');
  const [taxEnabled, setTaxEnabled] = useState<boolean>(
    posSettings.enableTax !== false
  );
  const [taxRateInput, setTaxRateInput] = useState<string>(
    String(posSettings.taxRatePercent ?? 16)
  );
  const [taxMode, setTaxMode] = useState<'included' | 'added'>(
    posSettings.taxMode || 'included'
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedReceipt, setCompletedReceipt] = useState<{
    sale: Sale;
    warrantiesCreated: number;
    warranties: Warranty[];
  } | null>(null);
  const [previewSale, setPreviewSale] = useState<Sale | null>(null);
  const [warrantySheetModal, setWarrantySheetModal] = useState<{
    warranties: Warranty[];
    sale: Sale;
  } | null>(null);
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  useEffect(() => {
    return subscribeCustomProductCategories(setCustomCategories);
  }, []);

  useEffect(() => {
    if (cart.length === 0) {
      setCashTenderedInput('');
      if (posSettings.defaultPaymentMethod) {
        setPaymentMethod(posSettings.defaultPaymentMethod);
      }
      setTaxEnabled(posSettings.enableTax !== false);
      setTaxRateInput(String(posSettings.taxRatePercent ?? 16));
      setTaxMode(posSettings.taxMode || 'included');
    }
  }, [
    posSettings.defaultPaymentMethod,
    posSettings.enableTax,
    posSettings.taxRatePercent,
    posSettings.taxMode,
    cart.length,
  ]);

  const allowNegativeStock = Boolean(developerSettings.allowNegativeStockSale);
  const maxDiscountPct = Math.min(
    100,
    Math.max(0, developerSettings.maxPosDiscountPercent ?? 100)
  );

  const addToCart = (product: Product) => {
    if (!allowNegativeStock && product.stock <= 0) return;
    setCompletedReceipt(null);
    setError(null);
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        const currentQty = prev[idx].quantity;
        if (!allowNegativeStock && currentQty >= product.stock) return prev;
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: currentQty + 1 };
        return copy;
      }
      return [...prev, { product, quantity: 1, imei: '' }];
    });
    if (posSettings.playSoundFeedback) {
      playPosBeep('add');
    }
    if (posSettings.clearSearchAfterAdd) {
      setSearch('');
    }
  };

  useEffect(() => {
    if (queuedProduct?.product) {
      addToCart(queuedProduct.product);
      setSubTab('pos');
      onConsumeQueuedProduct();
    }
  }, [queuedProduct, onConsumeQueuedProduct]);

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const rawNext = item.quantity + delta;
          const next = allowNegativeStock
            ? rawNext
            : Math.min(item.product.stock, rawNext);
          return next <= 0 ? null : { ...item, quantity: next };
        })
        .filter((x): x is PosCartItem => x !== null)
    );
  };

  const updateCartImei = (productId: string, imei: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, imei } : item
      )
    );
  };

  const availableCategories = useMemo(() => {
    const base = [...PRODUCT_CATEGORIES] as string[];
    const seen = new Set(base.map((c) => c.toLowerCase()));
    for (const c of customCategories) {
      if (c && !seen.has(c.toLowerCase())) {
        seen.add(c.toLowerCase());
        base.push(c);
      }
    }
    for (const p of products) {
      if (p.active && p.category && !seen.has(p.category.toLowerCase())) {
        seen.add(p.category.toLowerCase());
        base.push(p.category);
      }
    }
    return ['Todos', ...base];
  }, [products, customCategories]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (!p.active) return false;
      if (posSettings.hideOutOfStock && p.stock <= 0) return false;
      if (categoryFilter !== 'Todos' && p.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.model.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, search, categoryFilter, posSettings.hideOutOfStock]);

  const subtotal = cart.reduce(
    (acc, item) => acc + item.product.salePrice * item.quantity,
    0
  );
  const parsedDiscountInput = Math.max(0, Number(discountInput) || 0);
  const maxDiscountAmount = Number(((subtotal * maxDiscountPct) / 100).toFixed(2));
  const computedDiscount =
    discountMode === 'percent'
      ? (subtotal * Math.min(maxDiscountPct, parsedDiscountInput)) / 100
      : parsedDiscountInput;
  const safeDiscount = posSettings.allowDiscountPanel
    ? Number(Math.min(maxDiscountAmount, Math.max(0, computedDiscount)).toFixed(2))
    : 0;
  const netAfterDiscount = Math.max(
    0,
    Number((subtotal - safeDiscount).toFixed(2))
  );
  const activeTaxLabel = (posSettings.taxLabel || 'IVA').trim() || 'IVA';
  const parsedTaxRate = taxEnabled
    ? Math.max(0, Math.min(100, Number(taxRateInput) || 0))
    : 0;
  const isTaxIncluded = taxMode === 'included';
  const computedTaxAmount =
    parsedTaxRate > 0
      ? isTaxIncluded
        ? Number(
            Math.max(
              0,
              netAfterDiscount -
                Number((netAfterDiscount / (1 + parsedTaxRate / 100)).toFixed(2))
            ).toFixed(2)
          )
        : Number(((netAfterDiscount * parsedTaxRate) / 100).toFixed(2))
      : 0;
  const taxBaseAmount =
    parsedTaxRate > 0 && isTaxIncluded
      ? Number(Math.max(0, netAfterDiscount - computedTaxAmount).toFixed(2))
      : netAfterDiscount;
  const total =
    parsedTaxRate > 0 && !isTaxIncluded
      ? Number((netAfterDiscount + computedTaxAmount).toFixed(2))
      : netAfterDiscount;

  const isCashOrMixto = paymentMethod === 'Efectivo' || paymentMethod === 'Mixto';
  const hasCashInput = cashTenderedInput.trim() !== '';
  const parsedCashTendered = hasCashInput ? Number(cashTenderedInput) : NaN;
  const effectiveCashTendered =
    isCashOrMixto &&
    hasCashInput &&
    Number.isFinite(parsedCashTendered) &&
    parsedCashTendered >= 0
      ? Number(parsedCashTendered.toFixed(2))
      : paymentMethod === 'Efectivo'
        ? total
        : undefined;
  const cashShortfall =
    paymentMethod === 'Efectivo' &&
    hasCashInput &&
    (!Number.isFinite(parsedCashTendered) || parsedCashTendered < total);
  const computedChange =
    typeof effectiveCashTendered === 'number'
      ? Number(Math.max(0, effectiveCashTendered - total).toFixed(2))
      : 0;

  const quickCashSuggestions = useMemo(() => {
    if (total <= 0) return [];
    const steps = [10, 20, 50, 100, 200, 500, 1000];
    const candidates = new Set<number>();
    for (const step of steps) {
      const rounded = Math.ceil(total / step) * step;
      if (rounded > total) {
        candidates.add(rounded);
      }
    }
    return Array.from(candidates)
      .sort((a, b) => a - b)
      .slice(0, 4);
  }, [total]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (posSettings.requireCustomerInfo && !customerName.trim()) {
      setError('Captura el nombre del cliente antes de cobrar.');
      return;
    }

    if (
      paymentMethod === 'Efectivo' &&
      hasCashInput &&
      (!Number.isFinite(parsedCashTendered) || parsedCashTendered < total)
    ) {
      setError(
        `El efectivo recibido (${formatCurrency(
          Number.isFinite(parsedCashTendered) ? parsedCashTendered : 0
        )}) es menor al total a cobrar (${formatCurrency(total)}).`
      );
      return;
    }

    if (
      paymentMethod === 'Mixto' &&
      hasCashInput &&
      (!Number.isFinite(parsedCashTendered) || parsedCashTendered < 0)
    ) {
      setError('Ingresa un monto de efectivo válido.');
      return;
    }

    const missingImei = cart.find(
      (c) => c.product.imeiRequired && !c.imei.trim()
    );
    if (missingImei) {
      setError(
        `Captura el número IMEI / serie para "${missingImei.product.name}" antes de cobrar.`
      );
      return;
    }

    const soldPhone = cart.some(
      (c) => c.product.category === 'Smartphones' || c.product.imeiRequired
    );

    setSubmitting(true);
    setError(null);
    try {
      const result = await processPosSale({
        uid,
        sellerName,
        customerName:
          customerName.trim() ||
          posSettings.defaultCustomerName ||
          'Cliente Mostrador',
        customerPhone: customerPhone.trim() || 'Sin teléfono',
        paymentMethod,
        discount: safeDiscount,
        taxRate: parsedTaxRate,
        taxIncluded: isTaxIncluded,
        taxLabel: activeTaxLabel,
        amountTendered: effectiveCashTendered,
        cart,
        existingSales: sales,
        existingRepairs: repairs,
        defaultPhoneWarrantyMonths:
          developerSettings.defaultPhoneWarrantyMonths || 12,
      });

      if (posSettings.playSoundFeedback) {
        playPosBeep('sale');
      }

      setCompletedReceipt({
        sale: result.sale,
        warrantiesCreated: result.warrantiesCreated,
        warranties: result.createdWarranties,
      });
      const openedWarranty =
        developerSettings.autoOpenWarrantyOnPhoneSale !== false &&
        soldPhone &&
        result.createdWarranties.length > 0;
      if (openedWarranty) {
        setWarrantySheetModal({
          warranties: result.createdWarranties,
          sale: result.sale,
        });
      } else if (posSettings.autoPrintReceiptOnSale) {
        setPreviewSale(result.sale);
      }
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setDiscountInput('');
      setCashTenderedInput('');
      setShowDiscountPanel(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar la venta.');
    } finally {
      setSubmitting(false);
    }
  };

  // Layout & card size calculations from PosSettings
  const cardSize = posSettings.productCardSize || 'sm';
  const defaultImgHeightPx =
    cardSize === 'xs' ? 56 : cardSize === 'sm' ? 80 : cardSize === 'md' ? 112 : 144;
  const imgHeightPx =
    posSettings.customImageHeightPx > 0
      ? posSettings.customImageHeightPx
      : defaultImgHeightPx;

  const gridColsClass =
    posSettings.gridColumnsDesktop === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : posSettings.gridColumnsDesktop === 3
        ? 'grid-cols-2 sm:grid-cols-2 xl:grid-cols-3'
        : posSettings.gridColumnsDesktop === 4
          ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'
          : posSettings.gridColumnsDesktop === 5
            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
            : cardSize === 'xs'
              ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
              : cardSize === 'sm'
                ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'
                : cardSize === 'md'
                  ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-2';

  const gridGapClass = cardSize === 'xs' ? 'gap-2' : cardSize === 'lg' ? 'gap-4' : 'gap-2.5';
  const catalogColSpanClass =
    posSettings.catalogWidthRatio === 'wide'
      ? 'lg:col-span-8 xl:col-span-9'
      : 'lg:col-span-7 xl:col-span-8';
  const cartColSpanClass =
    posSettings.catalogWidthRatio === 'wide'
      ? 'lg:col-span-4 xl:col-span-3'
      : 'lg:col-span-5 xl:col-span-4';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      {posSettings.showHeaderBanner && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {posSettings.posTitle || DEFAULT_POS_SETTINGS.posTitle}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Descuento automático de inventario, emisión de garantías por IMEI y actualización de reporte diario
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onChangeCurrency && (
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                <Coins className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="sr-only">Moneda del sistema</span>
                <select
                  value={currencyCode}
                  onChange={(e) =>
                    onChangeCurrency(e.target.value as AppCurrencyCode)
                  }
                  aria-label="Moneda del sistema"
                  className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none cursor-pointer max-w-[190px]"
                >
                  {APP_CURRENCY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setSubTab('pos')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  subTab === 'pos'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Caja POS
              </button>
              <button
                type="button"
                onClick={() => setSubTab('history')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  subTab === 'history'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Historial ({sales.length})
              </button>
              <button
                type="button"
                onClick={() => setSubTab('cancel')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  subTab === 'cancel'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                Cancelar Venta
              </button>
            </div>
            <button
              type="button"
              onClick={onOpenScanner}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap"
            >
              <QrCode className="w-4 h-4" />
              Escanear Producto
            </button>
          </div>
        </div>
      )}

      {!posSettings.showHeaderBanner && subTab !== 'pos' && (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setSubTab('pos')}
              className="px-2.5 py-1 text-xs font-medium rounded-md text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Caja POS
            </button>
            <button
              type="button"
              onClick={() => setSubTab('history')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                subTab === 'history'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Historial ({sales.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('cancel')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                subTab === 'cancel'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              <Ban className="w-3.5 h-3.5" />
              Cancelar Venta
            </button>
          </div>
        </div>
      )}

      {subTab === 'pos' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Panel Izquierdo: Catálogo de Productos */}
          <div
            className={`${catalogColSpanClass} ${
              posSettings.cartPosition === 'left' ? 'lg:order-2' : 'lg:order-1'
            } bg-white border border-slate-200 rounded-xl p-5 space-y-4`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-700" />
                <h2 className="text-base font-semibold text-slate-900">
                  Catálogo de Productos
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!posSettings.showHeaderBanner && (
                  <>
                    <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setSubTab('pos')}
                        className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-white text-slate-900 shadow-xs"
                      >
                        Caja
                      </button>
                      <button
                        type="button"
                        onClick={() => setSubTab('history')}
                        className="px-2.5 py-1 text-[11px] font-medium rounded-md text-slate-600 hover:text-slate-900"
                      >
                        Historial ({sales.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSubTab('cancel')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md text-amber-800 hover:bg-amber-50"
                      >
                        <Ban className="w-3 h-3" />
                        Cancelar Venta
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenScanner}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      Escanear
                    </button>
                  </>
                )}
                <span className="text-xs font-mono text-slate-500">
                  {filteredProducts.length}{' '}
                  {filteredProducts.length === 1 ? 'producto' : 'productos'}
                </span>
              </div>
            </div>

            {/* Barra de búsqueda en tiempo real + Escaneo directo + Filtros por categorías */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      const token = extractCodeToken(search);
                      if (!token) return;
                      const lower = token.toLowerCase();
                      const exact = products.find(
                        (p) =>
                          p.active &&
                          (p.barcode.toLowerCase() === lower ||
                            p.sku.toLowerCase() === lower ||
                            p.qrCodeData.toLowerCase() === lower)
                      );
                      const candidate =
                        exact || (filteredProducts.length === 1 ? filteredProducts[0] : undefined);
                      if (candidate) {
                        e.preventDefault();
                        addToCart(candidate);
                        setSearch('');
                      }
                    }}
                    placeholder="Buscar o escanear código de barra, SKU, nombre o marca..."
                    className="w-full pl-9 pr-9 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Limpiar búsqueda"
                      className="p-1 text-slate-400 hover:text-slate-700 absolute right-2.5 top-1/2 -translate-y-1/2 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onOpenScanner}
                  title="Escanear código de barras con cámara o teléfono"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Camera className="w-4 h-4" />
                  <span className="hidden sm:inline">Escanear con Teléfono</span>
                  <span className="sm:hidden">Escanear</span>
                </button>
              </div>

              {posSettings.showCategoryTabs && (
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                  {availableCategories.map((cat) => {
                    const active = categoryFilter === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cuadrícula adaptable de tarjetas con fotografías */}
            {filteredProducts.length === 0 ? (
              <div className="py-12 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">
                  No se encontraron productos con esos filtros
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Prueba otra palabra clave o selecciona la categoría &quot;Todos&quot;.
                </p>
              </div>
            ) : (
              <div className={`grid ${gridColsClass} ${gridGapClass} max-h-[680px] overflow-y-auto pr-1`}>
                {filteredProducts.map((p) => {
                  const inCartItem = cart.find((item) => item.product.id === p.id);
                  const qtyInCart = inCartItem?.quantity || 0;
                  const outOfStock = !allowNegativeStock && p.stock <= 0;
                  const reachedMaxStock = !allowNegativeStock && qtyInCart >= p.stock;

                  const cardBodyPad =
                    cardSize === 'xs'
                      ? 'p-2 gap-1'
                      : cardSize === 'md'
                        ? 'p-3 gap-2'
                        : cardSize === 'lg'
                          ? 'p-4 gap-2.5'
                          : 'p-2.5 gap-1.5';
                  const titleTextCls =
                    cardSize === 'xs'
                      ? 'text-[11px]'
                      : cardSize === 'md' || cardSize === 'lg'
                        ? 'text-sm'
                        : 'text-xs';
                  const priceTextCls =
                    cardSize === 'xs'
                      ? 'text-xs'
                      : cardSize === 'md'
                        ? 'text-base'
                        : cardSize === 'lg'
                          ? 'text-lg'
                          : 'text-sm';

                  return (
                    <div
                      key={p.id}
                      className={`border rounded-lg overflow-hidden flex flex-col justify-between bg-white transition-colors ${
                        qtyInCart > 0
                          ? 'border-blue-700 ring-1 ring-blue-700/20'
                          : 'border-slate-200 hover:border-slate-300'
                      } ${outOfStock ? 'opacity-65' : ''}`}
                    >
                      {/* Fotografía del producto (clic para agregar a la venta) */}
                      {posSettings.showProductImages ? (
                        <button
                          type="button"
                          disabled={outOfStock || reachedMaxStock}
                          onClick={() => addToCart(p)}
                          title={
                            outOfStock
                              ? 'Sin existencias'
                              : reachedMaxStock
                                ? 'Límite de stock alcanzado'
                                : `Agregar ${p.name} a la venta`
                          }
                          aria-label={
                            outOfStock
                              ? `${p.name} agotado`
                              : reachedMaxStock
                                ? `${p.name} límite de stock alcanzado`
                                : `Agregar ${p.name} a la venta`
                          }
                          style={{ height: `${imgHeightPx}px` }}
                          className="group/img relative w-full bg-slate-100 border-b border-slate-100 overflow-hidden block text-left cursor-pointer disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-700"
                        >
                          <div className="w-full h-full transition-transform duration-200 group-hover/img:scale-[1.03] group-disabled/img:scale-100">
                            <PosProductImage
                              src={p.imageUrl}
                              alt={p.name}
                              fitMode={posSettings.imageFitMode}
                            />
                          </div>
                          {posSettings.showStockBadge && (
                            <span
                              className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[9px] font-mono font-semibold rounded border ${
                                outOfStock
                                  ? 'bg-red-50/95 text-red-700 border-red-200'
                                  : 'bg-white/95 text-slate-700 border-slate-200'
                              }`}
                            >
                              {outOfStock ? 'Agotado' : `${p.stock} disp.`}
                            </span>
                          )}
                          {posSettings.showCartQtyBadge && qtyInCart > 0 && (
                            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[9px] font-semibold rounded bg-slate-900 text-white">
                              x{qtyInCart}
                            </span>
                          )}
                          {!outOfStock && !reachedMaxStock && (
                            <span className="absolute inset-x-0 bottom-0 py-0.5 px-2 bg-slate-950/75 text-white text-[10px] font-medium flex items-center justify-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
                              <Plus className="w-3 h-3" />
                              Agregar
                            </span>
                          )}
                          {!outOfStock && reachedMaxStock && (
                            <span className="absolute inset-x-0 bottom-0 py-0.5 px-2 bg-amber-950/80 text-amber-100 text-[9px] font-medium text-center">
                              Límite de stock
                            </span>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={outOfStock || reachedMaxStock}
                          onClick={() => addToCart(p)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 hover:bg-blue-50 border-b border-slate-100 flex items-center justify-between gap-2 text-left cursor-pointer disabled:cursor-not-allowed transition-colors"
                        >
                          <div className="flex items-center gap-1.5">
                            {posSettings.showCartQtyBadge && qtyInCart > 0 ? (
                              <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-slate-900 text-white">
                                x{qtyInCart}
                              </span>
                            ) : (
                              <Plus className="w-3 h-3 text-blue-700" />
                            )}
                            <span className="text-[10px] font-medium text-slate-600">
                              {outOfStock
                                ? 'Sin stock'
                                : reachedMaxStock
                                  ? 'Límite'
                                  : 'Agregar'}
                            </span>
                          </div>
                          {posSettings.showStockBadge && (
                            <span
                              className={`text-[9px] font-mono font-semibold ${
                                outOfStock ? 'text-red-600' : 'text-slate-600'
                              }`}
                            >
                              {outOfStock ? 'Agotado' : `${p.stock} disp.`}
                            </span>
                          )}
                        </button>
                      )}

                      {/* Detalles del producto */}
                      <div
                        onClick={() => {
                          if (!outOfStock && !reachedMaxStock) addToCart(p);
                        }}
                        className={`${cardBodyPad} flex-1 flex flex-col justify-between cursor-pointer`}
                      >
                        <div className="space-y-0.5">
                          {posSettings.showCategoryBadge && (
                            <p className="text-[10px] font-medium text-blue-700 truncate">
                              {p.category}
                            </p>
                          )}
                          <h3
                            className={`${titleTextCls} font-semibold text-slate-900 line-clamp-2 leading-tight`}
                          >
                            {p.name}
                          </h3>
                          {posSettings.showBrandModel && (
                            <p className="text-[10px] text-slate-500 truncate">
                              {p.brand} {p.model}
                            </p>
                          )}
                          {posSettings.showSkuCode && (
                            <p className="text-[10px] font-mono text-slate-500 truncate">
                              Cód: {p.sku}
                            </p>
                          )}
                        </div>

                        <div className="pt-1.5 border-t border-slate-100">
                          <div className="flex items-baseline justify-between gap-1.5">
                            <span className="text-[10px] text-slate-500">
                              Precio
                            </span>
                            <span
                              className={`${priceTextCls} font-bold font-mono tabular-nums text-slate-900`}
                            >
                              {formatCurrency(p.salePrice)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Panel Derecho: Área de Ventas */}
          <div
            className={`${cartColSpanClass} ${
              posSettings.cartPosition === 'left' ? 'lg:order-1' : 'lg:order-2'
            } lg:sticky lg:top-20 bg-white border border-slate-200 rounded-xl p-5 space-y-5`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-slate-700" />
                <h2 className="text-base font-semibold text-slate-900">
                  {posSettings.cartSectionTitle || DEFAULT_POS_SETTINGS.cartSectionTitle}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                {onOpenReceiptSettings && (
                  <button
                    type="button"
                    onClick={onOpenReceiptSettings}
                    className="text-[11px] font-medium text-blue-700 hover:underline"
                  >
                    Config. comprobante
                  </button>
                )}
                <span className="text-xs font-mono text-slate-500">
                  {cart.reduce((a, b) => a + b.quantity, 0)} artículos
                </span>
              </div>
            </div>

            {completedReceipt && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-950">
                        Venta completada · {completedReceipt.sale.saleNumber}
                      </p>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Cliente: {completedReceipt.sale.customerName} · Total:{' '}
                        <span className="font-mono font-semibold">
                          {formatCurrency(completedReceipt.sale.total)}
                        </span>
                      </p>
                      {completedReceipt.sale.discount > 0 && (
                        <p className="text-xs text-emerald-800 mt-0.5 font-mono">
                          Subtotal {formatCurrency(completedReceipt.sale.subtotal)} · Descuento -{formatCurrency(completedReceipt.sale.discount)}
                        </p>
                      )}
                      {typeof completedReceipt.sale.taxAmount === 'number' &&
                        completedReceipt.sale.taxAmount > 0 && (
                          <p className="text-xs text-emerald-800 mt-0.5 font-mono">
                            {completedReceipt.sale.taxLabel || 'IVA'} ({completedReceipt.sale.taxRate ?? 0}%
                            {completedReceipt.sale.taxIncluded !== false ? ' inc.' : ''}):{' '}
                            {formatCurrency(completedReceipt.sale.taxAmount)}
                          </p>
                        )}
                      {typeof completedReceipt.sale.amountTendered === 'number' && (
                        <p className="text-xs text-emerald-900 mt-0.5 font-mono">
                          Efectivo recibido:{' '}
                          <span className="font-semibold">
                            {formatCurrency(completedReceipt.sale.amountTendered)}
                          </span>{' '}
                          · Cambio:{' '}
                          <span className="font-bold">
                            {formatCurrency(
                              typeof completedReceipt.sale.changeAmount === 'number'
                                ? completedReceipt.sale.changeAmount
                                : Math.max(
                                    0,
                                    completedReceipt.sale.amountTendered -
                                      completedReceipt.sale.total
                                  )
                            )}
                          </span>
                        </p>
                      )}
                      {completedReceipt.warrantiesCreated > 0 && (
                        <p className="text-xs text-emerald-800 mt-1">
                          Se emitieron {completedReceipt.warrantiesCreated} certificados de garantía automáticamente.
                        </p>
                      )}
                    </div>
                  </div>
                  <QrCodeImg value={completedReceipt.sale.saleNumber} size={64} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewSale(completedReceipt.sale)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-emerald-300 text-emerald-900 rounded-lg hover:bg-emerald-100 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Ver e Imprimir Comprobante
                  </button>
                  {completedReceipt.warranties.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setWarrantySheetModal({
                          warranties: completedReceipt.warranties,
                          sale: completedReceipt.sale,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-700 text-white rounded-lg hover:bg-blue-800 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Hoja de Garantía
                    </button>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {error}
              </div>
            )}

            {cart.length === 0 ? (
              <div className="py-10 text-center text-slate-500">
                <Receipt className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                <p className="text-sm">Selecciona productos de la lista o escanea un código.</p>
              </div>
            ) : (
              <form onSubmit={handleCheckout} className="space-y-4">
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div key={item.product.id} className="py-3 space-y-2">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 shrink-0 overflow-hidden rounded-lg">
                            <PosProductImage
                              src={item.product.imageUrl}
                              alt={item.product.name}
                              compact
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {item.product.name}
                            </p>
                            <p className="text-xs font-mono text-slate-500">
                              {formatCurrency(item.product.salePrice)} c/u
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.product.id, -1)}
                            className="p-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-100"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-mono tabular-nums font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.product.id, 1)}
                            className="p-1 border border-slate-200 rounded text-slate-600 hover:bg-slate-100"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.product.id, -item.quantity)}
                            className="p-1 text-slate-400 hover:text-red-600 ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {item.product.imeiRequired && (
                        <div>
                          <input
                            type="text"
                            required
                            maxLength={40}
                            value={item.imei}
                            onChange={(e) => updateCartImei(item.product.id, e.target.value)}
                            placeholder="IMEI / Número de serie obligatorio para garantía"
                            className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nombre del Cliente{posSettings.requireCustomerInfo ? ' *' : ''}
                    </label>
                    <input
                      type="text"
                      required={posSettings.requireCustomerInfo}
                      maxLength={100}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={
                        posSettings.defaultCustomerName || 'Ej: Laura Méndez'
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Teléfono / WhatsApp
                    </label>
                    <input
                      type="text"
                      maxLength={32}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+52 55..."
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Método de Pago
                    </label>
                    {posSettings.showQuickPayButtons ? (
                      <div className="grid grid-cols-2 gap-1.5">
                        {PAYMENT_METHODS.map((pm) => (
                          <button
                            key={pm}
                            type="button"
                            onClick={() => setPaymentMethod(pm)}
                            className={`py-2 px-2.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                              paymentMethod === pm
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {pm}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                      >
                        {PAYMENT_METHODS.map((pm) => (
                          <option key={pm} value={pm}>
                            {pm}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Custom Discount Control */}
                  {posSettings.allowDiscountPanel && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setShowDiscountPanel((prev) => !prev)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 hover:text-blue-700 transition-colors"
                        >
                          <Tag className="w-3.5 h-3.5 text-blue-700" />
                          <span>
                            {showDiscountPanel || safeDiscount > 0
                              ? 'Descuento personalizado'
                              : 'Aplicar descuento personalizado'}
                          </span>
                        </button>

                        {safeDiscount > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDiscountInput('');
                              setShowDiscountPanel(false);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 hover:underline"
                          >
                            <X className="w-3 h-3" />
                            Quitar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowDiscountPanel((prev) => !prev)}
                            className="text-[11px] font-medium text-blue-700 hover:underline"
                          >
                            {showDiscountPanel ? 'Ocultar' : 'Configurar'}
                          </button>
                        )}
                      </div>

                      {(showDiscountPanel || safeDiscount > 0) && (
                        <div className="space-y-2.5 pt-1 border-t border-slate-200/80">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-lg shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setDiscountMode('amount');
                                  setDiscountInput('');
                                }}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                                  discountMode === 'amount'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                <Coins className="w-3 h-3" />
                                Monto ({activeCurrency.symbol})
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDiscountMode('percent');
                                  setDiscountInput('');
                                }}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                                  discountMode === 'percent'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                <Percent className="w-3 h-3" />
                                Porcentaje (%)
                              </button>
                            </div>

                            <div className="relative flex-1">
                              <input
                                type="number"
                                min={0}
                                max={discountMode === 'percent' ? 100 : subtotal}
                                step="0.01"
                                value={discountInput}
                                onChange={(e) => setDiscountInput(e.target.value)}
                                placeholder={
                                  discountMode === 'percent' ? 'Ej: 12' : 'Ej: 50.00'
                                }
                                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-slate-500 mr-0.5">
                              Rápido:
                            </span>
                            {(discountMode === 'percent'
                              ? [5, 10, 15, 20, 30]
                              : [10, 25, 50, 100]
                            ).map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setDiscountInput(String(preset))}
                                className={`px-2 py-1 text-[11px] font-mono rounded-md border transition-colors ${
                                  Number(discountInput) === preset
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                {discountMode === 'percent'
                                  ? `${preset}%`
                                  : `${activeCurrency.symbol}${preset}`}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Cash Received & Change Calculator */}
                  {isCashOrMixto && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="pos-cash-tendered"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800"
                        >
                          <Coins className="w-3.5 h-3.5 text-emerald-700" />
                          <span>
                            {paymentMethod === 'Mixto'
                              ? `Efectivo entregado (${activeCurrency.symbol})`
                              : `Efectivo que dio el cliente (${activeCurrency.symbol})`}
                          </span>
                        </label>
                        {hasCashInput && (
                          <button
                            type="button"
                            onClick={() => setCashTenderedInput('')}
                            className="text-[11px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                          >
                            Limpiar
                          </button>
                        )}
                      </div>

                      <input
                        id="pos-cash-tendered"
                        type="number"
                        min={0}
                        step="0.01"
                        value={cashTenderedInput}
                        onChange={(e) => setCashTenderedInput(e.target.value)}
                        placeholder={`Exacto: ${total.toFixed(2)}`}
                        className="w-full px-3 py-2 text-sm font-mono font-semibold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                      />

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCashTenderedInput(total.toFixed(2))}
                          className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer ${
                            hasCashInput && Number(cashTenderedInput) === total
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          Exacto
                        </button>
                        {quickCashSuggestions.map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setCashTenderedInput(String(amt))}
                            className={`px-2 py-1 text-[11px] font-mono rounded-md border transition-colors cursor-pointer ${
                              hasCashInput && Number(cashTenderedInput) === amt
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {formatCurrency(amt)}
                          </button>
                        ))}
                      </div>

                      {cashShortfall ? (
                        <div className="flex items-center justify-between text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                          <span>Falta por cubrir</span>
                          <span className="font-mono font-semibold tabular-nums">
                            {formatCurrency(
                              total -
                                (Number.isFinite(parsedCashTendered)
                                  ? parsedCashTendered
                                  : 0)
                            )}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                          <span className="text-slate-600 font-medium">
                            Cambio a devolver
                          </span>
                          <span className="font-mono font-bold tabular-nums text-emerald-700 text-sm">
                            {formatCurrency(computedChange)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* IVA / Tax Control */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={taxEnabled}
                          onChange={(e) => setTaxEnabled(e.target.checked)}
                          className="rounded border-slate-300"
                        />
                        <span>Aplicar {activeTaxLabel}</span>
                      </label>

                      {taxEnabled && (
                        <div className="flex items-center gap-1.5">
                          <div className="inline-flex rounded-md bg-slate-200/70 p-0.5 text-[10px]">
                            <button
                              type="button"
                              onClick={() => setTaxMode('included')}
                              className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                                taxMode === 'included'
                                  ? 'bg-white text-slate-900 shadow-2xs'
                                  : 'text-slate-600'
                              }`}
                            >
                              Incluido
                            </button>
                            <button
                              type="button"
                              onClick={() => setTaxMode('added')}
                              className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                                taxMode === 'added'
                                  ? 'bg-white text-slate-900 shadow-2xs'
                                  : 'text-slate-600'
                              }`}
                            >
                              + Sumar
                            </button>
                          </div>
                          <div className="relative w-16">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.5"
                              value={taxRateInput}
                              onChange={(e) => setTaxRateInput(e.target.value)}
                              className="w-full px-2 py-1 pr-5 text-[11px] font-mono bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-700"
                              aria-label={`Porcentaje de ${activeTaxLabel}`}
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                              %
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 space-y-1.5 text-sm">
                  <div className="flex justify-between text-slate-500 text-xs">
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums">{formatCurrency(subtotal)}</span>
                  </div>
                  {safeDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700 text-xs">
                      <span>
                        Descuento aplicado
                        {discountMode === 'percent' && parsedDiscountInput > 0
                          ? ` (${Math.min(100, parsedDiscountInput)}%)`
                          : ''}
                      </span>
                      <span className="font-mono tabular-nums">
                        -{formatCurrency(safeDiscount)}
                      </span>
                    </div>
                  )}
                  {parsedTaxRate > 0 && (
                    <>
                      {isTaxIncluded && (
                        <div className="flex justify-between text-slate-500 text-xs">
                          <span>Base sin {activeTaxLabel}</span>
                          <span className="font-mono tabular-nums">
                            {formatCurrency(taxBaseAmount)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-700 text-xs">
                        <span>
                          {activeTaxLabel} ({parsedTaxRate}%{isTaxIncluded ? ' inc.' : ''})
                        </span>
                        <span className="font-mono tabular-nums">
                          {isTaxIncluded ? '' : '+'}
                          {formatCurrency(computedTaxAmount)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-base font-bold text-slate-900 pt-1">
                    <span>Total a Cobrar</span>
                    <span className="font-mono tabular-nums">{formatCurrency(total)}</span>
                  </div>
                  {typeof effectiveCashTendered === 'number' && !cashShortfall && (
                    <div className="pt-1.5 mt-1 border-t border-dashed border-slate-200 space-y-0.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Efectivo recibido</span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(effectiveCashTendered)}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold text-emerald-700">
                        <span>Cambio</span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(computedChange)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  {submitting
                    ? 'Procesando cobro...'
                    : posSettings.checkoutButtonLabel ||
                      DEFAULT_POS_SETTINGS.checkoutButtonLabel}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : subTab === 'cancel' ? (
        <CancelSalePanel
          sales={sales}
          repairs={repairs}
          warranties={warranties}
          uid={uid}
          actorName={sellerName}
          viewRole={viewRole}
          isDeveloper={isDeveloper}
          currentUsername={currentUsername}
          requireAdminToCancelSale={
            developerSettings.requireAdminToCancelSale ?? true
          }
          onOpenReceipt={(sale) => setPreviewSale(sale)}
        />
      ) : (
        <div className="space-y-4">
          {historyFeedback && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-emerald-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium">{historyFeedback}</span>
              </div>
              <button
                type="button"
                onClick={() => setHistoryFeedback(null)}
                className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
                aria-label="Cerrar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {sales.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                Aún no hay ventas registradas.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Folio</th>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Artículos</th>
                      <th className="py-3 px-4">Pago</th>
                      <th className="py-3 px-4 text-right">Total</th>
                      {viewRole === 'admin' && (
                        <th className="py-3 px-4 text-right">Utilidad</th>
                      )}
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Comprobante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {sales.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                          {s.saleNumber}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                          {s.dateKey}
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-xs font-medium text-slate-900">{s.customerName}</p>
                          <p className="text-[11px] text-slate-400">{s.customerPhone}</p>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 max-w-[260px] truncate">
                          {s.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                          {s.paymentMethod}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                          {formatCurrency(s.total)}
                          {s.discount > 0 && (
                            <span className="block text-[11px] font-normal text-emerald-700">
                              Desc. -{formatCurrency(s.discount)}
                            </span>
                          )}
                        </td>
                        {viewRole === 'admin' && (
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-emerald-700 whitespace-nowrap">
                            {formatCurrency(s.profit)}
                          </td>
                        )}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`text-xs font-medium ${
                              s.status === 'Completada' ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-3">
                          <button
                            type="button"
                            onClick={() => setPreviewSale(s)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Comprobante
                          </button>
                          {warranties.some((w) => w.saleId === s.id) && (
                            <button
                              type="button"
                              onClick={() =>
                                setWarrantySheetModal({
                                  warranties: warranties.filter((w) => w.saleId === s.id),
                                  sale: s,
                                })
                              }
                              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Garantía
                            </button>
                          )}
                          {s.status === 'Completada' && (
                            <button
                              type="button"
                              onClick={() => setCancelModalSale(s)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              Cancelar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <CancelSaleModal
        sale={cancelModalSale}
        allSales={sales}
        allRepairs={repairs}
        warranties={warranties}
        uid={uid}
        actorName={sellerName}
        viewRole={viewRole}
        isDeveloper={isDeveloper}
        currentUsername={currentUsername}
        requireAdminToCancelSale={
          developerSettings.requireAdminToCancelSale ?? true
        }
        onClose={() => setCancelModalSale(null)}
        onCancelled={(msg) => setHistoryFeedback(msg)}
      />

      <ReceiptPreviewModal
        sale={previewSale}
        settings={receiptSettings}
        onClose={() => setPreviewSale(null)}
        onOpenSettings={onOpenReceiptSettings}
      />

      <WarrantySheetModal
        warranties={warrantySheetModal?.warranties || []}
        sale={warrantySheetModal?.sale || null}
        products={products}
        settings={receiptSettings}
        warrantySettings={warrantySheetSettings}
        onClose={() => setWarrantySheetModal(null)}
        onOpenReceipt={
          warrantySheetModal?.sale
            ? () => {
                const targetSale = warrantySheetModal.sale;
                setWarrantySheetModal(null);
                setPreviewSale(targetSale);
              }
            : undefined
        }
      />
    </motion.div>
  );
}
