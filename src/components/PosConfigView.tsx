import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Grid,
  LayoutGrid,
  Package,
  Plus,
  RotateCcw,
  Save,
  ShoppingCart,
  Sliders,
  Smartphone,
} from 'lucide-react';
import {
  DEFAULT_CATALOG_IMAGE_PRESETS,
  DEFAULT_POS_SETTINGS,
  formatCurrency,
  PAYMENT_METHODS,
  type PaymentMethod,
  type PosCardSize,
  type PosGridColumns,
  type PosSettings,
} from '../types/store';
import { saveStorePosSettings } from '../lib/storeOperations';

const CARD_SIZE_OPTIONS: {
  id: PosCardSize;
  label: string;
  desc: string;
}[] = [
  { id: 'xs', label: 'Muy Compacto', desc: '5 por fila · foto mini' },
  { id: 'sm', label: 'Compacto', desc: '4 por fila · equilibrado' },
  { id: 'md', label: 'Mediano', desc: '3 por fila · clásico' },
  { id: 'lg', label: 'Grande', desc: '2 por fila · táctil' },
];

const COLUMN_OPTIONS: { id: PosGridColumns; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 2, label: '2 col' },
  { id: 3, label: '3 col' },
  { id: 4, label: '4 col' },
  { id: 5, label: '5 col' },
];

const PREVIEW_PRODUCTS = [
  {
    id: 'p1',
    name: 'iPhone 15 Pro 256GB',
    brand: 'Apple',
    model: 'A3101',
    category: 'Smartphones',
    sku: 'CEL-15PRO',
    stock: 6,
    inCart: 1,
    price: 23999,
    img: DEFAULT_CATALOG_IMAGE_PRESETS[0].url,
  },
  {
    id: 'p2',
    name: 'Cargador Rápido 30W USB-C',
    brand: 'Anker',
    model: 'Nano 3',
    category: 'Cargadores y Cables',
    sku: 'CAR-30W',
    stock: 18,
    inCart: 0,
    price: 499,
    img: DEFAULT_CATALOG_IMAGE_PRESETS[1].url,
  },
  {
    id: 'p3',
    name: 'Display OLED Original',
    brand: 'Samsung',
    model: 'S23 Ultra',
    category: 'Pantallas y Repuestos',
    sku: 'REP-S23U',
    stock: 0,
    inCart: 0,
    price: 4200,
    img: DEFAULT_CATALOG_IMAGE_PRESETS[2].url,
  },
  {
    id: 'p4',
    name: 'Funda MagSafe Kevlar',
    brand: 'Spigen',
    model: 'Ultra Hybrid',
    category: 'Protección',
    sku: 'FUN-MAG',
    stock: 12,
    inCart: 2,
    price: 590,
    img: DEFAULT_CATALOG_IMAGE_PRESETS[1].url,
  },
];

function ToggleCheck({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 cursor-pointer transition-colors">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-900">{label}</p>
        {description && (
          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
            {description}
          </p>
        )}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 accent-blue-700 shrink-0 cursor-pointer"
      />
    </label>
  );
}

