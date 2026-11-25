import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  LayoutList,
  Shield,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  BOOTSTRAP_ADMIN_USERNAME,
  DEFAULT_ADMIN_MENU_TABS,
  DEFAULT_STAFF_MENU_TABS,
  MENU_PERMISSION_OPTIONS,
  normalizeUsername,
  resolveUserAllowedTabs,
  type NavTab,
  type TeamMember,
  type UserRole,
} from '../types/store';
import {
  createTeamMemberAccount,
  deleteTeamMemberAccount,
  exportDesktopBackupFile,
  importDesktopBackupFile,
  updateTeamMemberPassword,
  updateUserAllowedTabs,
  updateUserRoleAndStatus,
} from '../lib/storeOperations';

const CASHIER_PRESET_TABS: NavTab[] = [
  'dashboard',
  'pos',
  'inventory',
  'warranties',
];
const WORKSHOP_PRESET_TABS: NavTab[] = [
  'dashboard',
  'repairs',
  'warranties',
  'inventory',
];

function formatMenuSummary(member: TeamMember): string {
  const tabs = resolveUserAllowedTabs(
    member.role,
    member.allowedTabs,
    member.username
  );
  const maxForRole = MENU_PERMISSION_OPTIONS.length - 1;
  if (tabs.length >= maxForRole) {
    return `Menú completo (${tabs.length})`;
  }
  const labels = tabs
    .map((id) => MENU_PERMISSION_OPTIONS.find((o) => o.id === id)?.label || id)
    .slice(0, 3);
  const suffix = tabs.length > 3 ? ` +${tabs.length - 3}` : '';
  return `${tabs.length} secciones: ${labels.join(' · ')}${suffix}`;
}

