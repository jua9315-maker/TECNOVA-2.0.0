import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  Image as ImageIcon,
  ImagePlus,
  Lock,
  Palette,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
  Trash2,
  Type,
  Upload,
  User,
} from 'lucide-react';
import {
  DEFAULT_LOGIN_PRESENTATION_SETTINGS,
  getLoginFontFamilyCss,
  isHexColorDark,
  LOGIN_HERO_PRESETS,
  type LoginFontStyle,
  type LoginHeadlineSize,
  type LoginLogoSize,
  type LoginPresentationSettings,
  type ReceiptSettings,
} from '../types/store';
import { saveStoreLoginPresentationSettings } from '../lib/storeOperations';

const FONT_OPTIONS: {
  id: LoginFontStyle;
  label: string;
  sample: string;
  css: string;
}[] = [
  {
    id: 'modern',
    label: 'Moderna Sans',
    sample: 'Aa Bb 123',
    css: 'var(--font-sans)',
  },
  {
    id: 'geometric',
    label: 'Geométrica',
    sample: 'Aa Bb 123',
    css: 'var(--font-geometric)',
  },
  {
    id: 'editorial',
    label: 'Editorial Clásica',
    sample: 'Aa Bb 123',
    css: 'var(--font-serif-display)',
  },
  {
    id: 'technical',
    label: 'Técnica Mono',
    sample: 'Aa Bb 123',
    css: 'var(--font-mono)',
  },
];

const PANEL_BG_PRESETS = ['#ffffff', '#f8fafc', '#0f172a', '#1e293b', '#fafaf9'];
const TEXT_COLOR_PRESETS = ['#0f172a', '#1e293b', '#1d4ed8', '#ffffff', '#e2e8f0'];
const ACCENT_COLOR_PRESETS = ['#0f172a', '#1d4ed8', '#047857', '#b45309', '#be123c'];

function readImageResized(
  file: File,
  options: { maxDim: number; outputType: 'image/png' | 'image/jpeg'; quality?: number; allowSvg?: boolean }
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecciona un archivo de imagen válido (PNG, JPG, WEBP o SVG).'));
      return;
    }

    if (file.type === 'image/svg+xml') {
      if (!options.allowSvg) {
        reject(new Error('Para la imagen de portada usa formato PNG, JPG o WEBP.'));
        return;
      }
      if (file.size > 150 * 1024) {
        reject(new Error('El archivo SVG es demasiado pesado (máximo 150 KB).'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('No se pudo leer el archivo SVG.'));
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo SVG.'));
      reader.readAsDataURL(file);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, options.maxDim / Math.max(img.width, img.height));
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo procesar la imagen.'));
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const dataUrl =
          options.outputType === 'image/jpeg'
            ? canvas.toDataURL('image/jpeg', options.quality ?? 0.86)
            : canvas.toDataURL('image/png');
        resolve(dataUrl);
      } catch {
        reject(new Error('Error al optimizar la imagen seleccionada.'));
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo cargar la imagen seleccionada.'));
    };
    img.src = objectUrl;
  });
}

