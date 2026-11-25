import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  FileText,
  ImagePlus,
  LayoutList,
  PenTool,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Stamp,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  DEFAULT_WARRANTY_SHEET_SETTINGS,
  DEFAULT_WARRANTY_SHEET_TERMS,
  DEFAULT_WARRANTY_TERM_ITEMS,
  getTodayDateKey,
  resolveWarrantyTermItems,
  type Product,
  type ReceiptSettings,
  type Sale,
  type Warranty,
  type WarrantySheetPaperDensity,
  type WarrantySheetSettings,
  type WarrantyTermItem,
} from '../types/store';
import { saveStoreWarrantySheetSettings } from '../lib/storeOperations';
import {
  WarrantySheetDocument,
  WarrantySheetModal,
} from './WarrantySheetModal';

type EditorFilter = 'all' | 'terms' | 'header' | 'sections' | 'signatures';

const QUICK_PRESET_TERMS: { label: string; text: string }[] = [
  {
    label: '+ Pantalla y golpes',
    text: 'No aplica garantía en pantallas estrelladas, líneas en display, manchas negras por presión o daños ocasionados por golpes o caídas.',
  },
  {
    label: '+ Tiempo de revisión',
    text: 'Todo equipo ingresado a garantía pasará por revisión técnica de 24 a 72 horas hábiles para diagnóstico y validación.',
  },
  {
    label: '+ Respaldo de información',
    text: 'La tienda {negocio} no se hace responsable por pérdida de datos, fotos o aplicaciones; el cliente debe respaldar su información antes de entregar el equipo.',
  },
  {
    label: '+ Cuenta iCloud / Google',
    text: 'Para recibir un equipo en garantía es indispensable entregarlo sin bloqueos de pantalla, iCloud, cuenta Google o reportes de bloqueo.',
  },
];

const SAMPLE_WARRANTY: Warranty = {
  id: 'sample-war-preview',
  warrantyCode: 'GAR-20261120-742',
  saleId: 'sample-sale-preview',
  productId: 'sample-prod-preview',
  productName: 'iPhone 15 Pro 256GB Titanio Natural',
  imei: '358491029384712',
  customerName: 'Laura Méndez',
  customerPhone: '+52 55 4821 9034',
  purchaseDate: getTodayDateKey(),
  expiresDate: '2027-11-20',
  warrantyMonths: 12,
  status: 'Vigente',
  notes: 'Equipo entregado sellado y verificado en mostrador.',
  createdBy: 'local_admin_01',
  storeId: 'nexocell-main',
};

const SAMPLE_PRODUCT: Product = {
  id: 'sample-prod-preview',
  sku: 'IPH-15PRO-256',
  barcode: '7501055301501',
  qrCodeData: 'TECNOVA:SKU=IPH-15PRO-256',
  name: 'iPhone 15 Pro 256GB Titanio Natural',
  brand: 'Apple',
  model: 'iPhone 15 Pro',
  category: 'Smartphones',
  condition: 'Nuevo',
  storage: '256GB',
  color: 'Titanio Natural',
  costPrice: 890,
  salePrice: 1149,
  stock: 6,
  minStock: 2,
  warrantyMonths: 12,
  imeiRequired: true,
  supplier: 'Distribuidor Oficial',
  location: 'Vitrina A1',
  description: '',
  imageUrl: '',
  active: true,
  storeId: 'nexocell-main',
  updatedBy: 'local_admin_01',
};

const SAMPLE_SALE: Sale = {
  id: 'sample-sale-preview',
  saleNumber: 'VTA-20261120-1042',
  dateKey: getTodayDateKey(),
  customerName: 'Laura Méndez',
  customerPhone: '+52 55 4821 9034',
  paymentMethod: 'Efectivo',
  items: [
    {
      productId: 'sample-prod-preview',
      productName: 'iPhone 15 Pro 256GB Titanio Natural',
      sku: 'IPH-15PRO-256',
      quantity: 1,
      unitPrice: 1149,
      costPrice: 890,
      imei: '358491029384712',
      warrantyMonths: 12,
    },
  ],
  subtotal: 1149,
  discount: 0,
  total: 1149,
  totalCost: 890,
  profit: 259,
  sellerUid: 'local_admin_01',
  sellerName: 'Administrador Principal',
  status: 'Completada',
  storeId: 'nexocell-main',
};

