import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Ban,
  Calendar,
  CheckCircle2,
  Eye,
  KeyRound,
  PackageCheck,
  Printer,
  Receipt,
  Search,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import {
  DEFAULT_WARRANTY_SHEET_SETTINGS,
  formatCurrency,
  getTodayDateKey,
  PAYMENT_METHODS,
  type PaymentMethod,
  type Product,
  type ReceiptSettings,
  type RepairTicket,
  type Sale,
  type UserRole,
  type Warranty,
  type WarrantySheetSettings,
} from '../types/store';
import {
  authorizeAdminAction,
  deleteSaleRecord,
} from '../lib/storeOperations';
import { CancelSaleModal, CancelSalePanel } from './CancelSaleSection';
import { ReceiptPreviewModal } from './ReceiptPreviewModal';
import { WarrantySheetModal } from './WarrantySheetModal';

type DateRangeFilter = 'all' | 'today' | '7d' | 'custom';
type StatusFilter = 'all' | 'Completada' | 'Anulada';

function formatSaleTime(sale: Sale): string {
  try {
    if (sale.createdAt?.toDate) {
      return sale.createdAt.toDate().toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  } catch {
    // ignore formatting fallback
  }
  return '';
}

export function SalesHistoryView({
  sales,
  products,
  repairs,
  warranties,
  receiptSettings,
  warrantySheetSettings = DEFAULT_WARRANTY_SHEET_SETTINGS,
  uid,
  actorName,
  viewRole,
  isDeveloper = false,
  currentUsername = '',
  requireAdminToCancelSale = true,
  onOpenPos,
  onOpenReceiptSettings,
}: {
  sales: Sale[];
  products: Product[];
  repairs: RepairTicket[];
  warranties: Warranty[];
  receiptSettings: ReceiptSettings;
  warrantySheetSettings?: WarrantySheetSettings;
  uid: string;
  actorName: string;
  viewRole: UserRole;
  isDeveloper?: boolean;
  currentUsername?: string;
  requireAdminToCancelSale?: boolean;
  onOpenPos?: () => void;
  onOpenReceiptSettings?: () => void;
}) {
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all');
  const [customDate, setCustomDate] = useState(getTodayDateKey());
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentMethod>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [previewSale, setPreviewSale] = useState<Sale | null>(null);
  const [warrantySheetModal, setWarrantySheetModal] = useState<{
    warranties: Warranty[];
    sale: Sale;
  } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const [restoreStockOnDelete, setRestoreStockOnDelete] = useState(true);
  const [deleteWarrantiesOnDelete, setDeleteWarrantiesOnDelete] = useState(true);
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [sectionTab, setSectionTab] = useState<'list' | 'cancel'>('list');
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isAdmin = viewRole === 'admin';
  const hasDirectDevPermission = isDeveloper || viewRole === 'developer';
  const deleteNeedsAdminAuth =
    !hasDirectDevPermission && (!isAdmin || requireAdminToCancelSale);
  const todayKey = getTodayDateKey();

  const sevenDaysAgoKey = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((s) => {
      if (dateRange === 'today' && s.dateKey !== todayKey) return false;
      if (dateRange === '7d' && s.dateKey < sevenDaysAgoKey) return false;
      if (dateRange === 'custom' && customDate && s.dateKey !== customDate) {
        return false;
      }
      if (paymentFilter !== 'all' && s.paymentMethod !== paymentFilter) {
        return false;
      }
      if (statusFilter !== 'all' && s.status !== statusFilter) {
        return false;
      }
      if (q) {
        const hay = [
          s.saleNumber,
          s.customerName,
          s.customerPhone,
          s.sellerName,
          s.paymentMethod,
          ...s.items.map((i) => `${i.productName} ${i.sku} ${i.imei}`),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    sales,
    search,
    dateRange,
    todayKey,
    sevenDaysAgoKey,
    customDate,
    paymentFilter,
    statusFilter,
  ]);

  const summary = useMemo(() => {
    const completed = filteredSales.filter((s) => s.status === 'Completada');
    const voidedCount = filteredSales.length - completed.length;
    const totalRevenue = completed.reduce((acc, s) => acc + s.total, 0);
    const totalDiscount = completed.reduce((acc, s) => acc + (s.discount || 0), 0);
    const totalProfit = completed.reduce((acc, s) => acc + (s.profit || 0), 0);
    const totalUnits = completed.reduce(
      (acc, s) => acc + s.items.reduce((sum, item) => sum + item.quantity, 0),
      0
    );
    return {
      count: filteredSales.length,
      completedCount: completed.length,
      voidedCount,
      totalRevenue,
      totalDiscount,
      totalProfit,
      totalUnits,
    };
  }, [filteredSales]);

  const openDeleteModal = (sale: Sale) => {
    setDeleteTarget(sale);
    setRestoreStockOnDelete(sale.status === 'Completada');
    setDeleteWarrantiesOnDelete(warranties.some((w) => w.saleId === sale.id));
    setAdminUser(
      isAdmin && !hasDirectDevPermission ? currentUsername : ''
    );
    setAdminPass('');
    setDeleteError(null);
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      if (deleteNeedsAdminAuth) {
        if (!adminUser.trim() || !adminPass) {
          setDeleteError(
            'Ingresa usuario y contraseña de administrador para eliminar la venta.'
          );
          setDeleting(false);
          return;
        }
        await authorizeAdminAction(
          adminUser.trim(),
          adminPass,
          'eliminar ventas realizadas'
        );
      }

      const result = await deleteSaleRecord({
        sale: deleteTarget,
        allSales: sales,
        allRepairs: repairs,
        warranties,
        uid,
        actorName,
        restoreStock: restoreStockOnDelete,
        deleteLinkedWarranties: deleteWarrantiesOnDelete,
      });

      const details: string[] = [];
      if (result.restoredUnits > 0) {
        details.push(`${result.restoredUnits} uds devueltas al inventario`);
      }
      if (result.removedWarranties > 0) {
        details.push(`${result.removedWarranties} garantía(s) eliminada(s)`);
      }

      setFeedback(
        `Venta ${deleteTarget.saleNumber} eliminada correctamente${
          details.length > 0 ? ` (${details.join(' · ')})` : ''
        }.`
      );
      if (detailSale?.id === deleteTarget.id) {
        setDetailSale(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar el registro de venta.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const linkedWarrantiesForTarget = useMemo(() => {
    if (!deleteTarget) return [];
    return warranties.filter((w) => w.saleId === deleteTarget.id);
  }, [deleteTarget, warranties]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Ventas Realizadas
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Consulta el historial completo de tickets cobrados, revisa detalles, reimprime comprobantes o elimina registros
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setSectionTab('list')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                sectionTab === 'list'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ventas ({sales.length})
            </button>
            <button
              type="button"
              onClick={() => setSectionTab('cancel')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                sectionTab === 'cancel'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              <Ban className="w-3.5 h-3.5" />
              Cancelar Venta Realizada
            </button>
          </div>
          {onOpenPos && (
            <button
              type="button"
              onClick={onOpenPos}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              Ir al Punto de Venta
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-emerald-900 no-print">
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

      {sectionTab === 'cancel' ? (
        <CancelSalePanel
          sales={sales}
          repairs={repairs}
          warranties={warranties}
          uid={uid}
          actorName={actorName}
          viewRole={viewRole}
          isDeveloper={isDeveloper}
          currentUsername={currentUsername}
          requireAdminToCancelSale={requireAdminToCancelSale}
          onOpenReceipt={(sale) => setPreviewSale(sale)}
        />
      ) : (
        <>
      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 no-print">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-medium text-slate-500">
            Ventas en lista
          </p>
          <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {summary.count}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {summary.completedCount} completadas · {summary.voidedCount} anuladas
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-medium text-slate-500">
            Total vendido
          </p>
          <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {formatCurrency(summary.totalRevenue)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Solo ventas completadas
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-medium text-slate-500">
            Descuentos otorgados
          </p>
          <p className="text-xl font-bold font-mono tabular-nums text-amber-700 mt-1">
            {formatCurrency(summary.totalDiscount)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {summary.totalUnits} artículos despachados
          </p>
        </div>
        {isAdmin ? (
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-[11px] font-medium text-slate-500">
              Utilidad neta
            </p>
            <p className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
              {formatCurrency(summary.totalProfit)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Margen sobre costo registrado
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-[11px] font-medium text-slate-500">
              Artículos vendidos
            </p>
            <p className="text-xl font-bold font-mono tabular-nums text-blue-700 mt-1">
              {summary.totalUnits}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Unidades en tickets válidos
            </p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 no-print">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por folio, cliente, teléfono, producto o IMEI..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
            >
              <option value="all">Todas las fechas</option>
              <option value="today">Hoy ({todayKey})</option>
              <option value="7d">Últimos 7 días</option>
              <option value="custom">Fecha específica</option>
            </select>
          </div>

          {dateRange === 'custom' && (
            <div className="md:col-span-2">
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
          )}

          <div className={dateRange === 'custom' ? 'md:col-span-2' : 'md:col-span-2'}>
            <select
              value={paymentFilter}
              onChange={(e) =>
                setPaymentFilter(e.target.value as 'all' | PaymentMethod)
              }
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
            >
              <option value="all">Todos los pagos</option>
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm} value={pm}>
                  {pm}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
            >
              <option value="all">Todos los estados</option>
              <option value="Completada">Completadas</option>
              <option value="Anulada">Anuladas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredSales.length === 0 ? (
          <div className="py-14 px-6 text-center space-y-2">
            <Receipt className="w-9 h-9 text-slate-300 mx-auto" />
            <p className="text-sm font-medium text-slate-700">
              {sales.length === 0
                ? 'Aún no hay ventas realizadas.'
                : 'No hay ventas que coincidan con los filtros seleccionados.'}
            </p>
            <p className="text-xs text-slate-500">
              {sales.length === 0
                ? 'Las ventas cobradas desde el Punto de Venta aparecerán aquí automáticamente.'
                : 'Prueba limpiando la búsqueda o ampliando el rango de fechas.'}
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
                  <th className="py-3 px-4">Vendedor</th>
                  <th className="py-3 px-4">Pago</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  {isAdmin && <th className="py-3 px-4 text-right">Utilidad</th>}
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredSales.map((s) => {
                  const saleWarranties = warranties.filter(
                    (w) => w.saleId === s.id
                  );
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
                        {s.sellerName}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {s.paymentMethod}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatCurrency(s.total)}
                        {s.discount > 0 && (
                          <span className="block text-[10px] font-normal text-emerald-700">
                            Desc. -{formatCurrency(s.discount)}
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-emerald-700 whitespace-nowrap">
                          {formatCurrency(s.profit)}
                        </td>
                      )}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            s.status === 'Completada'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDetailSale(s)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                            title="Ver detalle de venta"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Detalle
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewSale(s)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer"
                            title="Ver e imprimir comprobante"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Ticket
                          </button>
                          {saleWarranties.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setWarrantySheetModal({
                                  warranties: saleWarranties,
                                  sale: s,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                              title="Ver hoja de garantía"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Garantía
                            </button>
                          )}
                          {s.status === 'Completada' && (
                            <button
                              type="button"
                              onClick={() => setCancelTarget(s)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-md transition-colors cursor-pointer"
                              title="Cancelar venta realizada y devolver inventario"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              Cancelar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openDeleteModal(s)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors cursor-pointer"
                            title="Eliminar esta venta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Eliminar
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
        </>
      )}

      {/* Sale Detail Modal */}
      {detailSale && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-[1px] p-4 no-print"
          onClick={() => setDetailSale(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Detalle de Venta ·{' '}
                  <span className="font-mono">{detailSale.saleNumber}</span>
                </h2>
                <p className="text-xs text-slate-500">
                  {detailSale.dateKey} {formatSaleTime(detailSale)} · Atendió:{' '}
                  {detailSale.sellerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailSale(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Cerrar detalle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Cliente</span>
                  <strong className="text-slate-900">
                    {detailSale.customerName}
                  </strong>
                  <span className="block text-slate-500">
                    {detailSale.customerPhone}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Método de Pago</span>
                  <strong className="text-slate-900">
                    {detailSale.paymentMethod}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Estado</span>
                  <strong
                    className={
                      detailSale.status === 'Completada'
                        ? 'text-emerald-700'
                        : 'text-red-600'
                    }
                  >
                    {detailSale.status}
                  </strong>
                  {detailSale.status === 'Anulada' && detailSale.cancelReason && (
                    <span className="block text-[11px] text-slate-600 mt-0.5">
                      Motivo: {detailSale.cancelReason}
                    </span>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <th className="py-2.5 px-3">Producto</th>
                      <th className="py-2.5 px-3">SKU / IMEI</th>
                      <th className="py-2.5 px-3 text-right">Cant.</th>
                      <th className="py-2.5 px-3 text-right">P. Unit.</th>
                      <th className="py-2.5 px-3 text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detailSale.items.map((item, idx) => (
                      <tr key={`${item.productId}-${idx}`}>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {item.productName}
                          {item.warrantyMonths > 0 && (
                            <span className="block text-[10px] text-emerald-700 font-normal">
                              Garantía: {item.warrantyMonths} mes(es)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                          {item.sku}
                          {item.imei && (
                            <span className="block text-slate-700">
                              IMEI: {item.imei}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const target = detailSale;
                      setDetailSale(null);
                      setPreviewSale(target);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Ver Comprobante
                  </button>
                  {detailSale.status === 'Completada' && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = detailSale;
                        setDetailSale(null);
                        setCancelTarget(target);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Cancelar Venta
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const target = detailSale;
                      setDetailSale(null);
                      openDeleteModal(target);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar Venta
                  </button>
                </div>

                <div className="text-right space-y-1 text-xs">
                  <p className="text-slate-500">
                    Subtotal:{' '}
                    <span className="font-mono font-semibold text-slate-900">
                      {formatCurrency(detailSale.subtotal)}
                    </span>
                  </p>
                  {detailSale.discount > 0 && (
                    <p className="text-emerald-700">
                      Descuento:{' '}
                      <span className="font-mono font-semibold">
                        -{formatCurrency(detailSale.discount)}
                      </span>
                    </p>
                  )}
                  {typeof detailSale.taxAmount === 'number' &&
                    (detailSale.taxAmount > 0 || (detailSale.taxRate ?? 0) > 0) && (
                      <>
                        {detailSale.taxIncluded !== false && (
                          <p className="text-slate-500">
                            Base sin {detailSale.taxLabel || 'IVA'}:{' '}
                            <span className="font-mono font-semibold text-slate-800">
                              {formatCurrency(
                                Math.max(0, detailSale.total - detailSale.taxAmount)
                              )}
                            </span>
                          </p>
                        )}
                        <p className="text-slate-600">
                          {detailSale.taxLabel || 'IVA'} ({detailSale.taxRate ?? 0}%
                          {detailSale.taxIncluded !== false ? ' inc.' : ''}):{' '}
                          <span className="font-mono font-semibold text-slate-900">
                            {detailSale.taxIncluded === false ? '+' : ''}
                            {formatCurrency(detailSale.taxAmount)}
                          </span>
                        </p>
                      </>
                    )}
                  <p className="text-sm font-bold text-slate-900">
                    Total:{' '}
                    <span className="font-mono">
                      {formatCurrency(detailSale.total)}
                    </span>
                  </p>
                  {typeof detailSale.amountTendered === 'number' && (
                    <>
                      <p className="text-slate-600">
                        Efectivo recibido:{' '}
                        <span className="font-mono font-semibold text-slate-900">
                          {formatCurrency(detailSale.amountTendered)}
                        </span>
                      </p>
                      <p className="text-emerald-700 font-semibold">
                        Cambio:{' '}
                        <span className="font-mono">
                          {formatCurrency(
                            typeof detailSale.changeAmount === 'number'
                              ? detailSale.changeAmount
                              : Math.max(
                                  0,
                                  detailSale.amountTendered - detailSale.total
                                )
                          )}
                        </span>
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-[1px] p-4 no-print"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Eliminar Venta Realizada
                  </h2>
                  <p className="text-[11px] font-mono text-slate-500">
                    {deleteTarget.saleNumber} · {formatCurrency(deleteTarget.total)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Cerrar confirmación"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDelete} className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Esta acción eliminará permanentemente el registro de la venta de{' '}
                <strong className="text-slate-900">
                  {deleteTarget.customerName}
                </strong>{' '}
                ({deleteTarget.items.length} línea(s)) y actualizará el reporte diario si existe.
              </p>

              <div className="space-y-2.5 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                {deleteTarget.status === 'Completada' && (
                  <label className="flex items-start gap-2.5 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={restoreStockOnDelete}
                      onChange={(e) => setRestoreStockOnDelete(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-blue-700"
                    />
                    <span>
                      <strong className="inline-flex items-center gap-1">
                        <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Devolver productos al inventario
                      </strong>
                      <span className="block text-[11px] text-slate-500">
                        Sumará nuevamente{' '}
                        {deleteTarget.items.reduce(
                          (acc, i) => acc + i.quantity,
                          0
                        )}{' '}
                        unidad(es) al stock disponible.
                      </span>
                    </span>
                  </label>
                )}

                {linkedWarrantiesForTarget.length > 0 && (
                  <label className="flex items-start gap-2.5 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deleteWarrantiesOnDelete}
                      onChange={(e) =>
                        setDeleteWarrantiesOnDelete(e.target.checked)
                      }
                      className="mt-0.5 rounded border-slate-300 text-blue-700"
                    />
                    <span>
                      <strong>
                        Eliminar garantías emitidas en esta venta (
                        {linkedWarrantiesForTarget.length})
                      </strong>
                      <span className="block text-[11px] text-slate-500">
                        Quita las hojas de garantía vinculadas al folio{' '}
                        {deleteTarget.saleNumber}.
                      </span>
                    </span>
                  </label>
                )}
              </div>

              {deleteNeedsAdminAuth && (
                <div className="space-y-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-[11px] font-semibold text-amber-900">
                    Autorización de Administrador requerida
                  </p>
                  <input
                    type="text"
                    value={adminUser}
                    onChange={(e) => setAdminUser(e.target.value)}
                    placeholder="Usuario administrador"
                    className="w-full px-3 py-2 text-xs border border-amber-200 rounded-lg bg-white"
                    required
                  />
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      placeholder="Contraseña de administrador"
                      className="w-full pl-8 pr-3 py-2 text-xs border border-amber-200 rounded-lg bg-white"
                      required
                    />
                  </div>
                </div>
              )}

              {deleteError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {deleteError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deleting ? 'Eliminando...' : 'Confirmar y Eliminar'}
                </button>
              </div>
            </form>
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

      <ReceiptPreviewModal
        sale={previewSale}
        settings={receiptSettings}
        onClose={() => setPreviewSale(null)}
        onOpenSettings={onOpenReceiptSettings}
      />

      <WarrantySheetModal
        warranties={warrantySheetModal?.warranties || []}
        sale={warrantySheetModal?.sale || null}
        products={products}
        settings={receiptSettings}
        warrantySettings={warrantySheetSettings}
        onClose={() => setWarrantySheetModal(null)}
        onOpenReceipt={
          warrantySheetModal?.sale
            ? () => {
                const targetSale = warrantySheetModal.sale;
                setWarrantySheetModal(null);
                setPreviewSale(targetSale);
              }
            : undefined
        }
      />
    </motion.div>
  );
}
