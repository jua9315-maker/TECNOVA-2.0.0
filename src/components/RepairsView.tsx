import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Clock,
  Plus,
  Search,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import {
  formatCurrency,
  REPAIR_STATUSES,
  type RepairStatus,
  type RepairTicket,
  type UserRole,
  type Warranty,
} from '../types/store';
import {
  createRepairTicket,
  updateRepairTicket,
} from '../lib/storeOperations';
import { QrCodeImg } from './BarcodeQrToolkit';

export function RepairsView({
  repairs,
  warranties,
  uid,
  actorName,
  viewRole,
  prefillWarranty,
  onClearPrefillWarranty,
  focusedRepair,
  onClearFocusedRepair,
}: {
  repairs: RepairTicket[];
  warranties: Warranty[];
  uid: string;
  actorName: string;
  viewRole: UserRole;
  prefillWarranty: Warranty | null;
  onClearPrefillWarranty: () => void;
  focusedRepair: RepairTicket | null;
  onClearFocusedRepair: () => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | RepairStatus>('Todos');
  const [newOpen, setNewOpen] = useState(false);
  const [selected, setSelected] = useState<RepairTicket | null>(null);
  const [saving, setSaving] = useState(false);

  const [newForm, setNewForm] = useState({
    customerName: '',
    customerPhone: '',
    deviceBrand: 'Apple',
    deviceModel: '',
    imei: '',
    issueDescription: '',
    estimatedCost: 0,
    warrantyCovered: false,
    warrantyId: '',
  });

  const [editForm, setEditForm] = useState({
    status: 'Recibido' as RepairStatus,
    diagnosis: '',
    partsUsed: '',
    estimatedCost: 0,
    finalCost: 0,
    warrantyCovered: false,
  });

  useEffect(() => {
    if (prefillWarranty) {
      setNewForm({
        customerName: prefillWarranty.customerName,
        customerPhone: prefillWarranty.customerPhone,
        deviceBrand: prefillWarranty.productName.split(' ')[0] || 'Smartphone',
        deviceModel: prefillWarranty.productName,
        imei: prefillWarranty.imei,
        issueDescription: `Revisión cubierta bajo póliza ${prefillWarranty.warrantyCode}`,
        estimatedCost: 0,
        warrantyCovered: prefillWarranty.status === 'Vigente',
        warrantyId: prefillWarranty.id,
      });
      setNewOpen(true);
      onClearPrefillWarranty();
    }
  }, [prefillWarranty, onClearPrefillWarranty]);

  const openRepairDetail = (r: RepairTicket) => {
    setSelected(r);
    setEditForm({
      status: r.status,
      diagnosis: r.diagnosis,
      partsUsed: r.partsUsed,
      estimatedCost: r.estimatedCost,
      finalCost: r.finalCost,
      warrantyCovered: r.warrantyCovered,
    });
  };

  useEffect(() => {
    if (focusedRepair) {
      openRepairDetail(focusedRepair);
      onClearFocusedRepair();
    }
  }, [focusedRepair, onClearFocusedRepair]);

  // Auto-detect warranty by IMEI when creating a new ticket
  const matchedWarrantyByImei = useMemo(() => {
    const clean = newForm.imei.trim().toLowerCase();
    if (clean.length < 6) return null;
    return warranties.find((w) => w.imei.toLowerCase() === clean) || null;
  }, [newForm.imei, warranties]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return repairs.filter((r) => {
      if (statusFilter !== 'Todos' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.ticketCode.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.customerPhone.toLowerCase().includes(q) ||
        r.deviceModel.toLowerCase().includes(q) ||
        r.imei.toLowerCase().includes(q)
      );
    });
  }, [repairs, search, statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createRepairTicket(uid, actorName, {
        ...newForm,
        warrantyId: newForm.warrantyId || matchedWarrantyByImei?.id || '',
      });
      setNewOpen(false);
      setNewForm({
        customerName: '',
        customerPhone: '',
        deviceBrand: 'Apple',
        deviceModel: '',
        imei: '',
        issueDescription: '',
        estimatedCost: 0,
        warrantyCovered: false,
        warrantyId: '',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await updateRepairTicket(selected, editForm, actorName);
      setSelected(null);
    } finally {
      setSaving(false);
    }
  };

  const isTerminalForStaff =
    viewRole !== 'admin' &&
    selected !== null &&
    (selected.status === 'Entregado' || selected.status === 'Cancelado');

  const statusTone = (status: RepairStatus) => {
    switch (status) {
      case 'Listo para Entrega':
      case 'Entregado':
        return 'text-emerald-700';
      case 'En Diagnóstico':
      case 'Esperando Repuesto':
      case 'En Reparación':
        return 'text-blue-700';
      case 'Cancelado':
        return 'text-red-600';
      default:
        return 'text-amber-700';
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
            Historial de Reparaciones Técnicas
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Bitácora de servicio técnico por cliente y equipo, diagnósticos, refacciones y vínculo con garantías
          </p>
        </div>

        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nueva Orden de Taller
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por orden REP, cliente, modelo o IMEI..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {(['Todos', ...REPAIR_STATUSES] as const).map((st) => (
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
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-14 text-center">
            <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-900">
              No hay órdenes de reparación en esta vista
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Crea una orden técnica para llevar el historial completo del equipo del cliente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Orden</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Dispositivo / IMEI</th>
                  <th className="py-3 px-4">Falla Reportada</th>
                  <th className="py-3 px-4">Garantía</th>
                  <th className="py-3 px-4 text-right">Costo Final</th>
                  <th className="py-3 px-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => openRepairDetail(r)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                      {r.ticketCode}
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-xs font-medium text-slate-900">{r.customerName}</p>
                      <p className="text-[11px] text-slate-400">{r.customerPhone}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-xs font-medium text-slate-900">
                        {r.deviceBrand} {r.deviceModel}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400">{r.imei}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-[260px] truncate">
                      {r.issueDescription}
                    </td>
                    <td className="py-3 px-4 text-xs whitespace-nowrap">
                      {r.warrantyCovered ? (
                        <span className="text-emerald-700 font-medium">Cubierta</span>
                      ) : (
                        <span className="text-slate-400">Particular</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold text-slate-900 whitespace-nowrap">
                      {formatCurrency(r.finalCost)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`text-xs font-medium ${statusTone(r.status)}`}>
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

      {/* Repair Detail & Chronological History Drawer */}
      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/35 backdrop-blur-xs">
          <div className="bg-white w-full max-w-xl h-full border-l border-slate-200 overflow-y-auto p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <p className="text-xs font-mono text-slate-500">
                  {selected.ticketCode} · Técnico: {selected.technicianName}
                </p>
                <h2 className="text-lg font-semibold text-slate-900 mt-1">
                  {selected.deviceBrand} {selected.deviceModel}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cliente: {selected.customerName} ({selected.customerPhone}) · IMEI:{' '}
                  <span className="font-mono">{selected.imei}</span>
                </p>
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
              <div className="text-xs space-y-1">
                <p className="font-semibold text-slate-800">Falla inicial reportada</p>
                <p className="text-slate-600 leading-relaxed">{selected.issueDescription}</p>
              </div>
              <QrCodeImg value={selected.ticketCode} size={76} />
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              {isTerminalForStaff && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  Esta orden ya fue marcada como <strong>{selected.status}</strong>. Solo un administrador puede reabrirla.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Estado Técnico
                  </label>
                  <select
                    disabled={isTerminalForStaff}
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm({ ...editForm, status: e.target.value as RepairStatus })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white disabled:bg-slate-100"
                  >
                    {REPAIR_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={isTerminalForStaff}
                      checked={editForm.warrantyCovered}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          warrantyCovered: e.target.checked,
                          finalCost: e.target.checked ? 0 : editForm.finalCost,
                        })
                      }
                      className="w-4 h-4 rounded border-slate-300 text-blue-700"
                    />
                    <span className="text-xs font-medium text-slate-700">
                      Cubierto por garantía ($0 cliente)
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Diagnóstico Técnico
                </label>
                <textarea
                  rows={2}
                  disabled={isTerminalForStaff}
                  maxLength={500}
                  value={editForm.diagnosis}
                  onChange={(e) => setEditForm({ ...editForm, diagnosis: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Refacciones / Piezas Utilizadas
                </label>
                <input
                  type="text"
                  disabled={isTerminalForStaff}
                  maxLength={300}
                  value={editForm.partsUsed}
                  onChange={(e) => setEditForm({ ...editForm, partsUsed: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg disabled:bg-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Costo Estimado ($)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={isTerminalForStaff}
                    value={editForm.estimatedCost}
                    onChange={(e) =>
                      setEditForm({ ...editForm, estimatedCost: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Costo Final ($)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={isTerminalForStaff || editForm.warrantyCovered}
                    value={editForm.warrantyCovered ? 0 : editForm.finalCost}
                    onChange={(e) =>
                      setEditForm({ ...editForm, finalCost: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg disabled:bg-slate-100"
                  />
                </div>
              </div>

              {!isTerminalForStaff && (
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  {saving ? 'Guardando historial...' : 'Guardar Avance Técnico'}
                </button>
              )}
            </form>

            {/* Chronological Repair History Log */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>Bitácora Cronológica del Equipo</span>
              </div>
              <div className="space-y-2">
                {selected.historyLog.map((entry, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-mono leading-relaxed"
                  >
                    {entry}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Repair Ticket Modal */}
      {newOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                Ingreso a Servicio Técnico
              </h2>
              <button
                type="button"
                onClick={() => setNewOpen(false)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nombre del Cliente
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
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Marca
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={newForm.deviceBrand}
                    onChange={(e) => setNewForm({ ...newForm, deviceBrand: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Modelo del Celular
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={newForm.deviceModel}
                    onChange={(e) => setNewForm({ ...newForm, deviceModel: e.target.value })}
                    placeholder="Ej: Galaxy S24 Ultra"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    IMEI / Serie
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    value={newForm.imei}
                    onChange={(e) => setNewForm({ ...newForm, imei: e.target.value })}
                    placeholder="3584..."
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Presupuesto Estimado ($)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={newForm.warrantyCovered ? 0 : newForm.estimatedCost}
                    disabled={newForm.warrantyCovered}
                    onChange={(e) =>
                      setNewForm({ ...newForm, estimatedCost: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg disabled:bg-slate-100"
                  />
                </div>
              </div>

              {matchedWarrantyByImei && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-emerald-900">
                    <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      Garantía detectada ({matchedWarrantyByImei.warrantyCode} ·{' '}
                      {matchedWarrantyByImei.status})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setNewForm({
                        ...newForm,
                        warrantyCovered: matchedWarrantyByImei.status === 'Vigente',
                        warrantyId: matchedWarrantyByImei.id,
                        estimatedCost: 0,
                      })
                    }
                    className="text-xs font-semibold text-emerald-800 hover:underline whitespace-nowrap"
                  >
                    Aplicar Garantía
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Falla Reportada por el Cliente
                </label>
                <textarea
                  rows={3}
                  required
                  maxLength={500}
                  value={newForm.issueDescription}
                  onChange={(e) =>
                    setNewForm({ ...newForm, issueDescription: e.target.value })
                  }
                  placeholder="Describe síntomas, golpes, humedad o fallos de carga..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newForm.warrantyCovered}
                  onChange={(e) =>
                    setNewForm({ ...newForm, warrantyCovered: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-slate-300 text-blue-700"
                />
                <span className="text-xs text-slate-700">
                  Ingresar como reparación cubierta por garantía
                </span>
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNewOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg"
                >
                  {saving ? 'Registrando...' : 'Crear Orden Técnica'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
}
