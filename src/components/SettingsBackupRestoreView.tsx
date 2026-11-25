import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  CheckSquare,
  Code2,
  Database,
  Download,
  FileJson,
  Image as ImageIcon,
  Monitor,
  MonitorDown,
  Palette,
  Receipt,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Sliders,
  Square,
  Upload,
} from 'lucide-react';
import {
  resolveWarrantyTermItems,
  type AppAppearanceSettings,
  type DeveloperSystemSettings,
  type InstalledAppSettings,
  type LoginPresentationSettings,
  type PosSettings,
  type ReceiptSettings,
  type VisualCustomizationSettings,
  type WarrantySheetSettings,
} from '../types/store';
import {
  ALL_SETTINGS_BUNDLE_KEYS,
  subscribeCustomProductCategories,
  type ParsedSettingsBackup,
  type SettingsBundleKey,
} from '../lib/localDb';
import {
  applySettingsBackup,
  exportDesktopBackupFile,
  exportSettingsBackupFile,
  inspectSettingsBackupFile,
  resetStoreSettingsToDefaults,
} from '../lib/storeOperations';

interface SettingsMetaItem {
  key: SettingsBundleKey;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SETTINGS_CATALOG: SettingsMetaItem[] = [
  {
    key: 'appAppearance',
    title: 'Aplicación, Colores y Tema',
    description: 'Nombre de la app, logo lateral, tipografía, opacidad, colores, moneda y modo claro/oscuro.',
    icon: Palette,
  },
  {
    key: 'installedApp',
    title: 'Programa Instalado e Íconos',
    description: 'Nombre al instalar, íconos PNG 192/512, ventana y estilo de pantalla.',
    icon: MonitorDown,
  },
  {
    key: 'loginPresentation',
    title: 'Presentación de Inicio',
    description: 'Título, subtítulo, imagen lateral, marca, colores y etiqueta del botón de entrada.',
    icon: Monitor,
  },
  {
    key: 'receipt',
    title: 'Comprobante de Ventas',
    description: 'Datos del negocio, ancho de papel, logotipo, QR, IMEI, impuestos y pie de ticket.',
    icon: Receipt,
  },
  {
    key: 'warrantySheet',
    title: 'Hoja de Garantía',
    description: 'Títulos, secciones visibles, cláusulas, firmas, sello digital y densidad.',
    icon: ShieldCheck,
  },
  {
    key: 'pos',
    title: 'Punto de Venta (POS)',
    description: 'Tamaño de tarjetas, columnas, campos visibles, impuestos y reglas de cobro.',
    icon: ShoppingCart,
  },
  {
    key: 'catalog',
    title: 'Catálogo e Imágenes Base',
    description: 'Categorías personalizadas, condiciones de equipo e imágenes predefinidas.',
    icon: ImageIcon,
  },
  {
    key: 'developerSystem',
    title: 'Reglas del Sistema',
    description: 'Sucursal base, prefijo QR, garantías automáticas, descuentos y permisos de caja.',
    icon: Code2,
  },
  {
    key: 'visualCustomization',
    title: 'Editor Visual y Menú Lateral',
    description: 'Orden del menú, nombres personalizados y cambios visuales aplicados en pantalla.',
    icon: Sliders,
  },
];

function formatExportDate(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function SettingsBackupRestoreView({
  appSettings,
  installedSettings,
  loginSettings,
  receiptSettings,
  warrantySettings,
  posSettings,
  developerSettings,
  visualCustomization,
}: {
  appSettings: AppAppearanceSettings;
  installedSettings: InstalledAppSettings;
  loginSettings: LoginPresentationSettings;
  receiptSettings: ReceiptSettings;
  warrantySettings: WarrantySheetSettings;
  posSettings: PosSettings;
  developerSettings: DeveloperSystemSettings;
  visualCustomization: VisualCustomizationSettings;
}) {
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [exportSelection, setExportSelection] = useState<SettingsBundleKey[]>([
    ...ALL_SETTINGS_BUNDLE_KEYS,
  ]);

  const [pendingBackup, setPendingBackup] = useState<{
    fileName: string;
    parsed: ParsedSettingsBackup;
    selectedKeys: SettingsBundleKey[];
  } | null>(null);

  const [confirmFactoryTarget, setConfirmFactoryTarget] = useState<{
    keys: SettingsBundleKey[];
    label: string;
  } | null>(null);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsub = subscribeCustomProductCategories(setCustomCategories);
    return () => unsub();
  }, []);

