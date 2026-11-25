import React, { useCallback, useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import {
  Barcode,
  Camera,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  Flashlight,
  Image as ImageIcon,
  Keyboard,
  Minus,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  ShoppingBag,
  Smartphone,
  Video,
  Wifi,
  X,
} from 'lucide-react';
import {
  formatCurrency,
  type Product,
  type RepairTicket,
  type Warranty,
} from '../types/store';

export const BARCODE_AND_QR_FORMATS: Html5QrcodeSupportedFormats[] = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.QR_CODE,
];

export type ScannerContextMode = 'general' | 'pos' | 'inventory';

export interface LanBridgeInfo {
  ok: boolean;
  port: number;
  httpsPort: number;
  pin: string;
  ips: string[];
  urls: string[];
  caUrls: string[];
  caFingerprint: string;
  phoneConnected: boolean;
  totalScans: number;
  clients: number;
}

const LAN_BRIDGE_STORAGE_KEY = 'tecnova_lan_bridge_port';

export function getLanBridgeBaseUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('lanBridgePort');
    if (fromQuery && /^\d+$/.test(fromQuery)) {
      sessionStorage.setItem(LAN_BRIDGE_STORAGE_KEY, fromQuery);
      return `http://127.0.0.1:${fromQuery}`;
    }
    const stored = sessionStorage.getItem(LAN_BRIDGE_STORAGE_KEY);
    if (stored && /^\d+$/.test(stored)) {
      return `http://127.0.0.1:${stored}`;
    }
    if (
      /Electron/i.test(navigator.userAgent) &&
      (window.location.port === '41731' || window.location.protocol === 'file:')
    ) {
      return 'http://127.0.0.1:41732';
    }
  } catch {
    // ignore storage/URL errors
  }
  return null;
}

export function isMobileOrTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const coarsePointer =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  return mobileUa || coarsePointer || window.innerWidth < 768;
}

export function playScannerBeep(kind: 'ok' | 'error' = 'ok') {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(kind === 'ok' ? 70 : [70, 40, 70]);
    }
  } catch {
    // ignore vibration errors
  }

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind === 'ok' ? 'sine' : 'triangle';
    osc.frequency.value = kind === 'ok' ? 1046 : 320;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + (kind === 'ok' ? 0.12 : 0.2)
    );
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (kind === 'ok' ? 0.13 : 0.21));
  } catch {
    // ignore audio errors
  }
}

export async function decodeBarcodeFromImageFile(
  file: File,
  hiddenContainerId: string
): Promise<string> {
  const scanner = new Html5Qrcode(hiddenContainerId, {
    formatsToSupport: BARCODE_AND_QR_FORMATS,
    useBarCodeDetectorIfSupported: true,
    verbose: false,
  });
  try {
    const decoded = await scanner.scanFile(file, false);
    const token = extractCodeToken(decoded);
    if (token) return token;
    throw new Error('No se detectó ningún código de barras o QR en la foto.');
  } finally {
    try {
      scanner.clear();
    } catch {
      // ignore cleanup
    }
  }
}

export function BarcodeSvg({
  value,
  height = 44,
  displayValue = true,
  id,
}: {
  value: string;
  height?: number;
  displayValue?: boolean;
  id?: string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        lineColor: '#0f172a',
        background: '#ffffff',
        width: 1.6,
        height,
        displayValue,
        fontSize: 11,
        font: 'JetBrains Mono, monospace',
        margin: 4,
      });
    } catch {
      // Fallback if unsupported characters
    }
  }, [value, height, displayValue]);

  return (
    <svg
      ref={svgRef}
      id={id}
      className="max-w-full h-auto block"
      aria-label={`Código de barras ${value}`}
    />
  );
}

export function QrCodeImg({
  value,
  size = 132,
}: {
  value: string;
  size?: number;
}) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    if (!value) return;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (mounted) setDataUrl(url);
      })
      .catch(() => {
        if (mounted) setDataUrl('');
      });
    return () => {
      mounted = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400"
      >
        <QrCode className="w-8 h-8" />
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={`Código QR para ${value}`}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      className="rounded border border-slate-200 bg-white block"
    />
  );
}

