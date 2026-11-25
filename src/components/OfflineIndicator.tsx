import React from 'react';
import { HardDrive } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC<{ visible?: boolean }> = ({
  visible = true,
}) => {
  const isOnline = useOnlineStatus();

  if (isOnline || !visible) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-medium text-white shadow-lg no-print">
      <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      <span>Modo sin conexión — Base de datos local activa</span>
    </div>
  );
};
