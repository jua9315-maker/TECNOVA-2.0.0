import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Coins,
  ImagePlus,
  LayoutDashboard,
  Package,
  Palette,
  QrCode,
  RotateCcw,
  Save,
  ShoppingCart,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import {
  APP_CURRENCY_OPTIONS,
  DEFAULT_APP_APPEARANCE_SETTINGS,
  applyBackgroundOpacity,
  extractHexStops,
  extractPrimaryHex,
  formatCurrency,
  getLoginFontFamilyCss,
  isCssGradient,
  isHexColorDark,
  type AppAppearanceSettings,
  type AppCurrencyCode,
  type LoginFontStyle,
  type LoginPresentationSettings,
  type ReceiptSettings,
} from '../types/store';
import { saveStoreAppAppearanceSettings } from '../lib/storeOperations';

const THEME_PRESETS: {
  id: string;
  label: string;
  patch: Partial<AppAppearanceSettings>;
}[] = [
  {
    id: 'classic',
    label: 'Estudio Clásico',
    patch: {
      accentColor: '#1d4ed8',
      primaryColor: '#0f172a',
      sidebarBgColor: '#ffffff',
      headerBgColor: '#ffffff',
      canvasBgColor: '#f8fafc',
    },
  },
  {
    id: 'dark-sidebar',
    label: 'Barra Oscura Pro',
    patch: {
      accentColor: '#2563eb',
      primaryColor: '#2563eb',
      sidebarBgColor: '#0f172a',
      headerBgColor: '#ffffff',
      canvasBgColor: '#f8fafc',
    },
  },
  {
    id: 'emerald',
    label: 'Esmeralda Retail',
    patch: {
      accentColor: '#047857',
      primaryColor: '#064e3b',
      sidebarBgColor: '#ffffff',
      headerBgColor: '#ffffff',
      canvasBgColor: '#f8fafc',
    },
  },
  {
    id: 'navy',
    label: 'Azul Ejecutivo',
    patch: {
      accentColor: '#1d4ed8',
      primaryColor: '#1e3a8a',
      sidebarBgColor: '#172554',
      headerBgColor: '#ffffff',
      canvasBgColor: '#f1f5f9',
    },
  },
  {
    id: 'aurora-studio',
    label: 'Aurora Multicolor',
    patch: {
      accentColor: '#6d28d9',
      primaryColor: 'linear-gradient(135deg, #6d28d9 0%, #2563eb 100%)',
      sidebarBgColor: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)',
      headerBgColor: 'linear-gradient(90deg, #ffffff 0%, #eef2ff 100%)',
      canvasBgColor: 'linear-gradient(135deg, #eef2ff 0%, #f0f9ff 50%, #fdf4ff 100%)',
    },
  },
  {
    id: 'sunset-prism',
    label: 'Atardecer Pastel',
    patch: {
      accentColor: '#e11d48',
      primaryColor: 'linear-gradient(135deg, #be123c 0%, #ea580c 100%)',
      sidebarBgColor: 'linear-gradient(180deg, #fff1f2 0%, #fff7ed 100%)',
      headerBgColor: '#ffffff',
      canvasBgColor: 'linear-gradient(135deg, #fff1f2 0%, #fefce8 55%, #f0f9ff 100%)',
    },
  },
];

const FONT_OPTIONS: {
  id: LoginFontStyle;
  label: string;
  sample: string;
  css: string;
}[] = [
  { id: 'modern', label: 'Moderna Sans', sample: 'Aa Bb 123', css: 'var(--font-sans)' },
  { id: 'geometric', label: 'Geométrica', sample: 'Aa Bb 123', css: 'var(--font-geometric)' },
  { id: 'editorial', label: 'Editorial Clásica', sample: 'Aa Bb 123', css: 'var(--font-serif-display)' },
  { id: 'technical', label: 'Técnica Mono', sample: 'Aa Bb 123', css: 'var(--font-mono)' },
];

