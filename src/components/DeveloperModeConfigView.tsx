import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Code2,
  Cpu,
  Database,
  Download,
  Eye,
  EyeOff,
  HardDrive,
  Image as ImageIcon,
  KeyRound,
  Layers,
  Monitor,
  MonitorDown,
  Palette,
  Receipt,
  RotateCcw,
  Save,
  ShieldCheck,
  ShoppingCart,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  DEFAULT_DEVELOPER_SYSTEM_SETTINGS,
  DEFAULT_VISUAL_CUSTOMIZATION_SETTINGS,
  type AppAppearanceSettings,
  type DeveloperSystemSettings,
  type InstalledAppSettings,
  type NavTab,
  type UserProfile,
  type VisualCustomizationSettings,
  type VisualElementPatch,
} from '../types/store';
import {
  exportDesktopBackupFile,
  importDesktopBackupFile,
  saveStoreDeveloperSystemSettings,
  saveStoreVisualCustomizationSettings,
  updateDeveloperOwnAccount,
} from '../lib/storeOperations';
import type { SettingsSection } from './SettingsWorkspaceView';

const MODULE_META: { id: NavTab; defaultLabel: string }[] = [
  { id: 'dashboard', defaultLabel: 'Panel Principal' },
  { id: 'inventory', defaultLabel: 'Inventario y QR' },
  { id: 'pos', defaultLabel: 'Punto de Venta' },
  { id: 'sales', defaultLabel: 'Ventas Realizadas' },
  { id: 'warranties', defaultLabel: 'Garantías' },
  { id: 'repairs', defaultLabel: 'Reparaciones' },
  { id: 'reports', defaultLabel: 'Reportes Diarios' },
  { id: 'team', defaultLabel: 'Equipo y Roles' },
  { id: 'settings', defaultLabel: 'Opciones' },
];

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 cursor-pointer transition-colors">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-900">{label}</p>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
          {description}
        </p>
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

