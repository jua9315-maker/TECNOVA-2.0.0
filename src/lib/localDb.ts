import {
  DEFAULT_APP_APPEARANCE_SETTINGS,
  DEFAULT_CATALOG_IMAGE_PRESETS,
  DEFAULT_DEVELOPER_SYSTEM_SETTINGS,
  DEFAULT_INSTALLED_APP_SETTINGS,
  DEFAULT_LOCAL_ADMIN,
  DEFAULT_LOCAL_DEVELOPER,
  DEFAULT_LOGIN_PRESENTATION_SETTINGS,
  DEFAULT_POS_SETTINGS,
  DEFAULT_RECEIPT_SETTINGS,
  DEFAULT_VISUAL_CUSTOMIZATION_SETTINGS,
  DEFAULT_WARRANTY_SHEET_SETTINGS,
  normalizeUsername,
  PRODUCT_CONDITIONS,
  resolveUserAllowedTabs,
  resolveWarrantyTermItems,
  STORE_ID,
  type AppAppearanceSettings,
  type CatalogImagePreset,
  type DailyReport,
  type DeveloperSystemSettings,
  type InstalledAppSettings,
  type LoginPresentationSettings,
  type NavTab,
  type PosSettings,
  type Product,
  type ReceiptSettings,
  type RepairTicket,
  type Sale,
  type StoreTimestamp,
  type TeamMember,
  type UserProfile,
  type UserRole,
  type VisualCustomizationSettings,
  type Warranty,
  type WarrantySheetSettings,
  type WarrantyTermItem,
} from '../types/store';

export type LocalStoreName =
  | 'accounts'
  | 'products'
  | 'sales'
  | 'warranties'
  | 'repairs'
  | 'dailyReports';

export interface StoredAccountRecord {
  uid: string;
  username: string;
  displayName: string;
  role: UserRole;
  allowedTabs?: NavTab[];
  active: boolean;
  storeId: string;
  salt: string;
  passwordHash: string;
  isDefaultPassword?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

type WithTimestamps = {
  createdAtMs?: number;
  updatedAtMs?: number;
  createdAt?: StoreTimestamp | null;
  updatedAt?: StoreTimestamp | null;
};

const DB_NAME = 'nexocell_desktop_db';
const DB_VERSION = 1;
const ALL_STORES: (LocalStoreName | 'meta')[] = [
  'accounts',
  'products',
  'sales',
  'warranties',
  'repairs',
  'dailyReports',
  'meta',
];
const SESSION_KEY = 'nexocell_desktop_session_uid';
const MEMORY_FALLBACK_KEY = 'nexocell_desktop_fallback_v1';

const listeners: Record<LocalStoreName, Set<(items: unknown[]) => void>> = {
  accounts: new Set(),
  products: new Set(),
  sales: new Set(),
  warranties: new Set(),
  repairs: new Set(),
  dailyReports: new Set(),
};

const receiptListeners = new Set<(settings: ReceiptSettings) => void>();
const loginPresentationListeners = new Set<(settings: LoginPresentationSettings) => void>();
const appAppearanceListeners = new Set<(settings: AppAppearanceSettings) => void>();
const visualCustomizationListeners = new Set<
  (settings: VisualCustomizationSettings) => void
>();
const installedAppListeners = new Set<(settings: InstalledAppSettings) => void>();
const developerSystemListeners = new Set<
  (settings: DeveloperSystemSettings) => void
>();
const customCategoriesListeners = new Set<(categories: string[]) => void>();
const posSettingsListeners = new Set<(settings: PosSettings) => void>();
const warrantySheetSettingsListeners = new Set<
  (settings: WarrantySheetSettings) => void
>();

let dbPromise: Promise<IDBDatabase | null> | null = null;
let initPromise: Promise<void> | null = null;
let memoryMirror: Record<string, Record<string, unknown>> | null = null;
let broadcast: BroadcastChannel | null = null;

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcast = new BroadcastChannel('nexocell_desktop_sync');
    broadcast.onmessage = (event) => {
      const store = event.data?.store as
        | LocalStoreName
        | 'receiptSettings'
        | 'loginPresentation'
        | 'appAppearance'
        | 'visualCustomization'
        | 'installedApp'
        | 'developerSystem'
        | 'customCategories'
        | 'posSettings'
        | 'warrantySheetSettings'
        | 'all'
        | undefined;
      if (store === 'all') {
        for (const s of Object.keys(listeners) as LocalStoreName[]) {
          void notifyStore(s, false);
        }
        void notifyReceiptSettings(false);
        void notifyLoginPresentationSettings(false);
        void notifyAppAppearanceSettings(false);
        void notifyVisualCustomizationSettings(false);
        void notifyInstalledAppSettings(false);
        void notifyDeveloperSystemSettings(false);
        void notifyCustomProductCategories(false);
        void notifyPosSettings(false);
        void notifyWarrantySheetSettings(false);
      } else if (store === 'receiptSettings') {
        void notifyReceiptSettings(false);
      } else if (store === 'loginPresentation') {
        void notifyLoginPresentationSettings(false);
      } else if (store === 'appAppearance') {
        void notifyAppAppearanceSettings(false);
      } else if (store === 'visualCustomization') {
        void notifyVisualCustomizationSettings(false);
      } else if (store === 'installedApp') {
        void notifyInstalledAppSettings(false);
      } else if (store === 'developerSystem') {
        void notifyDeveloperSystemSettings(false);
      } else if (store === 'customCategories') {
        void notifyCustomProductCategories(false);
      } else if (store === 'posSettings') {
        void notifyPosSettings(false);
      } else if (store === 'warrantySheetSettings') {
        void notifyWarrantySheetSettings(false);
      } else if (store && listeners[store]) {
        void notifyStore(store, false);
      }
    };
  } catch {
    broadcast = null;
  }
}

export function makeTimestamp(ms = Date.now()): StoreTimestamp {
  return {
    toDate: () => new Date(ms),
    toMillis: () => ms,
  };
}

