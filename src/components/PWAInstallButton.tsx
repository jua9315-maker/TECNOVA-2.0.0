import React, { useState } from 'react';
import { MonitorDown, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'compact' | 'full' }> = ({
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) return;
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        className={
          variant === 'full'
            ? 'w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors'
            : 'inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0'
        }
      >
        <MonitorDown className="w-4 h-4 text-blue-700 shrink-0" />
        <span>Instalar en Escritorio</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Instalar TECNOVA como App de Escritorio
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Funciona en ventana propia y 100% sin conexión a internet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="list-decimal pl-4 space-y-2 text-xs text-slate-700 leading-relaxed">
                <li>
                  Toca el botón <strong>Compartir</strong> en la barra de Safari.
                </li>
                <li>
                  Desliza hacia abajo y selecciona{' '}
                  <strong>Agregar a pantalla de inicio</strong>.
                </li>
              </ol>
            ) : (
              <ol className="list-decimal pl-4 space-y-2 text-xs text-slate-700 leading-relaxed">
                <li>
                  Si estás viendo la vista previa integrada, abre la aplicación en una{' '}
                  <strong>pestaña independiente de Chrome o Microsoft Edge</strong>.
                </li>
                <li>
                  Haz clic en el icono de{' '}
                  <strong>Instalar aplicación</strong> en la barra de direcciones (esquina superior derecha) o en{' '}
                  <strong>Menú → Guardar y compartir → Instalar TECNOVA</strong>.
                </li>
                <li>
                  Se creará un acceso directo en tu Escritorio / Menú Inicio para abrirla como programa local sin barras de navegador y sin internet.
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
