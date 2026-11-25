import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  isValidUsername,
  normalizeUsername,
  type TeamMember,
  type UserProfile,
  type UserRole,
} from '../types/store';
import {
  authenticateLocalUser,
  ensureLocalDbReady,
  getAccountByUid,
  getSessionUid,
  isDefaultAdminPasswordUntouched,
  setSessionUid,
  subscribeLocalStore,
  toUserProfile,
} from '../lib/localDb';

export interface LocalAuthUser {
  uid: string;
  username: string;
  displayName: string;
}

interface AuthContextValue {
  user: LocalAuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  actualRole: UserRole;
  activeViewRole: UserRole;
  isDefaultAdminPasswordActive: boolean;
  setActiveViewRole: (role: UserRole) => void;
  signInWithUsername: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LocalAuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeViewRole, setActiveViewRole] = useState<UserRole>('staff');
  const [isDefaultAdminPasswordActive, setIsDefaultAdminPasswordActive] =
    useState(false);

  useEffect(() => {
    let active = true;

    async function bootstrapSession() {
      try {
        await ensureLocalDbReady();
        const untouched = await isDefaultAdminPasswordUntouched();
        if (active) setIsDefaultAdminPasswordActive(untouched);

        const sessionUid = await getSessionUid();
        if (sessionUid) {
          const account = await getAccountByUid(sessionUid);
          if (account && active) {
            setUser({
              uid: account.uid,
              username: account.username,
              displayName: account.displayName,
            });
            setProfile(toUserProfile(account));
            setActiveViewRole(account.role);
          } else {
            await setSessionUid(null);
          }
        }
      } catch (err) {
        if (active) {
          setAuthError(
            err instanceof Error
              ? err.message
              : 'No se pudo inicializar la base de datos local.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void bootstrapSession();

    const unsubAccounts = subscribeLocalStore<TeamMember>(
      'accounts',
      async (members) => {
        const untouched = await isDefaultAdminPasswordUntouched();
        if (active) setIsDefaultAdminPasswordActive(untouched);

        setUser((currentUser) => {
          if (!currentUser) return null;
          const matched = members.find((m) => m.uid === currentUser.uid);
          if (matched) {
            setProfile((prev) =>
              prev
                ? {
                    ...prev,
                    username: matched.username,
                    displayName: matched.displayName,
                    role: matched.role,
                    allowedTabs: matched.allowedTabs,
                    active: matched.active,
                  }
                : null
            );
            if (matched.role !== 'admin' && matched.role !== 'developer') {
              setActiveViewRole('staff');
            }
          }
          return currentUser;
        });
      }
    );

    return () => {
      active = false;
      unsubAccounts();
    };
  }, []);

  const signInWithUsername = async (username: string, password: string) => {
    setAuthError(null);
    const clean = normalizeUsername(username);
    if (!isValidUsername(clean)) {
      setAuthError(
        'Ingresa un nombre de usuario válido (3 a 40 caracteres: letras, números, ".", "_" o "-").'
      );
      return;
    }
    if (!password || password.length < 6) {
      setAuthError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    try {
      const account = await authenticateLocalUser(clean, password);
      setUser({
        uid: account.uid,
        username: account.username,
        displayName: account.displayName,
      });
      setProfile(toUserProfile(account));
      setActiveViewRole(account.role);
      const untouched = await isDefaultAdminPasswordUntouched();
      setIsDefaultAdminPasswordActive(untouched);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'No se pudo iniciar sesión. Verifica tus credenciales.'
      );
    }
  };

  const signOut = async () => {
    await setSessionUid(null);
    setUser(null);
    setProfile(null);
    setActiveViewRole('staff');
  };

  const actualRole: UserRole =
    profile?.role === 'developer'
      ? 'developer'
      : profile?.role === 'admin'
        ? 'admin'
        : 'staff';

  const handleSetViewRole = (role: UserRole) => {
    if (actualRole === 'developer') {
      setActiveViewRole(role === 'staff' ? 'staff' : 'developer');
    } else if (actualRole === 'admin') {
      setActiveViewRole(role === 'staff' ? 'staff' : 'admin');
    } else {
      setActiveViewRole('staff');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        authError,
        actualRole,
        activeViewRole:
          actualRole === 'admin' || actualRole === 'developer'
            ? activeViewRole
            : 'staff',
        isDefaultAdminPasswordActive,
        setActiveViewRole: handleSetViewRole,
        signInWithUsername,
        signOut,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider');
  }
  return ctx;
}