export function generateLocalId(prefix = 'id'): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rnd}`;
}

function hydrateRecord<T extends WithTimestamps>(raw: T): T {
  const createdMs = typeof raw.createdAtMs === 'number' ? raw.createdAtMs : Date.now();
  const updatedMs = typeof raw.updatedAtMs === 'number' ? raw.updatedAtMs : createdMs;
  return {
    ...raw,
    createdAt: makeTimestamp(createdMs),
    updatedAt: makeTimestamp(updatedMs),
  };
}

function stripNonCloneable<T extends Record<string, unknown>>(obj: T): T {
  const copy: Record<string, unknown> = { ...obj };
  delete copy.createdAt;
  delete copy.updatedAt;
  return copy as T;
}

function loadFallbackMemory(): Record<string, Record<string, unknown>> {
  if (memoryMirror) return memoryMirror;
  const empty: Record<string, Record<string, unknown>> = {
    accounts: {},
    products: {},
    sales: {},
    warranties: {},
    repairs: {},
    dailyReports: {},
    meta: {},
  };
  try {
    const raw = localStorage.getItem(MEMORY_FALLBACK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>;
      memoryMirror = { ...empty, ...parsed };
      return memoryMirror;
    }
  } catch {
    // Ignore storage parse failure
  }
  memoryMirror = empty;
  return memoryMirror;
}

function saveFallbackMemory(): void {
  if (!memoryMirror) return;
  try {
    localStorage.setItem(MEMORY_FALLBACK_KEY, JSON.stringify(memoryMirror));
  } catch {
    // Ignore storage quota error
  }
}

function openIndexedDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const storeName of ALL_STORES) {
          if (!db.objectStoreNames.contains(storeName)) {
            const keyPath =
              storeName === 'accounts'
                ? 'uid'
                : storeName === 'meta'
                  ? 'key'
                  : 'id';
            db.createObjectStore(storeName, { keyPath });
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function getAllRaw<T>(storeName: LocalStoreName | 'meta'): Promise<T[]> {
  const db = await openIndexedDb();
  if (!db) {
    const mem = loadFallbackMemory();
    return Object.values(mem[storeName] || {}) as T[];
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []) as T[]);
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

async function getOneRaw<T>(
  storeName: LocalStoreName | 'meta',
  key: string
): Promise<T | null> {
  const db = await openIndexedDb();
  if (!db) {
    const mem = loadFallbackMemory();
    return (mem[storeName]?.[key] as T) || null;
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) || null);
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

async function putOneRaw<T extends Record<string, unknown>>(
  storeName: LocalStoreName | 'meta',
  record: T
): Promise<void> {
  const clean = stripNonCloneable(record);
  const db = await openIndexedDb();
  if (!db) {
    const mem = loadFallbackMemory();
    const keyField =
      storeName === 'accounts' ? 'uid' : storeName === 'meta' ? 'key' : 'id';
    const key = String(clean[keyField]);
    mem[storeName][key] = clean;
    saveFallbackMemory();
    return;
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(clean);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

async function deleteOneRaw(
  storeName: LocalStoreName | 'meta',
  key: string
): Promise<void> {
  const db = await openIndexedDb();
  if (!db) {
    const mem = loadFallbackMemory();
    delete mem[storeName][key];
    saveFallbackMemory();
    return;
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

function randomSalt(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return Math.random().toString(16).slice(2, 18);
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const input = `${salt}::nexocell::${password}`;
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Portable fallback when crypto.subtle is unavailable (e.g. non-HTTPS local LAN)
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`;
}

async function notifyStore(
  storeName: LocalStoreName,
  broadcastChange = true
): Promise<void> {
  const items = await readHydratedStore(storeName);
  for (const cb of listeners[storeName]) {
    cb(items);
  }
  if (broadcastChange && broadcast) {
    try {
      broadcast.postMessage({ store: storeName });
    } catch {
      // Ignore broadcast channel errors
    }
  }
}

async function readHydratedStore(storeName: LocalStoreName): Promise<unknown[]> {
  if (storeName === 'accounts') {
    const raw = await getAllRaw<StoredAccountRecord>('accounts');
    return raw.map((acc) => toTeamMember(acc));
  }
  const raw = await getAllRaw<Record<string, unknown> & WithTimestamps>(storeName);
  const hydrated = raw.map((item) => hydrateRecord(item));
  if (storeName === 'products') {
    hydrated.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
  } else if (storeName === 'dailyReports') {
    hydrated.sort((a, b) =>
      String((b as unknown as DailyReport).dateKey || '').localeCompare(
        String((a as unknown as DailyReport).dateKey || '')
      )
    );
  } else {
    hydrated.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  }
  return hydrated;
}

export function toTeamMember(acc: StoredAccountRecord): TeamMember {
  return {
    id: acc.uid,
    uid: acc.uid,
    username: acc.username,
    displayName: acc.displayName,
    role: acc.role,
    allowedTabs: resolveUserAllowedTabs(acc.role, acc.allowedTabs, acc.username),
    active: acc.active,
    storeId: acc.storeId,
    createdAt: makeTimestamp(acc.createdAtMs),
    updatedAt: makeTimestamp(acc.updatedAtMs),
  };
}

export function toUserProfile(acc: StoredAccountRecord): UserProfile {
  return {
    id: acc.uid,
    uid: acc.uid,
    username: acc.username,
    email: `${acc.username}@local.desktop`,
    displayName: acc.displayName,
    role: acc.role,
    allowedTabs: resolveUserAllowedTabs(acc.role, acc.allowedTabs, acc.username),
    active: acc.active,
    storeId: acc.storeId,
    createdAt: makeTimestamp(acc.createdAtMs),
    updatedAt: makeTimestamp(acc.updatedAtMs),
  };
}