function MenuSelectorGrid({
  selectedTabs,
  onChange,
  role,
}: {
  selectedTabs: NavTab[];
  onChange: (next: NavTab[]) => void;
  role: UserRole;
}) {
  const availableOptions = MENU_PERMISSION_OPTIONS.filter(
    (o) => o.id !== 'settings'
  );

  const toggleTab = (tabId: NavTab) => {
    if (selectedTabs.includes(tabId)) {
      onChange(selectedTabs.filter((t) => t !== tabId));
    } else {
      const ordered = availableOptions
        .map((o) => o.id)
        .filter((id) => id === tabId || selectedTabs.includes(id));
      onChange(ordered);
    }
  };

  return (
    <div className="space-y-2.5 pt-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-medium text-slate-700">
          ¿Qué puede ver en el menú? ({selectedTabs.length} de{' '}
          {availableOptions.length})
        </label>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <button
            type="button"
            onClick={() =>
              onChange(
                role === 'admin'
                  ? [...DEFAULT_ADMIN_MENU_TABS]
                  : [...DEFAULT_STAFF_MENU_TABS]
              )
            }
            className="px-2 py-1 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md font-medium"
          >
            Por rol
          </button>
          <button
            type="button"
            onClick={() => onChange([...CASHIER_PRESET_TABS])}
            className="px-2 py-1 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md font-medium"
          >
            Solo Caja
          </button>
          <button
            type="button"
            onClick={() => onChange([...WORKSHOP_PRESET_TABS])}
            className="px-2 py-1 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md font-medium"
          >
            Solo Taller
          </button>
          <button
            type="button"
            onClick={() => onChange([...DEFAULT_ADMIN_MENU_TABS])}
            className="px-2 py-1 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md font-medium"
          >
            Todo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {availableOptions.map((opt) => {
          const checked = selectedTabs.includes(opt.id);
          return (
            <label
              key={opt.id}
              className={`flex items-start gap-2.5 p-2.5 border rounded-lg cursor-pointer transition-colors ${
                checked
                  ? 'border-blue-600 bg-blue-50/50'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleTab(opt.id)}
                className="mt-0.5 rounded border-slate-300"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 leading-tight">
                  {opt.label}
                </p>
                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                  {opt.description}
                </p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function TeamManagementView({
  members,
  currentUid,
  isDeveloper = false,
}: {
  members: TeamMember[];
  currentUid: string;
  isDeveloper?: boolean;
}) {
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('staff');
  const [allowedTabs, setAllowedTabs] = useState<NavTab[]>([
    ...DEFAULT_STAFF_MENU_TABS,
  ]);

  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  // Change password dialog state
  const [pwdTarget, setPwdTarget] = useState<TeamMember | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  // Edit menu permissions modal state
  const [menuTarget, setMenuTarget] = useState<TeamMember | null>(null);
  const [menuDraftTabs, setMenuDraftTabs] = useState<NavTab[]>([]);
  const [savingMenu, setSavingMenu] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetForm = () => {
    setDisplayName('');
    setUsername('');
    setPassword('');
    setShowPassword(false);
    setRole('staff');
    setAllowedTabs([...DEFAULT_STAFF_MENU_TABS]);
    setFormError(null);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setNotice(null);
    setCreating(true);
    try {
      const created = await createTeamMemberAccount({
        displayName,
        username,
        password,
        role,
        allowedTabs,
      });
      setNotice(
        `Cuenta local "@${created.username}" creada con ${allowedTabs.length} ${
          allowedTabs.length === 1 ? 'opción visible' : 'opciones visibles'
        } en el menú.`
      );
      resetForm();
      setModalOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'No se pudo crear la cuenta.'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdTarget) return;
    setPwdError(null);
    setSavingPwd(true);
    try {
      await updateTeamMemberPassword(pwdTarget.uid, newPassword);
      setNotice(`Contraseña actualizada para "@${pwdTarget.username}".`);
      setPwdTarget(null);
      setNewPassword('');
    } catch (err) {
      setPwdError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar la contraseña.'
      );
    } finally {
      setSavingPwd(false);
    }
  };

  const handleSaveMenuPermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuTarget) return;
    setMenuError(null);
    setSavingMenu(true);
    try {
      await updateUserAllowedTabs(menuTarget.uid, menuDraftTabs);
      setNotice(
        `Menú actualizado para "@${menuTarget.username}" (${menuDraftTabs.length} secciones visibles).`
      );
      setMenuTarget(null);
    } catch (err) {
      setMenuError(
        err instanceof Error
          ? err.message
          : 'No se pudieron actualizar los permisos de menú.'
      );
    } finally {
      setSavingMenu(false);
    }
  };

  const handleRoleChange = async (member: TeamMember, nextRole: UserRole) => {
    setBusyUid(member.uid);
    try {
      await updateUserRoleAndStatus(member, nextRole, member.active);
    } finally {
      setBusyUid(null);
    }
  };

  const handleToggleActive = async (member: TeamMember) => {
    setBusyUid(member.uid);
    try {
      await updateUserRoleAndStatus(member, member.role, !member.active);
    } finally {
      setBusyUid(null);
    }
  };

  const handleDeleteUser = async (member: TeamMember) => {
    if (
      !window.confirm(
        `¿Estás seguro de eliminar permanentemente al usuario "@${member.username}" (${member.displayName})?`
      )
    ) {
      return;
    }
    setBusyUid(member.uid);
    try {
      await deleteTeamMemberAccount(member.uid);
      setNotice(`Usuario "@${member.username}" eliminado correctamente.`);
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : 'No se pudo eliminar el usuario.'
      );
    } finally {
      setBusyUid(null);
    }
  };

  const handleExportBackup = async () => {
    setBackupError(null);
    try {
      await exportDesktopBackupFile();
      setNotice('Respaldo local exportado en formato .json.');
    } catch (err) {
      setBackupError(
        err instanceof Error ? err.message : 'Error al exportar el respaldo.'
      );
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBackupError(null);
    setNotice(null);
    try {
      const counts = await importDesktopBackupFile(file);
      setNotice(
        `Respaldo restaurado: ${counts.products} productos, ${counts.sales} ventas, ${counts.warranties} garantías y ${counts.repairs} reparaciones.`
      );
    } catch (err) {
      setBackupError(
        err instanceof Error ? err.message : 'Archivo de respaldo inválido.'
      );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Control de Roles, Equipo y Respaldo Local
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Administra usuarios, contraseñas y las secciones del menú visibles para cada colaborador directamente en este equipo.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            resetForm();
            setModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Crear Usuario
        </button>
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-3 text-xs text-emerald-800">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Role Permissions Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Shield className="w-4 h-4 text-blue-700" />
            Rol Administrador
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Acceso total a costos y márgenes de ganancia, eliminación de inventario, anulación de ventas, reapertura de reportes diarios cerrados, respaldo local y gestión de usuarios.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Users className="w-4 h-4 text-slate-700" />
            Rol Usuario (Vendedor / Técnico)
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Panel enfocado en mostrador y taller: cobro POS, escaneo de códigos de barra y QR para actualizar stock o subir productos, gestión de garantías y bitácora de reparaciones.
          </p>
        </div>
      </div>

      {(() => {
        const visibleMembers = members.filter((m) => m.role !== 'developer');
        return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {visibleMembers.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No hay colaboradores registrados aún. Usa &quot;Crear Usuario&quot; para dar de alta al equipo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Colaborador</th>
                  <th className="py-3 px-4">Usuario de Acceso</th>
                  <th className="py-3 px-4">Rol Asignado</th>
                  <th className="py-3 px-4">Menú Visible</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {visibleMembers.map((u) => {
                  const isSelf = u.uid === currentUid;
                  const isRootAdmin =
                    u.username.toLowerCase() === BOOTSTRAP_ADMIN_USERNAME;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {u.displayName}{' '}
                        {isSelf && (
                          <span className="text-xs font-normal text-slate-400">
                            (Tú)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 font-mono">
                        @{u.username}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          disabled={isRootAdmin || isSelf || busyUid === u.uid}
                          value={u.role}
                          onChange={(e) =>
                            void handleRoleChange(u, e.target.value as UserRole)
                          }
                          className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white disabled:bg-slate-100"
                        >
                          <option value="admin">Administrador</option>
                          <option value="staff">Usuario (Vendedor/Técnico)</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
                        {formatMenuSummary(u)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs font-medium ${
                            u.active ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {u.active ? 'Activo' : 'Suspendido'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-3 whitespace-nowrap">
                        {!isRootAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setMenuTarget(u);
                              setMenuDraftTabs(
                                resolveUserAllowedTabs(
                                  u.role,
                                  u.allowedTabs,
                                  u.username
                                )
                              );
                              setMenuError(null);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:underline"
                          >
                            <LayoutList className="w-3.5 h-3.5" />
                            Menú
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setPwdTarget(u);
                            setNewPassword('');
                            setShowNewPassword(false);
                            setPwdError(null);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          Contraseña
                        </button>
                        {!isRootAdmin && !isSelf && (
                          <button
                            type="button"
                            disabled={busyUid === u.uid}
                            onClick={() => void handleToggleActive(u)}
                            className="text-xs font-medium text-slate-700 hover:underline disabled:opacity-50"
                          >
                            {u.active ? 'Suspender' : 'Reactivar'}
                          </button>
                        )}
                        {isDeveloper && u.role !== 'developer' && (
                          <button
                            type="button"
                            disabled={busyUid === u.uid}
                            onClick={() => void handleDeleteUser(u)}
                            className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                          >
                            Eliminar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
        );
      })()}

      {/* Local Desktop Database Backup & Restore */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <HardDrive className="w-4 h-4 text-emerald-700" />
            Respaldo de Base de Datos en tu Equipo
          </div>
          <p className="text-xs text-slate-500">
            Guarda una copia completa de tu inventario, ventas, garantías, taller y usuarios en un archivo local o restaura un respaldo en otra computadora.
          </p>
          {backupError && (
            <p className="text-xs text-red-600 font-medium pt-1">{backupError}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => void handleExportBackup()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar Respaldo (.json)
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => void handleImportBackup(e)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" />
            Restaurar Respaldo
          </button>
        </div>
      </div>

      {/* Create Team Account Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Crear Usuario Local
                </h2>
                <p className="text-xs text-slate-500">
                  Define usuario, contraseña y qué opciones podrá ver en su menú
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleCreateUser(e)}
              className="p-6 space-y-4 overflow-y-auto"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="ej. Valeria Gómez"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nombre de usuario
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={40}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ej. valeria.taller"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Acceso: <span className="font-mono text-slate-800">@{normalizeUsername(username) || 'usuario'}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Contraseña de acceso
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full pl-3 pr-10 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Rol asignado
                  </label>
                  <select
                    value={role}
                    onChange={(e) => {
                      const nextRole =
                        e.target.value === 'admin' ? 'admin' : 'staff';
                      setRole(nextRole);
                      setAllowedTabs(
                        nextRole === 'admin'
                          ? [...DEFAULT_ADMIN_MENU_TABS]
                          : [...DEFAULT_STAFF_MENU_TABS]
                      );
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600"
                  >
                    <option value="staff">Usuario (Vendedor / Técnico)</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>

              <MenuSelectorGrid
                selectedTabs={allowedTabs}
                onChange={setAllowedTabs}
                role={role}
              />

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {formError}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating || allowedTabs.length === 0}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 rounded-lg"
                >
                  {creating ? 'Creando...' : 'Guardar y Crear Acceso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Menu Permissions Modal */}
      {menuTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Permisos de Menú
                </h2>
                <p className="text-xs text-slate-500 font-mono">
                  @{menuTarget.username} · {menuTarget.displayName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMenuTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleSaveMenuPermissions(e)}
              className="p-6 space-y-4 overflow-y-auto"
            >
              <MenuSelectorGrid
                selectedTabs={menuDraftTabs}
                onChange={setMenuDraftTabs}
                role={menuTarget.role}
              />

              {menuError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {menuError}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMenuTarget(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingMenu || menuDraftTabs.length === 0}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 rounded-lg"
                >
                  {savingMenu ? 'Guardando...' : 'Guardar Menú'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {pwdTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Cambiar Contraseña
                </h2>
                <p className="text-xs text-slate-500 font-mono">
                  @{pwdTarget.username} · {pwdTarget.displayName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPwdTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleChangePassword(e)}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-3 pr-10 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {pwdError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {pwdError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPwdTarget(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPwd}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 rounded-lg"
                >
                  {savingPwd ? 'Guardando...' : 'Actualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
}