export function PhoneConnectionPanel() {
  const [lanBridgeUrl] = useState<string | null>(() => getLanBridgeBaseUrl());
  const [lanInfo, setLanInfo] = useState<LanBridgeInfo | null>(null);
  const [lanLoading, setLanLoading] = useState(false);
  const [lanError, setLanError] = useState<string | null>(null);
  const [selectedUrlIdx, setSelectedUrlIdx] = useState(0);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCaUrl, setCopiedCaUrl] = useState(false);

  useEffect(() => {
    if (!lanBridgeUrl) return;
    let cancelled = false;

    const loadInfo = async (showLoading: boolean) => {
      if (showLoading) setLanLoading(true);
      try {
        const res = await fetch(`${lanBridgeUrl}/api/lan-scanner/info`);
        if (!res.ok) throw new Error('No se pudo consultar el puente Wi-Fi.');
        const data = (await res.json()) as LanBridgeInfo;
        if (!cancelled) {
          setLanInfo(data);
          setLanError(null);
        }
      } catch {
        if (!cancelled) {
          setLanError(
            'El puente Wi-Fi solo se activa al ejecutar TECNOVA como aplicación de escritorio en Windows (.exe).'
          );
        }
      } finally {
        if (!cancelled && showLoading) setLanLoading(false);
      }
    };

    void loadInfo(true);
    const interval = setInterval(() => {
      void loadInfo(false);
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [lanBridgeUrl]);

  const activeWifiUrl =
    lanInfo && lanInfo.urls.length > 0
      ? lanInfo.urls[Math.min(selectedUrlIdx, lanInfo.urls.length - 1)]
      : '';
  const activeCaUrl =
    lanInfo && lanInfo.caUrls.length > 0
      ? lanInfo.caUrls[Math.min(selectedUrlIdx, lanInfo.caUrls.length - 1)]
      : '';

  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
      {!lanBridgeUrl || lanError ? (
        <div className="space-y-2 text-xs text-slate-600">
          <div className="flex items-center gap-2 text-slate-900 font-semibold">
            <Smartphone className="w-4 h-4 text-blue-700" />
            <span>Conectar Teléfono como Escáner Inalámbrico (Wi-Fi)</span>
          </div>
          <p>
            {lanError ||
              'Ejecuta TECNOVA como aplicación de escritorio (.exe) para iniciar el puente y mostrar los códigos QR.'}
          </p>
        </div>
      ) : lanLoading && !lanInfo ? (
        <div className="py-6 text-center text-xs text-slate-500">
          Iniciando servidor local para emparejar tu teléfono...
        </div>
      ) : lanInfo ? (
        <div className="space-y-4">
          {lanInfo.ips.length > 1 && (
            <label className="block max-w-sm space-y-1">
              <span className="text-xs font-medium text-slate-700">
                Red / dirección de conexión
              </span>
              <select
                value={selectedUrlIdx}
                onChange={(e) => setSelectedUrlIdx(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
              >
                {lanInfo.ips.map((ip, index) => (
                  <option key={ip} value={index}>
                    {ip}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-center">
            <div className="flex flex-col items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 mx-auto">
              {activeWifiUrl ? (
                <QrCodeImg value={activeWifiUrl} size={156} />
              ) : (
                <div className="w-[156px] h-[156px] flex items-center justify-center text-xs text-slate-400 text-center">
                  Sin red Wi-Fi detectada
                </div>
              )}
              <span className="text-[11px] font-mono font-semibold text-slate-700">
                PIN: {lanInfo.pin}
              </span>
              <span className="text-[10px] text-slate-500 text-center">
                QR de TECNOVA
              </span>
            </div>

            <div className="space-y-3 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 inline-flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-blue-700" />
                  Conexión del teléfono
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-md border ${
                    lanInfo.phoneConnected
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      lanInfo.phoneConnected ? 'bg-emerald-600' : 'bg-slate-400'
                    }`}
                  />
                  {lanInfo.phoneConnected
                    ? `Teléfono conectado (${lanInfo.totalScans} envíos)`
                    : 'Esperando conexión'}
                </span>
              </div>

              <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside">
                <li>Conecta la PC y el teléfono a la misma red Wi-Fi.</li>
                <li>Instala y confía el certificado CA antes de abrir el QR de TECNOVA.</li>
                <li>Escanea el QR de TECNOVA y permite el uso de la cámara.</li>
                <li>Los códigos leídos en el teléfono se enviarán a la PC.</li>
              </ol>

              {activeCaUrl && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="shrink-0 rounded-md border border-amber-200 bg-white p-1.5">
                    <QrCodeImg value={activeCaUrl} size={88} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-[11px] font-semibold text-amber-950">
                      Certificado CA para HTTPS local
                    </p>
                    <p className="text-[10px] leading-relaxed text-amber-900">
                      Escanea para descargarlo. Instálalo como CA y confía solo si estás en tu propia PC/red.
                    </p>
                    <p className="text-[9px] font-mono text-amber-950 break-all">
                      Huella SHA-256: {lanInfo.caFingerprint}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(activeCaUrl);
                        setCopiedCaUrl(true);
                        setTimeout(() => setCopiedCaUrl(false), 1800);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-amber-950 bg-white border border-amber-300 hover:bg-amber-100 rounded-md"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedCaUrl ? 'Enlace copiado' : 'Copiar enlace del certificado'}
                    </button>
                  </div>
                </div>
              )}

              {activeWifiUrl && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={activeWifiUrl}
                    aria-label="Enlace HTTPS del escáner del teléfono"
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-[11px] font-mono bg-white border border-slate-200 rounded-lg text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(activeWifiUrl);
                      setCopiedUrl(true);
                      setTimeout(() => setCopiedUrl(false), 1800);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg shrink-0"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedUrl ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ProductLabelModal({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    if (!product) return;
    QRCode.toDataURL(product.qrCodeData || product.barcode, {
      width: 400,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(setQrUrl)
      .catch(() => setQrUrl(''));
  }, [product]);

  if (!product) return null;

  const handleDownloadFullLabel = async () => {
    if (!product) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 720;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Border
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 4;
      ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

      // Store Title Banner
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(12, 12, canvas.width - 24, 46);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('TECNOVA — ETIQUETA DE PRODUCTO', 28, 41);

      // Brand & SKU
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`${product.brand.toUpperCase()} · SKU: ${product.sku}`, 32, 88);

      // Product Name
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(product.name, 32, 120);

      // Specs
      ctx.fillStyle = '#334155';
      ctx.font = '14px sans-serif';
      const specs = [
        product.storage !== '-' ? product.storage : '',
        product.color,
        product.condition,
        product.location,
      ]
        .filter(Boolean)
        .join(' · ');
      ctx.fillText(specs, 32, 145);

      // Price
      ctx.fillStyle = '#1d4ed8';
      ctx.font = 'bold 26px monospace';
      ctx.fillText(formatCurrency(product.salePrice), 32, 188);

      // Draw QR Code Image
      if (qrUrl) {
        await new Promise<void>((resolve) => {
          const qrImg = new Image();
          qrImg.onload = () => {
            ctx.drawImage(qrImg, 510, 75, 160, 160);
            resolve();
          };
          qrImg.onerror = () => resolve();
          qrImg.src = qrUrl;
        });
      }

      // Draw Barcode SVG converted to Image
      const svgEl = document.getElementById(`full-label-barcode-${product.id || product.sku}`);
      if (svgEl) {
        const svgString = new XMLSerializer().serializeToString(svgEl);
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const DOMURL = window.URL || window.webkitURL || window;
        const blobUrl = DOMURL.createObjectURL(svgBlob);
        await new Promise<void>((resolve) => {
          const barImg = new Image();
          barImg.onload = () => {
            ctx.drawImage(barImg, 32, 255, 656, 150);
            DOMURL.revokeObjectURL(blobUrl);
            resolve();
          };
          barImg.onerror = () => {
            DOMURL.revokeObjectURL(blobUrl);
            resolve();
          };
          barImg.src = blobUrl;
        });
      }

      // Barcode number text
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(product.barcode, canvas.width / 2, 436);

      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `etiqueta-completa-${product.sku}.png`;
      a.click();
    } catch {
      // fallback
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-xl"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 no-print">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Etiqueta Completa (Código de Barras y QR)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Lista para impresión térmica o descarga con ambos códigos
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Cerrar etiqueta"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="my-5 p-5 border border-dashed border-slate-300 rounded-lg bg-white space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-mono text-slate-500 uppercase tracking-wider">
                  {product.brand} · {product.sku}
                </p>
                <h4 className="text-sm font-semibold text-slate-900 mt-1 leading-snug">
                  {product.name}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {product.storage !== '-' ? `${product.storage} · ` : ''}
                  {product.color} · {product.condition}
                </p>
                <p className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-3">
                  {formatCurrency(product.salePrice)}
                </p>
              </div>
              <div className="shrink-0">
                <QrCodeImg value={product.qrCodeData || product.barcode} size={96} />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-center">
              <BarcodeSvg value={product.barcode} height={46} id={`full-label-barcode-${product.id || product.sku}`} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 no-print">
            <button
              type="button"
              onClick={handleDownloadFullLabel}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar Etiqueta Completa (QR + Barra)
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export function extractCodeToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('TECNOVA:') || trimmed.startsWith('NEXOCELL:')) {
    const barMatch = trimmed.match(/BAR=([^|]+)/);
    if (barMatch && barMatch[1]) return barMatch[1].trim();
    const skuMatch = trimmed.match(/SKU=([^|]+)/);
    if (skuMatch && skuMatch[1]) return skuMatch[1].trim();
  }
  return trimmed;
}

/**
 * Compact modal to scan a barcode automatically via live camera video stream
 */
export function BarcodeCaptureModal({
  isOpen,
  title = 'Escanear Código de Barras',
  subtitle = 'Apunta la cámara al código de barras o QR para reconocerlo automáticamente',
  onDetected,
  onClose,
}: {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [manualInput, setManualInput] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    onDetectedRef.current = onDetected;
    onCloseRef.current = onClose;
  }, [onDetected, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setManualInput('');
      setCameraError(null);
      setTorchOn(false);
      setTorchSupported(false);
      return;
    }

    let cancelled = false;
    const stopCamera = async () => {
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
        setCameraActive(false);
        setTorchSupported(false);
        setTorchOn(false);
      }
    };

    const startCamera = async () => {
      setCameraError(null);
      try {
        const scanner = new Html5Qrcode('tecnova-capture-reader', {
          formatsToSupport: BARCODE_AND_QR_FORMATS,
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 20,
            qrbox: (vw, vh) => ({
              width: Math.min(360, Math.max(220, Math.floor(vw * 0.88))),
              height: Math.min(180, Math.max(110, Math.floor(vh * 0.45))),
            }),
          },
          (decodedText) => {
            if (cancelled) return;
            const token = extractCodeToken(decodedText);
            if (!token) return;
            playScannerBeep('ok');
            onDetectedRef.current(token);
            onCloseRef.current();
          },
          () => {
            // ignore misses
          }
        );

        if (!cancelled) {
          setCameraActive(true);
          try {
            const caps = scanner.getRunningTrackCameraCapabilities();
            if (caps?.torchFeature?.().isSupported()) {
              setTorchSupported(true);
            }
          } catch {
            // ignore torch check
          }
        }
      } catch {
        if (!cancelled) {
          setCameraActive(false);
          setCameraError(
            'Iniciando cámara en vivo... Si el navegador solicita permisos de cámara, concédelos para escaneo automático instantáneo.'
          );
        }
      }
    };

    const timer = setTimeout(() => {
      void startCamera();
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      void stopCamera();
    };
  }, [isOpen]);

  const handleToggleTorch = async () => {
    if (!scannerRef.current || !torchSupported) return;
    try {
      const next = !torchOn;
      await scannerRef.current.getRunningTrackCameraCapabilities().torchFeature().apply(next);
      setTorchOn(next);
    } catch {
      // ignore torch error
    }
  };

  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCameraError(null);
    try {
      const token = await decodeBarcodeFromImageFile(file, 'tecnova-capture-file-reader');
      playScannerBeep('ok');
      onDetected(token);
      onClose();
    } catch (err) {
      playScannerBeep('error');
      setCameraError(
        err instanceof Error
          ? err.message
          : 'No se pudo leer el código en la foto.'
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 truncate">{title}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            aria-label="Cerrar escáner de captura"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          <div className="rounded-xl border border-slate-200 bg-slate-950 overflow-hidden min-h-[230px] flex items-center justify-center relative">
            <div id="tecnova-capture-reader" className="w-full" />
            <div id="tecnova-capture-file-reader" className="hidden" />
            {!cameraActive && !cameraError && (
              <p className="text-xs text-slate-300 absolute px-4 text-center">
                Activando cámara trasera automáticamente...
              </p>
            )}
            {cameraActive && (
              <div className="absolute top-2.5 left-2.5 px-2 py-1 bg-emerald-500/90 text-white rounded text-[10px] font-semibold animate-pulse">
                Escaneando en vivo...
              </div>
            )}
            {cameraActive && torchSupported && (
              <button
                type="button"
                onClick={() => void handleToggleTorch()}
                className={`absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border ${
                  torchOn
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-slate-900/80 text-white border-slate-700'
                }`}
              >
                <Flashlight className="w-3.5 h-3.5" />
                {torchOn ? 'Linterna ON' : 'Linterna'}
              </button>
            )}
          </div>

          {cameraError && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              {cameraError}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoFile}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
            >
              ¿Problemas con cámara? Subir foto o archivo
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const token = extractCodeToken(manualInput);
              if (!token) return;
              playScannerBeep('ok');
              onDetected(token);
              onClose();
            }}
            className="flex gap-2 pt-1 border-t border-slate-100"
          >
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="O escribe / pega el código manualmente..."
              className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
            <button
              type="submit"
              className="px-3 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap"
            >
              Usar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function ScannerModal({
  isOpen,
  onClose,
  initialContext = 'general',
  initialScanMode = 'camera',
  products,
  warranties,
  repairs,
  onAdjustStock,
  onOpenEditProduct,
  onCreateNewFromCode,
  onAddToPos,
  onLocateWarranty,
  onLocateRepair,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialContext?: ScannerContextMode;
  products: Product[];
  warranties: Warranty[];
  repairs: RepairTicket[];
  onAdjustStock: (product: Product, delta: number) => Promise<void>;
  onOpenEditProduct: (product: Product) => void;
  onCreateNewFromCode: (code: string) => void;
  onAddToPos: (product: Product) => void;
  onLocateWarranty: (warranty: Warranty) => void;
  onLocateRepair: (repair: RepairTicket) => void;
  initialScanMode?: 'camera' | 'wifi';
}) {
  const [scanMode, setScanMode] = useState<'camera' | 'keyboard' | 'wifi'>(initialScanMode);
  const [autoAddPos, setAutoAddPos] = useState(initialContext === 'pos');
  const [inputCode, setInputCode] = useState('');
  const [lastScanned, setLastScanned] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
  const [posAddedCount, setPosAddedCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const [lanBridgeUrl] = useState<string | null>(() => getLanBridgeBaseUrl());
  const [lanInfo, setLanInfo] = useState<LanBridgeInfo | null>(null);
  const [lanLoading, setLanLoading] = useState(false);
  const [lanError, setLanError] = useState<string | null>(null);
  const [selectedUrlIdx, setSelectedUrlIdx] = useState(0);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCaUrl, setCopiedCaUrl] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanStampRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const productsRef = useRef(products);
  const autoAddPosRef = useRef(autoAddPos);
  const onAddToPosRef = useRef(onAddToPos);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    autoAddPosRef.current = autoAddPos;
  }, [autoAddPos]);

  useEffect(() => {
    onAddToPosRef.current = onAddToPos;
  }, [onAddToPos]);

  const handleDetectedToken = useCallback((rawToken: string) => {
    const token = extractCodeToken(rawToken);
    if (!token) return;

    const now = Date.now();
    if (
      lastScanStampRef.current.code.toLowerCase() === token.toLowerCase() &&
      now - lastScanStampRef.current.at < 1600
    ) {
      return;
    }
    lastScanStampRef.current = { code: token, at: now };

    setLastScanned(token);
    setInputCode(token);
    setErrorFeedback(null);

    const match = productsRef.current.find(
      (p) =>
        p.barcode.toLowerCase() === token.toLowerCase() ||
        p.sku.toLowerCase() === token.toLowerCase() ||
        p.qrCodeData.toLowerCase() === token.toLowerCase()
    );

    if (autoAddPosRef.current) {
      if (match) {
        if (!match.active) {
          playScannerBeep('error');
          setFeedback(null);
          setErrorFeedback(`"${match.name}" está inactivo en catálogo.`);
          return;
        }
        if (match.stock <= 0) {
          playScannerBeep('error');
          setFeedback(null);
          setErrorFeedback(`"${match.name}" no tiene stock disponible (Stock: 0).`);
          return;
        }
        onAddToPosRef.current(match);
        playScannerBeep('ok');
        setPosAddedCount((c) => c + 1);
        setFeedback(`Agregado al carrito POS: ${match.name} (+1)`);
      } else {
        playScannerBeep('error');
        setFeedback(null);
        setErrorFeedback(`Código ${token} no encontrado en el inventario.`);
      }
      return;
    }

    playScannerBeep('ok');
    setFeedback(
      match
        ? `Producto detectado: ${match.name} (Stock actual: ${match.stock})`
        : `Código escaneado: ${token}`
    );
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setInputCode('');
      setLastScanned('');
      setCameraError(null);
      setFeedback(null);
      setErrorFeedback(null);
      setPosAddedCount(0);
      setTorchOn(false);
      setTorchSupported(false);
      return;
    }
    setAutoAddPos(initialContext === 'pos');
    setScanMode(initialScanMode);
  }, [isOpen, initialContext, initialScanMode]);

  useEffect(() => {
    if (isOpen && scanMode === 'keyboard') {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen, scanMode]);

  useEffect(() => {
    let cancelled = false;
    const stopCamera = async () => {
      if (qrScannerRef.current) {
        try {
          if (qrScannerRef.current.isScanning) {
            await qrScannerRef.current.stop();
          }
          qrScannerRef.current.clear();
        } catch {
          // ignore
        }
        qrScannerRef.current = null;
      }
      if (!cancelled) {
        setCameraActive(false);
        setTorchSupported(false);
        setTorchOn(false);
      }
    };

    if (!isOpen || scanMode !== 'camera') {
      void stopCamera();
      return;
    }

    const startCamera = async () => {
      setCameraError(null);
      try {
        const list = await Html5Qrcode.getCameras().catch(() => []);
        if (!cancelled && Array.isArray(list) && list.length > 0) {
          setCameras(list.map((c) => ({ id: c.id, label: c.label || 'Cámara' })));
        }

        const scanner = new Html5Qrcode('nexocell-qr-reader', {
          formatsToSupport: BARCODE_AND_QR_FORMATS,
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        });
        qrScannerRef.current = scanner;

        const cameraConstraint: string | MediaTrackConstraints = selectedCameraId
          ? selectedCameraId
          : { facingMode: 'environment' };

        await scanner.start(
          cameraConstraint,
          {
            fps: 20,
            qrbox: (vw, vh) => ({
              width: Math.min(360, Math.max(220, Math.floor(vw * 0.88))),
              height: Math.min(180, Math.max(110, Math.floor(vh * 0.45))),
            }),
          },
          (decodedText) => {
            if (!cancelled) {
              handleDetectedToken(decodedText);
            }
          },
          () => {
            // ignore misses
          }
        );

        if (!cancelled) {
          setCameraActive(true);
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
          setCameraError(
            'Iniciando cámara en vivo automáticamente...'
          );
          setCameraActive(false);
        }
      }
    };

    const timer = setTimeout(() => {
      void startCamera();
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      void stopCamera();
    };
  }, [isOpen, scanMode, selectedCameraId, handleDetectedToken]);

  const handleToggleTorch = async () => {
    if (!qrScannerRef.current || !torchSupported) return;
    try {
      const next = !torchOn;
      await qrScannerRef.current.getRunningTrackCameraCapabilities().torchFeature().apply(next);
      setTorchOn(next);
    } catch {
      // ignore
    }
  };

  const handlePhotoScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCameraError(null);
    setErrorFeedback(null);
    try {
      const token = await decodeBarcodeFromImageFile(file, 'nexocell-qr-file-reader');
      handleDetectedToken(token);
    } catch (err) {
      playScannerBeep('error');
      setErrorFeedback(
        err instanceof Error
          ? err.message
          : 'No se detectó un código de barras legible en la foto.'
      );
    }
  };

  if (!isOpen) return null;

  const resolvedToken = extractCodeToken(lastScanned || inputCode);
  const matchedProduct = resolvedToken
    ? products.find(
        (p) =>
          p.barcode.toLowerCase() === resolvedToken.toLowerCase() ||
          p.sku.toLowerCase() === resolvedToken.toLowerCase() ||
          p.qrCodeData.toLowerCase() === resolvedToken.toLowerCase()
      )
    : undefined;

  const matchedWarranty =
    !matchedProduct && resolvedToken
      ? warranties.find(
          (w) =>
            w.warrantyCode.toLowerCase() === resolvedToken.toLowerCase() ||
            w.imei.toLowerCase() === resolvedToken.toLowerCase()
        )
      : undefined;

  const matchedRepair =
    !matchedProduct && !matchedWarranty && resolvedToken
      ? repairs.find(
          (r) =>
            r.ticketCode.toLowerCase() === resolvedToken.toLowerCase() ||
            r.imei.toLowerCase() === resolvedToken.toLowerCase()
        )
      : undefined;

  const handleSubmitCode = (e: React.FormEvent) => {
    e.preventDefault();
    const token = extractCodeToken(inputCode);
    if (!token) return;
    handleDetectedToken(token);
  };

  const handleStockQuick = async (delta: number) => {
    if (!matchedProduct || busy) return;
    setBusy(true);
    try {
      await onAdjustStock(matchedProduct, delta);
      playScannerBeep('ok');
      setFeedback(
        `Stock actualizado (${delta > 0 ? `+${delta}` : delta}) para ${matchedProduct.name}.`
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl my-auto max-h-[94vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 truncate">
                {initialContext === 'pos'
                  ? 'Escáner Automático para Punto de Ventas (POS)'
                  : initialContext === 'inventory'
                    ? 'Escáner Automático para Inventario'
                    : 'Escáner Automático de Código de Barras y QR'}
              </h2>
              <p className="text-xs text-slate-500 truncate">
                {autoAddPos
                  ? 'Reconocimiento automático continuo: cada código suma +1 al POS'
                  : 'Apunta la cámara al código para reconocerlo al instante'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Cerrar escáner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit max-w-full overflow-x-auto">
              <button
                type="button"
                onClick={() => setScanMode('camera')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  scanMode === 'camera'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                Cámara Automática
              </button>
              <button
                type="button"
                onClick={() => setScanMode('keyboard')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  scanMode === 'keyboard'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5" />
                USB / Manual
              </button>
              <button
                type="button"
                onClick={() => setScanMode('wifi')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  scanMode === 'wifi'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Wifi className="w-3.5 h-3.5" />
                Teléfono por Wi-Fi
              </button>
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoAddPos}
                onChange={(e) => setAutoAddPos(e.target.checked)}
                className="rounded border-slate-300 text-blue-700 focus:ring-blue-700"
              />
              <span>Agregar directo al POS</span>
              {posAddedCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-blue-100 text-blue-800 rounded">
                  +{posAddedCount}
                </span>
              )}
            </label>
          </div>

          {scanMode === 'keyboard' && (
            <form onSubmit={handleSubmitCode} className="space-y-3">
              <label className="block text-xs font-medium text-slate-700">
                Escanea con pistola USB/Bluetooth o escribe el código de barra, SKU, QR o IMEI
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputCode}
                    onChange={(e) => {
                      setInputCode(e.target.value);
                      if (!autoAddPos) {
                        setLastScanned(e.target.value);
                      }
                    }}
                    placeholder="Ej: 7501055301501 o IPH-15PRO-256"
                    className="w-full pl-9 pr-3 py-2.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
                >
                  {autoAddPos ? 'Agregar' : 'Buscar'}
                </button>
              </div>
            </form>
          )}

          {scanMode === 'camera' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {cameras.length > 1 && (
                  <select
                    value={selectedCameraId}
                    onChange={(e) => setSelectedCameraId(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 max-w-full"
                    aria-label="Seleccionar cámara"
                  >
                    <option value="">Cámara trasera automática</option>
                    {cameras.map((cam) => (
                      <option key={cam.id} value={cam.id}>
                        {cam.label || cam.id}
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  {cameraActive && torchSupported && (
                    <button
                      type="button"
                      onClick={() => void handleToggleTorch()}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        torchOn
                          ? 'bg-amber-400 text-slate-950 border-amber-300'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Flashlight className="w-3.5 h-3.5" />
                      {torchOn ? 'Linterna ON' : 'Linterna'}
                    </button>
                  )}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoScan}
                  />
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    Subir foto opcional
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-950 overflow-hidden min-h-[240px] flex items-center justify-center relative">
                <div id="nexocell-qr-reader" className="w-full" />
                <div id="nexocell-qr-file-reader" className="hidden" />
                {!cameraActive && !cameraError && (
                  <p className="text-xs text-slate-300 absolute px-4 text-center">
                    Activando cámara en vivo para reconocimiento automático...
                  </p>
                )}
                {cameraActive && (
                  <div className="absolute top-3 left-3 px-2.5 py-1 bg-emerald-500/90 text-white rounded-md text-[11px] font-semibold animate-pulse shadow">
                    Reconocimiento automático activo
                  </div>
                )}
              </div>

              {cameraError && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  {cameraError}
                </div>
              )}
            </div>
          )}

          {scanMode === 'wifi' && <PhoneConnectionPanel />}

          {feedback && (
            <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="truncate">{feedback}</span>
              </div>
              {autoAddPos && posAddedCount > 0 && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md shrink-0"
                >
                  Listo / Cobrar
                </button>
              )}
            </div>
          )}

          {errorFeedback && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              <span>{errorFeedback}</span>
            </div>
          )}

          {resolvedToken && matchedProduct && (
            <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-mono text-slate-500">
                    {matchedProduct.sku} · Barra: {matchedProduct.barcode}
                  </p>
                  <h4 className="text-base font-semibold text-slate-900 mt-0.5">
                    {matchedProduct.name}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    {matchedProduct.category} · {matchedProduct.location} · Precio:{' '}
                    <span className="font-mono font-semibold text-slate-900">
                      {formatCurrency(matchedProduct.salePrice)}
                    </span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-500">Stock Actual</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    {matchedProduct.stock}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleStockQuick(1)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-200 hover:border-slate-300 text-slate-900 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  +1 Stock
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleStockQuick(5)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-200 hover:border-slate-300 text-slate-900 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  +5 Stock
                </button>
                <button
                  type="button"
                  disabled={busy || matchedProduct.stock <= 0}
                  onClick={() => handleStockQuick(-1)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-200 hover:border-slate-300 text-slate-900 rounded-lg transition-colors disabled:opacity-40"
                >
                  <Minus className="w-3.5 h-3.5 text-red-600" />
                  -1 Stock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEditProduct(matchedProduct);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-200 hover:border-slate-300 text-slate-900 rounded-lg transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Editar Ficha
                </button>
                <button
                  type="button"
                  disabled={matchedProduct.stock <= 0}
                  onClick={() => {
                    onAddToPos(matchedProduct);
                    if (!autoAddPos) {
                      onClose();
                    } else {
                      playScannerBeep('ok');
                      setPosAddedCount((c) => c + 1);
                      setFeedback(`Agregado al carrito POS: ${matchedProduct.name} (+1)`);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition-colors ml-auto disabled:opacity-40"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Agregar a Venta
                </button>
              </div>
            </div>
          )}

          {resolvedToken && matchedWarranty && (
            <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-mono text-slate-500">
                  Garantía {matchedWarranty.warrantyCode} · IMEI {matchedWarranty.imei}
                </p>
                <h4 className="text-sm font-semibold text-slate-900 mt-0.5">
                  {matchedWarranty.productName} — {matchedWarranty.customerName}
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Estado: {matchedWarranty.status} · Vence: {matchedWarranty.expiresDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onLocateWarranty(matchedWarranty);
                  onClose();
                }}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap"
              >
                Abrir Garantía
              </button>
            </div>
          )}

          {resolvedToken && matchedRepair && (
            <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-mono text-slate-500">
                  Orden Técnica {matchedRepair.ticketCode} · IMEI {matchedRepair.imei}
                </p>
                <h4 className="text-sm font-semibold text-slate-900 mt-0.5">
                  {matchedRepair.deviceBrand} {matchedRepair.deviceModel} —{' '}
                  {matchedRepair.customerName}
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Estado actual: {matchedRepair.status}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onLocateRepair(matchedRepair);
                  onClose();
                }}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap"
              >
                Ver Reparación
              </button>
            </div>
          )}

          {resolvedToken && !matchedProduct && !matchedWarranty && !matchedRepair && (
            <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-mono text-slate-500">Código sin registro</p>
                <h4 className="text-sm font-semibold text-slate-900 mt-0.5">
                  El código <span className="font-mono">{resolvedToken}</span> no existe en el
                  inventario
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Puedes darlo de alta ahora mismo con este código de barras ya cargado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCreateNewFromCode(resolvedToken);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Registrar Producto
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