export async function ensureLocalDbReady(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const accounts = await getAllRaw<StoredAccountRecord>('accounts');
    if (accounts.length === 0) {
      const salt = randomSalt();
      const passwordHash = await hashPassword(DEFAULT_LOCAL_ADMIN.password, salt);
      const now = Date.now();
      const defaultAdmin: StoredAccountRecord = {
        uid: 'local_admin_01',
        username: DEFAULT_LOCAL_ADMIN.username,
        displayName: DEFAULT_LOCAL_ADMIN.displayName,
        role: 'admin',
        allowedTabs: resolveUserAllowedTabs('admin', undefined, DEFAULT_LOCAL_ADMIN.username),
        active: true,
        storeId: STORE_ID,
        salt,
        passwordHash,
        isDefaultPassword: true,
        createdAtMs: now,
        updatedAtMs: now,
      };
      await putOneRaw('accounts', defaultAdmin as unknown as Record<string, unknown>);
    }

    const hasDeveloper = accounts.some(
      (a) =>
        a.role === 'developer' ||
        a.username.toLowerCase() === DEFAULT_LOCAL_DEVELOPER.username
    );
    if (!hasDeveloper) {
      const devSalt = randomSalt();
      const devHash = await hashPassword(DEFAULT_LOCAL_DEVELOPER.password, devSalt);
      const now = Date.now();
      const defaultDeveloper: StoredAccountRecord = {
        uid: 'local_developer_01',
        username: DEFAULT_LOCAL_DEVELOPER.username,
        displayName: DEFAULT_LOCAL_DEVELOPER.displayName,
        role: 'developer',
        allowedTabs: resolveUserAllowedTabs(
          'developer',
          undefined,
          DEFAULT_LOCAL_DEVELOPER.username
        ),
        active: true,
        storeId: STORE_ID,
        salt: devSalt,
        passwordHash: devHash,
        isDefaultPassword: false,
        createdAtMs: now,
        updatedAtMs: now,
      };
      await putOneRaw(
        'accounts',
        defaultDeveloper as unknown as Record<string, unknown>
      );
    }

    const salesTabMigration = await getOneRaw<{ key: string; value: boolean }>(
      'meta',
      'migration_sales_tab_v1'
    );
    if (!salesTabMigration?.value) {
      const latestAccounts = await getAllRaw<StoredAccountRecord>('accounts');
      for (const acc of latestAccounts) {
        const tabs = Array.isArray(acc.allowedTabs) ? [...acc.allowedTabs] : [];
        if (
          !tabs.includes('sales') &&
          (acc.role === 'developer' ||
            acc.role === 'admin' ||
            tabs.includes('pos'))
        ) {
          const posIdx = tabs.indexOf('pos');
          if (posIdx >= 0) {
            tabs.splice(posIdx + 1, 0, 'sales');
          } else {
            tabs.push('sales');
          }
          await putOneRaw('accounts', {
            ...acc,
            allowedTabs: resolveUserAllowedTabs(acc.role, tabs, acc.username),
          } as unknown as Record<string, unknown>);
        }
      }
      await putOneRaw('meta', { key: 'migration_sales_tab_v1', value: true });
    }

    const brandTecnovaMigration = await getOneRaw<{ key: string; value: boolean }>(
      'meta',
      'migration_brand_tecnova_v1'
    );
    if (!brandTecnovaMigration?.value) {
      const appRow = await getOneRaw<{ key: string; value: AppAppearanceSettings }>(
        'meta',
        'app_appearance_settings'
      );
      if (appRow?.value) {
        const nextApp = { ...appRow.value };
        let changed = false;
        if (nextApp.appName === 'NexoCell Studio') {
          nextApp.appName = 'TECNOVA';
          changed = true;
        }
        if (nextApp.shortName === 'NexoCell') {
          nextApp.shortName = 'TECNOVA';
          changed = true;
        }
        if (changed) {
          await putOneRaw('meta', { key: 'app_appearance_settings', value: nextApp });
        }
      }

      const instRow = await getOneRaw<{ key: string; value: InstalledAppSettings }>(
        'meta',
        'installed_app_settings'
      );
      if (instRow?.value) {
        const nextInst = { ...instRow.value };
        let changed = false;
        if (nextInst.installedName === 'NexoCell Studio Escritorio') {
          nextInst.installedName = 'TECNOVA Escritorio';
          changed = true;
        }
        if (nextInst.installedShortName === 'NexoCell') {
          nextInst.installedShortName = 'TECNOVA';
          changed = true;
        }
        if (changed) {
          await putOneRaw('meta', { key: 'installed_app_settings', value: nextInst });
        }
      }

      const loginRow = await getOneRaw<{ key: string; value: LoginPresentationSettings }>(
        'meta',
        'login_presentation_settings'
      );
      if (loginRow?.value?.brandName === 'NexoCell Studio') {
        await putOneRaw('meta', {
          key: 'login_presentation_settings',
          value: { ...loginRow.value, brandName: 'TECNOVA' },
        });
      }

      const receiptRow = await getOneRaw<{ key: string; value: ReceiptSettings }>(
        'meta',
        'receipt_settings'
      );
      if (receiptRow?.value?.businessName === 'NexoCell Studio') {
        await putOneRaw('meta', {
          key: 'receipt_settings',
          value: { ...receiptRow.value, businessName: 'TECNOVA' },
        });
      }

      const devSysRow = await getOneRaw<{ key: string; value: DeveloperSystemSettings }>(
        'meta',
        'developer_system_settings'
      );
      if (devSysRow?.value?.qrCodePrefix === 'NEXOCELL') {
        await putOneRaw('meta', {
          key: 'developer_system_settings',
          value: { ...devSysRow.value, qrCodePrefix: 'TECNOVA' },
        });
      }

      await putOneRaw('meta', { key: 'migration_brand_tecnova_v1', value: true });
    }
  })();
  return initPromise;
}

export function subscribeLocalStore<T>(
  storeName: LocalStoreName,
  callback: (items: T[]) => void
): () => void {
  const typedCb = callback as (items: unknown[]) => void;
  listeners[storeName].add(typedCb);
  void ensureLocalDbReady().then(async () => {
    const items = await readHydratedStore(storeName);
    callback(items as T[]);
  });
  return () => {
    listeners[storeName].delete(typedCb);
  };
}

export async function getSessionUid(): Promise<string | null> {
  await ensureLocalDbReady();
  try {
    const sessionUid = sessionStorage.getItem(SESSION_KEY);
    if (sessionUid) return sessionUid;
  } catch {
    // Fall through and clear any legacy persistent session below.
  }

  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore unavailable localStorage.
  }
  await deleteOneRaw('meta', 'session_uid');
  return null;
}

export async function setSessionUid(uid: string | null): Promise<void> {
  try {
    if (uid) sessionStorage.setItem(SESSION_KEY, uid);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore unavailable sessionStorage; legacy storage is still cleared below.
  }
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore unavailable localStorage.
  }
  await deleteOneRaw('meta', 'session_uid');
}

export async function getAccountByUid(uid: string): Promise<StoredAccountRecord | null> {
  await ensureLocalDbReady();
  return getOneRaw<StoredAccountRecord>('accounts', uid);
}

export async function isDefaultAdminPasswordUntouched(): Promise<boolean> {
  await ensureLocalDbReady();
  const accounts = await getAllRaw<StoredAccountRecord>('accounts');
  const admin = accounts.find((a) => a.username === DEFAULT_LOCAL_ADMIN.username);
  return Boolean(admin?.isDefaultPassword);
}

export async function authenticateLocalUser(
  username: string,
  password: string
): Promise<StoredAccountRecord> {
  await ensureLocalDbReady();
  const clean = normalizeUsername(username);
  const accounts = await getAllRaw<StoredAccountRecord>('accounts');
  const match = accounts.find((a) => a.username.toLowerCase() === clean);
  if (!match) {
    throw new Error('Usuario o contraseña incorrectos.');
  }
  const hash = await hashPassword(password, match.salt);
  if (hash !== match.passwordHash) {
    throw new Error('Usuario o contraseña incorrectos.');
  }
  await setSessionUid(match.uid);
  return match;
}

export async function verifyAdministratorAuthorization(
  username: string,
  password: string,
  actionLabel = 'autorizar esta operación'
): Promise<StoredAccountRecord> {
  await ensureLocalDbReady();
  const clean = normalizeUsername(username);
  if (!clean || !password) {
    throw new Error('Ingresa el usuario y la contraseña de un administrador.');
  }
  const accounts = await getAllRaw<StoredAccountRecord>('accounts');
  const match = accounts.find((a) => a.username.toLowerCase() === clean);
  if (!match) {
    throw new Error('Credenciales de administrador incorrectas.');
  }
  const hash = await hashPassword(password, match.salt);
  if (hash !== match.passwordHash) {
    throw new Error('Credenciales de administrador incorrectas.');
  }
  if (!match.active) {
    throw new Error('Esta cuenta de administrador se encuentra desactivada.');
  }
  if (match.role !== 'admin' && match.role !== 'developer') {
    throw new Error(
      `Autorización denegada: solo un Administrador o Desarrollador puede ${actionLabel}.`
    );
  }
  return match;
}

export async function createLocalAccount(input: {
  displayName: string;
  username: string;
  password: string;
  role: UserRole;
  allowedTabs?: NavTab[];
}): Promise<TeamMember> {
  await ensureLocalDbReady();
  const clean = normalizeUsername(input.username);
  const accounts = await getAllRaw<StoredAccountRecord>('accounts');
  if (accounts.some((a) => a.username.toLowerCase() === clean)) {
    throw new Error(`El usuario "@${clean}" ya existe en este equipo.`);
  }
  const now = Date.now();
  const salt = randomSalt();
  const passwordHash = await hashPassword(input.password, salt);
  const record: StoredAccountRecord = {
    uid: generateLocalId('usr'),
    username: clean,
    displayName: input.displayName,
    role: input.role,
    allowedTabs: resolveUserAllowedTabs(input.role, input.allowedTabs, clean),
    active: true,
    storeId: STORE_ID,
    salt,
    passwordHash,
    isDefaultPassword: false,
    createdAtMs: now,
    updatedAtMs: now,
  };
  await putOneRaw('accounts', record as unknown as Record<string, unknown>);
  await notifyStore('accounts');
  return toTeamMember(record);
}