  const getCurrentSummary = (key: SettingsBundleKey): string => {
    switch (key) {
      case 'appAppearance':
        return `${appSettings.appName || 'TECNOVA'} · ${appSettings.currencyCode} · Opacidad ${appSettings.surfaceOpacityPercent}%`;
      case 'installedApp':
        return `${installedSettings.installedShortName || 'TECNOVA'} · ${installedSettings.displayMode}`;
      case 'loginPresentation':
        return `${loginSettings.brandName || 'TECNOVA'} · Tipografía ${loginSettings.fontStyle}`;
      case 'receipt':
        return `${receiptSettings.businessName || 'TECNOVA'} · Papel ${receiptSettings.paperWidth}`;
      case 'warrantySheet': {
        const activeTerms = resolveWarrantyTermItems(warrantySettings).filter(
          (t) => t.enabled
        ).length;
        return `${warrantySettings.documentTitle} · ${activeTerms} cláusulas`;
      }
      case 'pos':
        return `${posSettings.gridColumnsDesktop === 'auto' ? 'Auto' : `${posSettings.gridColumnsDesktop} cols`} · Tarjeta ${posSettings.productCardSize.toUpperCase()}`;
      case 'catalog':
        return `${customCategories.length} cat. extra · ${(developerSettings.catalogImagePresets || []).length} imágenes`;
      case 'developerSystem':
        return `Prefijo ${developerSettings.qrCodePrefix} · Desc. máx ${developerSettings.maxPosDiscountPercent}%`;
      case 'visualCustomization':
        return `${Object.keys(visualCustomization.patches || {}).length} ediciones · ${Object.keys(visualCustomization.navLabels || {}).length} nombres`;
    }
  };

