import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Calendar,
  CheckCircle2,
  Code2,
  KeyRound,
  PackageCheck,
  Printer,
  Receipt,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  formatCurrency,
  getTodayDateKey,
  type RepairTicket,
  type Sale,
  type UserRole,
  type Warranty,
} from '../types/store';
import { authorizeAdminAction, cancelSaleRecord } from '../lib/storeOperations';

const CANCEL_REASONS = [
  'Error de cobro / captura',
  'Devolución del cliente',
  'Cambio de equipo o modelo',
  'Venta duplicada',
];

function formatSaleTime(sale: Sale): string {
  try {
    if (sale.createdAt?.toDate) {
      return sale.createdAt.toDate().toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  } catch {
    // ignore fallback
  }
  return '';
}

export function CancelSaleModal({
  sale,
  allSales,
  allRepairs,
  warranties,
  uid,
  actorName,
  viewRole,
  isDeveloper = false,
  currentUsername = '',
  requireAdminToCancelSale = true,
  onClose,
  onCancelled,
}: {
  sale: Sale | null;
  allSales: Sale[];
  allRepairs: RepairTicket[];
  warranties: Warranty[];
  uid: string;
  actorName: string;
  viewRole: UserRole;
  isDeveloper?: boolean;
  currentUsername?: string;
  requireAdminToCancelSale?: boolean;
  onClose: () => void;
  onCancelled: (message: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [restoreStock, setRestoreStock] = useState(true);
  const [cancelWarranties, setCancelWarranties] = useState(true);
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hasDirectDevPermission = isDeveloper || viewRole === 'developer';
  const needsAdminCredentials =
    !hasDirectDevPermission &&
    (viewRole !== 'admin' || requireAdminToCancelSale);

  useEffect(() => {
    if (sale) {
      setReason('');
      setRestoreStock(true);
      setCancelWarranties(true);
      setAdminUser(
        viewRole === 'admin' && !hasDirectDevPermission ? currentUsername : ''
      );
      setAdminPass('');
      setError(null);
    }
  }, [sale, viewRole, hasDirectDevPermission, currentUsername]);

  const linkedWarranties = useMemo(() => {
    if (!sale) return [];
    return warranties.filter((w) => w.saleId === sale.id && w.status !== 'Anulada');
  }, [sale, warranties]);

  if (!sale) return null;

  const totalUnits = sale.items.reduce((acc, i) => acc + i.quantity, 0);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      let authorizedActor = actorName;
      if (needsAdminCredentials) {
        if (!adminUser.trim() || !adminPass) {
          setError(
            'Ingresa usuario y contraseña de un Administrador para autorizar la cancelación.'
          );
          setSubmitting(false);
          return;
        }
        const auth = await authorizeAdminAction(
          adminUser.trim(),
          adminPass,
          'cancelar ventas realizadas'
        );
        authorizedActor = auth.displayName || actorName;
      }

      const result = await cancelSaleRecord({
        sale,
        allSales,
        allRepairs,
        warranties,
        uid,
        actorName: authorizedActor,
        reason,
        restoreStock,
        cancelLinkedWarranties: cancelWarranties,
      });

      const notes: string[] = [];
      if (result.restoredUnits > 0) {
        notes.push(`${result.restoredUnits} uds devueltas al inventario`);
      }
      if (result.cancelledWarranties > 0) {
        notes.push(`${result.cancelledWarranties} garantía(s) anulada(s)`);
      }

      onCancelled(
        `Venta ${sale.saleNumber} cancelada correctamente${
          notes.length > 0 ? ` (${notes.join(' · ')})` : ''
        }.`
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cancelar la venta seleccionada.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-[1px] p-4 no-print"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
              <Ban className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Cancelar Venta Realizada
              </h2>
              <p className="text-[11px] font-mono text-slate-500">
                {sale.saleNumber} · {formatCurrency(sale.total)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="Cerrar confirmación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-6 space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
            <p className="text-slate-600">
              Cliente:{' '}
              <strong className="text-slate-900">{sale.customerName}</strong>
            </p>
            <p className="text-slate-600 truncate">
              Artículos:{' '}
              <span className="text-slate-800">
                {sale.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
              </span>
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Motivo de cancelación (Opcional)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {CANCEL_REASONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  className={`px-2 py-1 text-[11px] rounded-md border transition-colors cursor-pointer ${
                    reason === preset
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              type="text"
              maxLength={240}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Cliente cambió de opinión antes de salir..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <div className="space-y-2.5 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <label className="flex items-start gap-2.5 text-xs text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={restoreStock}
                onChange={(e) => setRestoreStock(e.target.checked)}
                className="mt-0.5 rounded border-slate-300"
              />
              <span>
                <strong className="inline-flex items-center gap-1">
                  <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Devolver unidades al inventario
                </strong>
                <span className="block text-[11px] text-slate-500">
                  Reintegra {totalUnits} unidad(es) al stock disponible.
                </span>
              </span>
            </label>

            {linkedWarranties.length > 0 && (
              <label className="flex items-start gap-2.5 text-xs text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cancelWarranties}
                  onChange={(e) => setCancelWarranties(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300"
                />
                <span>
                  <strong className="inline-flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                    Anular garantías emitidas ({linkedWarranties.length})
                  </strong>
                  <span className="block text-[11px] text-slate-500">
                    Marca las garantías de esta venta como Anuladas.
                  </span>
                </span>
              </label>
            )}
          </div>

          {hasDirectDevPermission ? (
            <div className="p-3 bg-slate-950 text-cyan-200 border border-cyan-500/30 rounded-xl text-[11px] flex items-center gap-2">
              <Code2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                <strong>Permiso total de Desarrollador activo:</strong> autorización directa habilitada ({actorName}).
              </span>
            </div>
          ) : needsAdminCredentials ? (
            <div className="space-y-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-[11px] font-semibold text-amber-900 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                Autorización de Administrador requerida
              </p>
              <p className="text-[11px] text-amber-800 leading-snug">
                {viewRole === 'admin'
                  ? 'Confirma tus credenciales de Administrador para autorizar la cancelación de esta venta.'
                  : 'Un Administrador (o Desarrollador) debe autorizar con su usuario y contraseña para cancelar esta venta.'}
              </p>
              <input
                type="text"
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
                placeholder="Usuario administrador"
                autoComplete="off"
                className="w-full px-3 py-2 text-xs bg-white border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
              <input
                type="password"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                placeholder="Contraseña de administrador"
                autoComplete="new-password"
                className="w-full px-3 py-2 text-xs bg-white border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-[11px] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                Autorizado como <strong>Administrador</strong> ({actorName}).
              </span>
            </div>
          )}

          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Volver
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50 cursor-pointer"
            >
              <Ban className="w-3.5 h-3.5" />
              {submitting ? 'Cancelando...' : 'Confirmar Cancelación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CancelSalePanel({
  sales,
  repairs,
  warranties,
  uid,
  actorName,
  viewRole,
  isDeveloper = false,
  currentUsername = '',
  requireAdminToCancelSale = true,
  onOpenReceipt,
}: {
  sales: Sale[];
  repairs: RepairTicket[];
  warranties: Warranty[];
  uid: string;
  actorName: string;
  viewRole: UserRole;
  isDeveloper?: boolean;
  currentUsername?: string;
  requireAdminToCancelSale?: boolean;
  onOpenReceipt?: (sale: Sale) => void;
}) {
  const [search, setSearch] = useState('');
  const [dateScope, setDateScope] = useState<'today' | 'all'>('all');
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const todayKey = getTodayDateKey();

  const matchesQuery = (s: Sale, q: string) => {
    if (!q) return true;
    const hay = [
      s.saleNumber,
      s.customerName,
      s.customerPhone,
      s.sellerName,
      s.paymentMethod,
      s.cancelReason || '',
      ...s.items.map((i) => `${i.productName} ${i.sku} ${i.imei}`),
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  };

  const completedSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((s) => {
      if (s.status !== 'Completada') return false;
      if (dateScope === 'today' && s.dateKey !== todayKey) return false;
      return matchesQuery(s, q);
    });
  }, [sales, search, dateScope, todayKey]);

  const cancelledSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((s) => {
      if (s.status !== 'Anulada') return false;
      if (dateScope === 'today' && s.dateKey !== todayKey) return false;
      return matchesQuery(s, q);
    });
  }, [sales, search, dateScope, todayKey]);

  return (
    <div className="space-y-5">
      {/* Header & Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">
                  Cancelar Venta Realizada
                </h2>
                {isDeveloper || viewRole === 'developer' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-slate-950 text-cyan-300 border border-cyan-500/30 rounded-md">
                    <Code2 className="w-3 h-3" />
                    Permiso total Desarrollador
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded-md">
                    <ShieldCheck className="w-3 h-3" />
                    Requiere autorización de Administrador
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Busca un ticket por folio, cliente, producto o IMEI para cancelarlo con autorización administrativa, devolver unidades al inventario y ajustar el reporte diario.
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0 self-start">
            <button
              type="button"
              onClick={() => setDateScope('today')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                dateScope === 'today'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Solo hoy
            </button>
            <button
              type="button"
              onClick={() => setDateScope('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                dateScope === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todas las fechas
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar venta realizada por folio (VTA-...), cliente, teléfono, producto o IMEI..."
            className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
          />
        </div>

        {feedback && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{feedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
              aria-label="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Completed Sales Ready to Cancel */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-800">
            Ventas completadas disponibles para cancelar ({completedSales.length})
          </p>
        </div>

        {completedSales.length === 0 ? (
          <div className="py-12 px-6 text-center space-y-1.5">
            <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-medium text-slate-700">
              No hay ventas completadas que coincidan con tu búsqueda.
            </p>
            <p className="text-xs text-slate-500">
              Prueba limpiando el buscador o seleccionando &quot;Todas las fechas&quot;.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Folio</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Productos</th>
                  <th className="py-3 px-4">Pago</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {completedSales.map((s) => {
                  const saleTime = formatSaleTime(s);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                        {s.saleNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                        <span>{s.dateKey}</span>
                        {saleTime && (
                          <span className="block text-[10px] text-slate-400">
                            {saleTime}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-xs font-medium text-slate-900">
                          {s.customerName}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {s.customerPhone}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-[260px]">
                        <p className="truncate font-medium text-slate-800">
                          {s.items
                            .map((i) => `${i.quantity}x ${i.productName}`)
                            .join(', ')}
                        </p>
                        {s.items.some((i) => i.imei) && (
                          <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                            IMEI:{' '}
                            {s.items
                              .map((i) => i.imei)
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {s.paymentMethod}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatCurrency(s.total)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {onOpenReceipt && (
                            <button
                              type="button"
                              onClick={() => onOpenReceipt(s)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Ticket
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setCancelTarget(s)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Cancelar Venta
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recently Cancelled Sales Log */}
      {cancelledSales.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-red-50/50 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-800">
              Ventas canceladas / anuladas ({cancelledSales.length})
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Folio</th>
                  <th className="py-2.5 px-4">Fecha</th>
                  <th className="py-2.5 px-4">Cliente</th>
                  <th className="py-2.5 px-4">Motivo / Autorizó</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                  {onOpenReceipt && (
                    <th className="py-2.5 px-4 text-right">Ticket</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {cancelledSales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {s.saleNumber}
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 text-[10px]">
                        Anulada
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {s.dateKey}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">
                      {s.customerName}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 max-w-[260px]">
                      <p className="truncate">
                        {s.cancelReason || 'Sin motivo especificado'}
                      </p>
                      {s.cancelledByName && (
                        <p className="text-[10px] text-slate-400">
                          Por: {s.cancelledByName}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-500 line-through whitespace-nowrap">
                      {formatCurrency(s.total)}
                    </td>
                    {onOpenReceipt && (
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onOpenReceipt(s)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                        >
                          <Printer className="w-3 h-3" />
                          Ver
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CancelSaleModal
        sale={cancelTarget}
        allSales={sales}
        allRepairs={repairs}
        warranties={warranties}
        uid={uid}
        actorName={actorName}
        viewRole={viewRole}
        isDeveloper={isDeveloper}
        currentUsername={currentUsername}
        requireAdminToCancelSale={requireAdminToCancelSale}
        onClose={() => setCancelTarget(null)}
        onCancelled={(msg) => setFeedback(msg)}
      />
    </div>
  );
}