export async function updateLocalAccountStatusOrRole(
  uid: string,
  role: UserRole,
  active: boolean
): Promise<void> {
  await ensureLocalDbReady();
  const existing = await getOneRaw<StoredAccountRecord>('accounts', uid);
  if (!existing) throw new Error('Usuario no encontrado.');
  const updated: StoredAccountRecord = {
    ...existing,
    role,
    active,
    allowedTabs:
      role !== existing.role
        ? resolveUserAllowedTabs(role, undefined, existing.username)
        : resolveUserAllowedTabs(role, existing.allowedTabs, existing.username),
    updatedAtMs: Date.now(),
  };
  await putOneRaw('accounts', updated as unknown as Record<string, unknown>);
  await notifyStore('accounts');
}

export async function updateLocalAccountAllowedTabs(
  uid: string,
  allowedTabs: NavTab[]
): Promise<void> {
  await ensureLocalDbReady();
  const existing = await getOneRaw<StoredAccountRecord>('accounts', uid);
  if (!existing) throw new Error('Usuario no encontrado.');
  const updated: StoredAccountRecord = {
    ...existing,
    allowedTabs: resolveUserAllowedTabs(
      existing.role,
      allowedTabs,
      existing.username
    ),
    updatedAtMs: Date.now(),
  };
  await putOneRaw('accounts', updated as unknown as Record<string, unknown>);
  await notifyStore('accounts');
}

export async function updateLocalAccountPassword(
  uid: string,
  newPassword: string
): Promise<void> {
  await ensureLocalDbReady();
  const existing = await getOneRaw<StoredAccountRecord>('accounts', uid);
  if (!existing) throw new Error('Usuario no encontrado.');
  const salt = randomSalt();
  const passwordHash = await hashPassword(newPassword, salt);
  const updated: StoredAccountRecord = {
    ...existing,
    salt,
    passwordHash,
    isDefaultPassword: false,
    updatedAtMs: Date.now(),
  };
  await putOneRaw('accounts', updated as unknown as Record<string, unknown>);
  await notifyStore('accounts');
}

export async function deleteLocalAccount(uid: string): Promise<void> {
  await ensureLocalDbReady();
  const existing = await getOneRaw<StoredAccountRecord>('accounts', uid);
  if (!existing) throw new Error('Usuario no encontrado.');
  if (existing.username.toLowerCase() === 'desarrollador') {
    throw new Error('No se puede eliminar la cuenta principal del desarrollador.');
  }
  await deleteOneRaw('accounts', uid);
  await notifyStore('accounts');
}

export async function updateOwnDeveloperProfile(
  uid: string,
  updates: { displayName?: string; newPassword?: string }
): Promise<void> {
  await ensureLocalDbReady();
  const existing = await getOneRaw<StoredAccountRecord>('accounts', uid);
  if (!existing || existing.role !== 'developer') {
    throw new Error('Solo la cuenta de Desarrollador puede actualizar este perfil.');
  }

  let nextSalt = existing.salt;
  let nextPasswordHash = existing.passwordHash;
  if (updates.newPassword && updates.newPassword.length > 0) {
    if (updates.newPassword.length < 6) {
      throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
    }
    nextSalt = randomSalt();
    nextPasswordHash = await hashPassword(updates.newPassword, nextSalt);
  }

  const nextName =
    updates.displayName !== undefined
      ? updates.displayName.trim() || existing.displayName
      : existing.displayName;

  const updated: StoredAccountRecord = {
    ...existing,
    displayName: nextName,
    salt: nextSalt,
    passwordHash: nextPasswordHash,
    isDefaultPassword: false,
    updatedAtMs: Date.now(),
  };
  await putOneRaw('accounts', updated as unknown as Record<string, unknown>);
  await notifyStore('accounts');
}

export async function saveLocalDoc<T extends Record<string, unknown>>(
  storeName: Exclude<LocalStoreName, 'accounts'>,
  docId: string,
  data: T,
  isCreate: boolean
): Promise<void> {
  await ensureLocalDbReady();
  const existing = await getOneRaw<Record<string, unknown> & WithTimestamps>(
    storeName,
    docId
  );
  const now = Date.now();
  const createdAtMs =
    !isCreate && existing && typeof existing.createdAtMs === 'number'
      ? existing.createdAtMs
      : existing && typeof existing.createdAtMs === 'number'
        ? existing.createdAtMs
        : now;

  const payload = {
    ...stripNonCloneable(data),
    id: docId,
    createdAtMs,
    updatedAtMs: now,
  };
  await putOneRaw(storeName, payload);
  await notifyStore(storeName);
}

export async function getLocalDoc<T>(
  storeName: Exclude<LocalStoreName, 'accounts'>,
  docId: string
): Promise<T | null> {
  await ensureLocalDbReady();
  const raw = await getOneRaw<Record<string, unknown> & WithTimestamps>(
    storeName,
    docId
  );
  if (!raw) return null;
  return hydrateRecord(raw) as unknown as T;
}

export async function deleteLocalDoc(
  storeName: Exclude<LocalStoreName, 'accounts'>,
  docId: string
): Promise<void> {
  await ensureLocalDbReady();
  await deleteOneRaw(storeName, docId);
  await notifyStore(storeName);
}

export async function getReceiptSettings(): Promise<ReceiptSettings> {
  await ensureLocalDbReady();
  const row = await getOneRaw<{ key: string; value: ReceiptSettings }>(
    'meta',
    'receipt_settings'
  );
  if (!row?.value) return { ...DEFAULT_RECEIPT_SETTINGS };
  return { ...DEFAULT_RECEIPT_SETTINGS, ...row.value };
}

async function notifyReceiptSettings(broadcastChange = true): Promise<void> {
  const settings = await getReceiptSettings();
  for (const cb of receiptListeners) {
    cb(settings);
  }
  if (broadcastChange && broadcast) {
    try {
      broadcast.postMessage({ store: 'receiptSettings' });
    } catch {
      // Ignore broadcast channel errors
    }
  }
}

export async function saveReceiptSettings(
  settings: ReceiptSettings
): Promise<ReceiptSettings> {
  await ensureLocalDbReady();
  const normalized: ReceiptSettings = {
    ...DEFAULT_RECEIPT_SETTINGS,
    ...settings,
    businessName: settings.businessName.trim() || DEFAULT_RECEIPT_SETTINGS.businessName,
    updatedAtMs: Date.now(),
  };
  await putOneRaw('meta', { key: 'receipt_settings', value: normalized });
  await notifyReceiptSettings(true);
  return normalized;
}