  const toggleExportKey = (key: SettingsBundleKey) => {
    setExportSelection((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const togglePendingImportKey = (key: SettingsBundleKey) => {
    setPendingBackup((prev) => {
      if (!prev) return null;
      const exists = prev.selectedKeys.includes(key);
      return {
        ...prev,
        selectedKeys: exists
          ? prev.selectedKeys.filter((item) => item !== key)
          : [...prev.selectedKeys, key],
      };
    });
  };

  const handleDownloadSettings = async () => {
    if (exportSelection.length === 0) {
      setErrorMsg('Selecciona al menos una configuración para descargar.');
      return;
    }
    setBusyAction('export-settings');
    setErrorMsg(null);
    setNotice(null);
    try {
      const { filename, count } = await exportSettingsBackupFile(exportSelection);
      setNotice(
        `Archivo "${filename}" descargado con ${count} ${count === 1 ? 'sección configurada' : 'secciones configuradas'}.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo descargar el archivo de configuraciones.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownloadFullBackup = async () => {
    setBusyAction('export-full');
    setErrorMsg(null);
    setNotice(null);
    try {
      await exportDesktopBackupFile();
      setNotice(
        'Respaldo completo del sistema descargado (.json) con configuraciones, usuarios, productos, ventas y reparaciones.'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo descargar el respaldo completo.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleSelectBackupFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusyAction('inspect-file');
    setErrorMsg(null);
    setNotice(null);
    try {
      const parsed = await inspectSettingsBackupFile(file);
      setPendingBackup({
        fileName: file.name,
        parsed,
        selectedKeys: [...parsed.availableKeys],
      });
    } catch (err) {
      setPendingBackup(null);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'El archivo seleccionado no es válido.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleApplyBackupFile = async () => {
    if (!pendingBackup) return;
    if (pendingBackup.selectedKeys.length === 0) {
      setErrorMsg('Selecciona al menos una configuración del archivo para restaurar.');
      return;
    }
    setBusyAction('apply-file');
    setErrorMsg(null);
    setNotice(null);
    try {
      const result = await applySettingsBackup(
        pendingBackup.parsed.snapshot,
        pendingBackup.selectedKeys
      );
      setPendingBackup(null);
      setNotice(
        `Se restauraron ${result.appliedKeys.length} ${result.appliedKeys.length === 1 ? 'sección de configuración' : 'secciones de configuración'} desde "${pendingBackup.fileName}". Tus productos, ventas, garantías y usuarios permanecieron intactos.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudieron aplicar las configuraciones del archivo.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleConfirmFactoryReset = async () => {
    if (!confirmFactoryTarget) return;
    setBusyAction('reset-factory');
    setErrorMsg(null);
    setNotice(null);
    try {
      const { resetKeys } = await resetStoreSettingsToDefaults(
        confirmFactoryTarget.keys
      );
      const label = confirmFactoryTarget.label;
      setConfirmFactoryTarget(null);
      setNotice(
        `Se restauraron a valores originales de fábrica: ${label} (${resetKeys.length} ${resetKeys.length === 1 ? 'módulo' : 'módulos'}).`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudieron restaurar los valores de fábrica.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const allSelected = exportSelection.length === ALL_SETTINGS_BUNDLE_KEYS.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-2.5 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2.5 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Download All Configurations */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Descargar Todas las Configuraciones Realizadas
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Exporta en un solo archivo JSON tus ajustes de apariencia, colores, logo, programa instalado, inicio, tickets, hoja de garantía, punto de venta, catálogo y editor visual. No incluye ni altera ventas, productos ni contraseñas.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                setExportSelection(allSelected ? [] : [...ALL_SETTINGS_BUNDLE_KEYS])
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {allSelected ? (
                <>
                  <Square className="w-3.5 h-3.5" />
                  Deseleccionar todo
                </>
              ) : (
                <>
                  <CheckSquare className="w-3.5 h-3.5" />
                  Seleccionar todo
                </>
              )}
            </button>

            <button
              type="button"
              disabled={busyAction !== null || exportSelection.length === 0}
              onClick={() => void handleDownloadSettings()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {busyAction === 'export-settings'
                ? 'Generando archivo...'
                : `Descargar Configuraciones (${exportSelection.length})`}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {SETTINGS_CATALOG.map((item) => {
            const Icon = item.icon;
            const checked = exportSelection.includes(item.key);
            return (
              <label
                key={item.key}
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-colors cursor-pointer ${
                  checked
                    ? 'border-blue-500/45 bg-blue-50/40'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleExportKey(item.key)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 accent-blue-700 shrink-0 cursor-pointer"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {item.title}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    {item.description}
                  </p>
                  <p className="text-[11px] font-mono tabular-nums text-slate-600 truncate pt-0.5">
                    {getCurrentSummary(item.key)}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            ¿Necesitas también copiar productos, ventas, garantías, reparaciones y usuarios?
          </p>
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => void handleDownloadFullBackup()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            {busyAction === 'export-full'
              ? 'Exportando...'
              : 'Descargar Respaldo Completo (.json)'}
          </button>
        </div>
      </section>

      {/* Restore Section: Two Columns (From File + Factory Defaults) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Restore from Downloaded JSON */}
        <section className="xl:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Restaurar Configuraciones desde Archivo
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Carga un archivo <span className="font-mono">.json</span> descargado previamente (de configuraciones o respaldo completo) y elige qué apartados aplicar sin tocar el inventario ni las ventas.
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => void handleSelectBackupFile(e)}
            className="hidden"
          />

          {!pendingBackup ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center space-y-3">
              <FileJson className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-900">
                  Selecciona tu archivo de configuraciones
                </p>
                <p className="text-[11px] text-slate-500">
                  Antes de aplicar los cambios podrás revisar las secciones incluidas en el archivo.
                </p>
              </div>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                {busyAction === 'inspect-file'
                  ? 'Leyendo archivo...'
                  : 'Elegir Archivo (.json)'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {pendingBackup.fileName}
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] font-medium text-blue-700 hover:underline cursor-pointer"
                  >
                    Cambiar archivo
                  </button>
                </div>
                <p className="text-[11px] text-slate-600 font-mono tabular-nums">
                  {pendingBackup.parsed.sourceKind === 'settings'
                    ? 'Respaldo de Configuraciones'
                    : 'Respaldo Completo (solo se restaurarán ajustes)'}{' '}
                  · {formatExportDate(pendingBackup.parsed.exportedAt)}
                  {pendingBackup.parsed.themeMode
                    ? ` · Tema ${pendingBackup.parsed.themeMode === 'dark' ? 'Oscuro' : 'Claro'}`
                    : ''}
                </p>
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {SETTINGS_CATALOG.filter((item) =>
                  pendingBackup.parsed.availableKeys.includes(item.key)
                ).map((item) => {
                  const Icon = item.icon;
                  const checked = pendingBackup.selectedKeys.includes(item.key);
                  return (
                    <label
                      key={item.key}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePendingImportKey(item.key)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-700 accent-emerald-700 shrink-0 cursor-pointer"
                      />
                      <Icon className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                      <span className="text-xs font-medium text-slate-900 truncate">
                        {item.title}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => setPendingBackup(null)}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={
                    busyAction !== null || pendingBackup.selectedKeys.length === 0
                  }
                  onClick={() => void handleApplyBackupFile()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {busyAction === 'apply-file'
                    ? 'Restaurando...'
                    : `Aplicar ${pendingBackup.selectedKeys.length} Configuraciones`}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Restore Factory Defaults */}
        <section className="xl:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Restaurar a Valores Originales de Fábrica
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Devuelve un apartado específico o toda la personalización de TECNOVA a su estado inicial, manteniendo intactos tus productos, ventas y equipo.
                </p>
              </div>
            </div>
          </div>

          {confirmFactoryTarget && (
            <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    Confirmar restauración: {confirmFactoryTarget.label}
                  </p>
                  <p className="text-[11px] text-amber-900 mt-0.5">
                    Se restablecerán {confirmFactoryTarget.keys.length}{' '}
                    {confirmFactoryTarget.keys.length === 1
                      ? 'apartado seleccionado'
                      : 'apartados seleccionados'}{' '}
                    a los valores iniciales. Esta acción no borra productos, ventas ni usuarios.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => setConfirmFactoryTarget(null)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-300 bg-white hover:bg-amber-100/60 text-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void handleConfirmFactoryReset()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-700 hover:bg-amber-800 text-white whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {busyAction === 'reset-factory'
                    ? 'Restaurando...'
                    : 'Sí, restaurar valores'}
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
            {SETTINGS_CATALOG.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.key}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-900 truncate">
                        {item.title}
                      </p>
                      <p className="text-[11px] font-mono tabular-nums text-slate-500 truncate">
                        {getCurrentSummary(item.key)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() =>
                      setConfirmFactoryTarget({
                        keys: [item.key],
                        label: item.title,
                      })
                    }
                    className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Restaurar
                  </button>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={busyAction !== null || exportSelection.length === 0}
              onClick={() =>
                setConfirmFactoryTarget({
                  keys: [...exportSelection],
                  label: `Configuraciones seleccionadas (${exportSelection.length})`,
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar Seleccionadas ({exportSelection.length})
            </button>

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() =>
                setConfirmFactoryTarget({
                  keys: [...ALL_SETTINGS_BUNDLE_KEYS],
                  label: 'Todas las configuraciones del sistema',
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar Todas a Fábrica
            </button>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