export function PresentationConfigView({
  settings,
  receiptSettings,
}: {
  settings: LoginPresentationSettings;
  receiptSettings: ReceiptSettings;
}) {
  const [draft, setDraft] = useState<LoginPresentationSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const heroInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const updateDraft = (patch: Partial<LoginPresentationSettings>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setSavedNotice(false);
    setUploadError(null);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await readImageResized(file, {
        maxDim: 360,
        outputType: 'image/png',
        allowSvg: true,
      });
      updateDraft({ logoDataUrl: dataUrl, showLogo: true });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'No se pudo cargar el logo.');
    }
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await readImageResized(file, {
        maxDim: 1400,
        outputType: 'image/jpeg',
        quality: 0.86,
        allowSvg: false,
      });
      updateDraft({ heroImageUrl: dataUrl, showHeroImage: true });
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'No se pudo cargar la imagen de portada.'
      );
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);
    try {
      await saveStoreLoginPresentationSettings(draft);
      setSavedNotice(true);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraft({ ...DEFAULT_LOGIN_PRESENTATION_SETTINGS });
    setSavedNotice(false);
    setUploadError(null);
  };

  const previewDarkBg = isHexColorDark(draft.panelBgColor);
  const previewAccentDark = isHexColorDark(draft.accentColor);
  const previewFontCss = getLoginFontFamilyCss(draft.fontStyle);

  const previewLogoClass =
    draft.logoSize === 'sm'
      ? 'h-5'
      : draft.logoSize === 'lg'
        ? 'h-9'
        : 'h-7';

  const previewHeadlineClass =
    draft.headlineSize === 'compact'
      ? 'text-base'
      : draft.headlineSize === 'large'
        ? 'text-xl'
        : 'text-lg';

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
            Presentación de inicio guardada en tu equipo. Se aplicará automáticamente en la pantalla de acceso.
          </span>
        </div>
      )}

      {uploadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-700">
          {uploadError}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Form Column */}
        <form
          onSubmit={(e) => void handleSave(e)}
          className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6"
        >
          {/* Section 1: Logo and Brand Name */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-700" />
                Logo y Marca en Inicio
              </h2>
              {receiptSettings.logoDataUrl && (
                <button
                  type="button"
                  onClick={() =>
                    updateDraft({ logoDataUrl: receiptSettings.logoDataUrl, showLogo: true })
                  }
                  className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
                >
                  Usar mismo logo del comprobante
                </button>
              )}
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-16 h-16 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                  {draft.logoDataUrl ? (
                    <img
                      src={draft.logoDataUrl}
                      alt="Logo de presentación"
                      className="max-w-full max-h-full object-contain p-1"
                    />
                  ) : (
                    <ImagePlus className="w-6 h-6 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-semibold text-slate-900">
                    Logo de la pantalla de inicio
                  </p>
                  <p className="text-[11px] text-slate-500">
                    PNG, JPG, WEBP o SVG. Aparece en la esquina superior del acceso.
                  </p>
                  {draft.logoDataUrl && (
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer pt-0.5">
                      <input
                        type="checkbox"
                        checked={draft.showLogo}
                        onChange={(e) => updateDraft({ showLogo: e.target.checked })}
                        className="rounded border-slate-300"
                      />
                      <span>Mostrar logo</span>
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
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {draft.logoDataUrl ? 'Cambiar logo' : 'Subir logo'}
                </button>
                {draft.logoDataUrl && (
                  <button
                    type="button"
                    onClick={() => updateDraft({ logoDataUrl: '' })}
                    className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Quitar logo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-6">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nombre de la tienda / marca
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={draft.brandName}
                  onChange={(e) => updateDraft({ brandName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tamaño del logo
                </label>
                <select
                  value={draft.logoSize}
                  onChange={(e) =>
                    updateDraft({ logoSize: e.target.value as LoginLogoSize })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
                >
                  <option value="sm">Pequeño</option>
                  <option value="md">Mediano</option>
                  <option value="lg">Grande</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="flex items-center gap-2 p-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 text-xs">
                  <input
                    type="checkbox"
                    checked={draft.showBrandName}
                    onChange={(e) => updateDraft({ showBrandName: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  <span className="font-medium text-slate-800 whitespace-nowrap">
                    Mostrar texto
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 2: Typography, Texts & Colors */}
          <div className="space-y-4 pt-2">
            <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Type className="w-4 h-4 text-blue-700" />
              Textos y Tipo de Letra
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Estilo de letra (Tipografía)
              </label>
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-8">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Título principal de bienvenida
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={draft.headline}
                  onChange={(e) => updateDraft({ headline: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tamaño de título
                </label>
                <select
                  value={draft.headlineSize}
                  onChange={(e) =>
                    updateDraft({ headlineSize: e.target.value as LoginHeadlineSize })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
                >
                  <option value="compact">Compacto</option>
                  <option value="normal">Normal</option>
                  <option value="large">Grande</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Descripción / subtítulo (Opcional)
              </label>
              <textarea
                rows={2}
                maxLength={240}
                value={draft.subtitle}
                onChange={(e) => updateDraft({ subtitle: e.target.value })}
                placeholder="Mensaje breve de bienvenida..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Texto del botón de acceso
              </label>
              <input
                type="text"
                required
                maxLength={40}
                value={draft.buttonLabel}
                onChange={(e) => updateDraft({ buttonLabel: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Color Palette Pickers */}
            <div className="pt-1 space-y-3">
              <p className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-slate-500" />
                Colores de presentación
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-700">
                      Color de letras
                    </span>
                    <input
                      type="color"
                      value={draft.textColor}
                      onChange={(e) => updateDraft({ textColor: e.target.value })}
                      className="w-6 h-6 rounded border border-slate-200 cursor-pointer"
                      aria-label="Color de letras"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {TEXT_COLOR_PRESETS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => updateDraft({ textColor: hex })}
                        style={{ backgroundColor: hex }}
                        className={`w-5 h-5 rounded-full border ${
                          draft.textColor.toLowerCase() === hex
                            ? 'ring-2 ring-blue-600 ring-offset-1 border-slate-400'
                            : 'border-slate-300'
                        }`}
                        title={hex}
                      />
                    ))}
                  </div>
                </div>

                <div className="p-3 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-700">
                      Color del botón
                    </span>
                    <input
                      type="color"
                      value={draft.accentColor}
                      onChange={(e) => updateDraft({ accentColor: e.target.value })}
                      className="w-6 h-6 rounded border border-slate-200 cursor-pointer"
                      aria-label="Color del botón"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {ACCENT_COLOR_PRESETS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => updateDraft({ accentColor: hex })}
                        style={{ backgroundColor: hex }}
                        className={`w-5 h-5 rounded-full border ${
                          draft.accentColor.toLowerCase() === hex
                            ? 'ring-2 ring-blue-600 ring-offset-1 border-slate-400'
                            : 'border-slate-300'
                        }`}
                        title={hex}
                      />
                    ))}
                  </div>
                </div>

                <div className="p-3 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-700">
                      Fondo del panel
                    </span>
                    <input
                      type="color"
                      value={draft.panelBgColor}
                      onChange={(e) => updateDraft({ panelBgColor: e.target.value })}
                      className="w-6 h-6 rounded border border-slate-200 cursor-pointer"
                      aria-label="Fondo del panel"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {PANEL_BG_PRESETS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => {
                          const willBeDark = isHexColorDark(hex);
                          const currentTextDark = isHexColorDark(draft.textColor);
                          updateDraft({
                            panelBgColor: hex,
                            textColor:
                              willBeDark && currentTextDark
                                ? '#f8fafc'
                                : !willBeDark && !currentTextDark
                                  ? '#0f172a'
                                  : draft.textColor,
                          });
                        }}
                        style={{ backgroundColor: hex }}
                        className={`w-5 h-5 rounded-full border ${
                          draft.panelBgColor.toLowerCase() === hex
                            ? 'ring-2 ring-blue-600 ring-offset-1 border-slate-400'
                            : 'border-slate-300'
                        }`}
                        title={hex}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Presentation Image */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-700" />
                Imagen de Presentación
              </h2>
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.showHeroImage}
                  onChange={(e) => updateDraft({ showHeroImage: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <span>Mostrar imagen lateral</span>
              </label>
            </div>

            {draft.showHeroImage && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {LOGIN_HERO_PRESETS.map((preset) => {
                    const selected = draft.heroImageUrl === preset.url;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => updateDraft({ heroImageUrl: preset.url })}
                        className={`group rounded-lg overflow-hidden border text-left transition-all ${
                          selected
                            ? 'border-blue-700 ring-2 ring-blue-600/30'
                            : 'border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                          <img
                            src={preset.url}
                            alt={preset.label}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <p className="px-2 py-1.5 text-[11px] font-medium text-slate-700 truncate bg-white">
                          {preset.label}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-xs text-slate-600">
                    <p className="font-semibold text-slate-900">
                      ¿Prefieres tu propia fotografía?
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Sube una foto de tu tienda, mostrador o banner en PNG, JPG o WEBP.
                    </p>
                  </div>
                  <input
                    ref={heroInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => void handleHeroUpload(e)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => heroInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Subir imagen propia
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Texto opcional sobre la imagen (vacío para imagen limpia)
                  </label>
                  <input
                    type="text"
                    maxLength={140}
                    value={draft.heroCaption}
                    onChange={(e) => updateDraft({ heroCaption: e.target.value })}
                    placeholder="Déjalo vacío para mostrar solo la fotografía sin textos encima"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>
              </>
            )}
          </div>

          <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar Predeterminado
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar Presentación'}
            </button>
          </div>
        </form>

        {/* Live Preview Column */}
        <div className="xl:col-span-5 bg-slate-100 border border-slate-200 rounded-xl p-5 space-y-3 xl:sticky xl:top-24">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">
              Vista Previa de Pantalla de Inicio
            </p>
            <span className="text-[11px] text-slate-500">
              Actualización en vivo
            </span>
          </div>

          <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-50 shadow-xs">
            <div
              className={`grid ${
                draft.showHeroImage ? 'grid-cols-12' : 'grid-cols-1'
              } min-h-[400px]`}
            >
              {/* Mini Login Panel */}
              <div
                className={`${
                  draft.showHeroImage ? 'col-span-6' : 'col-span-1 max-w-sm mx-auto w-full my-4 rounded-xl border border-slate-200'
                } p-5 flex flex-col justify-between border-r border-slate-200/70`}
                style={{
                  backgroundColor: draft.panelBgColor,
                  fontFamily: previewFontCss,
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {draft.showLogo && draft.logoDataUrl && (
                    <img
                      src={draft.logoDataUrl}
                      alt={draft.brandName}
                      className={`${previewLogoClass} w-auto object-contain shrink-0`}
                    />
                  )}
                  {draft.showBrandName && (
                    <span
                      className="text-xs font-bold tracking-tight truncate"
                      style={{ color: draft.textColor }}
                    >
                      {draft.brandName || 'TECNOVA'}
                    </span>
                  )}
                </div>

                <div className="my-5 space-y-3">
                  <h3
                    className={`${previewHeadlineClass} font-bold tracking-tight leading-tight`}
                    style={{ color: draft.textColor, textWrap: 'balance' }}
                  >
                    {draft.headline || 'Título principal'}
                  </h3>
                  {draft.subtitle && (
                    <p
                      className="text-[11px] leading-relaxed"
                      style={{
                        color: previewDarkBg ? '#cbd5e1' : draft.textColor,
                        opacity: previewDarkBg ? 0.9 : 0.72,
                      }}
                    >
                      {draft.subtitle}
                    </p>
                  )}

                  <div className="space-y-2 pt-1 font-sans">
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] text-slate-400">
                      <User className="w-3 h-3" />
                      <span>admin</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] text-slate-400">
                      <Lock className="w-3 h-3" />
                      <span>••••••••</span>
                    </div>
                    <div
                      className="w-full py-2 px-3 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5"
                      style={{
                        backgroundColor: draft.accentColor,
                        color: previewAccentDark ? '#ffffff' : '#0f172a',
                      }}
                    >
                      <span className="truncate">
                        {draft.buttonLabel || 'Entrar al sistema'}
                      </span>
                      <ArrowRight className="w-3 h-3 shrink-0" />
                    </div>
                  </div>
                </div>

                <div />
              </div>

              {/* Mini Showcase Photo */}
              {draft.showHeroImage && (
                <div className="col-span-6 relative bg-slate-900 overflow-hidden">
                  {draft.heroImageUrl ? (
                    <img
                      src={draft.heroImageUrl}
                      alt="Portada personalizada"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                      <Smartphone className="w-10 h-10" />
                    </div>
                  )}
                  {draft.heroCaption.trim() && (
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/15 to-transparent flex items-end p-4">
                      <p className="text-[11px] font-medium text-white leading-snug">
                        {draft.heroCaption}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