export function subscribeReceiptSettings(
  callback: (settings: ReceiptSettings) => void
): () => void {
  receiptListeners.add(callback);
  void getReceiptSettings().then((settings) => callback(settings));
  return () => {
    receiptListeners.delete(callback);
  };
}

export async function getLoginPresentationSettings(): Promise<LoginPresentationSettings> {
  await ensureLocalDbReady();
  const row = await getOneRaw<{ key: string; value: LoginPresentationSettings }>(
    'meta',
    'login_presentation_settings'
  );
  if (!row?.value) return { ...DEFAULT_LOGIN_PRESENTATION_SETTINGS };
  return { ...DEFAULT_LOGIN_PRESENTATION_SETTINGS, ...row.value };
}

async function notifyLoginPresentationSettings(broadcastChange = true): Promise<void> {
  const settings = await getLoginPresentationSettings();
  for (const cb of loginPresentationListeners) {
    cb(settings);
  }
  if (broadcastChange && broadcast) {
    try {
      broadcast.postMessage({ store: 'loginPresentation' });
    } catch {
      // Ignore broadcast channel errors
    }
  }
}

export async function saveLoginPresentationSettings(
  settings: LoginPresentationSettings
): Promise<LoginPresentationSettings> {
  await ensureLocalDbReady();
  const normalized: LoginPresentationSettings = {
    ...DEFAULT_LOGIN_PRESENTATION_SETTINGS,
    ...settings,
    brandName:
      settings.brandName.trim() || DEFAULT_LOGIN_PRESENTATION_SETTINGS.brandName,
    headline:
      settings.headline.trim() || DEFAULT_LOGIN_PRESENTATION_SETTINGS.headline,
    buttonLabel:
      settings.buttonLabel.trim() || DEFAULT_LOGIN_PRESENTATION_SETTINGS.buttonLabel,
    updatedAtMs: Date.now(),
  };
  await putOneRaw('meta', {
    key: 'login_presentation_settings',
    value: normalized,
  });
  await notifyLoginPresentationSettings(true);
  return normalized;
}

export function subscribeLoginPresentationSettings(
  callback: (settings: LoginPresentationSettings) => void
): () => void {
  loginPresentationListeners.add(callback);
  void getLoginPresentationSettings().then((settings) => callback(settings));
  return () => {
    loginPresentationListeners.delete(callback);
  };
}

export async function getAppAppearanceSettings(): Promise<AppAppearanceSettings> {
  await ensureLocalDbReady();
  const row = await getOneRaw<{ key: string; value: AppAppearanceSettings }>(
    'meta',
    'app_appearance_settings'
  );
  if (!row?.value) return { ...DEFAULT_APP_APPEARANCE_SETTINGS };
  return { ...DEFAULT_APP_APPEARANCE_SETTINGS, ...row.value };
}

async function notifyAppAppearanceSettings(broadcastChange = true): Promise<void> {
  const settings = await getAppAppearanceSettings();
  for (const cb of appAppearanceListeners) {
    cb(settings);
  }
  if (broadcastChange && broadcast) {
    try {
      broadcast.postMessage({ store: 'appAppearance' });
    } catch {
      // Ignore broadcast channel errors
    }
  }
}

export async function saveAppAppearanceSettings(
  settings: AppAppearanceSettings
): Promise<AppAppearanceSettings> {
  await ensureLocalDbReady();
  const normalized: AppAppearanceSettings = {
    ...DEFAULT_APP_APPEARANCE_SETTINGS,
    ...settings,
    surfaceOpacityPercent: Math.round(
      Math.max(35, Math.min(100, settings.surfaceOpacityPercent ?? DEFAULT_APP_APPEARANCE_SETTINGS.surfaceOpacityPercent))
    ),
    appName:
      settings.appName.trim() || DEFAULT_APP_APPEARANCE_SETTINGS.appName,
    shortName:
      settings.shortName.trim() ||
      settings.appName.trim() ||
      DEFAULT_APP_APPEARANCE_SETTINGS.shortName,
    updatedAtMs: Date.now(),
  };
  await putOneRaw('meta', {
    key: 'app_appearance_settings',
    value: normalized,
  });
  await notifyAppAppearanceSettings(true);
  return normalized;
}

export function subscribeAppAppearanceSettings(
  callback: (settings: AppAppearanceSettings) => void
): () => void {
  appAppearanceListeners.add(callback);
  void getAppAppearanceSettings().then((settings) => callback(settings));
  return () => {
    appAppearanceListeners.delete(callback);
  };
}

export async function getVisualCustomizationSettings(): Promise<VisualCustomizationSettings> {
  await ensureLocalDbReady();
  const row = await getOneRaw<{ key: string; value: VisualCustomizationSettings }>(
    'meta',
    'visual_customization_settings'
  );
  if (!row?.value) {
    return {
      ...DEFAULT_VISUAL_CUSTOMIZATION_SETTINGS,
      patches: {},
      navOrder: [...DEFAULT_VISUAL_CUSTOMIZATION_SETTINGS.navOrder],
      navLabels: {},
    };
  }
  const validDefaults = DEFAULT_VISUAL_CUSTOMIZATION_SETTINGS.navOrder;
  const mergedOrder =
    Array.isArray(row.value.navOrder) && row.value.navOrder.length > 0
      ? row.value.navOrder.filter((id) => validDefaults.includes(id))
      : [...validDefaults];
  for (const defTab of validDefaults) {
    if (!mergedOrder.includes(defTab)) {
      if (defTab === 'sales') {
        const posIdx = mergedOrder.indexOf('pos');
        if (posIdx >= 0) {
          mergedOrder.splice(posIdx + 1, 0, 'sales');
          continue;
        }
      }
      mergedOrder.push(defTab);
    }
  }
  return {
    ...DEFAULT_VISUAL_CUSTOMIZATION_SETTINGS,
    ...row.value,
    patches: row.value.patches ? { ...row.value.patches } : {},
    navOrder: mergedOrder,
    navLabels: row.value.navLabels ? { ...row.value.navLabels } : {},
  };
}

async function notifyVisualCustomizationSettings(
  broadcastChange = true
): Promise<void> {
  const settings = await getVisualCustomizationSettings();
  for (const cb of visualCustomizationListeners) {
    cb(settings);
  }
  if (broadcastChange && broadcast) {
    try {
      broadcast.postMessage({ store: 'visualCustomization' });
    } catch {
      // Ignore broadcast channel errors
    }
  }
}

export async function saveVisualCustomizationSettings(
  settings: VisualCustomizationSettings
): Promise<VisualCustomizationSettings> {
  await ensureLocalDbReady();
  const normalized: VisualCustomizationSettings = {
    patches: settings.patches || {},
    navOrder:
      Array.isArray(settings.navOrder) && settings.navOrder.length > 0
        ? settings.navOrder
        : [...DEFAULT_VISUAL_CUSTOMIZATION_SETTINGS.navOrder],
    navLabels: settings.navLabels || {},
    updatedAtMs: Date.now(),
  };
  await putOneRaw('meta', {
    key: 'visual_customization_settings',
    value: normalized,
  });
  await notifyVisualCustomizationSettings(true);
  return normalized;
}

