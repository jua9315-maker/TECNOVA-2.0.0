import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Plus,
  Printer,
  Search,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import {
  DEFAULT_RECEIPT_SETTINGS,
  DEFAULT_WARRANTY_SHEET_SETTINGS,
  getTodayDateKey,
  WARRANTY_STATUSES,
  type Product,
  type ReceiptSettings,
  type Sale,
  type Warranty,
  type WarrantySheetSettings,
  type WarrantyStatus,
} from '../types/store';
import {
  createManualWarranty,
  updateWarrantyStatus,
} from '../lib/storeOperations';
import { QrCodeImg } from './BarcodeQrToolkit';
import { WarrantySheetModal } from './WarrantySheetModal';

export function WarrantiesView({
  warranties,
  products = [],
  sales = [],
  receiptSettings = DEFAULT_RECEIPT_SETTINGS,
  warrantySheetSettings = DEFAULT_WARRANTY_SHEET_SETTINGS,
  uid,
  focusedWarranty,
  onClearFocusedWarranty,
  onCreateRepairFromWarranty,
}: {
  warranties: Warranty[];
  products?: Product[];
  sales?: Sale[];
  receiptSettings?: ReceiptSettings;
  warrantySheetSettings?: WarrantySheetSettings;
  uid: string;
  focusedWarranty: Warranty | null;
  onClearFocusedWarranty: () => void;
  onCreateRepairFromWarranty: (warranty: Warranty) => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todas' | WarrantyStatus>('Todas');
  const [selected, setSelected] = useState<Warranty | null>(null);
  const [printableWarranty, setPrintableWarranty] = useState<Warranty | null>(null);
  const [newModalOpen, setNewModalOpen] = useState(false);

  const [editStatus, setEditStatus] = useState<WarrantyStatus>('Vigente');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [newForm, setNewForm] = useState({
    productName: '',
    imei: '',
    customerName: '',
    customerPhone: '',
    purchaseDate: getTodayDateKey(),
    warrantyMonths: 12,
    notes: '',
  });

  useEffect(() => {
    if (focusedWarranty) {
      setSelected(focusedWarranty);
      setEditStatus(focusedWarranty.status);
      setEditNotes(focusedWarranty.notes);
      onClearFocusedWarranty();
    }
  }, [focusedWarranty, onClearFocusedWarranty]);

  const openDetail = (w: Warranty) => {
    setSelected(w);
    setEditStatus(w.status);
    setEditNotes(w.notes);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return warranties.filter((w) => {
      if (statusFilter !== 'Todas' && w.status !== statusFilter) return false;
      if (!q) return true;
      return (
        w.warrantyCode.toLowerCase().includes(q) ||
        w.imei.toLowerCase().includes(q) ||
        w.customerName.toLowerCase().includes(q) ||
        w.customerPhone.toLowerCase().includes(q) ||
        w.productName.toLowerCase().includes(q)
      );
    });
  }, [warranties, search, statusFilter]);

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await updateWarrantyStatus(selected.id, editStatus, editNotes);
      setSelected({ ...selected, status: editStatus, notes: editNotes });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createManualWarranty(uid, newForm);
      setNewModalOpen(false);
      setNewForm({
        productName: '',
        imei: '',
        customerName: '',
        customerPhone: '',
        purchaseDate: getTodayDateKey(),
        warrantyMonths: 12,
        notes: '',
      });
    } finally {
      setSaving(false);
    }
  };

  const statusColor = (status: WarrantyStatus) => {
    switch (status) {
      case 'Vigente':
        return 'text-emerald-700';
      case 'En Revisión':
        return 'text-amber-700';
      case 'Reclamada':
        return 'text-blue-700';
      case 'Vencida':
      case 'Anulada':
        return 'text-red-600';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Seguimiento de Garantías de Clientes
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Control de pólizas por IMEI, vigencia automática al vender y vinculación directa con reparaciones
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNewModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Registrar Garantía Manual
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por IMEI, código GAR, cliente o teléfono..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {(['Todas', ...WARRANTY_STATUSES] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === st
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-14 text-center">
            <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-900">
              No se encontraron certificados de garantía
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Las garantías se crean automáticamente al vender equipos con cobertura o manualmente desde aquí.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Equipo / Producto</th>
                  <th className="py-3 px-4">IMEI / Serie</th>
                  <th className="py-3 px-4">Compra</th>
                  <th className="py-3 px-4">Vencimiento</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Gestión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((w) => (
                  <tr
                    key={w.id}
                    onClick={() => openDetail(w)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                      {w.warrantyCode}
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-xs font-medium text-slate-900">{w.customerName}</p>
                      <p className="text-[11px] text-slate-400">{w.customerPhone}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 max-w-[220px] truncate">
                      {w.productName}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {w.imei}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {w.purchaseDate}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-900 whitespace-nowrap">
                      {w.expiresDate}
                      <span className="block text-[11px] text-slate-400">
                        {w.warrantyMonths} meses
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`text-xs font-medium ${statusColor(w.status)}`}>
                        {w.status}
                      </span>
                    </td>
                    <td
                      className="py-3 px-4 text-right whitespace-nowrap space-x-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setPrintableWarranty(w)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Hoja
                      </button>
                      <button
                        type="button"
                        onClick={() => onCreateRepairFromWarranty(w)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        Ingresar a Taller
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Warranty Detail Drawer */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/35 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md h-full border-l border-slate-200 overflow-y-auto p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <p className="text-xs font-mono text-slate-500">{selected.warrantyCode}</p>
                <h2 className="text-lg font-semibold text-slate-900 mt-1">
                  Certificado de Garantía
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-slate-900">{selected.productName}</p>
                <p className="text-slate-600">Cliente: {selected.customerName}</p>
                <p className="font-mono text-slate-600">IMEI: {selected.imei}</p>
                <p className="font-mono text-slate-500">
                  Vigencia: {selected.purchaseDate} → {selected.expiresDate}
                </p>
              </div>
              <QrCodeImg value={selected.warrantyCode} size={80} />
            </div>

            <form onSubmit={handleSaveStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Estado de Garantía
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as WarrantyStatus)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  {WARRANTY_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Bitácora / Observaciones de Cobertura
                </label>
                <textarea
                  rows={4}
                  maxLength={500}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 px-3 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap cursor-pointer"
                >
                  {saving ? 'Guardando...' : 'Actualizar Póliza'}
                </button>
                <button
                  type="button"
                  onClick={() => setPrintableWarranty(selected)}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg whitespace-nowrap cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Hoja de Garantía
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const w = selected;
                    setSelected(null);
                    onCreateRepairFromWarranty(w);
                  }}
                  className="flex-1 py-2.5 px-3 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg whitespace-nowrap cursor-pointer"
                >
                  Crear Reparación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Warranty Modal */}
      {newModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                Registrar Garantía Manual
              </h2>
              <button
                type="button"
                onClick={() => setNewModalOpen(false)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManual} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Producto / Equipo
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={newForm.productName}
                  onChange={(e) => setNewForm({ ...newForm, productName: e.target.value })}
                  placeholder="Ej: iPhone 15 Pro 256GB"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Cliente
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={newForm.customerName}
                    onChange={(e) => setNewForm({ ...newForm, customerName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={32}
                    value={newForm.customerPhone}
                    onChange={(e) => setNewForm({ ...newForm, customerPhone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    IMEI / Serie
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={40}
                    value={newForm.imei}
                    onChange={(e) => setNewForm({ ...newForm, imei: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Fecha Compra
                  </label>
                  <input
                    type="date"
                    required
                    value={newForm.purchaseDate}
                    onChange={(e) => setNewForm({ ...newForm, purchaseDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Meses
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    required
                    value={newForm.warrantyMonths}
                    onChange={(e) =>
                      setNewForm({ ...newForm, warrantyMonths: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Condiciones / Notas
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={newForm.notes}
                  onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNewModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg"
                >
                  {saving ? 'Guardando...' : 'Emitir Garantía'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <WarrantySheetModal
        warranties={printableWarranty ? [printableWarranty] : []}
        sale={
          printableWarranty
            ? sales.find((s) => s.id === printableWarranty.saleId) || null
            : null
        }
        products={products}
        settings={receiptSettings}
        warrantySettings={warrantySheetSettings}
        onClose={() => setPrintableWarranty(null)}
      />
    </motion.div>
  );
}