export function DeveloperModeConfigView({
  developerProfile,
  developerSettings,
  visualCustomization,
  appSettings,
  installedSettings,
  onChangeSection,
  onOpenVisualEditor,
  onSeedCatalog,
}: {
  developerProfile: UserProfile | null;
  developerSettings: DeveloperSystemSettings;
  visualCustomization: VisualCustomizationSettings;
  appSettings: AppAppearanceSettings;
  installedSettings: InstalledAppSettings;
  onChangeSection: (next: SettingsSection) => void;
  onOpenVisualEditor?: () => void;
  onSeedCatalog?: () => Promise<void>;
}) {
  const [sysDraft, setSysDraft] =
    useState<DeveloperSystemSettings>(developerSettings);
  const [visualDraft, setVisualDraft] =
    useState<VisualCustomizationSettings>(visualCustomization);

  const [devDisplayName, setDevDisplayName] = useState(
    developerProfile?.displayName || 'Desarrollador del Sistema'
  );
  const [devNewPassword, setDevNewPassword] = useState('');
  const [devConfirmPassword, setDevConfirmPassword] = useState('');

  const [savingSys, setSavingSys] = useState(false);
  const [savingVisual, setSavingVisual] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [busyBackup, setBusyBackup] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const visualJsonInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSysDraft(developerSettings);
  }, [developerSettings]);

  useEffect(() => {
    setVisualDraft(visualCustomization);
  }, [visualCustomization]);

  useEffect(() => {
    if (developerProfile?.displayName) {
      setDevDisplayName(developerProfile.displayName);
    }
  }, [developerProfile?.displayName]);

  const showNotice = (msg: string) => {
    setErrorMsg(null);
    setNotice(msg);
  };

  const handleSaveSystemRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSys(true);
    setErrorMsg(null);
    setNotice(null);
    try {
      await saveStoreDeveloperSystemSettings(sysDraft);
      showNotice(
        'Parámetros y reglas del Modo Desarrollador guardados y aplicados en todo el sistema.'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudieron guardar las reglas del sistema.'
      );
    } finally {
      setSavingSys(false);
    }
  };

  const persistVisualDraft = async (
    next: VisualCustomizationSettings,
    successText: string
  ) => {
    setSavingVisual(true);
    setErrorMsg(null);
    try {
      setVisualDraft(next);
      await saveStoreVisualCustomizationSettings(next);
      showNotice(successText);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar la personalización visual.'
      );
    } finally {
      setSavingVisual(false);
    }
  };

  const moveNavItem = (tabId: NavTab, delta: -1 | 1) => {
    const order = [
      ...(visualDraft.navOrder || DEFAULT_VISUAL_CUSTOMIZATION_SETTINGS.navOrder),
    ];
    const idx = order.indexOf(tabId);
    if (idx < 0) return;
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= order.length) return;
    const [item] = order.splice(idx, 1);
    order.splice(nextIdx, 0, item);
    void persistVisualDraft(
      { ...visualDraft, navOrder: order },
      'Orden del menú lateral actualizado.'
    );
  };

  const handleRenameNavItem = (tabId: NavTab, value: string) => {
    const nextLabels = { ...(visualDraft.navLabels || {}) };
    if (value.trim()) nextLabels[tabId] = value;
    else delete nextLabels[tabId];
    setVisualDraft({ ...visualDraft, navLabels: nextLabels });
  };

  const handleSaveMenuLabels = async () => {
    await persistVisualDraft(
      visualDraft,
      'Nombres personalizados del menú guardados.'
    );
  };

  const handleResetMenuOrderAndLabels = async () => {
    await persistVisualDraft(
      {
        ...visualDraft,
        navOrder: [...DEFAULT_VISUAL_CUSTOMIZATION_SETTINGS.navOrder],
        navLabels: {},
      },
      'Orden y nombres del menú restaurados.'
    );
  };

  const handleTogglePatchVisibility = (patchId: string) => {
    const existing = visualDraft.patches[patchId];
    if (!existing) return;
    const next: VisualCustomizationSettings = {
      ...visualDraft,
      patches: {
        ...visualDraft.patches,
        [patchId]: {
          ...existing,
          hidden: !existing.hidden,
        },
      },
    };
    void persistVisualDraft(next, 'Visibilidad del elemento actualizada.');
  };

  const handleDeletePatch = (patchId: string) => {
    const nextPatches = { ...visualDraft.patches };
    delete nextPatches[patchId];
    void persistVisualDraft(
      { ...visualDraft, patches: nextPatches },
      'Elemento restaurado a su estado original.'
    );
  };

  const handleClearAllVisualPatches = () => {
    void persistVisualDraft(
      {
        ...visualDraft,
        patches: {},
      },
      'Se limpiaron todos los cambios visuales de los módulos.'
    );
  };

  const handleExportVisualJson = () => {
    const blob = new Blob([JSON.stringify(visualDraft, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diseno-visual-desarrollador.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportVisualJson = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<VisualCustomizationSettings>;
      if (!parsed || typeof parsed !== 'object' || !parsed.patches) {
        throw new Error('Archivo de diseño visual inválido.');
      }
      await persistVisualDraft(
        {
          patches: parsed.patches || {},
          navOrder:
            Array.isArray(parsed.navOrder) && parsed.navOrder.length > 0
              ? parsed.navOrder
              : [...DEFAULT_VISUAL_CUSTOMIZATION_SETTINGS.navOrder],
          navLabels: parsed.navLabels || {},
        },
        'Diseño visual importado y aplicado correctamente.'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo importar el diseño.'
      );
    }
  };

  const handleSaveDeveloperAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!developerProfile?.uid) return;
    if (devNewPassword && devNewPassword !== devConfirmPassword) {
      setErrorMsg('Las contraseñas nuevas no coinciden.');
      return;
    }
    setSavingAccount(true);
    setErrorMsg(null);
    setNotice(null);
    try {
      await updateDeveloperOwnAccount(developerProfile.uid, {
        displayName: devDisplayName,
        newPassword: devNewPassword || undefined,
      });
      setDevNewPassword('');
      setDevConfirmPassword('');
      showNotice('Datos de la cuenta Desarrollador actualizados.');
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar la cuenta del desarrollador.'
      );
    } finally {
      setSavingAccount(false);
    }
  };

  const handleBackupExport = async () => {
    setBusyBackup(true);
    setErrorMsg(null);
    try {
      await exportDesktopBackupFile();
      showNotice('Respaldo completo de base de datos descargado (.json).');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al exportar respaldo.'
      );
    } finally {
      setBusyBackup(false);
    }
  };

  const handleBackupImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusyBackup(true);
    setErrorMsg(null);
    try {
      const stats = await importDesktopBackupFile(file);
      showNotice(
        `Respaldo restaurado: ${stats.products} productos, ${stats.sales} ventas, ${stats.warranties} garantías y ${stats.repairs} reparaciones.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Archivo de respaldo inválido.'
      );
    } finally {
      setBusyBackup(false);
    }
  };

  const handleSeedDemo = async () => {
    if (!onSeedCatalog) return;
    setSeeding(true);
    setErrorMsg(null);
    try {
      await onSeedCatalog();
      showNotice('Catálogo de demostración agregado a la base local.');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo cargar el catálogo.'
      );
    } finally {
      setSeeding(false);
    }
  };

  const patchList: VisualElementPatch[] = Object.values(
    visualDraft.patches || {}
  );
  const renamedModulesCount = Object.keys(visualDraft.navLabels || {}).length;

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

      {/* Developer Command Overview */}
      <div className="rounded-2xl bg-slate-950 text-white border border-cyan-500/30 p-6 shadow-lg space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center text-slate-950 shrink-0">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-white">
                  Centro Maestro de Modo Desarrollador
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 rounded">
                  SOLO DESARROLLADOR
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Controla reglas operativas, editor visual sin código, menú lateral, identidad de programa instalado y respaldo completo de la base de datos local.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenVisualEditor && (
              <button
                type="button"
                onClick={onOpenVisualEditor}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 transition-colors cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                Abrir Editor Visual en Pantalla
              </button>
            )}
            <button
              type="button"
              onClick={handleExportVisualJson}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar Diseño
            </button>
            <input
              ref={visualJsonInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => void handleImportVisualJson(e)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => visualJsonInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Importar Diseño
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <p className="text-[11px] text-slate-400">Ediciones Visuales</p>
            <p className="text-lg font-bold font-mono text-cyan-300 mt-0.5">
              {patchList.length}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <p className="text-[11px] text-slate-400">Módulos Renombrados</p>
            <p className="text-lg font-bold font-mono text-fuchsia-300 mt-0.5">
              {renamedModulesCount}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <p className="text-[11px] text-slate-400">App Instalada</p>
            <p className="text-xs font-semibold text-white truncate mt-1.5">
              {installedSettings.installedShortName}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10">
            <p className="text-[11px] text-slate-400">Moneda / Prefijo QR</p>
            <p className="text-xs font-semibold font-mono text-emerald-300 truncate mt-1.5">
              {appSettings.currencyCode} · {sysDraft.qrCodePrefix}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Access to Every Customizable Area */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => onChangeSection('installed')}
          className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-500 text-left transition-colors group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <MonitorDown className="w-4 h-4 text-blue-700" />
            <span className="text-[10px] font-medium text-blue-700 group-hover:underline">
              Configurar →
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-900 mt-2">
            Programa Instalado
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Nombre al instalar, logo PNG, acceso directo y color de ventana.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChangeSection('app')}
          className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-500 text-left transition-colors group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <Palette className="w-4 h-4 text-blue-700" />
            <span className="text-[10px] font-medium text-blue-700 group-hover:underline">
              Configurar →
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-900 mt-2">
            Aplicación y Colores
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Temas globales, colores de barras, tipografía y moneda del POS.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChangeSection('presentation')}
          className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-500 text-left transition-colors group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <Monitor className="w-4 h-4 text-blue-700" />
            <span className="text-[10px] font-medium text-blue-700 group-hover:underline">
              Configurar →
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-900 mt-2">
            Presentación de Inicio
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Pantalla de acceso, imagen lateral, título, textos y botón.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChangeSection('receipt')}
          className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-500 text-left transition-colors group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <Receipt className="w-4 h-4 text-blue-700" />
            <span className="text-[10px] font-medium text-blue-700 group-hover:underline">
              Configurar →
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-900 mt-2">
            Comprobante y Tickets
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Datos fiscales, ancho de papel 80/58mm, QR e IMEI en impresiones.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChangeSection('catalog')}
          className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-500 text-left transition-colors group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <ImageIcon className="w-4 h-4 text-blue-700" />
            <span className="text-[10px] font-medium text-blue-700 group-hover:underline">
              Configurar →
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-900 mt-2">
            Catálogo e Imágenes
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Edita las imágenes predefinidas, categorías y condiciones de productos.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChangeSection('pos')}
          className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-500 text-left transition-colors group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <ShoppingCart className="w-4 h-4 text-blue-700" />
            <span className="text-[10px] font-medium text-blue-700 group-hover:underline">
              Configurar →
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-900 mt-2">
            Punto de Venta
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Tamaño de tarjetas, columnas, campos visibles y reglas de caja.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChangeSection('warranty')}
          className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-500 text-left transition-colors group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span className="text-[10px] font-medium text-blue-700 group-hover:underline">
              Configurar →
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-900 mt-2">
            Hoja de Garantía
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Edita títulos, cláusulas, columnas de equipo, sello digital y firmas.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChangeSection('backup')}
          className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-500 text-left transition-colors group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <Archive className="w-4 h-4 text-blue-700" />
            <span className="text-[10px] font-medium text-blue-700 group-hover:underline">
              Abrir →
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-900 mt-2">
            Respaldo y Restaurar
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Descarga todas las configuraciones o restáuralas desde archivo o fábrica.
          </p>
        </button>
      </div>

      {/* Main Grid: System Rules + Visual Layout Manager */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: System & Business Logic Rules */}
        <form
          onSubmit={(e) => void handleSaveSystemRules(e)}
          className="xl:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-700" />
              <h3 className="text-sm font-semibold text-slate-900">
                Reglas Operativas y Parámetros del Sistema
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Sucursal / Ubicación base
              </label>
              <input
                type="text"
                maxLength={80}
                value={sysDraft.defaultStoreBranch}
                onChange={(e) =>
                  setSysDraft((p) => ({
                    ...p,
                    defaultStoreBranch: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Prefijo para códigos QR
              </label>
              <input
                type="text"
                maxLength={16}
                value={sysDraft.qrCodePrefix}
                onChange={(e) =>
                  setSysDraft((p) => ({
                    ...p,
                    qrCodePrefix: e.target.value.toUpperCase(),
                  }))
                }
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Garantía por defecto Teléfonos (meses)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={sysDraft.defaultPhoneWarrantyMonths}
                onChange={(e) =>
                  setSysDraft((p) => ({
                    ...p,
                    defaultPhoneWarrantyMonths: Number(e.target.value) || 12,
                  }))
                }
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Garantía por defecto Accesorios (meses)
              </label>
              <input
                type="number"
                min={0}
                max={60}
                value={sysDraft.defaultAccessoryWarrantyMonths}
                onChange={(e) =>
                  setSysDraft((p) => ({
                    ...p,
                    defaultAccessoryWarrantyMonths: Number(e.target.value) || 0,
                  }))
                }
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Stock mínimo sugerido en inventario
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={sysDraft.lowStockDefaultMin}
                onChange={(e) =>
                  setSysDraft((p) => ({
                    ...p,
                    lowStockDefaultMin: Number(e.target.value) || 0,
                  }))
                }
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Descuento máximo permitido en POS (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={sysDraft.maxPosDiscountPercent}
                onChange={(e) =>
                  setSysDraft((p) => ({
                    ...p,
                    maxPosDiscountPercent: Math.min(
                      100,
                      Math.max(0, Number(e.target.value) || 0)
                    ),
                  }))
                }
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            <ToggleRow
              label="Exigir autorización de Administrador para reabrir caja cerrada"
              description="Cuando está activo, reabrir la caja del día solicita usuario y contraseña de un Administrador."
              checked={sysDraft.requireAdminToReopenCash}
              onChange={(checked) =>
                setSysDraft((p) => ({ ...p, requireAdminToReopenCash: checked }))
              }
            />
            <ToggleRow
              label="Exigir autorización de Administrador para cancelar ventas"
              description="Solicita credenciales de Administrador al cancelar una venta realizada (el Desarrollador siempre tiene permiso total directo)."
              checked={sysDraft.requireAdminToCancelSale ?? true}
              onChange={(checked) =>
                setSysDraft((p) => ({ ...p, requireAdminToCancelSale: checked }))
              }
            />
            <ToggleRow
              label="Abrir Hoja de Garantía automáticamente al vender un teléfono"
              description="Muestra de inmediato la hoja imprimible de garantía cuando se cobra un smartphone o producto con IMEI."
              checked={sysDraft.autoOpenWarrantyOnPhoneSale}
              onChange={(checked) =>
                setSysDraft((p) => ({
                  ...p,
                  autoOpenWarrantyOnPhoneSale: checked,
                }))
              }
            />
            <ToggleRow
              label="Permitir vender productos con stock en cero (venta sin existencias)"
              description="Si se activa, el POS permite agregar y cobrar productos aunque el stock disponible sea 0."
              checked={sysDraft.allowNegativeStockSale}
              onChange={(checked) =>
                setSysDraft((p) => ({ ...p, allowNegativeStockSale: checked }))
              }
            />
            <ToggleRow
              label="Mostrar selector de vista por rol en barra lateral"
              description="Permite alternar rápidamente entre vista de Desarrollador/Admin y vista de Usuario Operativo."
              checked={sysDraft.showDevRoleSwitcher}
              onChange={(checked) =>
                setSysDraft((p) => ({ ...p, showDevRoleSwitcher: checked }))
              }
            />
            <ToggleRow
              label="Mostrar aviso flotante cuando no hay conexión a internet"
              description="Muestra el indicador inferior cuando el navegador está desconectado de la red."
              checked={sysDraft.showOfflineBanner}
              onChange={(checked) =>
                setSysDraft((p) => ({ ...p, showOfflineBanner: checked }))
              }
            />
          </div>

          <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSysDraft({ ...DEFAULT_DEVELOPER_SYSTEM_SETTINGS })}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Valores de Fábrica
            </button>

            <button
              type="submit"
              disabled={savingSys}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 rounded-lg cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {savingSys ? 'Guardando...' : 'Guardar Reglas del Sistema'}
            </button>
          </div>
        </form>

        {/* Right: Sidebar Menu Order & Visual Patches Manager */}
        <div className="xl:col-span-6 space-y-6">
          {/* Sidebar Menu Customization */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-700" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Módulos del Menú Lateral (Orden y Nombres)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleResetMenuOrderAndLabels()}
                  className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  Restaurar menú
                </button>
                <button
                  type="button"
                  disabled={savingVisual}
                  onClick={() => void handleSaveMenuLabels()}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  Guardar Nombres
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {(
                visualDraft.navOrder ||
                DEFAULT_VISUAL_CUSTOMIZATION_SETTINGS.navOrder
              ).map((tabId, idx, arr) => {
                const meta = MODULE_META.find((m) => m.id === tabId);
                if (!meta) return null;
                return (
                  <div
                    key={tabId}
                    className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50/70"
                  >
                    <span className="text-[11px] font-mono text-slate-400 w-5 text-center shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={
                        visualDraft.navLabels?.[tabId] ?? meta.defaultLabel
                      }
                      onChange={(e) =>
                        handleRenameNavItem(tabId, e.target.value)
                      }
                      className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                    />
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveNavItem(tabId, -1)}
                      className="p-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-35 cursor-pointer"
                      title="Subir módulo"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-slate-700" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === arr.length - 1}
                      onClick={() => moveNavItem(tabId, 1)}
                      className="p-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-35 cursor-pointer"
                      title="Bajar módulo"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-slate-700" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Applied Visual Element Patches List */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-fuchsia-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Elementos Editados con el Editor Visual ({patchList.length})
                </h3>
              </div>
              {patchList.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllVisualPatches}
                  className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpiar Todo
                </button>
              )}
            </div>

            {patchList.length === 0 ? (
              <div className="p-5 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
                <p className="text-xs text-slate-600">
                  Aún no hay botones, textos o posiciones modificadas con el Editor Visual.
                </p>
                {onOpenVisualEditor && (
                  <button
                    type="button"
                    onClick={onOpenVisualEditor}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-300 bg-slate-950 rounded-lg hover:bg-slate-900 cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Empezar a Editar Pantalla
                  </button>
                )}
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {patchList.map((patch) => (
                  <div
                    key={patch.id}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 text-[10px] font-mono uppercase bg-slate-900 text-cyan-300 rounded">
                          {patch.scope}
                        </span>
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {patch.customText || patch.label || 'Elemento visual'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 font-mono truncate">
                        {patch.offsetX || patch.offsetY
                          ? `Pos(${patch.offsetX || 0}, ${patch.offsetY || 0}) `
                          : ''}
                        {typeof patch.orderOffset === 'number'
                          ? `Orden:${patch.orderOffset} `
                          : ''}
                        {patch.fontSizePx ? `${patch.fontSizePx}px ` : ''}
                        {patch.widthPx ? `An:${patch.widthPx}px ` : ''}
                        {patch.heightPx ? `Al:${patch.heightPx}px ` : ''}
                        {patch.scalePercent ? `Esc:${patch.scalePercent}% ` : ''}
                        {patch.hidden ? '· Oculto' : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTogglePatchVisibility(patch.id)}
                        className="p-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer"
                        title={patch.hidden ? 'Mostrar elemento' : 'Ocultar elemento'}
                      >
                        {patch.hidden ? (
                          <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                        ) : (
                          <Eye className="w-3.5 h-3.5 text-slate-600" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePatch(patch.id)}
                        className="p-1.5 rounded-md bg-white border border-slate-200 hover:bg-rose-50 text-rose-600 cursor-pointer"
                        title="Restaurar este elemento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Developer Credentials + Full Database Maintenance */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={(e) => void handleSaveDeveloperAccount(e)}
          className="xl:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <KeyRound className="w-4 h-4 text-blue-700" />
            <h3 className="text-sm font-semibold text-slate-900">
              Cuenta y Seguridad del Desarrollador (@{developerProfile?.username || 'desarrollador'})
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nombre visible
              </label>
              <input
                type="text"
                required
                value={devDisplayName}
                onChange={(e) => setDevDisplayName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nueva contraseña (opcional)
              </label>
              <input
                type="password"
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                value={devNewPassword}
                onChange={(e) => setDevNewPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Confirmar contraseña
              </label>
              <input
                type="password"
                minLength={6}
                placeholder="Repetir contraseña"
                value={devConfirmPassword}
                onChange={(e) => setDevConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Esta cuenta no aparece en la lista pública de Equipo y Roles.
            </span>
            <button
              type="submit"
              disabled={savingAccount}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {savingAccount ? 'Actualizando...' : 'Actualizar Cuenta'}
            </button>
          </div>
        </form>

        <div className="xl:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Database className="w-4 h-4 text-blue-700" />
            <h3 className="text-sm font-semibold text-slate-900">
              Base de Datos Local, Respaldo Total y Catálogo
            </h3>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Descarga o restaura un respaldo completo en formato JSON incluyendo productos, ventas, garantías, reparaciones, reportes, personalizaciones visuales, programa instalado y reglas del sistema.
          </p>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={busyBackup}
              onClick={() => void handleBackupExport()}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar Respaldo Completo (.json)
            </button>

            <input
              ref={backupInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => void handleBackupImport(e)}
              className="hidden"
            />
            <button
              type="button"
              disabled={busyBackup}
              onClick={() => backupInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Restaurar Respaldo (.json)
            </button>

            {onSeedCatalog && (
              <button
                type="button"
                disabled={seeding}
                onClick={() => void handleSeedDemo()}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                <HardDrive className="w-3.5 h-3.5" />
                {seeding ? 'Cargando...' : 'Cargar Catálogo de Prueba'}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