export function subscribeVisualCustomizationSettings(
  callback: (settings: VisualCustomizationSettings) => void
): () => void {
  visualCustomizationListeners.add(callback);
  void getVisualCustomizationSettings().then((settings) => callback(settings));
  return () => {
    visualCustomizationListeners.delete(callback);
  };
}

export async function getInstalledAppSettings(): Promise<InstalledAppSettings> {
  await ensureLocalDbReady();
  const row = await getOneRaw<{ key: string; value: InstalledAppSettings }>(
    'meta',
    'installed_app_settings'
  );
  if (!row?.value) return { ...DEFAULT_INSTALLED_APP_SETTINGS };
  return { ...DEFAULT_INSTALLED_APP_SETTINGS, ...row.value };
}

async function notifyInstalledAppSettings(broadcastChange = true): Promise<void> {
  const settings = await getInstalledAppSettings();
  for (const cb of installedAppListeners) {
    cb(settings);
  }
  if (broadcastChange && broadcast) {
    try {
      broadcast.postMessage({ store: 'installedApp' });
    } catch {
      // Ignore broadcast channel errors
    }
  }
}

export async function saveInstalledAppSettings(
  settings: InstalledAppSettings
): Promise<InstalledAppSettings> {
  await ensureLocalDbReady();
  const normalized: InstalledAppSettings = {
    ...DEFAULT_INSTALLED_APP_SETTINGS,
    ...settings,
    installedName:
      settings.installedName.trim() ||
      DEFAULT_INSTALLED_APP_SETTINGS.installedName,
    installedShortName:
      settings.installedShortName.trim() ||
      settings.installedName.trim().slice(0, 12) ||
      DEFAULT_INSTALLED_APP_SETTINGS.installedShortName,
    description:
      settings.description.trim() || DEFAULT_INSTALLED_APP_SETTINGS.description,
    iconPaddingPercent: Math.min(
      30,
      Math.max(0, Math.round(Number(settings.iconPaddingPercent) || 0))
    ),
    updatedAtMs: Date.now(),
  };
  await putOneRaw('meta', { key: 'installed_app_settings', value: normalized });
  await notifyInstalledAppSettings(true);
  return normalized;
}

export function subscribeInstalledAppSettings(
  callback: (settings: InstalledAppSettings) => void
): () => void {
  installedAppListeners.add(callback);
  void getInstalledAppSettings().then((settings) => callback(settings));
  return () => {
    installedAppListeners.delete(callback);
  };
}

function normalizeCatalogImagePresets(
  raw?: CatalogImagePreset[]
): CatalogImagePreset[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_CATALOG_IMAGE_PRESETS.map((p) => ({ ...p }));
  }
  const clean: CatalogImagePreset[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const label = String(item.label || '').trim().slice(0, 60);
    const url = String(item.url || '').trim().slice(0, 250000);
    if (!label || !url) continue;
    const id =
      String(item.id || '').trim().slice(0, 48) || `preset_${i + 1}`;
    clean.push({ id, label, url });
  }
  return clean.length > 0
    ? clean
    : DEFAULT_CATALOG_IMAGE_PRESETS.map((p) => ({ ...p }));
}

function normalizeProductConditions(raw?: string[]): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [...PRODUCT_CONDITIONS];
  }
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const item of raw) {
    const trimmed = String(item || '').trim().slice(0, 40);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(trimmed);
  }
  return clean.length > 0 ? clean : [...PRODUCT_CONDITIONS];
}

export async function getDeveloperSystemSettings(): Promise<DeveloperSystemSettings> {
  await ensureLocalDbReady();
  const row = await getOneRaw<{ key: string; value: DeveloperSystemSettings }>(
    'meta',
    'developer_system_settings'
  );
  if (!row?.value) {
    return {
      ...DEFAULT_DEVELOPER_SYSTEM_SETTINGS,
      catalogImagePresets: DEFAULT_CATALOG_IMAGE_PRESETS.map((p) => ({ ...p })),
      productConditions: [...PRODUCT_CONDITIONS],
    };
  }
  return {
    ...DEFAULT_DEVELOPER_SYSTEM_SETTINGS,
    ...row.value,
    catalogImagePresets: normalizeCatalogImagePresets(row.value.catalogImagePresets),
    productConditions: normalizeProductConditions(row.value.productConditions),
  };
}

async function notifyDeveloperSystemSettings(broadcastChange = true): Promise<void> {
  const settings = await getDeveloperSystemSettings();
  for (const cb of developerSystemListeners) {
    cb(settings);
  }
  if (broadcastChange && broadcast) {
    try {
      broadcast.postMessage({ store: 'developerSystem' });
    } catch {
      // Ignore broadcast channel errors
    }
  }
}

export async function saveDeveloperSystemSettings(
  settings: DeveloperSystemSettings
): Promise<DeveloperSystemSettings> {
  await ensureLocalDbReady();
  const normalized: DeveloperSystemSettings = {
    ...DEFAULT_DEVELOPER_SYSTEM_SETTINGS,
    ...settings,
    defaultStoreBranch:
      settings.defaultStoreBranch.trim() ||
      DEFAULT_DEVELOPER_SYSTEM_SETTINGS.defaultStoreBranch,
    qrCodePrefix:
      settings.qrCodePrefix.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') ||
      DEFAULT_DEVELOPER_SYSTEM_SETTINGS.qrCodePrefix,
    defaultPhoneWarrantyMonths: Math.min(
      60,
      Math.max(1, Math.round(Number(settings.defaultPhoneWarrantyMonths) || 12))
    ),
    defaultAccessoryWarrantyMonths: Math.min(
      60,
      Math.max(0, Math.round(Number(settings.defaultAccessoryWarrantyMonths) || 0))
    ),
    lowStockDefaultMin: Math.min(
      100,
      Math.max(0, Math.round(Number(settings.lowStockDefaultMin) || 0))
    ),
    maxPosDiscountPercent: Math.min(
      100,
      Math.max(0, Math.round(Number(settings.maxPosDiscountPercent) || 0))
    ),
    catalogImagePresets: normalizeCatalogImagePresets(settings.catalogImagePresets),
    productConditions: normalizeProductConditions(settings.productConditions),
    updatedAtMs: Date.now(),
  };
  await putOneRaw('meta', { key: 'developer_system_settings', value: normalized });
  await notifyDeveloperSystemSettings(true);
  return normalized;
}

export function subscribeDeveloperSystemSettings(
  callback: (settings: DeveloperSystemSettings) => void
): () => void {
  developerSystemListeners.add(callback);
  void getDeveloperSystemSettings().then((settings) => callback(settings));
  return () => {
    developerSystemListeners.delete(callback);
  };
}

export async function getCustomProductCategories(): Promise<string[]> {
  await ensureLocalDbReady();
  const row = await getOneRaw<{ key: string; value: string[] }>(
    'meta',
    'custom_product_categories'
  );
  if (!Array.isArray(row?.value)) return [];
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of row.value) {
    const trimmed = String(raw || '').trim().slice(0, 48);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(trimmed);
  }
  return clean;
}

async function notifyCustomProductCategories(broadcastChange = true): Promise<void> {
  const categories = await getCustomProductCategories();
  for (const cb of customCategoriesListeners) {
    cb(categories);
  }
  if (broadcastChange && broadcast) {
    try {
      broadcast.postMessage({ store: 'customCategories' });
    } catch {
      // Ignore broadcast channel errors
    }
  }
}

