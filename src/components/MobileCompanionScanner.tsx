import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Barcode,
  Camera,
  CheckCircle2,
  Flashlight,
  PackagePlus,
  Send,
  ShoppingCart,
  Smartphone,
  Video,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  BARCODE_AND_QR_FORMATS,
  decodeBarcodeFromImageFile,
  extractCodeToken,
  playScannerBeep,
} from './BarcodeQrToolkit';

interface SentScanItem {
  id: number;
  code: string;
  mode: 'pos' | 'inventory';
  time: string;
  ok: boolean;
  message: string;
}

export function MobileCompanionScanner({
  preview = false,
}: {
  preview?: boolean;
}) {
  const [pin] = useState<string>(() => {
    if (preview) return '';
    try {
      return new URLSearchParams(window.location.search).get('pin') || '';
    } catch {
      return '';
    }
  });
  const [targetMode, setTargetMode] = useState<'pos' | 'inventory'>(() => {
    try {
      const m = new URLSearchParams(window.location.search).get('mode');
      return m === 'inventory' ? 'inventory' : 'pos';
    } catch {
      return 'pos';
    }
  });
  const [connected, setConnected] = useState<boolean>(preview);
  const [statusMessage, setStatusMessage] = useState<string>(
    preview
      ? 'Vista previa del escáner del teléfono'
      : 'Verificando conexión con TECNOVA PC...'
  );
  const [liveCameraOpen, setLiveCameraOpen] = useState<boolean>(() => {
    if (preview) return true;
    try {
      const hasPin = Boolean(new URLSearchParams(window.location.search).get('pin'));
      return hasPin && window.isSecureContext;
    } catch {
      return false;
    }
  });
  const [liveCameraActive, setLiveCameraActive] = useState<boolean>(false);
  const [liveCameraError, setLiveCameraError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [photoBusy, setPhotoBusy] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [history, setHistory] = useState<SentScanItem[]>([]);

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastLiveScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const targetModeRef = useRef(targetMode);
  const pinRef = useRef(pin);

  useEffect(() => {
    targetModeRef.current = targetMode;
  }, [targetMode]);

  useEffect(() => {
    pinRef.current = pin;
  }, [pin]);

  const verifyConnection = useCallback(async (currentPin: string) => {
    if (preview) return true;
    if (!currentPin.trim()) {
      setConnected(false);
      setStatusMessage('Escanea el QR de conexión que aparece en TECNOVA PC.');
      return false;
    }
    try {
      const res = await fetch(
        `/api/lan-scanner/verify?pin=${encodeURIComponent(currentPin.trim())}`
      );
      if (!res.ok) {
        setConnected(false);
        setStatusMessage('PIN incorrecto o sesión expirada. Vuelve a escanear el QR de tu PC.');
        return false;
      }
      setConnected(true);
      setStatusMessage('Conectado a TECNOVA PC por Wi-Fi local');
      return true;
    } catch {
      setConnected(false);
      setStatusMessage('Sin conexión con la PC. Verifica que ambos estén en el mismo Wi-Fi.');
      return false;
    }
  }, [preview]);

  useEffect(() => {
    if (preview) return;
    void verifyConnection(pin);
    const timer = setInterval(() => {
      if (pinRef.current.trim()) {
        void verifyConnection(pinRef.current);
      }
    }, 12000);
    return () => clearInterval(timer);
  }, [pin, preview, verifyConnection]);

  const sendCodeToPc = useCallback(async (rawCode: string, fromLiveCamera = false) => {
    if (preview) return;
    const code = extractCodeToken(rawCode);
    if (!code) return;

    const now = Date.now();
    if (
      fromLiveCamera &&
      lastLiveScanRef.current.code.toLowerCase() === code.toLowerCase() &&
      now - lastLiveScanRef.current.at < 1600
    ) {
      return;
    }
    lastLiveScanRef.current = { code, at: now };

    const activePin = pinRef.current.trim();
    const activeMode = targetModeRef.current;

    if (!activePin) {
      playScannerBeep('error');
      setStatusMessage('Escanea el QR de conexión que aparece en TECNOVA PC.');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/lan-scanner/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: activePin,
          code,
          mode: activeMode,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      const timeLabel = new Date().toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      if (!res.ok || !data.ok) {
        playScannerBeep('error');
        setHistory((prev) => [
          {
            id: now,
            code,
            mode: activeMode,
            time: timeLabel,
            ok: false,
            message: data.error || 'No se pudo enviar',
          },
          ...prev.slice(0, 14),
        ]);
        return;
      }

      playScannerBeep('ok');
      setConnected(true);
      setHistory((prev) => [
        {
          id: now,
          code,
          mode: activeMode,
          time: timeLabel,
          ok: true,
          message:
            activeMode === 'pos'
              ? 'Enviado al carrito POS de la PC'
              : 'Enviado a Registro de Inventario en la PC',
        },
        ...prev.slice(0, 14),
      ]);
    } catch {
      playScannerBeep('error');
      setConnected(false);
      setStatusMessage('Se perdió la conexión con TECNOVA PC.');
    } finally {
      setSending(false);
    }
  }, [preview]);

  useEffect(() => {
    let cancelled = false;
    const stopLive = async () => {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch {
          // ignore
        }
        scannerRef.current = null;
      }
      if (!cancelled) {
        setLiveCameraActive(false);
        setTorchSupported(false);
        setTorchOn(false);
      }
    };

    if (preview) {
      setLiveCameraActive(false);
      setTorchSupported(false);
      setTorchOn(false);
      return;
    }

    if (!liveCameraOpen || !connected) {
      void stopLive();
      return;
    }

    const startLive = async () => {
      setLiveCameraError(null);
      if (!window.isSecureContext) {
        setLiveCameraActive(false);
        setLiveCameraError(
          'Estás conectado por HTTP directo (sin certificado): usa el botón blanco "Escanear Código con Cámara del Teléfono" arriba para leer códigos, o usa el modo HTTPS si prefieres video continuo.'
        );
        return;
      }
      try {
        const scanner = new Html5Qrcode('tecnova-mobile-live-reader', {
          formatsToSupport: BARCODE_AND_QR_FORMATS,
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: (vw, vh) => ({
              width: Math.min(340, Math.max(200, Math.floor(vw * 0.86))),
              height: Math.min(180, Math.max(105, Math.floor(vh * 0.42))),
            }),
          },
          (decoded) => {
            if (!cancelled) {
              void sendCodeToPc(decoded, true);
            }
          },
          () => {
            // ignore misses
          }
        );

        if (!cancelled) {
          setLiveCameraActive(true);
          try {
            const caps = scanner.getRunningTrackCameraCapabilities();
            if (caps?.torchFeature?.().isSupported()) {
              setTorchSupported(true);
            }
          } catch {
            // ignore
          }
        }
      } catch {
        if (!cancelled) {
          setLiveCameraActive(false);
          setLiveCameraError(
            'Este navegador no permite cámara continua en esta conexión local. Prueba abrir el enlace en Chrome o Safari y permitir el acceso a la cámara; si sigue bloqueado, usa el escaneo con foto.'
          );
        }
      }
    };

    const timer = setTimeout(() => {
      void startLive();
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      void stopLive();
    };
  }, [liveCameraOpen, connected, preview, sendCodeToPc]);

  const handleToggleTorch = async () => {
    if (preview) return;
    if (!scannerRef.current || !torchSupported) return;
    try {
      const next = !torchOn;
      await scannerRef.current.getRunningTrackCameraCapabilities().torchFeature().apply(next);
      setTorchOn(next);
    } catch {
      // ignore
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (preview) return;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    setLiveCameraError(null);
    try {
      const token = await decodeBarcodeFromImageFile(file, 'tecnova-mobile-file-reader');
      await sendCodeToPc(token, false);
    } catch (err) {
      playScannerBeep('error');
      setLiveCameraError(
        err instanceof Error
          ? err.message
          : 'No se pudo leer el código de barras en la foto. Intenta acercar más la cámara.'
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <div
      className={`${
        preview ? 'h-full overflow-y-auto' : 'min-h-screen'
      } bg-slate-950 text-slate-100 flex flex-col`}
    >
      <header className="px-4 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-white truncate">
              TECNOVA Escáner Móvil
            </h1>
            <p className="text-[11px] text-slate-400 truncate">{statusMessage}</p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg border shrink-0 ${
            connected
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          }`}
        >
          {preview ? (
            <Smartphone className="w-3.5 h-3.5" />
          ) : connected ? (
            <Wifi className="w-3.5 h-3.5" />
          ) : (
            <WifiOff className="w-3.5 h-3.5" />
          )}
          {preview ? 'Vista previa' : connected ? 'En línea' : 'Sin enlace'}
        </span>
      </header>

      <main className="flex-1 p-4 max-w-lg w-full mx-auto space-y-4">
        {/* Target Destination on PC */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-400">
            Enviar códigos escaneados a:
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              aria-disabled={preview || undefined}
              tabIndex={preview ? -1 : undefined}
              onClick={() => {
                if (!preview) setTargetMode('pos');
              }}
              className={`p-3 rounded-xl border text-left transition-colors flex items-center gap-2.5 aria-disabled:cursor-default aria-disabled:opacity-70 ${
                targetMode === 'pos'
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-950/50'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <ShoppingCart className="w-5 h-5 shrink-0" />
              <div>
                <p className="text-xs font-bold">Punto de Ventas</p>
                <p className="text-[10px] opacity-80">Sumar al carrito POS</p>
              </div>
            </button>

            <button
              type="button"
              aria-disabled={preview || undefined}
              tabIndex={preview ? -1 : undefined}
              onClick={() => {
                if (!preview) setTargetMode('inventory');
              }}
              className={`p-3 rounded-xl border text-left transition-colors flex items-center gap-2.5 aria-disabled:cursor-default aria-disabled:opacity-70 ${
                targetMode === 'inventory'
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-950/50'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <PackagePlus className="w-5 h-5 shrink-0" />
              <div>
                <p className="text-xs font-bold">Inventario</p>
                <p className="text-[10px] opacity-80">Registrar o editar</p>
              </div>
            </button>
          </div>
        </div>

        {/* Primary Photo Scan Action (works on iOS/Android HTTP LAN) */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoCapture}
        />
        <div id="tecnova-mobile-file-reader" className="hidden" />

        <button
          type="button"
          aria-disabled={preview || photoBusy || sending || undefined}
          tabIndex={preview ? -1 : undefined}
          onClick={() => {
            if (!preview) photoInputRef.current?.click();
          }}
          className="w-full py-4 px-5 rounded-xl bg-white text-slate-950 hover:bg-slate-100 active:scale-[0.99] transition-all font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl aria-disabled:opacity-60"
        >
          <Camera className="w-5 h-5 text-blue-700" />
          {photoBusy
            ? 'Leyendo código de barras...'
            : 'Escanear Código con Cámara del Teléfono'}
        </button>

        {/* Live Video Stream Option */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-300 inline-flex items-center gap-1.5">
              <Video className="w-4 h-4 text-blue-400" />
              Cámara continua en vivo
            </span>
            <button
              type="button"
              aria-disabled={preview || undefined}
              tabIndex={preview ? -1 : undefined}
              onClick={() => {
                if (!preview) setLiveCameraOpen((v) => !v);
              }}
              className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-white aria-disabled:opacity-70"
            >
              {liveCameraOpen ? 'Cerrar cámara' : 'Activar Video'}
            </button>
          </div>

          {liveCameraOpen && (
            <div className="space-y-2">
              <div className="rounded-lg overflow-hidden bg-black border border-slate-800 min-h-[190px] relative flex items-center justify-center">
                <div id="tecnova-mobile-live-reader" className="w-full" />
                {preview ? (
                  <p className="text-xs text-slate-400 absolute">
                    Vista de cámara en vivo
                  </p>
                ) : !liveCameraActive && !liveCameraError ? (
                  <p className="text-xs text-slate-400 absolute">Iniciando video...</p>
                ) : null}
                {liveCameraActive && torchSupported && (
                  <button
                    type="button"
                    onClick={() => void handleToggleTorch()}
                    className={`absolute bottom-2 right-2 px-2.5 py-1 text-[11px] font-medium rounded-lg border inline-flex items-center gap-1 ${
                      torchOn
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-slate-900/80 text-white border-slate-700'
                    }`}
                  >
                    <Flashlight className="w-3.5 h-3.5" />
                    {torchOn ? 'Luz ON' : 'Linterna'}
                  </button>
                )}
              </div>
            </div>
          )}

          {liveCameraError && (
            <p className="text-xs text-amber-300 bg-amber-950/50 border border-amber-800/60 rounded-lg p-2.5">
              {liveCameraError}
            </p>
          )}
        </div>

        {/* Manual / Clipboard Entry */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (preview) return;
            if (!manualCode.trim()) return;
            void sendCodeToPc(manualCode, false);
            setManualCode('');
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={manualCode}
              readOnly={preview}
              aria-disabled={preview || undefined}
              tabIndex={preview ? -1 : undefined}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Escribir o pegar código manualmente..."
              className="w-full pl-9 pr-3 py-2.5 text-sm font-mono bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <button
            type="submit"
            disabled={!preview && (sending || !manualCode.trim())}
            aria-disabled={preview || sending || !manualCode.trim() || undefined}
            tabIndex={preview ? -1 : undefined}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 aria-disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            Enviar
          </button>
        </form>

        {/* Sent Scan History */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
          <p className="text-xs font-semibold text-slate-300">
            Últimos códigos enviados ({history.length})
          </p>
          {history.length === 0 ? (
            <p className="text-xs text-slate-500">
              Aún no se han enviado lecturas en esta sesión.
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-mono font-bold text-white truncate">
                      {item.code}
                    </p>
                    <p
                      className={`text-[11px] truncate ${
                        item.ok ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {item.message}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-slate-500 block">
                      {item.time}
                    </span>
                    {item.ok && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-auto mt-0.5" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