function processImageFileToDataUrl(
  file: File,
  maxDim: number,
  onSuccess: (dataUrl: string) => void,
  onError: (msg: string) => void
) {
  if (!file.type.startsWith('image/')) {
    onError('Selecciona una imagen válida (PNG, JPG, WEBP o SVG).');
    return;
  }

  if (file.type === 'image/svg+xml') {
    if (file.size > 150 * 1024) {
      onError('El archivo SVG excede 150 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onSuccess(reader.result);
      }
    };
    reader.readAsDataURL(file);
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    try {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const targetW = Math.max(1, Math.round(img.width * scale));
      const targetH = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas no disponible');
      ctx.drawImage(img, 0, 0, targetW, targetH);
      onSuccess(canvas.toDataURL('image/png'));
    } catch {
      onError('No se pudo procesar la imagen seleccionada.');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };
  img.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    onError('No se pudo cargar la imagen.');
  };
  img.src = objectUrl;
}

function hydrateDraft(settings: WarrantySheetSettings): WarrantySheetSettings {
  const resolved = resolveWarrantyTermItems(settings);
  return {
    ...DEFAULT_WARRANTY_SHEET_SETTINGS,
    ...settings,
    warrantyTerms: resolved,
    termsList: resolved.filter((t) => t.enabled).map((t) => t.text),
  };
}

