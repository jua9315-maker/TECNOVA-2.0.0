import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Eye,
  ImagePlus,
  RotateCcw,
  Save,
  Settings,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  DEFAULT_RECEIPT_SETTINGS,
  getTodayDateKey,
  type ReceiptPaperWidth,
  type ReceiptSettings,
  type Sale,
} from '../types/store';
import { saveStoreReceiptSettings } from '../lib/storeOperations';
import { ReceiptDocument, ReceiptPreviewModal } from './ReceiptPreviewModal';

const SAMPLE_PREVIEW_SALE: Sale = {
  id: 'sample-preview',
  saleNumber: 'VTA-20261119-1042',
  dateKey: getTodayDateKey(),
  customerName: 'Laura Méndez',
  customerPhone: '+52 55 4821 9034',
  paymentMethod: 'Efectivo',
  items: [
    {
      productId: 'sample-1',
      productName: 'iPhone 15 Pro 256GB Titanio',
      sku: 'IPH-15PRO-256',
      quantity: 1,
      unitPrice: 1149,
      costPrice: 890,
      imei: '358491029384712',
      warrantyMonths: 12,
    },
    {
      productId: 'sample-2',
      productName: 'Cargador Rápido GaN 65W',
      sku: 'CAR-GAN65-USBC',
      quantity: 1,
      unitPrice: 39,
      costPrice: 18,
      imei: '',
      warrantyMonths: 6,
    },
  ],
  subtotal: 1188,
  discount: 38,
  taxRate: 16,
  taxAmount: 158.62,
  taxIncluded: true,
  taxLabel: 'IVA',
  total: 1150,
  amountTendered: 1200,
  changeAmount: 50,
  totalCost: 908,
  profit: 242,
  sellerUid: 'local_admin_01',
  sellerName: 'Administrador Principal',
  status: 'Completada',
  storeId: 'nexocell-main',
};

