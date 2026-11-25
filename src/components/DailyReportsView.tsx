import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  Download,
  FileSpreadsheet,
  Lock,
  Printer,
  RefreshCw,
  Unlock,
} from 'lucide-react';
import { AdminCashAuthModal } from './AdminCashAuthModal';
import {
  formatCurrency,
  getTodayDateKey,
  type DailyReport,
  type RepairTicket,
  type Sale,
  type UserRole,
} from '../types/store';
import {
  exportDailyReportsCsv,
  reopenDailyCashRegister,
  syncDailyReportForDate,
} from '../lib/storeOperations';

export function DailyReportsView({
  reports,
  sales,
  repairs,
  uid,
  actorName,
  viewRole,
  isDeveloper = false,
  requireAdminToReopenCash = true,
}: {
  reports: DailyReport[];
  sales: Sale[];
  repairs: RepairTicket[];
  uid: string;
  actorName: string;
  viewRole: UserRole;
  isDeveloper?: boolean;
  requireAdminToReopenCash?: boolean;
}) {
  const [selectedDate, setSelectedDate] = useState(getTodayDateKey());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);

  const livePreview = useMemo(() => {
    const validSales = sales.filter(
      (s) => s.dateKey === selectedDate && s.status === 'Completada'
    );
    let totalRevenue = 0;
    let totalCost = 0;
    let cashTotal = 0;
    let cardTotal = 0;
    let transferTotal = 0;
    const productCounts: Record<string, number> = {};

    for (const s of validSales) {
      totalRevenue += s.total;
      totalCost += s.totalCost;
      if (s.paymentMethod === 'Efectivo') cashTotal += s.total;
      else if (s.paymentMethod === 'Tarjeta') cardTotal += s.total;
      else if (s.paymentMethod === 'Transferencia') transferTotal += s.total;
      else {
        cashTotal += s.total / 2;
        cardTotal += s.total / 2;
      }
      for (const item of s.items) {
        productCounts[item.productName] =
          (productCounts[item.productName] || 0) + item.quantity;
      }
    }

    let topProduct = 'Sin ventas registradas';
    let maxQty = 0;
    for (const [name, qty] of Object.entries(productCounts)) {
      if (qty > maxQty) {
        maxQty = qty;
        topProduct = `${name} (${qty} uds)`;
      }
    }

    const repairsRevenue = repairs
      .filter((r) => {
        if (r.status !== 'Entregado' || r.warrantyCovered) return false;
        const dt = r.updatedAt?.toDate ? r.updatedAt.toDate() : new Date();
        const rk = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        return rk === selectedDate;
      })
      .reduce((acc, r) => acc + (r.finalCost || 0), 0);

    return {
      totalSalesCount: validSales.length,
      totalRevenue,
      totalCost,
      grossProfit: totalRevenue - totalCost,
      repairsRevenue,
      cashTotal,
      cardTotal,
      transferTotal,
      topProduct,
    };
  }, [sales, repairs, selectedDate]);

  const savedReport = reports.find((r) => r.dateKey === selectedDate);
  const isLockedForStaff = viewRole !== 'admin' && savedReport?.status === 'Cerrado';

  const handleGenerate = async (closeDay: boolean) => {
    setBusy(true);
    try {
      await syncDailyReportForDate(
        selectedDate,
        sales,
        repairs,
        uid,
        actorName,
        closeDay,
        notes
      );
      setNotes('');
    } finally {
      setBusy(false);
    }
  };

  const isAdmin = viewRole === 'admin';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Reportes Automáticos de Ventas Diarias
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Consolidado automático por fecha, desglose por método de pago, ingresos de taller y cierre de caja
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            disabled={reports.length === 0}
            onClick={() => exportDailyReportsCsv(reports)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-40 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            Imprimir Corte
          </button>
        </div>
      </div>

      {/* Selected Date Live Summary + Sync */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-slate-500" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Corte del Día · <span className="font-mono">{selectedDate}</span>
              </h2>
              <p className="text-xs text-slate-500">
                Estado guardado:{' '}
                <strong className="text-slate-800">
                  {savedReport ? savedReport.status : 'Calculado en vivo (sin guardar)'}
                </strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 no-print">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg bg-slate-50"
            />
            {savedReport?.status === 'Cerrado' ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (isDeveloper || !requireAdminToReopenCash) {
                    void handleGenerate(false);
                  } else {
                    setReopenModalOpen(true);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-amber-950 bg-amber-300 hover:bg-amber-400 rounded-lg whitespace-nowrap cursor-pointer"
              >
                <Unlock className="w-3.5 h-3.5" />
                {isDeveloper ? 'Abrir Caja (Desarrollador)' : 'Abrir Caja (Admin)'}
              </button>
            ) : (
              !isLockedForStaff && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleGenerate(false)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg whitespace-nowrap"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {busy ? 'Generando...' : 'Guardar Reporte'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleGenerate(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Cerrar Caja
                  </button>
                </>
              )
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-xs text-slate-500">Ventas Completadas</p>
            <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {livePreview.totalSalesCount}
            </p>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-xs text-slate-500">Ingresos por Ventas</p>
            <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {formatCurrency(livePreview.totalRevenue)}
            </p>
          </div>
          {isAdmin ? (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs text-slate-500">Ganancia Bruta</p>
              <p className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                {formatCurrency(livePreview.grossProfit)}
              </p>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs text-slate-500">Ingresos Taller</p>
              <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {formatCurrency(livePreview.repairsRevenue)}
              </p>
            </div>
          )}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-xs text-slate-500">Producto Estrella</p>
            <p className="text-sm font-semibold text-slate-900 mt-1.5 truncate">
              {livePreview.topProduct}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 text-xs">
          <div>
            <span className="text-slate-500">Efectivo:</span>{' '}
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {formatCurrency(livePreview.cashTotal)}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Tarjeta:</span>{' '}
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {formatCurrency(livePreview.cardTotal)}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Transferencia:</span>{' '}
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {formatCurrency(livePreview.transferTotal)}
            </span>
          </div>
        </div>

        {!isLockedForStaff && (
          <div className="no-print">
            <input
              type="text"
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas opcionales de cierre de caja (ej. diferencia en efectivo, retiros)..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>
        )}
      </div>

      {/* Historical Daily Reports Archive */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Archivo de Reportes Diarios Generados
          </h2>
          <span className="text-xs font-mono text-slate-500">{reports.length} días</span>
        </div>

        {reports.length === 0 ? (
          <div className="py-12 text-center">
            <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-600">
              Aún no se han almacenado cortes diarios. Haz clic en &ldquo;Guardar Reporte&rdquo; arriba o registra una venta POS.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4 text-right">Ventas</th>
                  <th className="py-3 px-4 text-right">Ingresos</th>
                  {isAdmin && <th className="py-3 px-4 text-right">Ganancia</th>}
                  <th className="py-3 px-4 text-right">Efectivo</th>
                  <th className="py-3 px-4 text-right">Tarjeta</th>
                  <th className="py-3 px-4">Producto Top</th>
                  <th className="py-3 px-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {reports.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedDate(r.dateKey)}
                    className="hover:bg-slate-50/80 cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                      {r.dateKey}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                      {r.totalSalesCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold text-slate-900">
                      {formatCurrency(r.totalRevenue)}
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-emerald-700">
                        {formatCurrency(r.grossProfit)}
                      </td>
                    )}
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-600">
                      {formatCurrency(r.cashTotal)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-600">
                      {formatCurrency(r.cardTotal)}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-[200px] truncate">
                      {r.topProduct}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`text-xs font-medium ${
                          r.status === 'Cerrado' ? 'text-slate-900' : 'text-blue-700'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <AdminCashAuthModal
        isOpen={reopenModalOpen}
        dateKey={selectedDate}
        onClose={() => setReopenModalOpen(false)}
        onAuthorize={async (adminUsername, adminPassword, reason) => {
          await reopenDailyCashRegister({
            dateKey: selectedDate,
            allSales: sales,
            allRepairs: repairs,
            adminUsername,
            adminPassword,
            reason,
          });
        }}
      />
    </motion.div>
  );
}