const ACCENT_PALETTE = [
  '#1d4ed8', '#2563eb', '#0284c7', '#0891b2',
  '#047857', '#059669', '#65a30d', '#ca8a04',
  '#d97706', '#ea580c', '#dc2626', '#be123c',
  '#db2777', '#9333ea', '#6d28d9', '#0f172a',
];

const PRIMARY_PALETTE = [
  '#0f172a', '#1e293b', '#1e3a8a', '#1d4ed8',
  '#0369a1', '#0f766e', '#064e3b', '#047857',
  '#3f6212', '#92400e', '#9a3412', '#991b1b',
  '#881337', '#86198f', '#4c1d95', '#312e81',
];

const SIDEBAR_PALETTE = [
  '#ffffff', '#f8fafc', '#f1f5f9', '#eff6ff',
  '#ecfdf5', '#fefce8', '#fdf2f8', '#f5f3ff',
  '#0f172a', '#1e293b', '#172554', '#042f2e',
  '#064e3b', '#3b0764', '#4c0519', '#18181b',
];

const HEADER_PALETTE = [
  '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0',
  '#eff6ff', '#ecfeff', '#ecfdf5', '#fefce8',
  '#fff1f2', '#faf5ff', '#0f172a', '#1e293b',
  '#172554', '#064e3b', '#3b0764', '#18181b',
];

const CANVAS_PALETTE = [
  '#f8fafc', '#f1f5f9', '#fafaf9', '#ffffff',
  '#eff6ff', '#f0f9ff', '#ecfeff', '#f0fdf4',
  '#fefce8', '#fff7ed', '#fff1f2', '#fdf4ff',
  '#f5f3ff', '#e2e8f0', '#0f172a', '#18181b',
];

type GradientPreset = {
  label: string;
  css: string;
};

