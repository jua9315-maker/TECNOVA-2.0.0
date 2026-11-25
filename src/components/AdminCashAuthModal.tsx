import React, { useEffect, useState } from 'react';
import { AlertCircle, KeyRound, ShieldCheck, Unlock, X } from 'lucide-react';

export function AdminCashAuthModal({
  isOpen,
  dateKey,
  defaultAdminUsername,
  onClose,
  onAuthorize,
}: {
  isOpen: boolean;
  dateKey: string;
  defaultAdminUsername?: string;
  onClose: () => void;
  onAuthorize: (
    adminUsername: string,
    adminPassword: string,
    reason: string
  ) => Promise<void>;
}) {
  const [username, setUsername] = useState(defaultAdminUsername || '');
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUsername(defaultAdminUsername || '');
      setPassword('');
      setReason('');
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen, defaultAdminUsername]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('Ingresa el usuario y la contraseña de un administrador.');
      return;
    }

    setSubmitting(true);
    try {
      await onAuthorize(username.trim(), password, reason.trim());
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo autorizar la apertura de caja.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-cash-auth-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-slate-950 text-white border border-cyan-500/30 shadow-2xl overflow-hidden">
        <div className="h-[2px] bg-gradient-to-r from-amber-400 via-cyan-400 to-fuchsia-500" />
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="admin-cash-auth-title"
                className="text-sm font-semibold text-white truncate"
              >
                Autorización de Administrador
              </h2>
              <p className="text-[11px] text-slate-400 font-mono tabular-nums">
                Abrir caja · Fecha {dateKey}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            La caja del día se encuentra cerrada. Para reabrirla y permitir nuevas operaciones, un{' '}
            <strong className="text-amber-300">Administrador</strong> debe confirmar sus credenciales.
          </p>

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Usuario Administrador
            </label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej. admin"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white/5 border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Contraseña de Administrador
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña autorizada"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl bg-white/5 border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Motivo de reapertura (opcional)
            </label>
            <input
              type="text"
              maxLength={140}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Venta adicional de cierre o ajuste de corte"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white/5 border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-300 via-cyan-300 to-emerald-300 hover:from-amber-200 hover:to-emerald-200 rounded-lg transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" />
              {submitting ? 'Verificando...' : 'Autorizar y Abrir Caja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