export async function saveCustomProductCategories(
  categories: string[]
): Promise<string[]> {
  await ensureLocalDbReady();
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of categories) {
    const trimmed = String(raw || '').trim().slice(0, 48);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(trimmed);
  }
  await putOneRaw('meta', {
    key: 'custom_product_categories',
    value: clean,
  });
  await notifyCustomProductCategories(true);
  return clean;
}

export async function addCustomProductCategory(
  name: string,
  builtinCategories: readonly string[] = []
): Promise<{ category: string; categories: string[]; added: boolean }> {
  const trimmed = name.trim().slice(0, 48);
  if (!trimmed) {
    throw new Error('Escribe un nombre válido para la categoría.');
  }
  const lower = trimmed.toLowerCase();
  const builtinMatch = builtinCategories.find((c) => c.toLowerCase() === lower);
  const current = await getCustomProductCategories();
  if (builtinMatch) {
    return { category: builtinMatch, categories: current, added: false };
  }
  const existingMatch = current.find((c) => c.toLowerCase() === lower);
  if (existingMatch) {
    return { category: existingMatch, categories: current, added: false };
  }
  const next = await saveCustomProductCategories([...current, trimmed]);
  return { category: trimmed, categories: next, added: true };
}

export function subscribeCustomProductCategories(
  callback: (categories: string[]) => void
): () => void {
  customCategoriesListeners.add(callback);
  void getCustomProductCategories().then((categories) => callback(categories));
  return () => {
    customCategoriesListeners.delete(callback);
  };
}

export async function getPosSettings(): Promise<PosSettings> {
  await ensureLocalDbReady();
  const row = await getOneRaw<{ key: string; value: PosSettings }>(
    'meta',
    'pos_settings'
  );
  if (!row?.value) return { ...DEFAULT_POS_SETTINGS };
  return { ...DEFAULT_POS_SETTINGS, ...row.value };
}

async function notifyPosSettings(broadcastChange = true): Promise<void> {
  const settings = await getPosSettings();
  for (const cb of posSettingsListeners) {
    cb(settings);
  }
  if (broadcastChange && broadcast) {
    try {
      broadcast.postMessage({ store: 'posSettings' });
    } catch {
      // Ignore broadcast channel errors
    }
  }
}

export async function savePosSettings(
  settings: PosSettings
): Promise<PosSettings> {
  await ensureLocalDbReady();
  const heightNum = Math.round(Number(settings.customImageHeightPx) || 0);
  const normalized: PosSettings = {
    ...DEFAULT_POS_SETTINGS,
    ...settings,
    customImageHeightPx:
      heightNum <= 0 ? 0 : Math.min(200, Math.max(48, heightNum)),
    defaultCustomerName:
      settings.defaultCustomerName.trim().slice(0, 80) ||
      DEFAULT_POS_SETTINGS.defaultCustomerName,
    posTitle:
      settings.posTitle.trim().slice(0, 80) || DEFAULT_POS_SETTINGS.posTitle,
    cartSectionTitle:
      settings.cartSectionTitle.trim().slice(0, 60) ||
      DEFAULT_POS_SETTINGS.cartSectionTitle,
    checkoutButtonLabel:
      settings.checkoutButtonLabel.trim().slice(0, 60) ||
      DEFAULT_POS_SETTINGS.checkoutButtonLabel,
    updatedAtMs: Date.now(),
  };
  await putOneRaw('meta', { key: 'pos_settings', value: normalized });
  await notifyPosSettings(true);
  return normalized;
}

export function subscribePosSettings(
  callback: (settings: PosSettings) => void
): () => void {
  posSettingsListeners.add(callback);
  void getPosSettings().then((settings) => callback(settings));
  return () => {
    posSettingsListeners.delete(callback);
  };
}

export async function getWarrantySheetSettings(): Promise<WarrantySheetSettings> {
  await ensureLocalDbReady();
  const row = await getOneRaw<{ key: string; value: WarrantySheetSettings }>(
    'meta',
    'warranty_sheet_settings'
  );
  if (!row?.value) {
    const baseTerms = resolveWarrantyTermItems(DEFAULT_WARRANTY_SHEET_SETTINGS);
    return {
      ...DEFAULT_WARRANTY_SHEET_SETTINGS,
      warrantyTerms: baseTerms,
      termsList: baseTerms.filter((t) => t.enabled).map((t) => t.text),
    };
  }
  const resolvedTerms = resolveWarrantyTermItems(row.value);
  return {
    ...DEFAULT_WARRANTY_SHEET_SETTINGS,
    ...row.value,
    warrantyTerms: resolvedTerms,
    termsList: resolvedTerms.filter((t) => t.enabled).map((t) => t.text),
  };
}

async function notifyWarrantySheetSettings(
  broadcastChange = true
): Promise<void> {
  const settings = await getWarrantySheetSettings();
  for (const cb of warrantySheetSettingsListeners) {
    cb(settings);
  }
  if (broadcastChange && broadcast) {
    try {
      broadcast.postMessage({ store: 'warrantySheetSettings' });
    } catch {
      // Ignore broadcast channel errors
    }
  }
}

export async function saveWarrantySheetSettings(
  settings: WarrantySheetSettings
): Promise<WarrantySheetSettings> {
  await ensureLocalDbReady();
  const rawTerms: WarrantyTermItem[] = resolveWarrantyTermItems(settings)
    .map((t, idx) => ({
      id: t.id || `term_${idx + 1}`,
      text: t.text.trim(),
      enabled: t.enabled !== false,
    }))
    .filter((t) => t.text.length > 0)
    .slice(0, 30);
  const cleanTerms = rawTerms.filter((t) => t.enabled).map((t) => t.text);
  const normalized: WarrantySheetSettings = {
    ...DEFAULT_WARRANTY_SHEET_SETTINGS,
    ...settings,
    badgeLabel:
      settings.badgeLabel.trim().slice(0, 50) ||
      DEFAULT_WARRANTY_SHEET_SETTINGS.badgeLabel,
    documentTitle:
      settings.documentTitle.trim().slice(0, 70) ||
      DEFAULT_WARRANTY_SHEET_SETTINGS.documentTitle,
    customerSectionTitle:
      settings.customerSectionTitle.trim().slice(0, 70) ||
      DEFAULT_WARRANTY_SHEET_SETTINGS.customerSectionTitle,
    coverageSectionTitle:
      settings.coverageSectionTitle.trim().slice(0, 70) ||
      DEFAULT_WARRANTY_SHEET_SETTINGS.coverageSectionTitle,
    deviceSectionTitle:
      settings.deviceSectionTitle.trim().slice(0, 80) ||
      DEFAULT_WARRANTY_SHEET_SETTINGS.deviceSectionTitle,
    termsSectionTitle:
      settings.termsSectionTitle.trim().slice(0, 80) ||
      DEFAULT_WARRANTY_SHEET_SETTINGS.termsSectionTitle,
    warrantyTerms: rawTerms,
    termsList: cleanTerms,
    updatedAtMs: Date.now(),
  };
  await putOneRaw('meta', {
    key: 'warranty_sheet_settings',
    value: normalized,
  });
  await notifyWarrantySheetSettings(true);
  return normalized;
}