export function PosConfigView({ settings }: { settings: PosSettings }) {
  const [draft, setDraft] = useState<PosSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const update = (patch: Partial<PosSettings>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setNotice(null);
    setErrorMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setNotice(null);
    try {
      await saveStorePosSettings(draft);
      setNotice(
        'Configuración del Punto de Venta guardada. Los cambios ya están aplicados en Caja POS.'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar la configuración del Punto de Venta.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const defaults = { ...DEFAULT_POS_SETTINGS };
    setDraft(defaults);
    setSaving(true);
    try {
      await saveStorePosSettings(defaults);
      setNotice('Punto de Venta restaurado a su diseño predeterminado.');
    } finally {
      setSaving(false);
    }
  };

  // Preview helpers matching PosSalesView metrics
  const defaultHeightPx =
    draft.productCardSize === 'xs'
      ? 56
      : draft.productCardSize === 'sm'
        ? 80
        : draft.productCardSize === 'md'
          ? 112
          : 144;
  const effectiveImageHeight =
    draft.customImageHeightPx > 0 ? draft.customImageHeightPx : defaultHeightPx;

  const previewColsClass =
    draft.gridColumnsDesktop === 2
      ? 'grid-cols-2'
      : draft.gridColumnsDesktop === 3
        ? 'grid-cols-3'
        : draft.gridColumnsDesktop === 4
          ? 'grid-cols-2 sm:grid-cols-4'
          : draft.gridColumnsDesktop === 5
            ? 'grid-cols-2 sm:grid-cols-3'
            : draft.productCardSize === 'lg'
              ? 'grid-cols-2'
              : draft.productCardSize === 'md'
                ? 'grid-cols-2 sm:grid-cols-3'
                : 'grid-cols-2 sm:grid-cols-3';

  const visiblePreviewProducts = draft.hideOutOfStock
    ? PREVIEW_PRODUCTS.filter((p) => p.stock > 0)
    : PREVIEW_PRODUCTS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-2.5 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Controls */}
        <form
          onSubmit={(e) => void handleSave(e)}
          className="xl:col-span-7 space-y-6"
        >
          {/* Card 1: Product Sizes & Grid */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-blue-700" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Tamaño de Productos y Cuadrícula
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Ajusta el tamaño de las tarjetas, columnas y altura de fotografía en el POS.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Tamaño preestablecido de tarjeta
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {CARD_SIZE_OPTIONS.map((opt) => {
                  const active = draft.productCardSize === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => update({ productCardSize: opt.id })}
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <p className="text-xs font-semibold">{opt.label}</p>
                      <p
                        className={`text-[10px] mt-0.5 ${
                          active ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {opt.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  Columnas en escritorio
                </label>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {COLUMN_OPTIONS.map((col) => (
                    <button
                      key={String(col.id)}
                      type="button"
                      onClick={() => update({ gridColumnsDesktop: col.id })}
                      className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                        draft.gridColumnsDesktop === col.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  Ajuste de fotografía
                </label>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => update({ imageFitMode: 'cover' })}
                    className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                      draft.imageFitMode === 'cover'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Llenar marco
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ imageFitMode: 'contain' })}
                    className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                      draft.imageFitMode === 'contain'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Foto completa
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <ToggleCheck
                label="Mostrar fotografías en las tarjetas de producto"
                description="Desactívalo si prefieres tarjetas solo de texto ultra rápidas para pantallas con muchos artículos."
                checked={draft.showProductImages}
                onChange={(v) => update({ showProductImages: v })}
              />

              {draft.showProductImages && (
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      Altura exacta de imagen
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-blue-700 font-semibold">
                        {draft.customImageHeightPx > 0
                          ? `${draft.customImageHeightPx} px`
                          : `Auto (${defaultHeightPx} px)`}
                      </span>
                      {draft.customImageHeightPx > 0 && (
                        <button
                          type="button"
                          onClick={() => update({ customImageHeightPx: 0 })}
                          className="text-[11px] text-slate-500 hover:text-slate-900 underline cursor-pointer"
                        >
                          Auto
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    min={48}
                    max={180}
                    step={4}
                    value={effectiveImageHeight}
                    onChange={(e) =>
                      update({ customImageHeightPx: Number(e.target.value) })
                    }
                    className="w-full accent-blue-700 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>48 px (Mini)</span>
                    <span>112 px</span>
                    <span>180 px (Grande)</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Card Fields & Visibility */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Grid className="w-4 h-4 text-blue-700" />
              <h3 className="text-sm font-semibold text-slate-900">
                Información Visible en cada Producto
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <ToggleCheck
                label="Mostrar categoría"
                checked={draft.showCategoryBadge}
                onChange={(v) => update({ showCategoryBadge: v })}
              />
              <ToggleCheck
                label="Mostrar código SKU"
                checked={draft.showSkuCode}
                onChange={(v) => update({ showSkuCode: v })}
              />
              <ToggleCheck
                label="Mostrar marca y modelo"
                checked={draft.showBrandModel}
                onChange={(v) => update({ showBrandModel: v })}
              />
              <ToggleCheck
                label="Mostrar etiqueta de stock"
                checked={draft.showStockBadge}
                onChange={(v) => update({ showStockBadge: v })}
              />
              <ToggleCheck
                label="Mostrar insignia de cantidad en carrito"
                checked={draft.showCartQtyBadge}
                onChange={(v) => update({ showCartQtyBadge: v })}
              />
              <ToggleCheck
                label="Ocultar productos agotados (stock 0)"
                checked={draft.hideOutOfStock}
                onChange={(v) => update({ hideOutOfStock: v })}
              />
            </div>
          </div>

          {/* Card 3: POS Layout, Behavior & Labels */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Sliders className="w-4 h-4 text-blue-700" />
              <h3 className="text-sm font-semibold text-slate-900">
                Distribución, Reglas de Cobro y Textos del POS
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Ubicación del Área de Ventas (Carrito)
                </label>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => update({ cartPosition: 'right' })}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      draft.cartPosition === 'right'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    A la derecha
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ cartPosition: 'left' })}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      draft.cartPosition === 'left'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    A la izquierda
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Proporción de pantalla
                </label>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => update({ catalogWidthRatio: 'balanced' })}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      draft.catalogWidthRatio === 'balanced'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Equilibrado
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ catalogWidthRatio: 'wide' })}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      draft.catalogWidthRatio === 'wide'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Catálogo amplio
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Método de pago por defecto
                </label>
                <select
                  value={draft.defaultPaymentMethod}
                  onChange={(e) =>
                    update({
                      defaultPaymentMethod: e.target.value as PaymentMethod,
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nombre de cliente por defecto
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={draft.defaultCustomerName}
                  onChange={(e) =>
                    update({ defaultCustomerName: e.target.value })
                  }
                  placeholder="Cliente Mostrador"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Título principal del POS
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={draft.posTitle}
                  onChange={(e) => update({ posTitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Título del panel de carrito
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={draft.cartSectionTitle}
                  onChange={(e) => update({ cartSectionTitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Texto del botón de cobro
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={draft.checkoutButtonLabel}
                  onChange={(e) =>
                    update({ checkoutButtonLabel: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <ToggleCheck
                label="Mostrar barra superior del POS"
                description="Ocultarla da más espacio vertical al catálogo."
                checked={draft.showHeaderBanner}
                onChange={(v) => update({ showHeaderBanner: v })}
              />
              <ToggleCheck
                label="Mostrar pestañas de categorías"
                description="Permite filtrar rápido por categoría."
                checked={draft.showCategoryTabs}
                onChange={(v) => update({ showCategoryTabs: v })}
              />
              <ToggleCheck
                label="Botones rápidos de método de pago"
                description="Botones táctiles para Efectivo, Tarjeta, etc."
                checked={draft.showQuickPayButtons}
                onChange={(v) => update({ showQuickPayButtons: v })}
              />
              <ToggleCheck
                label="Habilitar descuentos en el POS"
                description="Permite aplicar monto o porcentaje de descuento."
                checked={draft.allowDiscountPanel}
                onChange={(v) => update({ allowDiscountPanel: v })}
              />
              <ToggleCheck
                label="Exigir nombre de cliente al cobrar"
                description="Evita ventas sin identificar al comprador."
                checked={draft.requireCustomerInfo}
                onChange={(v) => update({ requireCustomerInfo: v })}
              />
              <ToggleCheck
                label="Limpiar buscador al agregar producto"
                description="Borra el texto de búsqueda tras cada clic."
                checked={draft.clearSearchAfterAdd}
                onChange={(v) => update({ clearSearchAfterAdd: v })}
              />
              <ToggleCheck
                label="Abrir comprobante automáticamente al cobrar"
                description="Muestra el ticket listo para imprimir al vender."
                checked={draft.autoPrintReceiptOnSale}
                onChange={(v) => update({ autoPrintReceiptOnSale: v })}
              />
              <ToggleCheck
                label="Sonido de confirmación en caja"
                description="Emite un tono breve al agregar o cobrar."
                checked={draft.playSoundFeedback}
                onChange={(v) => update({ playSoundFeedback: v })}
              />
            </div>

            {/* IVA / Impuesto Configuration */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    Configuración de IVA / Impuesto en Ventas
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Define el porcentaje de IVA y si ya está incluido en los precios o se suma al total.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.enableTax !== false}
                    onChange={(e) => update({ enableTax: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <span>Activar IVA</span>
                </label>
              </div>

              {draft.enableTax !== false && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Porcentaje (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.5"
                      value={draft.taxRatePercent ?? 16}
                      onChange={(e) =>
                        update({
                          taxRatePercent: Math.max(
                            0,
                            Math.min(100, Number(e.target.value) || 0)
                          ),
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Etiqueta (ej. IVA, ITBIS)
                    </label>
                    <input
                      type="text"
                      maxLength={20}
                      value={draft.taxLabel || 'IVA'}
                      onChange={(e) => update({ taxLabel: e.target.value })}
                      placeholder="IVA"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Cálculo del impuesto
                    </label>
                    <select
                      value={draft.taxMode || 'included'}
                      onChange={(e) =>
                        update({
                          taxMode: e.target.value as 'included' | 'added',
                        })
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="included">Incluido en precios (desglosar)</option>
                      <option value="added">Sumar IVA al total (+%)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void handleReset()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restaurar Valores
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 rounded-lg cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Guardando...' : 'Guardar Configuración POS'}
              </button>
            </div>
          </div>
        </form>

        {/* Right: Live Preview */}
        <div className="xl:col-span-5 xl:sticky xl:top-20 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-700" />
              <h3 className="text-sm font-semibold text-slate-900">
                Vista Previa en Vivo
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              {draft.productCardSize.toUpperCase()} ·{' '}
              {draft.showProductImages ? `${effectiveImageHeight}px` : 'Sin foto'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 space-y-3">
            {draft.showHeaderBanner && (
              <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 truncate">
                  {draft.posTitle || DEFAULT_POS_SETTINGS.posTitle}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-900 text-white rounded">
                  Escanear
                </span>
              </div>
            )}

            <div className="grid grid-cols-12 gap-2.5 items-start">
              <div
                className={`col-span-12 ${
                  draft.catalogWidthRatio === 'wide' ? 'sm:col-span-8' : 'sm:col-span-7'
                } bg-white border border-slate-200 rounded-lg p-2.5 space-y-2 ${
                  draft.cartPosition === 'left' ? 'sm:order-2' : 'sm:order-1'
                }`}
              >
                {draft.showCategoryTabs && (
                  <div className="flex items-center gap-1 overflow-hidden">
                    <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-900 text-white rounded">
                      Todos
                    </span>
                    <span className="px-2 py-0.5 text-[10px] text-slate-500 bg-slate-100 rounded">
                      Smartphones
                    </span>
                    <span className="px-2 py-0.5 text-[10px] text-slate-500 bg-slate-100 rounded">
                      Accesorios
                    </span>
                  </div>
                )}

                <div className={`grid ${previewColsClass} gap-2`}>
                  {visiblePreviewProducts.map((p) => (
                    <div
                      key={p.id}
                      className={`border rounded-lg overflow-hidden bg-white flex flex-col justify-between ${
                        p.inCart > 0
                          ? 'border-blue-700 ring-1 ring-blue-700/20'
                          : 'border-slate-200'
                      } ${p.stock === 0 ? 'opacity-60' : ''}`}
                    >
                      {draft.showProductImages ? (
                        <div
                          className="relative w-full bg-slate-100 border-b border-slate-100 overflow-hidden"
                          style={{ height: `${effectiveImageHeight}px` }}
                        >
                          <img
                            src={p.img}
                            alt={p.name}
                            className={`w-full h-full ${
                              draft.imageFitMode === 'contain'
                                ? 'object-contain p-1'
                                : 'object-cover'
                            }`}
                          />
                          {draft.showStockBadge && (
                            <span
                              className={`absolute top-1 right-1 px-1 py-0.5 text-[8px] font-mono font-semibold rounded border ${
                                p.stock === 0
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-white/95 text-slate-700 border-slate-200'
                              }`}
                            >
                              {p.stock === 0 ? 'Agotado' : `${p.stock}d`}
                            </span>
                          )}
                          {draft.showCartQtyBadge && p.inCart > 0 && (
                            <span className="absolute top-1 left-1 px-1 py-0.5 text-[8px] font-semibold rounded bg-slate-900 text-white">
                              x{p.inCart}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="px-2 pt-1.5 flex items-center justify-between gap-1">
                          {draft.showCartQtyBadge && p.inCart > 0 ? (
                            <span className="px-1.5 py-0.5 text-[8px] font-semibold rounded bg-slate-900 text-white">
                              x{p.inCart}
                            </span>
                          ) : (
                            <Smartphone className="w-3 h-3 text-slate-300" />
                          )}
                          {draft.showStockBadge && (
                            <span
                              className={`text-[9px] font-mono font-semibold ${
                                p.stock === 0 ? 'text-red-600' : 'text-slate-500'
                              }`}
                            >
                              {p.stock === 0 ? 'Agotado' : `${p.stock} disp.`}
                            </span>
                          )}
                        </div>
                      )}

                      <div
                        className={
                          draft.productCardSize === 'xs'
                            ? 'p-1.5 space-y-0.5'
                            : draft.productCardSize === 'lg'
                              ? 'p-3 space-y-1.5'
                              : 'p-2 space-y-1'
                        }
                      >
                        {draft.showCategoryBadge && (
                          <p className="text-[9px] font-medium text-blue-700 truncate">
                            {p.category}
                          </p>
                        )}
                        <p
                          className={`font-semibold text-slate-900 line-clamp-2 leading-tight ${
                            draft.productCardSize === 'xs'
                              ? 'text-[10px]'
                              : draft.productCardSize === 'lg'
                                ? 'text-xs'
                                : 'text-[11px]'
                          }`}
                        >
                          {p.name}
                        </p>
                        {draft.showBrandModel && (
                          <p className="text-[9px] text-slate-500 truncate">
                            {p.brand} · {p.model}
                          </p>
                        )}
                        {draft.showSkuCode && (
                          <p className="text-[9px] font-mono text-slate-400 truncate">
                            {p.sku}
                          </p>
                        )}
                        <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[9px] text-slate-400">Precio</span>
                          <span
                            className={`font-bold font-mono text-slate-900 ${
                              draft.productCardSize === 'xs'
                                ? 'text-[10px]'
                                : draft.productCardSize === 'lg'
                                  ? 'text-xs'
                                  : 'text-[11px]'
                            }`}
                          >
                            {formatCurrency(p.price)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                className={`col-span-12 ${
                  draft.catalogWidthRatio === 'wide' ? 'sm:col-span-4' : 'sm:col-span-5'
                } bg-white border border-slate-200 rounded-lg p-2.5 space-y-2.5 ${
                  draft.cartPosition === 'left' ? 'sm:order-1' : 'sm:order-2'
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-900 truncate">
                    <ShoppingCart className="w-3 h-3 text-slate-700 shrink-0" />
                    {draft.cartSectionTitle || DEFAULT_POS_SETTINGS.cartSectionTitle}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">3 art.</span>
                </div>

                <div className="space-y-1 text-[10px] text-slate-600">
                  <div className="flex justify-between">
                    <span>Cliente:</span>
                    <span className="font-medium text-slate-800 truncate max-w-[90px]">
                      {draft.defaultCustomerName || 'Cliente Mostrador'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pago:</span>
                    <span className="font-medium text-slate-800">
                      {draft.defaultPaymentMethod}
                    </span>
                  </div>
                  {draft.showQuickPayButtons && (
                    <div className="grid grid-cols-2 gap-1 pt-1">
                      {PAYMENT_METHODS.map((pm) => (
                        <span
                          key={pm}
                          className={`text-center py-0.5 rounded border text-[9px] ${
                            draft.defaultPaymentMethod === pm
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {pm}
                        </span>
                      ))}
                    </div>
                  )}
                  {draft.allowDiscountPanel && (
                    <div className="pt-1 text-[9px] text-blue-700 font-medium inline-flex items-center gap-1">
                      <Plus className="w-2.5 h-2.5" />
                      Descuento habilitado
                    </div>
                  )}
                </div>

                <div className="w-full py-1.5 px-2 text-center text-[10px] font-semibold text-white bg-blue-700 rounded-md truncate">
                  {draft.checkoutButtonLabel ||
                    DEFAULT_POS_SETTINGS.checkoutButtonLabel}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