const DARK_OR_VIVID_GRADIENTS: GradientPreset[] = [
  { label: 'Índigo Eléctrico', css: 'linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)' },
  { label: 'Océano Profundo', css: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)' },
  { label: 'Esmeralda Viva', css: 'linear-gradient(135deg, #047857 0%, #0d9488 100%)' },
  { label: 'Atardecer Coral', css: 'linear-gradient(135deg, #e11d48 0%, #f59e0b 100%)' },
  { label: 'Neón Cibernético', css: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #9333ea 100%)' },
  { label: 'Noche Galaxia', css: 'linear-gradient(180deg, #090d16 0%, #1e1b4b 55%, #312e81 100%)' },
  { label: 'Bosque Nocturno', css: 'linear-gradient(180deg, #022c22 0%, #064e3b 55%, #0f766e 100%)' },
  { label: 'Prisma Arcoíris', css: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #06b6d4 100%)' },
];

const LIGHT_OR_SOFT_GRADIENTS: GradientPreset[] = [
  { label: 'Aurora Pastel', css: 'linear-gradient(135deg, #eef2ff 0%, #e0f2fe 50%, #fae8ff 100%)' },
  { label: 'Brisa Menta', css: 'linear-gradient(135deg, #ecfdf5 0%, #e0f2fe 100%)' },
  { label: 'Atardecer Suave', css: 'linear-gradient(135deg, #fff1f2 0%, #fef3c7 55%, #e0e7ff 100%)' },
  { label: 'Cielo Lavanda', css: 'linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%)' },
  { label: 'Durazno Claro', css: 'linear-gradient(135deg, #fff7ed 0%, #fce7f3 100%)' },
  { label: 'Cristal Nórdico', css: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' },
  { label: 'Océano Vivo', css: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #0e7490 100%)' },
  { label: 'Prisma Vibrante', css: 'linear-gradient(135deg, #dbeafe 0%, #fce7f3 50%, #fef9c3 100%)' },
];

type GradientDirection = '135deg' | '90deg' | '180deg' | 'radial';

const GRADIENT_DIRECTIONS: { id: GradientDirection; label: string }[] = [
  { id: '135deg', label: '↘ Diagonal' },
  { id: '90deg', label: '→ Horizontal' },
  { id: '180deg', label: '↓ Vertical' },
  { id: 'radial', label: '◎ Radial' },
];

function detectGradientDirection(css: string): GradientDirection {
  if (/radial-gradient/i.test(css)) return 'radial';
  if (/90deg/i.test(css)) return '90deg';
  if (/180deg/i.test(css)) return '180deg';
  return '135deg';
}

function buildCssGradient(
  direction: GradientDirection,
  c1: string,
  c2: string,
  c3?: string
): string {
  const stops = c3
    ? `${c1} 0%, ${c2} 50%, ${c3} 100%`
    : `${c1} 0%, ${c2} 100%`;
  if (direction === 'radial') {
    return `radial-gradient(circle at top left, ${stops})`;
  }
  return `linear-gradient(${direction}, ${stops})`;
}

function readLogoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecciona una imagen válida (PNG, JPG, WEBP o SVG).'));
      return;
    }
    if (file.type === 'image/svg+xml') {
      if (file.size > 150 * 1024) {
        reject(new Error('El SVG supera los 150 KB permitidos.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('No se pudo leer el archivo SVG.'));
      reader.onerror = () => reject(new Error('No se pudo leer el archivo SVG.'));
      reader.readAsDataURL(file);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 240;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas no disponible.'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        reject(new Error('No se pudo procesar la imagen del logo.'));
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo cargar la imagen.'));
    };
    img.src = objectUrl;
  });
}

function ColorPaletteField({
  label,
  value,
  palette,
  gradientPresets,
  allowGradient = true,
  defaultGradientStops,
  onChange,
}: {
  label: string;
  value: string;
  palette: string[];
  gradientPresets?: GradientPreset[];
  allowGradient?: boolean;
  defaultGradientStops: [string, string];
  onChange: (nextValue: string) => void;
}) {
  const valueIsGradient = isCssGradient(value);
  const [mode, setMode] = useState<'solid' | 'gradient'>(
    allowGradient && valueIsGradient ? 'gradient' : 'solid'
  );
  const [hexDraft, setHexDraft] = useState(() =>
    extractPrimaryHex(value, palette[0] || '#0f172a')
  );

  const stops = extractHexStops(value);
  const c1 = stops[0] || extractPrimaryHex(value, defaultGradientStops[0]);
  const c2 = stops[1] || defaultGradientStops[1];
  const c3 = stops[2] || '';
  const direction = valueIsGradient ? detectGradientDirection(value) : '135deg';

  useEffect(() => {
    if (allowGradient && isCssGradient(value)) {
      setMode('gradient');
    } else if (!isCssGradient(value)) {
      setMode('solid');
      setHexDraft(extractPrimaryHex(value, palette[0] || '#0f172a'));
    }
  }, [value, allowGradient, palette]);

  const solidPickerValue = extractPrimaryHex(value, palette[0] || '#0f172a');

  const handleHexInputChange = (raw: string) => {
    setHexDraft(raw);
    const trimmed = raw.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
      onChange(trimmed.toLowerCase());
    } else if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
      const c = trimmed.slice(1).toLowerCase();
      onChange(`#${c[0]}${c[0]}${c[1]}${c[1]}${c[2]}${c[2]}`);
    }
  };

  return (
    <div className="p-3.5 border border-slate-200 rounded-xl space-y-3 bg-white">
      {/* Header row with live swatch preview */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-7 h-7 rounded-lg border border-slate-300 shadow-2xs shrink-0"
            style={{ background: value }}
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 truncate">
              {label}
            </p>
            <p className="text-[10px] font-mono text-slate-500 truncate">
              {valueIsGradient ? 'Fondo multicolor' : solidPickerValue.toUpperCase()}
            </p>
          </div>
        </div>

        {allowGradient && (
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setMode('solid')}
              className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                mode === 'solid'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Color
            </button>
            <button
              type="button"
              onClick={() => setMode('gradient')}
              className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                mode === 'gradient'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Multicolor
            </button>
          </div>
        )}
      </div>

      {mode === 'solid' ? (
        <div className="space-y-2.5">
          {/* Full curated palette grid */}
          <div className="grid grid-cols-8 gap-1.5">
            {palette.map((hex) => {
              const selected =
                !valueIsGradient &&
                value.toLowerCase() === hex.toLowerCase();
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => onChange(hex)}
                  style={{ backgroundColor: hex }}
                  className={`h-6 w-full rounded-md border transition-transform hover:scale-105 ${
                    selected
                      ? 'ring-2 ring-slate-900 ring-offset-1 border-white'
                      : 'border-slate-300/80'
                  }`}
                  title={hex}
                  aria-label={`${label}: ${hex}`}
                />
              );
            })}
          </div>

          {/* Custom color wheel + free HEX input */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
            <label className="relative inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer shrink-0">
              <input
                type="color"
                value={solidPickerValue}
                onChange={(e) => onChange(e.target.value)}
                className="w-4 h-4 rounded border-0 p-0 bg-transparent cursor-pointer"
                aria-label={`Elegir color personalizado para ${label}`}
              />
              <span>Elegir</span>
            </label>
            <input
              type="text"
              value={hexDraft}
              onChange={(e) => handleHexInputChange(e.target.value)}
              onBlur={() =>
                setHexDraft(extractPrimaryHex(value, palette[0] || '#0f172a'))
              }
              maxLength={7}
              placeholder="#1d4ed8"
              className="flex-1 min-w-0 px-2.5 py-1.5 text-[11px] font-mono uppercase border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-600"
              aria-label={`Código HEX para ${label}`}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* Multicolor gradient presets */}
          {gradientPresets && gradientPresets.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5">
              {gradientPresets.map((preset) => {
                const selected =
                  value.trim().toLowerCase() === preset.css.toLowerCase();
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onChange(preset.css)}
                    style={{ background: preset.css }}
                    className={`h-7 rounded-md border transition-transform hover:scale-[1.03] ${
                      selected
                        ? 'ring-2 ring-slate-900 ring-offset-1 border-white'
                        : 'border-slate-300/80'
                    }`}
                    title={preset.label}
                    aria-label={preset.label}
                  />
                );
              })}
            </div>
          )}

          {/* Custom multicolor gradient builder */}
          <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                Mezcla personalizada
              </span>
              <div className="flex items-center gap-1">
                {GRADIENT_DIRECTIONS.map((dir) => (
                  <button
                    key={dir.id}
                    type="button"
                    onClick={() =>
                      onChange(buildCssGradient(dir.id, c1, c2, c3 || undefined))
                    }
                    className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors ${
                      direction === dir.id
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                    title={dir.label}
                  >
                    {dir.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-md cursor-pointer text-[11px] font-mono text-slate-700">
                <input
                  type="color"
                  value={c1}
                  onChange={(e) =>
                    onChange(
                      buildCssGradient(
                        direction,
                        e.target.value,
                        c2,
                        c3 || undefined
                      )
                    )
                  }
                  className="w-4 h-4 rounded border-0 p-0 bg-transparent cursor-pointer"
                  aria-label="Color 1 del fondo"
                />
                <span>1</span>
              </label>

              <label className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-md cursor-pointer text-[11px] font-mono text-slate-700">
                <input
                  type="color"
                  value={c2}
                  onChange={(e) =>
                    onChange(
                      buildCssGradient(
                        direction,
                        c1,
                        e.target.value,
                        c3 || undefined
                      )
                    )
                  }
                  className="w-4 h-4 rounded border-0 p-0 bg-transparent cursor-pointer"
                  aria-label="Color 2 del fondo"
                />
                <span>2</span>
              </label>

              {c3 ? (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-md text-[11px] font-mono text-slate-700">
                  <input
                    type="color"
                    value={c3}
                    onChange={(e) =>
                      onChange(
                        buildCssGradient(direction, c1, c2, e.target.value)
                      )
                    }
                    className="w-4 h-4 rounded border-0 p-0 bg-transparent cursor-pointer"
                    aria-label="Color 3 del fondo"
                  />
                  <span>3</span>
                  <button
                    type="button"
                    onClick={() => onChange(buildCssGradient(direction, c1, c2))}
                    className="ml-0.5 text-slate-400 hover:text-red-600 font-sans font-bold"
                    title="Quitar 3er color"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onChange(buildCssGradient(direction, c1, c2, '#ec4899'))
                  }
                  className="px-2 py-1 text-[10px] font-medium text-slate-700 bg-white border border-dashed border-slate-300 hover:border-slate-500 rounded-md"
                >
                  + 3er color
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppAppearanceConfigView({
  settings,
  receiptSettings,
  loginSettings,
}: {
  settings: AppAppearanceSettings;
  receiptSettings: ReceiptSettings;
  loginSettings: LoginPresentationSettings;
}) {
  const [draft, setDraft] = useState<AppAppearanceSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      '--app-surface-opacity',
      String((draft.surfaceOpacityPercent ?? 78) / 100)
    );
    return () => {
      root.style.setProperty(
        '--app-surface-opacity',
        String((settings.surfaceOpacityPercent ?? 78) / 100)
      );
    };
  }, [draft.surfaceOpacityPercent, settings.surfaceOpacityPercent]);

  const updateDraft = (patch: Partial<AppAppearanceSettings>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    if (patch.surfaceOpacityPercent !== undefined) {
      document.documentElement.style.setProperty(
        '--app-surface-opacity',
        String(patch.surfaceOpacityPercent / 100)
      );
    }
    setSavedNotice(false);
    setSaveError(null);
    setLogoError(null);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await readLogoFile(file);
      updateDraft({ logoDataUrl: dataUrl, showLogoInSidebar: true });
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Error al subir el logo.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);
    setSaveError(null);
    try {
      const normalized = await saveStoreAppAppearanceSettings(draft);
      setDraft(normalized);
      setSavedNotice(true);
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar la apariencia de la aplicación.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraft({ ...DEFAULT_APP_APPEARANCE_SETTINGS });
    setSavedNotice(false);
    setSaveError(null);
    setLogoError(null);
  };

  const previewSidebarDark = isHexColorDark(draft.sidebarBgColor);
  const previewHeaderDark = isHexColorDark(draft.headerBgColor);
  const previewPrimaryDark = isHexColorDark(draft.primaryColor);
  const previewAccentHex = extractPrimaryHex(draft.accentColor, '#1d4ed8');
  const previewAccentDark = isHexColorDark(previewAccentHex);
  const previewFontCss = getLoginFontFamilyCss(draft.fontStyle);

  const previewCurrencyLabel = formatCurrency(1249.5, draft.currencyCode);

  const availableOtherLogo =
    loginSettings.logoDataUrl || receiptSettings.logoDataUrl || '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      {savedNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-2.5 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            Configuración general guardada. El nombre, colores, transparencia, tipografía y moneda ya están aplicados en toda la aplicación.
          </span>
        </div>
      )}

      {logoError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-700">
          {logoError}
        </div>
      )}

      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-700">
          {saveError}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={(e) => void handleSave(e)}
          className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6"
        >
          {/* Section 1: App Name & Logo */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Nombre de la Aplicación y Logo Lateral
              </h2>
              {availableOtherLogo && (
                <button
                  type="button"
                  onClick={() =>
                    updateDraft({
                      logoDataUrl: availableOtherLogo,
                      showLogoInSidebar: true,
                    })
                  }
                  className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
                >
                  Copiar logo guardado
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nombre completo de la aplicación
                </label>
                <input
                  type="text"
                  required
                  maxLength={50}
                  value={draft.appName}
                  onChange={(e) => updateDraft({ appName: e.target.value })}
                  placeholder="Ej: TECNOVA"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nombre corto (barra superior y pestaña)
                </label>
                <input
                  type="text"
                  required
                  maxLength={24}
                  value={draft.shortName}
                  onChange={(e) => updateDraft({ shortName: e.target.value })}
                  placeholder="Ej: TECNOVA"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                  {draft.logoDataUrl ? (
                    <img
                      src={draft.logoDataUrl}
                      alt="Logo de la aplicación"
                      className="max-w-full max-h-full object-contain p-1"
                    />
                  ) : (
                    <ImagePlus className="w-5 h-5 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-semibold text-slate-900">
                    Ícono / logo en menú lateral
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Aparece junto al nombre en el menú izquierdo del sistema.
                  </p>
                  {draft.logoDataUrl && (
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.showLogoInSidebar}
                        onChange={(e) =>
                          updateDraft({ showLogoInSidebar: e.target.checked })
                        }
                        className="rounded border-slate-300"
                      />
                      <span>Mostrar logo en menú</span>
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
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {draft.logoDataUrl ? 'Cambiar' : 'Subir logo'}
                </button>
                {draft.logoDataUrl && (
                  <button
                    type="button"
                    onClick={() => updateDraft({ logoDataUrl: '' })}
                    className="inline-flex items-center px-2.5 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg"
                    title="Quitar logo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Quick Themes & Global Colors */}
          <div className="space-y-4 pt-2">
            <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Palette className="w-4 h-4 text-blue-700" />
              Temas Rápidos y Paleta de Colores / Fondos Multicolor
            </h2>

            <div>
              <p className="text-xs font-medium text-slate-700 mb-2">
                Combinaciones listas en un clic
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {THEME_PRESETS.map((preset) => {
                  const active =
                    draft.accentColor.toLowerCase() ===
                      preset.patch.accentColor?.toLowerCase() &&
                    draft.sidebarBgColor.toLowerCase() ===
                      preset.patch.sidebarBgColor?.toLowerCase() &&
                    draft.primaryColor.toLowerCase() ===
                      preset.patch.primaryColor?.toLowerCase();
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => updateDraft(preset.patch)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-colors ${
                        active
                          ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center -space-x-1 shrink-0">
                        <span
                          className="w-4 h-4 rounded-full border border-white"
                          style={{ background: preset.patch.sidebarBgColor }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-white"
                          style={{ background: preset.patch.primaryColor }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-white"
                          style={{ background: preset.patch.accentColor }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-800 truncate">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <ColorPaletteField
                label="Color de acento"
                value={draft.accentColor}
                palette={ACCENT_PALETTE}
                allowGradient={false}
                defaultGradientStops={['#1d4ed8', '#6d28d9']}
                onChange={(val) => updateDraft({ accentColor: val })}
              />
              <ColorPaletteField
                label="Menú activo / principal"
                value={draft.primaryColor}
                palette={PRIMARY_PALETTE}
                gradientPresets={DARK_OR_VIVID_GRADIENTS}
                defaultGradientStops={['#1d4ed8', '#6d28d9']}
                onChange={(val) => updateDraft({ primaryColor: val })}
              />
              <ColorPaletteField
                label="Fondo barra lateral"
                value={draft.sidebarBgColor}
                palette={SIDEBAR_PALETTE}
                gradientPresets={DARK_OR_VIVID_GRADIENTS}
                defaultGradientStops={['#0f172a', '#1e3a8a']}
                onChange={(val) => updateDraft({ sidebarBgColor: val })}
              />
              <ColorPaletteField
                label="Fondo barra superior"
                value={draft.headerBgColor}
                palette={HEADER_PALETTE}
                gradientPresets={LIGHT_OR_SOFT_GRADIENTS}
                defaultGradientStops={['#ffffff', '#e0e7ff']}
                onChange={(val) => updateDraft({ headerBgColor: val })}
              />
              <div className="md:col-span-2">
                <ColorPaletteField
                  label="Fondo área de trabajo"
                  value={draft.canvasBgColor}
                  palette={CANVAS_PALETTE}
                  gradientPresets={LIGHT_OR_SOFT_GRADIENTS}
                  defaultGradientStops={['#eef2ff', '#fae8ff']}
                  onChange={(val) => updateDraft({ canvasBgColor: val })}
                />
              </div>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label
                    htmlFor="app-surface-opacity"
                    className="text-xs font-semibold text-slate-900"
                  >
                    Opacidad global de la interfaz
                  </label>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Ajusta la transparencia de tarjetas, paneles y barras. El texto mantiene su opacidad normal.
                  </p>
                </div>
                <span className="shrink-0 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-mono font-semibold text-slate-700">
                  {draft.surfaceOpacityPercent}%
                </span>
              </div>
              <input
                id="app-surface-opacity"
                type="range"
                min={35}
                max={100}
                step={1}
                value={draft.surfaceOpacityPercent}
                onChange={(e) =>
                  updateDraft({ surfaceOpacityPercent: Number(e.target.value) })
                }
                className="w-full accent-blue-700 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Más transparente</span>
                <span>Más opaco</span>
              </div>
            </div>
          </div>

          {/* Section 3: Typography & Currency */}
          <div className="space-y-4 pt-2">
            <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Type className="w-4 h-4 text-blue-700" />
              Letra Global y Formato de Moneda
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FONT_OPTIONS.map((font) => {
                const selected = draft.fontStyle === font.id;
                return (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => updateDraft({ fontStyle: font.id })}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      selected
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <p
                      className="text-base font-bold leading-tight"
                      style={{ fontFamily: font.css }}
                    >
                      {font.sample}
                    </p>
                    <p
                      className={`text-[11px] mt-1 truncate ${
                        selected ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {font.label}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="max-w-sm">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1">
                <Coins className="w-3.5 h-3.5 text-slate-500" />
                Moneda del sistema (POS, Inventario, Reportes y Tickets)
              </label>
              <select
                value={draft.currencyCode}
                onChange={(e) =>
                  updateDraft({ currencyCode: e.target.value as AppCurrencyCode })
                }
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
              >
                {APP_CURRENCY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Ejemplo de formato:{' '}
                <span className="font-mono font-semibold text-slate-800 tabular-nums">
                  {previewCurrencyLabel}
                </span>
              </p>

              {draft.currencyCode === 'NIO' && (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-700">
                      Tipo de Cambio (1 USD = X NIO)
                    </label>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await fetch('https://open.er-api.com/v6/latest/USD');
                          if (!res.ok) return;
                          const data = (await res.json()) as { rates?: { NIO?: number } };
                          const r = data?.rates?.NIO;
                          if (r && r > 0) {
                            updateDraft({ exchangeRateNio: Number(r.toFixed(4)) });
                          }
                        } catch {
                          // ignore
                        }
                      }}
                      className="text-[11px] font-semibold text-blue-700 hover:underline"
                    >
                      Actualizar Automático
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.0001"
                    min="1"
                    value={draft.exchangeRateNio ?? 36.62}
                    onChange={(e) =>
                      updateDraft({ exchangeRateNio: Number(e.target.value) || 36.62 })
                    }
                    className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg"
                  />
                  <p className="text-[10px] text-slate-500">
                    Las cantidades se multiplican automáticamente por este tipo de cambio para mostrar la conversión real en córdobas.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar Original
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar Apariencia'}
            </button>
          </div>
        </form>

        {/* Live Desktop Shell Preview */}
        <div className="xl:col-span-5 bg-slate-100 border border-slate-200 rounded-xl p-5 space-y-3 xl:sticky xl:top-24">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">
              Vista Previa General de la Aplicación
            </p>
            <span className="text-[11px] font-mono text-slate-500">
              {draft.currencyCode}
            </span>
          </div>

          <div
            className="border border-slate-300 rounded-xl overflow-hidden shadow-xs grid grid-cols-12 min-h-[340px]"
            style={{
              background: applyBackgroundOpacity(
                draft.canvasBgColor,
                draft.surfaceOpacityPercent
              ),
              fontFamily: previewFontCss,
            }}
          >
            {/* Mini Sidebar */}
            <div
              className={`col-span-4 p-3 border-r flex flex-col justify-between ${
                previewSidebarDark ? 'border-slate-700/60' : 'border-slate-200'
              }`}
              style={{
                background: applyBackgroundOpacity(
                  draft.sidebarBgColor,
                  draft.surfaceOpacityPercent
                ),
              }}
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-400/20 min-w-0">
                  {draft.showLogoInSidebar && draft.logoDataUrl && (
                    <img
                      src={draft.logoDataUrl}
                      alt={draft.appName}
                      className="h-5 w-auto object-contain shrink-0"
                    />
                  )}
                  <span
                    className="text-xs font-bold truncate"
                    style={{
                      color: previewSidebarDark ? '#f8fafc' : '#0f172a',
                    }}
                  >
                    {draft.appName || 'TECNOVA'}
                  </span>
                </div>

                <div className="space-y-1 text-[11px]">
                  <div
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md font-medium"
                    style={{
                      background: applyBackgroundOpacity(
                        draft.primaryColor,
                        draft.surfaceOpacityPercent
                      ),
                      color: previewPrimaryDark ? '#ffffff' : '#0f172a',
                    }}
                  >
                    <LayoutDashboard className="w-3 h-3 shrink-0" />
                    <span className="truncate">Panel</span>
                  </div>
                  <div
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md"
                    style={{
                      color: previewSidebarDark ? '#cbd5e1' : '#475569',
                    }}
                  >
                    <Package className="w-3 h-3 shrink-0" />
                    <span className="truncate">Inventario</span>
                  </div>
                  <div
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md"
                    style={{
                      color: previewSidebarDark ? '#cbd5e1' : '#475569',
                    }}
                  >
                    <ShoppingCart className="w-3 h-3 shrink-0" />
                    <span className="truncate">Ventas</span>
                  </div>
                </div>
              </div>

              <p
                className="text-[10px] truncate pt-2 border-t border-slate-400/20"
                style={{
                  color: previewSidebarDark ? '#94a3b8' : '#64748b',
                }}
              >
                @admin · Administrador
              </p>
            </div>

            {/* Mini Main Content */}
            <div className="col-span-8 flex flex-col">
              {/* Mini Topbar */}
              <div
                className={`px-3.5 py-2.5 border-b flex items-center justify-between gap-2 ${
                  previewHeaderDark ? 'border-slate-700/60' : 'border-slate-200'
                }`}
                style={{
                  background: applyBackgroundOpacity(
                    draft.headerBgColor,
                    draft.surfaceOpacityPercent
                  ),
                }}
              >
                <span
                  className="text-[11px] font-medium truncate"
                  style={{
                    color: previewHeaderDark ? '#f8fafc' : '#0f172a',
                  }}
                >
                  <span className="opacity-55">{draft.shortName || 'TECNOVA'}</span> / Panel
                </span>

                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium shrink-0"
                  style={{
                    backgroundColor: previewAccentHex,
                    color: previewAccentDark ? '#ffffff' : '#0f172a',
                  }}
                >
                  <QrCode className="w-3 h-3" />
                  Escanear
                </span>
              </div>

              {/* Mini Cards */}
              <div className="p-3.5 space-y-3 flex-1">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <p className="text-[10px] text-slate-500">Ventas Hoy</p>
                    <p className="text-sm font-bold font-mono tabular-nums text-slate-900 mt-1">
                      {previewCurrencyLabel}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-3">
                    <p className="text-[10px] text-slate-500">Catálogo</p>
                    <p
                      className="text-sm font-bold font-mono tabular-nums mt-1"
                      style={{ color: previewAccentHex }}
                    >
                      24 equipos
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-900">
                      Acción rápida de muestra
                    </span>
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: previewAccentHex }}
                    >
                      Ver detalle
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full w-2/3 rounded-full"
                      style={{ backgroundColor: previewAccentHex }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