export function ReceiptConfigView({
  settings,
}: {
  settings: ReceiptSettings;
}) {
  const [draft, setDraft] = useState<ReceiptSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [testPreviewOpen, setTestPreviewOpen] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoError(null);

    if (!file.type.startsWith('image/')) {
      setLogoError('Selecciona un archivo de imagen válido (PNG, JPG, WEBP o SVG).');
      return;
    }

    if (file.type === 'image/svg+xml') {
      if (file.size > 150 * 1024) {
        setLogoError('El archivo SVG es demasiado pesado (máximo 150 KB).');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setDraft((prev) => ({
            ...prev,
            logoDataUrl: reader.result as string,
            showLogo: true,
          }));
          setSavedNotice(false);
        }
      };
      reader.readAsDataURL(file);
      return;
    }

    try {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 360;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const targetW = Math.max(1, Math.round(img.width * scale));
          const targetH = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas no disponible');
          ctx.drawImage(img, 0, 0, targetW, targetH);
          const dataUrl = canvas.toDataURL('image/png');
          setDraft((prev) => ({
            ...prev,
            logoDataUrl: dataUrl,
            showLogo: true,
          }));
          setSavedNotice(false);
        } catch {
          setLogoError('No se pudo procesar la imagen del logo.');
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setLogoError('No se pudo cargar la imagen seleccionada.');
      };
      img.src = objectUrl;
    } catch {
      setLogoError('Error al leer la imagen.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);
    try {
      await saveStoreReceiptSettings(draft);
      setSavedNotice(true);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraft({ ...DEFAULT_RECEIPT_SETTINGS });
    setSavedNotice(false);
    setLogoError(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              Diseño del Comprobante de Ventas
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Personaliza los datos de tu tienda, logo, tamaño de ticket y elementos visibles antes de imprimir.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setTestPreviewOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Eye className="w-4 h-4" />
          Probar Impresión
        </button>
      </div>

      {savedNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-2.5 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            Configuración del comprobante guardada en tu equipo. Todas las impresiones de ventas usarán este formato.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Column */}
        <form
          onSubmit={(e) => void handleSave(e)}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
              Encabezado del Negocio y Logo
            </h2>

            {/* Logo Uploader */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-16 h-16 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                  {draft.logoDataUrl ? (
                    <img
                      src={draft.logoDataUrl}
                      alt="Vista previa del logo"
                      className="max-w-full max-h-full object-contain p-1"
                    />
                  ) : (
                    <ImagePlus className="w-6 h-6 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-semibold text-slate-900">
                    Logo del comprobante
                  </p>
                  <p className="text-[11px] text-slate-500">
                    PNG, JPG, WEBP o SVG. Se ajusta automáticamente para ticket térmico o carta.
                  </p>
                  {draft.logoDataUrl && (
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer pt-0.5">
                      <input
                        type="checkbox"
                        checked={draft.showLogo}
                        onChange={(e) => {
                          setDraft({ ...draft, showLogo: e.target.checked });
                          setSavedNotice(false);
                        }}
                        className="rounded border-slate-300"
                      />
                      <span>Mostrar logo al imprimir</span>
                    </label>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => void handleLogoUpload(e)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {draft.logoDataUrl ? 'Cambiar logo' : 'Subir logo'}
                </button>
                {draft.logoDataUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraft({ ...draft, logoDataUrl: '' });
                      setSavedNotice(false);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Quitar logo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {logoError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {logoError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nombre comercial de la tienda
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={draft.businessName}
                  onChange={(e) => {
                    setDraft({ ...draft, businessName: e.target.value });
                    setSavedNotice(false);
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  RFC / NIT / RUC (Opcional)
                </label>
                <input
                  type="text"
                  maxLength={40}
                  value={draft.taxId}
                  onChange={(e) => {
                    setDraft({ ...draft, taxId: e.target.value });
                    setSavedNotice(false);
                  }}
                  placeholder="Ej: NXC240101AB1"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Subtítulo / Giro
              </label>
              <input
                type="text"
                maxLength={100}
                value={draft.tagline}
                onChange={(e) => {
                  setDraft({ ...draft, tagline: e.target.value });
                  setSavedNotice(false);
                }}
                placeholder="Venta de Celulares, Accesorios y Servicio Técnico"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Teléfono / WhatsApp
                </label>
                <input
                  type="text"
                  maxLength={40}
                  value={draft.phone}
                  onChange={(e) => {
                    setDraft({ ...draft, phone: e.target.value });
                    setSavedNotice(false);
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Formato de papel / impresora
                </label>
                <select
                  value={draft.paperWidth}
                  onChange={(e) => {
                    setDraft({
                      ...draft,
                      paperWidth: e.target.value as ReceiptPaperWidth,
                    });
                    setSavedNotice(false);
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
                >
                  <option value="80mm">Ticket Térmico 80mm (Estándar POS)</option>
                  <option value="58mm">Ticket Térmico 58mm (Mini impresora)</option>
                  <option value="A4">Hoja Carta / A4</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Dirección de la sucursal
              </label>
              <input
                type="text"
                maxLength={160}
                value={draft.address}
                onChange={(e) => {
                  setDraft({ ...draft, address: e.target.value });
                  setSavedNotice(false);
                }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
              Datos visibles en el comprobante
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="flex items-center gap-2.5 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={draft.showQrCode}
                  onChange={(e) => {
                    setDraft({ ...draft, showQrCode: e.target.checked });
                    setSavedNotice(false);
                  }}
                  className="rounded border-slate-300"
                />
                <span className="font-medium text-slate-800">
                  Incluir código QR del folio
                </span>
              </label>

              <label className="flex items-center gap-2.5 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={draft.showImei}
                  onChange={(e) => {
                    setDraft({ ...draft, showImei: e.target.checked });
                    setSavedNotice(false);
                  }}
                  className="rounded border-slate-300"
                />
                <span className="font-medium text-slate-800">
                  Mostrar IMEI / Serie de equipos
                </span>
              </label>

              <label className="flex items-center gap-2.5 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={draft.showSeller}
                  onChange={(e) => {
                    setDraft({ ...draft, showSeller: e.target.checked });
                    setSavedNotice(false);
                  }}
                  className="rounded border-slate-300"
                />
                <span className="font-medium text-slate-800">
                  Mostrar nombre del vendedor
                </span>
              </label>

              <label className="flex items-center gap-2.5 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={draft.showWarrantyNote}
                  onChange={(e) => {
                    setDraft({ ...draft, showWarrantyNote: e.target.checked });
                    setSavedNotice(false);
                  }}
                  className="rounded border-slate-300"
                />
                <span className="font-medium text-slate-800">
                  Mostrar meses de garantía
                </span>
              </label>

              <label className="flex items-center gap-2.5 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={draft.showCashChange !== false}
                  onChange={(e) => {
                    setDraft({ ...draft, showCashChange: e.target.checked });
                    setSavedNotice(false);
                  }}
                  className="rounded border-slate-300"
                />
                <span className="font-medium text-slate-800">
                  Mostrar efectivo recibido y cambio
                </span>
              </label>

              <label className="flex items-center gap-2.5 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={draft.showTax !== false}
                  onChange={(e) => {
                    setDraft({ ...draft, showTax: e.target.checked });
                    setSavedNotice(false);
                  }}
                  className="rounded border-slate-300"
                />
                <span className="font-medium text-slate-800">
                  Mostrar desglose de IVA
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <label className="block text-xs font-medium text-slate-700">
              Mensaje de pie / políticas de garantía
            </label>
            <textarea
              rows={3}
              maxLength={320}
              value={draft.footerMessage}
              onChange={(e) => {
                setDraft({ ...draft, footerMessage: e.target.value });
                setSavedNotice(false);
              }}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar Valores
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar Comprobante'}
            </button>
          </div>
        </form>

        {/* Live Saved Receipt Preview Column */}
        <div className="lg:col-span-5 bg-slate-100 border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">
              Vista Previa en Tiempo Real
            </p>
            <span className="text-[11px] font-mono text-slate-500">
              {draft.paperWidth}
            </span>
          </div>
          <ReceiptDocument sale={SAMPLE_PREVIEW_SALE} settings={draft} />
        </div>
      </div>

      {testPreviewOpen && (
        <ReceiptPreviewModal
          sale={SAMPLE_PREVIEW_SALE}
          settings={draft}
          onClose={() => setTestPreviewOpen(false)}
        />
      )}
    </motion.div>
  );
}