export function subscribeWarrantySheetSettings(
  callback: (settings: WarrantySheetSettings) => void
): () => void {
  warrantySheetSettingsListeners.add(callback);
  void getWarrantySheetSettings().then((settings) => callback(settings));
  return () => {
    warrantySheetSettingsListeners.delete(callback);
  };
}

export interface DesktopBackupSnapshot {
  app: 'TECNOVA Escritorio' | 'NexoCell Studio Escritorio';
  version: 1;
  exportedAt: string;
  receiptSettings?: ReceiptSettings;
  loginPresentationSettings?: LoginPresentationSettings;
  appAppearanceSettings?: AppAppearanceSettings;
  visualCustomizationSettings?: VisualCustomizationSettings;
  installedAppSettings?: InstalledAppSettings;
  developerSystemSettings?: DeveloperSystemSettings;
  posSettings?: PosSettings;
  warrantySheetSettings?: WarrantySheetSettings;
  customProductCategories?: string[];
  accounts: StoredAccountRecord[];
  products: Product[];
  sales: Sale[];
  warranties: Warranty[];
  repairs: RepairTicket[];
  dailyReports: DailyReport[];
}

export async function exportDesktopDatabaseJson(): Promise<string> {
  await ensureLocalDbReady();
  const [
    accounts,
    products,
    sales,
    warranties,
    repairs,
    dailyReports,
    receiptSettings,
    loginPresentationSettings,
    appAppearanceSettings,
    visualCustomizationSettings,
    installedAppSettings,
    developerSystemSettings,
    posSettings,
    warrantySheetSettings,
    customProductCategories,
  ] = await Promise.all([
    getAllRaw<StoredAccountRecord>('accounts'),
    getAllRaw<Product>('products'),
    getAllRaw<Sale>('sales'),
    getAllRaw<Warranty>('warranties'),
    getAllRaw<RepairTicket>('repairs'),
    getAllRaw<DailyReport>('dailyReports'),
    getReceiptSettings(),
    getLoginPresentationSettings(),
    getAppAppearanceSettings(),
    getVisualCustomizationSettings(),
    getInstalledAppSettings(),
    getDeveloperSystemSettings(),
    getPosSettings(),
    getWarrantySheetSettings(),
    getCustomProductCategories(),
  ]);

  const snapshot: DesktopBackupSnapshot = {
    app: 'TECNOVA Escritorio',
    version: 1,
    exportedAt: new Date().toISOString(),
    receiptSettings,
    loginPresentationSettings,
    appAppearanceSettings,
    visualCustomizationSettings,
    installedAppSettings,
    developerSystemSettings,
    posSettings,
    warrantySheetSettings,
    customProductCategories,
    accounts,
    products: products.map((p) => stripNonCloneable(p as unknown as Record<string, unknown>) as unknown as Product),
    sales: sales.map((s) => stripNonCloneable(s as unknown as Record<string, unknown>) as unknown as Sale),
    warranties: warranties.map((w) => stripNonCloneable(w as unknown as Record<string, unknown>) as unknown as Warranty),
    repairs: repairs.map((r) => stripNonCloneable(r as unknown as Record<string, unknown>) as unknown as RepairTicket),
    dailyReports: dailyReports.map((d) => stripNonCloneable(d as unknown as Record<string, unknown>) as unknown as DailyReport),
  };

  return JSON.stringify(snapshot, null, 2);
}

async function replaceStoreRecords(
  storeName: LocalStoreName,
  items: Record<string, unknown>[]
): Promise<void> {
  const db = await openIndexedDb();
  if (!db) {
    const mem = loadFallbackMemory();
    mem[storeName] = {};
    const keyField = storeName === 'accounts' ? 'uid' : 'id';
    for (const item of items) {
      const k = String(item[keyField]);
      mem[storeName][k] = stripNonCloneable(item);
    }
    saveFallbackMemory();
    return;
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      for (const item of items) {
        store.put(stripNonCloneable(item));
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function importDesktopDatabaseJson(jsonText: string): Promise<{
  products: number;
  sales: number;
  warranties: number;
  repairs: number;
  reports: number;
  accounts: number;
}> {
  const parsed = JSON.parse(jsonText) as Partial<DesktopBackupSnapshot>;
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray(parsed.products) ||
    !Array.isArray(parsed.sales) ||
    !Array.isArray(parsed.warranties) ||
    !Array.isArray(parsed.repairs) ||
    !Array.isArray(parsed.dailyReports)
  ) {
    throw new Error('El archivo seleccionado no es un respaldo válido de TECNOVA.');
  }

  const accounts = Array.isArray(parsed.accounts) ? parsed.accounts : [];
  if (accounts.length > 0) {
    await replaceStoreRecords(
      'accounts',
      accounts as unknown as Record<string, unknown>[]
    );
  }
  await replaceStoreRecords(
    'products',
    parsed.products as unknown as Record<string, unknown>[]
  );
  await replaceStoreRecords(
    'sales',
    parsed.sales as unknown as Record<string, unknown>[]
  );
  await replaceStoreRecords(
    'warranties',
    parsed.warranties as unknown as Record<string, unknown>[]
  );
  await replaceStoreRecords(
    'repairs',
    parsed.repairs as unknown as Record<string, unknown>[]
  );
  await replaceStoreRecords(
    'dailyReports',
    parsed.dailyReports as unknown as Record<string, unknown>[]
  );

  if (parsed.receiptSettings) {
    await saveReceiptSettings(parsed.receiptSettings);
  }
  if (parsed.loginPresentationSettings) {
    await saveLoginPresentationSettings(parsed.loginPresentationSettings);
  }
  if (parsed.appAppearanceSettings) {
    await saveAppAppearanceSettings(parsed.appAppearanceSettings);
  }
  if (parsed.visualCustomizationSettings) {
    await saveVisualCustomizationSettings(parsed.visualCustomizationSettings);
  }
  if (parsed.installedAppSettings) {
    await saveInstalledAppSettings(parsed.installedAppSettings);
  }
  if (parsed.developerSystemSettings) {
    await saveDeveloperSystemSettings(parsed.developerSystemSettings);
  }
  if (parsed.posSettings) {
    await savePosSettings(parsed.posSettings);
  }
  if (parsed.warrantySheetSettings) {
    await saveWarrantySheetSettings(parsed.warrantySheetSettings);
  }
  if (Array.isArray(parsed.customProductCategories)) {
    await saveCustomProductCategories(parsed.customProductCategories);
  }

  for (const s of ['accounts', 'products', 'sales', 'warranties', 'repairs', 'dailyReports'] as LocalStoreName[]) {
    await notifyStore(s, true);
  }
  if (broadcast) {
    try {
      broadcast.postMessage({ store: 'all' });
    } catch {
      // ignore
    }
  }

  return {
    products: parsed.products.length,
    sales: parsed.sales.length,
    warranties: parsed.warranties.length,
    repairs: parsed.repairs.length,
    reports: parsed.dailyReports.length,
    accounts: accounts.length,
  };
}