export function WarrantySheetConfigView({
  settings,
  receiptSettings,
}: {
  settings: WarrantySheetSettings;
  receiptSettings: ReceiptSettings;
}) {
  const [draft, setDraft] = useState<WarrantySheetSettings>(() =>
    hydrateDraft(settings)
  );
  const [activeFilter, setActiveFilter] = useState<EditorFilter>('all');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [newTermText, setNewTermText] = useState('');

  const customLogoRef = useRef<HTMLInputElement | null>(null);
  const stampInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(hydrateDraft(settings));
  }, [settings]);

  const termItems: WarrantyTermItem[] = resolveWarrantyTermItems(draft);
  const enabledTermsCount = termItems.filter((t) => t.enabled).length;

  const updateDraft = (patch: Partial<WarrantySheetSettings>) => {
    setSavedNotice(false);
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const updateTerms = (nextItems: WarrantyTermItem[]) => {
    setSavedNotice(false);
    setDraft((prev) => ({
      ...prev,
      warrantyTerms: nextItems,
      termsList: nextItems
        .filter((t) => t.enabled && t.text.trim())
        .map((t) => t.text),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);
    try {
      let nextItems = resolveWarrantyTermItems(draft);
      const pendingNew = newTermText.trim();
      if (pendingNew) {
        nextItems = [
          ...nextItems,
          {
            id: `term_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            text: pendingNew,
            enabled: true,
          },
        ];
        setNewTermText('');
      }
      const payload: WarrantySheetSettings = {
        ...draft,
        warrantyTerms: nextItems,
        termsList: nextItems
          .filter((t) => t.enabled && t.text.trim())
          .map((t) => t.text),
      };
      const saved = await saveStoreWarrantySheetSettings(payload);
      setDraft(hydrateDraft(saved));
      setSavedNotice(true);
    } finally {
      setSaving(false);
    }
  };

  const handleResetAll = () => {
    setSavedNotice(false);
    setUploadError(null);
    setNewTermText('');
    setDraft({
      ...DEFAULT_WARRANTY_SHEET_SETTINGS,
      termsList: [...DEFAULT_WARRANTY_SHEET_TERMS],
      warrantyTerms: DEFAULT_WARRANTY_TERM_ITEMS.map((t) => ({ ...t })),
    });
  };

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    processImageFileToDataUrl(
      file,
      360,
      (dataUrl) => updateDraft({ customLogoDataUrl: dataUrl, showLogo: true }),
      (msg) => setUploadError(msg)
    );
  };

  const handleStampFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    processImageFileToDataUrl(
      file,
      360,
      (dataUrl) =>
        updateDraft({ authorizedStampDataUrl: dataUrl, showSignatures: true }),
      (msg) => setUploadError(msg)
    );
  };

  const updateTermTextAt = (index: number, value: string) => {
    const next = termItems.map((item, idx) =>
      idx === index ? { ...item, text: value } : item
    );
    updateTerms(next);
  };

  const toggleTermEnabledAt = (index: number) => {
    const next = termItems.map((item, idx) =>
      idx === index ? { ...item, enabled: !item.enabled } : item
    );
    updateTerms(next);
  };

  const moveTerm = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= termItems.length) return;
    const next = [...termItems];
    const [removed] = next.splice(index, 1);
    next.splice(target, 0, removed);
    updateTerms(next);
  };

  const deleteTermAt = (index: number) => {
    updateTerms(termItems.filter((_, idx) => idx !== index));
  };

  const addTerm = (textToAdd?: string) => {
    const clean = (textToAdd ?? newTermText).trim();
    if (!clean) return;
    const next: WarrantyTermItem[] = [
      ...termItems,
      {
        id: `term_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        text: clean,
        enabled: true,
      },
    ];
    updateTerms(next);
    if (textToAdd === undefined) {
      setNewTermText('');
    }
  };

  const showSection = (key: Exclude<EditorFilter, 'all'>) =>
    activeFilter === 'all' || activeFilter === key;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      {/* Top Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Editor Completo de Hoja de Garantía
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Agrega, quita o modifica términos y condiciones de cobertura, encabezados, logotipo, etiquetas de bloques, columnas, sello digital y firmas.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setTestModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            Probar Modal Imprimible
          </button>
          <button
            type="button"
            onClick={handleResetAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Todo
          </button>
        </div>
      </div>

      {savedNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2 text-xs font-medium text-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          Plantilla de Hoja de Garantía guardada correctamente. Todas las garantías nuevas y reimpresas usarán estos cambios.
        </div>
      )}

      {uploadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">
          {uploadError}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Editor Controls */}
        <form
          onSubmit={handleSave}
          className="xl:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden"
        >
          {/* Quick Filter Switcher (All visible by default) */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              Ver Todo
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('terms')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeFilter === 'terms'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Términos ({enabledTermsCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('header')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeFilter === 'header'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              <ImagePlus className="w-3.5 h-3.5" />
              Encabezado
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('sections')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeFilter === 'sections'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              Bloques
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('signatures')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeFilter === 'signatures'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              Firmas y Sello
            </button>
          </div>

          <div className="p-5 space-y-6">
            {/* 1. TÉRMINOS Y CONDICIONES DE COBERTURA (Always visible by default & first!) */}
            {showSection('terms') && (
              <section className="space-y-4 pb-6 border-b border-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-700" />
                      Términos y Condiciones de Cobertura
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Activa, desactiva, edita, reordena, agrega o quita las cláusulas que aparecen en la hoja.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={draft.showTermsSection}
                      onChange={(e) =>
                        updateDraft({ showTermsSection: e.target.checked })
                      }
                      className="rounded border-slate-300 text-blue-700"
                    />
                    Mostrar sección
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Título de la sección
                  </label>
                  <input
                    type="text"
                    value={draft.termsSectionTitle}
                    onChange={(e) =>
                      updateDraft({ termsSectionTitle: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                  />
                </div>

                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-900">
                  Variables automáticas disponibles:{' '}
                  <code className="font-mono font-semibold">{'{meses}'}</code>,{' '}
                  <code className="font-mono font-semibold">{'{fechaCompra}'}</code>,{' '}
                  <code className="font-mono font-semibold">{'{fechaVencimiento}'}</code>,{' '}
                  <code className="font-mono font-semibold">{'{negocio}'}</code>,{' '}
                  <code className="font-mono font-semibold">{'{codigo}'}</code>.
                </div>

                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      Cláusulas ({enabledTermsCount} activas de {termItems.length})
                    </span>
                    <div className="flex items-center gap-3">
                      {termItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => updateTerms([])}
                          className="text-[11px] font-medium text-red-600 hover:underline cursor-pointer"
                        >
                          Quitar todas
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          updateTerms(
                            DEFAULT_WARRANTY_TERM_ITEMS.map((t) => ({ ...t }))
                          )
                        }
                        className="text-[11px] font-medium text-blue-700 hover:underline cursor-pointer"
                      >
                        Restaurar cláusulas base
                      </button>
                    </div>
                  </div>

                  {termItems.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500">
                      No hay términos ni condiciones agregados. Usa el campo de abajo o las plantillas rápidas para agregar cláusulas.
                    </div>
                  ) : (
                    termItems.map((term, idx) => (
                      <div
                        key={term.id}
                        className={`p-3 rounded-xl border space-y-2 transition-colors ${
                          term.enabled
                            ? 'border-slate-200 bg-slate-50/80'
                            : 'border-slate-200 bg-slate-100/70 opacity-70'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={term.enabled}
                              onChange={() => toggleTermEnabledAt(idx)}
                              className="rounded border-slate-300 text-blue-700"
                            />
                            <span className="font-mono">
                              Cláusula #{idx + 1}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                term.enabled
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {term.enabled ? 'Visible en hoja' : 'Oculta'}
                            </span>
                          </label>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveTerm(idx, -1)}
                              className="p-1 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                              title="Subir"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === termItems.length - 1}
                              onClick={() => moveTerm(idx, 1)}
                              className="p-1 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                              title="Bajar"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTermAt(idx)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 rounded cursor-pointer"
                              title="Quitar esta cláusula"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Quitar
                            </button>
                          </div>
                        </div>

                        <textarea
                          rows={2}
                          value={term.text}
                          onChange={(e) =>
                            updateTermTextAt(idx, e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
                        />
                      </div>
                    ))
                  )}

                  {/* Agregar nuevo término */}
                  <div className="p-3.5 rounded-xl border border-dashed border-blue-300 bg-blue-50/40 space-y-2.5">
                    <label className="block text-xs font-semibold text-slate-800">
                      Agregar nuevo término o condición de cobertura
                    </label>
                    <textarea
                      rows={2}
                      value={newTermText}
                      onChange={(e) => setNewTermText(e.target.value)}
                      placeholder="Escribe aquí una nueva condición de garantía..."
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {QUICK_PRESET_TERMS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => addTerm(preset.text)}
                            className="px-2 py-1 text-[11px] font-medium text-blue-800 bg-white border border-blue-200 hover:bg-blue-100 rounded-md transition-colors cursor-pointer"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={!newTermText.trim()}
                        onClick={() => addTerm()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-40 cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Agregar Término
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer">
                      <span>Mostrar cuadro de observaciones</span>
                      <input
                        type="checkbox"
                        checked={draft.showNotesBlock}
                        onChange={(e) =>
                          updateDraft({ showNotesBlock: e.target.checked })
                        }
                        className="rounded border-slate-300 text-blue-700"
                      />
                    </label>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Etiqueta de observaciones
                      </label>
                      <input
                        type="text"
                        value={draft.notesLabel}
                        onChange={(e) =>
                          updateDraft({ notesLabel: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Nota informativa fija adicional (opcional)
                    </label>
                    <textarea
                      rows={2}
                      value={draft.extraInfoNote}
                      onChange={(e) =>
                        updateDraft({ extraInfoNote: e.target.value })
                      }
                      placeholder="Ej. Horario de recepción de garantías: Lunes a Sábado de 10:00 a 19:00 hrs · WhatsApp de soporte: ..."
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* 2. ENCABEZADO Y MARCA */}
            {showSection('header') && (
              <section className="space-y-4 pb-6 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <ImagePlus className="w-4 h-4 text-blue-700" />
                  Encabezado, Logo y Diseño
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer">
                    <span>Mostrar logotipo</span>
                    <input
                      type="checkbox"
                      checked={draft.showLogo}
                      onChange={(e) => updateDraft({ showLogo: e.target.checked })}
                      className="rounded border-slate-300 text-blue-700"
                    />
                  </label>
                  <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer">
                    <span>Mostrar código QR de póliza</span>
                    <input
                      type="checkbox"
                      checked={draft.showQrCode}
                      onChange={(e) =>
                        updateDraft({ showQrCode: e.target.checked })
                      }
                      className="rounded border-slate-300 text-blue-700"
                    />
                  </label>
                </div>

                {/* Logo personalizado */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-900">
                        Logo exclusivo para Hoja de Garantía (opcional)
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Si no subes uno aquí, usará el logo del Comprobante de Ventas.
                      </p>
                    </div>
                    <input
                      ref={customLogoRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFile}
                      className="hidden"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => customLogoRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Subir Logo
                      </button>
                      {draft.customLogoDataUrl && (
                        <button
                          type="button"
                          onClick={() => updateDraft({ customLogoDataUrl: '' })}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                          title="Usar logo del comprobante"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {draft.customLogoDataUrl && (
                    <img
                      src={draft.customLogoDataUrl}
                      alt="Logo garantía"
                      className="h-12 w-auto object-contain bg-white border border-slate-200 rounded-lg p-1.5"
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Etiqueta superior derecha
                    </label>
                    <input
                      type="text"
                      maxLength={50}
                      value={draft.badgeLabel}
                      onChange={(e) =>
                        updateDraft({ badgeLabel: e.target.value })
                      }
                      placeholder="Póliza Oficial"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Título principal del documento
                    </label>
                    <input
                      type="text"
                      maxLength={70}
                      value={draft.documentTitle}
                      onChange={(e) =>
                        updateDraft({ documentTitle: e.target.value })
                      }
                      placeholder="HOJA DE GARANTÍA"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Nombre de tienda (vacío = hereda Comprobante)
                    </label>
                    <input
                      type="text"
                      maxLength={80}
                      value={draft.businessName}
                      onChange={(e) =>
                        updateDraft({ businessName: e.target.value })
                      }
                      placeholder={receiptSettings.businessName}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Eslogan / Giro (vacío = hereda Comprobante)
                    </label>
                    <input
                      type="text"
                      maxLength={100}
                      value={draft.tagline}
                      onChange={(e) => updateDraft({ tagline: e.target.value })}
                      placeholder={receiptSettings.tagline}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Dirección (opcional)
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={draft.address}
                      onChange={(e) => updateDraft({ address: e.target.value })}
                      placeholder={receiptSettings.address || 'Heredar'}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Teléfono (opcional)
                    </label>
                    <input
                      type="text"
                      maxLength={50}
                      value={draft.phone}
                      onChange={(e) => updateDraft({ phone: e.target.value })}
                      placeholder={receiptSettings.phone || 'Heredar'}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      RFC / NIT / ID (opcional)
                    </label>
                    <input
                      type="text"
                      maxLength={50}
                      value={draft.taxId}
                      onChange={(e) => updateDraft({ taxId: e.target.value })}
                      placeholder={receiptSettings.taxId || 'Heredar'}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Color de acento
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={draft.accentColor}
                        onChange={(e) =>
                          updateDraft({ accentColor: e.target.value })
                        }
                        className="h-9 w-12 rounded border border-slate-200 cursor-pointer"
                      />
                      <span className="text-xs font-mono text-slate-600">
                        {draft.accentColor}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Color línea encabezado
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={draft.headerBorderColor}
                        onChange={(e) =>
                          updateDraft({ headerBorderColor: e.target.value })
                        }
                        className="h-9 w-12 rounded border border-slate-200 cursor-pointer"
                      />
                      <span className="text-xs font-mono text-slate-600">
                        {draft.headerBorderColor}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Espaciado / Densidad
                    </label>
                    <select
                      value={draft.paperDensity}
                      onChange={(e) =>
                        updateDraft({
                          paperDensity: e.target
                            .value as WarrantySheetPaperDensity,
                        })
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50"
                    >
                      <option value="compact">Compacto</option>
                      <option value="normal">Normal</option>
                      <option value="spacious">Amplio</option>
                    </select>
                  </div>
                </div>
              </section>
            )}

            {/* 3. BLOQUES Y CAMPOS */}
            {showSection('sections') && (
              <section className="space-y-4 pb-6 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <LayoutList className="w-4 h-4 text-blue-700" />
                  Bloques, Campos y Columnas del Equipo
                </h3>

                {/* Bloque Cliente */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900">
                      Bloque 1: Datos del Cliente y Venta
                    </span>
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.showCustomerSection}
                        onChange={(e) =>
                          updateDraft({ showCustomerSection: e.target.checked })
                        }
                        className="rounded border-slate-300 text-blue-700"
                      />
                      Visible
                    </label>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Título del bloque
                    </label>
                    <input
                      type="text"
                      value={draft.customerSectionTitle}
                      onChange={(e) =>
                        updateDraft({ customerSectionTitle: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        Etiqueta Cliente
                      </label>
                      <input
                        type="text"
                        value={draft.customerNameLabel}
                        onChange={(e) =>
                          updateDraft({ customerNameLabel: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-slate-500">
                          Etiqueta Teléfono
                        </label>
                        <input
                          type="checkbox"
                          checked={draft.showCustomerPhone}
                          onChange={(e) =>
                            updateDraft({ showCustomerPhone: e.target.checked })
                          }
                          title="Mostrar teléfono"
                        />
                      </div>
                      <input
                        type="text"
                        value={draft.customerPhoneLabel}
                        onChange={(e) =>
                          updateDraft({ customerPhoneLabel: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-slate-500">
                          Etiqueta Folio Venta
                        </label>
                        <input
                          type="checkbox"
                          checked={draft.showSaleFolio}
                          onChange={(e) =>
                            updateDraft({ showSaleFolio: e.target.checked })
                          }
                          title="Mostrar folio de venta"
                        />
                      </div>
                      <input
                        type="text"
                        value={draft.saleFolioLabel}
                        onChange={(e) =>
                          updateDraft({ saleFolioLabel: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-slate-500">
                          Etiqueta Vendedor
                        </label>
                        <input
                          type="checkbox"
                          checked={draft.showSellerName}
                          onChange={(e) =>
                            updateDraft({ showSellerName: e.target.checked })
                          }
                          title="Mostrar vendedor"
                        />
                      </div>
                      <input
                        type="text"
                        value={draft.sellerNameLabel}
                        onChange={(e) =>
                          updateDraft({ sellerNameLabel: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Bloque Cobertura */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900">
                      Bloque 2: Cobertura y Vigencia
                    </span>
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.showCoverageSection}
                        onChange={(e) =>
                          updateDraft({ showCoverageSection: e.target.checked })
                        }
                        className="rounded border-slate-300 text-blue-700"
                      />
                      Visible
                    </label>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Título del bloque
                    </label>
                    <input
                      type="text"
                      value={draft.coverageSectionTitle}
                      onChange={(e) =>
                        updateDraft({ coverageSectionTitle: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-slate-500">
                          Etiqueta Fecha Compra
                        </label>
                        <input
                          type="checkbox"
                          checked={draft.showPurchaseDate}
                          onChange={(e) =>
                            updateDraft({ showPurchaseDate: e.target.checked })
                          }
                        />
                      </div>
                      <input
                        type="text"
                        value={draft.purchaseDateLabel}
                        onChange={(e) =>
                          updateDraft({ purchaseDateLabel: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-slate-500">
                          Etiqueta Vencimiento
                        </label>
                        <input
                          type="checkbox"
                          checked={draft.showExpiresDate}
                          onChange={(e) =>
                            updateDraft({ showExpiresDate: e.target.checked })
                          }
                        />
                      </div>
                      <input
                        type="text"
                        value={draft.expiresDateLabel}
                        onChange={(e) =>
                          updateDraft({ expiresDateLabel: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-slate-500">
                          Etiqueta Duración
                        </label>
                        <input
                          type="checkbox"
                          checked={draft.showDuration}
                          onChange={(e) =>
                            updateDraft({ showDuration: e.target.checked })
                          }
                        />
                      </div>
                      <input
                        type="text"
                        value={draft.durationLabel}
                        onChange={(e) =>
                          updateDraft({ durationLabel: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-slate-500">
                          Etiqueta Estado
                        </label>
                        <input
                          type="checkbox"
                          checked={draft.showStatus}
                          onChange={(e) =>
                            updateDraft({ showStatus: e.target.checked })
                          }
                        />
                      </div>
                      <input
                        type="text"
                        value={draft.statusLabel}
                        onChange={(e) =>
                          updateDraft({ statusLabel: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Bloque Equipo */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900">
                      Bloque 3: Tabla del Equipo Cubierto
                    </span>
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.showDeviceSection}
                        onChange={(e) =>
                          updateDraft({ showDeviceSection: e.target.checked })
                        }
                        className="rounded border-slate-300 text-blue-700"
                      />
                      Visible
                    </label>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Título del bloque
                    </label>
                    <input
                      type="text"
                      value={draft.deviceSectionTitle}
                      onChange={(e) =>
                        updateDraft({ deviceSectionTitle: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        Columna Equipo
                      </label>
                      <input
                        type="text"
                        value={draft.deviceColumnHeader}
                        onChange={(e) =>
                          updateDraft({ deviceColumnHeader: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-slate-500">
                          Columna IMEI / Serie
                        </label>
                        <input
                          type="checkbox"
                          checked={draft.showImeiColumn}
                          onChange={(e) =>
                            updateDraft({ showImeiColumn: e.target.checked })
                          }
                        />
                      </div>
                      <input
                        type="text"
                        value={draft.imeiColumnHeader}
                        onChange={(e) =>
                          updateDraft({ imeiColumnHeader: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-slate-500">
                          Columna Especificaciones
                        </label>
                        <input
                          type="checkbox"
                          checked={draft.showSpecsColumn}
                          onChange={(e) =>
                            updateDraft({ showSpecsColumn: e.target.checked })
                          }
                        />
                      </div>
                      <input
                        type="text"
                        value={draft.specsColumnHeader}
                        onChange={(e) =>
                          updateDraft({ specsColumnHeader: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-slate-500">
                          Columna Valor / Precio
                        </label>
                        <input
                          type="checkbox"
                          checked={draft.showPriceColumn}
                          onChange={(e) =>
                            updateDraft({ showPriceColumn: e.target.checked })
                          }
                        />
                      </div>
                      <input
                        type="text"
                        value={draft.priceColumnHeader}
                        onChange={(e) =>
                          updateDraft({ priceColumnHeader: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-slate-700 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.showBrandAndCondition}
                      onChange={(e) =>
                        updateDraft({ showBrandAndCondition: e.target.checked })
                      }
                      className="rounded border-slate-300 text-blue-700"
                    />
                    Mostrar marca, modelo y condición debajo del nombre del producto
                  </label>
                </div>
              </section>
            )}

            {/* 4. FIRMAS Y SELLO */}
            {showSection('signatures') && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <PenTool className="w-4 h-4 text-blue-700" />
                    Firmas, Sello Digital y Pie de Página
                  </h3>
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.showSignatures}
                      onChange={(e) =>
                        updateDraft({ showSignatures: e.target.checked })
                      }
                      className="rounded border-slate-300 text-blue-700"
                    />
                    Mostrar firmas
                  </label>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <p className="text-xs font-semibold text-slate-900">
                    Firma Izquierda (Cliente)
                  </p>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Texto sobre/bajo línea izquierda
                    </label>
                    <input
                      type="text"
                      value={draft.customerSignatureLabel}
                      onChange={(e) =>
                        updateDraft({ customerSignatureLabel: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.includeCustomerNameInSignature}
                      onChange={(e) =>
                        updateDraft({
                          includeCustomerNameInSignature: e.target.checked,
                        })
                      }
                      className="rounded border-slate-300 text-blue-700"
                    />
                    Incluir nombre del cliente entre paréntesis automáticamente
                  </label>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Subtítulo de aceptación
                    </label>
                    <input
                      type="text"
                      value={draft.customerSignatureSubtext}
                      onChange={(e) =>
                        updateDraft({ customerSignatureSubtext: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <p className="text-xs font-semibold text-slate-900">
                    Firma Derecha (Tienda y Sello)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        Texto de firma autorizada
                      </label>
                      <input
                        type="text"
                        value={draft.storeSignatureLabel}
                        onChange={(e) =>
                          updateDraft({ storeSignatureLabel: e.target.value })
                        }
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        Prefijo de validación inferior
                      </label>
                      <input
                        type="text"
                        value={draft.storeSignatureSubtext}
                        onChange={(e) =>
                          updateDraft({ storeSignatureSubtext: e.target.value })
                        }
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-slate-800">
                        Sello o firma digital (PNG/SVG opcional)
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Aparece centrado encima de la línea autorizada.
                      </p>
                    </div>
                    <input
                      ref={stampInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleStampFile}
                      className="hidden"
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => stampInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        <Stamp className="w-3.5 h-3.5" />
                        Subir Sello
                      </button>
                      {draft.authorizedStampDataUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            updateDraft({ authorizedStampDataUrl: '' })
                          }
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                          title="Quitar sello"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Pie de página / Aviso legal final (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={draft.footerDisclaimer}
                    onChange={(e) =>
                      updateDraft({ footerDisclaimer: e.target.value })
                    }
                    placeholder="Ej. Documento emitido electrónicamente · Válido únicamente con código QR legible."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
                  />
                </div>
              </section>
            )}

            {/* Save bar */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white py-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar Cambios de Hoja de Garantía'}
              </button>
            </div>
          </div>
        </form>

        {/* Right Live Preview */}
        <div className="xl:col-span-6 space-y-3 xl:sticky xl:top-20">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Vista Previa en Tiempo Real
            </p>
            <span className="text-[11px] text-slate-500">
              Cualquier cambio se refleja al instante
            </span>
          </div>
          <div className="bg-slate-200/70 border border-slate-300/80 rounded-2xl p-4 sm:p-5 overflow-x-auto">
            <WarrantySheetDocument
              warranty={SAMPLE_WARRANTY}
              sale={SAMPLE_SALE}
              product={SAMPLE_PRODUCT}
              settings={receiptSettings}
              warrantySettings={draft}
              isLast
            />
          </div>
        </div>
      </div>

      {testModalOpen && (
        <WarrantySheetModal
          warranties={[SAMPLE_WARRANTY]}
          sale={SAMPLE_SALE}
          products={[SAMPLE_PRODUCT]}
          settings={receiptSettings}
          warrantySettings={draft}
          onClose={() => setTestModalOpen(false)}
        />
      )}
    </motion.div>
  );
}
