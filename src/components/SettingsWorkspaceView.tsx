import React from 'react';
import {
  Code2,
  Image as ImageIcon,
  Monitor,
  MonitorDown,
  Palette,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sliders,
  Smartphone,
  Wifi,
} from 'lucide-react';
import type {
  AppAppearanceSettings,
  DeveloperSystemSettings,
  InstalledAppSettings,
  LoginPresentationSettings,
  PosSettings,
  ReceiptSettings,
  UserProfile,
  VisualCustomizationSettings,
  WarrantySheetSettings,
} from '../types/store';
import { AppAppearanceConfigView } from './AppAppearanceConfigView';
import { CatalogSettingsView } from './CatalogSettingsView';
import { DeveloperModeConfigView } from './DeveloperModeConfigView';
import { InstalledAppConfigView } from './InstalledAppConfigView';
import { PosConfigView } from './PosConfigView';
import { PresentationConfigView } from './PresentationConfigView';
import { ReceiptConfigView } from './ReceiptConfigView';
import { WarrantySheetConfigView } from './WarrantySheetConfigView';
import { PhoneConnectionPanel } from './BarcodeQrToolkit';
import { MobileCompanionScanner } from './MobileCompanionScanner';

export type SettingsSection =
  | 'app'
  | 'installed'
  | 'presentation'
  | 'receipt'
  | 'warranty'
  | 'catalog'
  | 'pos'
  | 'phone'
  | 'visual'
  | 'developer';

