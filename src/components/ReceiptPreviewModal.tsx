import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Settings, X } from 'lucide-react';
import {
  formatCurrency,
  type ReceiptSettings,
  type Sale,
} from '../types/store';
import { QrCodeImg } from './BarcodeQrToolkit';

export function ReceiptDocument({
  sale,
  settings,
}: {
  sale: Sale;
  settings: ReceiptSettings;
}) {
  const isThermal58 = settings.paperWidth === '58mm';
  const isA4 = settings.paperWidth === 'A4';

  const containerWidthClass = isThermal58
    ? 'w-full max-w-[260px] text-[11px]'
    : isA4
      ? 'w-full max-w-[640px] text-xs'
      : 'w-full max-w-[330px] text-xs';

  const dateTimeLabel = sale.createdAt?.toDate
    ? sale.createdAt.toDate().toLocaleString('es-MX', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : sale.dateKey;

  return (
    <div
      className={`${containerWidthClass} mx-auto bg-white text-slate-900 border border-slate-200 rounded-lg p-5 font-mono shadow-xs print:border-0 print:shadow-none print:rounded-none print:p-2`}
    >
      {/* Header */}
      <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
        {settings.showLogo && settings.logoDataUrl && (
          <div className="pb-1.5 flex justify-center">
            <img
              src={settings.logoDataUrl}
              alt={`Logo de ${settings.businessName}`}
              className={`${
                isThermal58
                  ? 'max-h-12 max-w-[160px]'
                  : isA4
                    ? 'max-h-20 max-w-[260px]'
                    : 'max-h-16 max-w-[210px]'
              } w-auto object-contain mx-auto`}
            />
          </div>
        )}
        <p className={`${isA4 ? 'text-lg' : 'text-sm'} font-bold tracking-tight font-sans`}>
          {settings.businessName}
        </p>
        {settings.tagline && (
          <p className="text-[11px] text-slate-600 font-sans">
            {settings.tagline}
          </p>
        )}
        {settings.taxId && (
          <p className="text-[10px] text-slate-500">ID Fiscal: {settings.taxId}</p>
        )}
        {settings.address && (
          <p className="text-[10px] text-slate-600 font-sans leading-snug">
            {settings.address}
          </p>
        )}
        {settings.phone && (
          <p className="text-[10px] text-slate-600">Tel: {settings.phone}</p>
        )}
      </div>

      {/* Sale Meta */}
      <div className="py-2.5 space-y-1 border-b border-dashed border-slate-300 text-[11px]">
        <div className="flex justify-between gap-2">
          <span className="text-slate-500">Folio:</span>
          <span className="font-semibold">{sale.saleNumber}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-500">Fecha:</span>
          <span>{dateTimeLabel}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-500">Cliente:</span>
          <span className="text-right truncate max-w-[180px]">{sale.customerName}</span>
        </div>
        {sale.customerPhone && sale.customerPhone !== 'Sin teléfono' && (
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Tel. Cliente:</span>
            <span>{sale.customerPhone}</span>
          </div>
        )}
        {settings.showSeller && (
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Atendió:</span>
            <span className="text-right truncate max-w-[180px]">{sale.sellerName}</span>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <span className="text-slate-500">Pago:</span>
          <span>{sale.paymentMethod}</span>
        </div>
      </div>

      {/* Line Items */}
      <div className="py-2.5 space-y-2 border-b border-dashed border-slate-300">
        <div className="flex justify-between text-[10px] text-slate-500 uppercase">
          <span>Descripción</span>
          <span>Importe</span>
        </div>

        {sale.items.map((item, idx) => (
          <div key={`${item.productId}-${idx}`} className="space-y-0.5">
            <div className="flex justify-between gap-2 items-start">
              <span className="font-sans font-medium text-slate-900 leading-snug">
                {item.quantity}x {item.productName}
              </span>
              <span className="tabular-nums font-semibold shrink-0">
                {formatCurrency(item.unitPrice * item.quantity)}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-2">
              <span>{formatCurrency(item.unitPrice)} c/u</span>
              {settings.showImei && item.imei && (
                <span>IMEI: {item.imei}</span>
              )}
              {settings.showWarrantyNote && item.warrantyMonths > 0 && (
                <span>Garantía: {item.warrantyMonths}m</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="py-2.5 space-y-1 border-b border-dashed border-slate-300">
        <div className="flex justify-between text-[11px] text-slate-600">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatCurrency(sale.subtotal)}</span>
        </div>
        {sale.discount > 0 && (
          <div className="flex justify-between text-[11px] text-emerald-700">
            <span>Descuento</span>
            <span className="tabular-nums">-{formatCurrency(sale.discount)}</span>
          </div>
        )}
        {settings.showTax !== false &&
          typeof sale.taxAmount === 'number' &&
          (sale.taxAmount > 0 || (sale.taxRate ?? 0) > 0) && (() => {
            const label = sale.taxLabel || settings.taxLabel || 'IVA';
            const rate = sale.taxRate ?? 0;
            const isIncluded = sale.taxIncluded !== false;
            const netBase = Math.max(0, sale.total - sale.taxAmount);
            return (
              <>
                {isIncluded && (
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Base sin {label}</span>
                    <span className="tabular-nums">{formatCurrency(netBase)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[11px] text-slate-700">
                  <span>
                    {label} ({rate}%{isIncluded ? ' inc.' : ''})
                  </span>
                  <span className="tabular-nums">
                    {isIncluded ? '' : '+'}
                    {formatCurrency(sale.taxAmount)}
                  </span>
                </div>
              </>
            );
          })()}
        <div className="flex justify-between text-sm font-bold text-slate-900 pt-1">
          <span>TOTAL</span>
          <span className="tabular-nums">{formatCurrency(sale.total)}</span>
        </div>
        {settings.showCashChange !== false &&
          typeof sale.amountTendered === 'number' && (
            <div className="pt-1.5 mt-1.5 border-t border-dotted border-slate-300 space-y-0.5 text-[11px]">
              <div className="flex justify-between text-slate-700">
                <span>Efectivo recibido</span>
                <span className="tabular-nums font-medium">
                  {formatCurrency(sale.amountTendered)}
                </span>
              </div>
              <div className="flex justify-between text-slate-900 font-semibold">
                <span>Cambio</span>
                <span className="tabular-nums">
                  {formatCurrency(
                    typeof sale.changeAmount === 'number'
                      ? sale.changeAmount
                      : Math.max(0, sale.amountTendered - sale.total)
                  )}
                </span>
              </div>
            </div>
          )}
      </div>

      {/* Footer + QR */}
      <div className="pt-3 text-center space-y-2.5">
        {settings.showQrCode && (
          <div className="flex flex-col items-center gap-1">
            <QrCodeImg value={sale.saleNumber} size={isThermal58 ? 72 : 84} />
            <span className="text-[9px] text-slate-500">{sale.saleNumber}</span>
          </div>
        )}
        {settings.footerMessage && (
          <p className="text-[10px] text-slate-600 font-sans leading-relaxed whitespace-pre-line">
            {settings.footerMessage}
          </p>
        )}
      </div>
    </div>
  );
}

export function ReceiptPreviewModal({
  sale,
  settings,
  onClose,
  onOpenSettings,
}: {
  sale: Sale | null;
  settings: ReceiptSettings;
  onClose: () => void;
  onOpenSettings?: () => void;
}) {
  useEffect(() => {
    const cleanup = () => {
      document.body.classList.remove('printing-receipt');
    };
    window.addEventListener('afterprint', cleanup);
    return () => {
      window.removeEventListener('afterprint', cleanup);
      cleanup();
    };
  }, []);

  if (!sale) return null;

  const handlePrint = () => {
    document.body.classList.add('printing-receipt');
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        document.body.classList.remove('printing-receipt');
      }, 300);
    }, 50);
  };

  const paperLabel =
    settings.paperWidth === '58mm'
      ? 'Ticket Térmico 58mm'
      : settings.paperWidth === 'A4'
        ? 'Hoja Carta / A4'
        : 'Ticket Térmico 80mm';

  return createPortal(
    <div
      id="receipt-print-portal"
      className="fixed inset-0 z-50 bg-slate-950/65 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-slate-100 border border-slate-200 rounded-2xl max-w-2xl w-full overflow-hidden shadow-xl flex flex-col max-h-[92vh] print:border-0 print:shadow-none print:bg-white print:max-h-none">
        {/* Toolbar (hidden during print) */}
        <div className="no-print bg-white px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Vista Previa del Comprobante Guardado
            </h2>
            <p className="text-[11px] text-slate-500">
              Formato activo: <span className="font-mono text-slate-700">{paperLabel}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                Editar Diseño
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Confirmar e Imprimir
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              aria-label="Cerrar vista previa"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Receipt Paper Stage */}
        <div className="p-6 overflow-y-auto print:p-0 print:overflow-visible">
          <ReceiptDocument sale={sale} settings={settings} />
        </div>
      </div>
    </div>,
    document.body
  );
}