export function SettingsWorkspaceView({
  appSettings,
  receiptSettings,
  loginSettings,
  installedSettings,
  developerSettings,
  posSettings,
  warrantySettings,
  visualCustomization,
  developerProfile,
  section,
  onChangeSection,
  onOpenVisualEditor,
  onOpenPhoneScanner,
  onSeedCatalog,
}: {
  appSettings: AppAppearanceSettings;
  receiptSettings: ReceiptSettings;
  loginSettings: LoginPresentationSettings;
  installedSettings: InstalledAppSettings;
  developerSettings: DeveloperSystemSettings;
  posSettings: PosSettings;
  warrantySettings: WarrantySheetSettings;
  visualCustomization: VisualCustomizationSettings;
  developerProfile: UserProfile | null;
  section: SettingsSection;
  onChangeSection: (next: SettingsSection) => void;
  onOpenVisualEditor?: () => void;
  onOpenPhoneScanner?: () => void;
  onSeedCatalog?: () => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-700" />
              <h1 className="text-xl font-semibold text-slate-900">
                Configuración del Sistema
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Personaliza la apariencia, nombre y logo del programa instalado, pantalla de inicio, comprobantes y reglas de Modo Desarrollador.
            </p>
          </div>

          {onOpenVisualEditor && (
            <button
              type="button"
              onClick={onOpenVisualEditor}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-950 text-cyan-300 hover:bg-slate-900 border border-cyan-500/40 shadow-xs transition-colors whitespace-nowrap shrink-0 self-start lg:self-auto cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              Abrir Editor Visual Sin Código
            </button>
          )}
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => onChangeSection('app')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              section === 'app'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            Aplicación y Colores
          </button>
          <button
            type="button"
            onClick={() => onChangeSection('installed')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              section === 'installed'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MonitorDown className="w-3.5 h-3.5" />
            Programa Instalado
          </button>
          <button
            type="button"
            onClick={() => onChangeSection('presentation')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              section === 'presentation'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            Presentación de Inicio
          </button>
          <button
            type="button"
            onClick={() => onChangeSection('receipt')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              section === 'receipt'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            Comprobante de Ventas
          </button>
          <button
            type="button"
            onClick={() => onChangeSection('warranty')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              section === 'warranty'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Hoja de Garantía
          </button>
          <button
            type="button"
            onClick={() => onChangeSection('catalog')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              section === 'catalog'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Catálogo e Imágenes
          </button>
          <button
            type="button"
            onClick={() => onChangeSection('pos')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              section === 'pos'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Punto de Venta
          </button>
          <button
            type="button"
            onClick={() => onChangeSection('phone')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              section === 'phone'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Conexión de Teléfono
          </button>
          <button
            type="button"
            onClick={() => onChangeSection('developer')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              section === 'developer'
                ? 'bg-slate-950 text-cyan-300 shadow-xs'
                : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200/70'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Modo Desarrollador
          </button>
          <button
            type="button"
            onClick={() => onChangeSection('visual')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              section === 'visual'
                ? 'bg-slate-950 text-cyan-300 shadow-xs'
                : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200/70'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Editor Visual
          </button>
        </div>
      </div>

      {section === 'app' && (
        <AppAppearanceConfigView
          settings={appSettings}
          receiptSettings={receiptSettings}
          loginSettings={loginSettings}
        />
      )}

      {section === 'installed' && (
        <InstalledAppConfigView
          settings={installedSettings}
          appAppearance={appSettings}
          loginSettings={loginSettings}
          receiptSettings={receiptSettings}
        />
      )}

      {section === 'presentation' && (
        <PresentationConfigView
          settings={loginSettings}
          receiptSettings={receiptSettings}
        />
      )}

      {section === 'receipt' && (
        <ReceiptConfigView settings={receiptSettings} />
      )}

      {section === 'warranty' && (
        <WarrantySheetConfigView
          settings={warrantySettings}
          receiptSettings={receiptSettings}
        />
      )}

      {section === 'catalog' && (
        <CatalogSettingsView developerSettings={developerSettings} />
      )}

      {section === 'pos' && <PosConfigView settings={posSettings} />}

      {section === 'phone' && (
        <section
          data-visual-scope="settings-phone"
          className="max-w-7xl bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Escáner del teléfono por Wi-Fi
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Conecta el teléfono y esta PC a la misma red Wi-Fi para enviar lecturas directamente a TECNOVA.
                La cámara continua del teléfono requiere HTTPS y confiar una vez en el certificado local.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_390px] gap-6 items-start">
            <div className="space-y-5 min-w-0">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 space-y-2">
                <p className="font-semibold">Configuración segura inicial</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Abre la conexión Wi-Fi para mostrar los códigos QR.</li>
                  <li>Escanea el QR del certificado e instálalo como CA de confianza en el teléfono.</li>
                  <li>Verifica la huella SHA-256 mostrada en TECNOVA antes de confiarlo.</li>
                  <li>Escanea el QR de TECNOVA. Después, las lecturas se enviarán automáticamente.</li>
                </ol>
                <p>
                  Instala certificados CA solo de tu propia PC. Los menús de instalación y confianza dependen de la versión de Android o iOS.
                </p>
                <p className="leading-relaxed">
                  Android: busca “Instalar un certificado CA” en Seguridad y credenciales. iPhone/iPad: instala el perfil descargado y luego habilita confianza completa en Ajustes &gt; General &gt; Información &gt; Ajustes de confianza de certificados.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-900">
                  Estado y configuración de la conexión
                </h3>
                <PhoneConnectionPanel />
              </div>

              <button
                type="button"
                onClick={onOpenPhoneScanner}
                disabled={!onOpenPhoneScanner}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Wifi className="w-4 h-4" />
                Abrir escáner completo
              </button>
            </div>

            <aside className="space-y-3">
              <div>
                <h3 className="text-xs font-semibold text-slate-900">
                  Así se ve en tu teléfono
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Vista previa del escáner móvil. No activa la cámara ni envía lecturas.
                </p>
              </div>
              <div className="mx-auto h-[720px] w-full max-w-[390px] overflow-hidden rounded-[2rem] bg-slate-950 p-2 shadow-xl ring-1 ring-slate-300">
                <div className="h-full overflow-hidden rounded-[1.5rem] bg-slate-950">
                  <MobileCompanionScanner preview />
                </div>
              </div>
            </aside>
          </div>
        </section>
      )}

      {section === 'visual' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <section className="xl:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Editor Visual Sin Código
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Selecciona textos, botones o bloques y modifica su texto, posición, tamaño y colores sin tocar el código.
                </p>
              </div>
              {onOpenVisualEditor && (
                <button
                  type="button"
                  onClick={onOpenVisualEditor}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-950 text-cyan-300 hover:bg-slate-900 border border-cyan-500/40 cursor-pointer whitespace-nowrap"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Abrir Editor Visual
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ['Texto', 'Cambia títulos, etiquetas y nombres de los módulos.'],
                ['Posición', 'Mueve elementos horizontal o verticalmente.'],
                ['Tamaño', 'Define ancho, alto, escala y tamaño de letra.'],
                ['Estilo', 'Modifica colores de texto y fondo.'],
                ['Orden', 'Cambia la posición de elementos en listas y filas.'],
                ['Visibilidad', 'Oculta o restaura elementos desde el inspector.'],
              ].map(([title, description]) => (
                <div key={title} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-900">{title}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{description}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="xl:col-span-4 bg-slate-950 rounded-xl p-5 text-white space-y-4">
            <div>
              <p className="text-[11px] text-cyan-300 uppercase tracking-wide">Estado actual</p>
              <p className="text-2xl font-bold font-mono mt-1">
                {Object.keys(visualCustomization.patches || {}).length}
              </p>
              <p className="text-xs text-slate-400 mt-1">elementos personalizados</p>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300">
              Los cambios se guardan automáticamente y se aplican a toda la aplicación.
            </p>
          </aside>
        </div>
      )}

      {section === 'developer' && (
        <DeveloperModeConfigView
          developerProfile={developerProfile}
          developerSettings={developerSettings}
          visualCustomization={visualCustomization}
          appSettings={appSettings}
          installedSettings={installedSettings}
          onChangeSection={onChangeSection}
          onOpenVisualEditor={onOpenVisualEditor}
          onSeedCatalog={onSeedCatalog}
        />
      )}
    </div>
  );
}
