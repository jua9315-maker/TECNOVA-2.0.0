import * as XLSX from 'xlsx';
import {
  addMonthsToDateKey,
  BLUEPRINT_LIMITS,
  clampString,
  getTodayDateKey,
  isValidUsername,
  normalizeUsername,
  PRODUCT_CATEGORIES,
  PRODUCT_CONDITIONS,
  sanitizeCode,
  STORE_ID,
  type AppAppearanceSettings,
  type DailyReport,
  type DeveloperSystemSettings,
  type InstalledAppSettings,
  type LoginPresentationSettings,
  type NavTab,
  type PaymentMethod,
  type PosSettings,
  type Product,
  type ProductCategory,
  type ProductCondition,
  type ReceiptSettings,
  type RepairStatus,
  type RepairTicket,
  type Sale,
  type SaleLineItem,
  type TeamMember,
  type UserRole,
  type VisualCustomizationSettings,
  type Warranty,
  type WarrantySheetSettings,
  type WarrantyStatus,
} from '../types/store';
import {
  ALL_SETTINGS_BUNDLE_KEYS,
  createLocalAccount,
  deleteLocalDoc,
  exportDesktopDatabaseJson,
  exportSettingsBundleJson,
  generateLocalId,
  getLocalDoc,
  importDesktopDatabaseJson,
  makeTimestamp,
  parseSettingsBackupJson,
  resetSettingsToFactoryDefaults,
  restoreSettingsFromParsedBackup,
  saveAppAppearanceSettings,
  saveDeveloperSystemSettings,
  saveInstalledAppSettings,
  saveLocalDoc,
  saveLoginPresentationSettings,
  savePosSettings,
  saveReceiptSettings,
  saveVisualCustomizationSettings,
  saveWarrantySheetSettings,
  updateLocalAccountAllowedTabs,
  updateLocalAccountPassword,
  updateLocalAccountStatusOrRole,
  updateOwnDeveloperProfile,
  verifyAdministratorAuthorization,
  deleteLocalAccount,
  type ParsedSettingsBackup,
  type SettingsBackupSnapshot,
  type SettingsBundleKey,
} from './localDb';

export interface ProductInput {
  sku: string;
  barcode: string;
  qrCodeData: string;
  name: string;
  brand: string;
  model: string;
  category: ProductCategory;
  condition: ProductCondition;
  storage: string;
  color: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  warrantyMonths: number;
  imeiRequired: boolean;
  supplier: string;
  location: string;
  description: string;
  imageUrl: string;
  active: boolean;
}

export async function createOrUpdateProduct(
  uid: string,
  input: ProductInput,
  existingProduct?: Product | null,
  isAdmin = false
): Promise<string> {
  const productId = existingProduct?.id || generateLocalId('prod');

  const cleanPayload = {
    sku: sanitizeCode(input.sku, BLUEPRINT_LIMITS.skuMax),
    barcode: sanitizeCode(input.barcode, BLUEPRINT_LIMITS.barcodeMax),
    qrCodeData: clampString(input.qrCodeData || input.barcode, BLUEPRINT_LIMITS.qrMax),
    name: clampString(input.name, BLUEPRINT_LIMITS.nameMax),
    brand: clampString(input.brand, BLUEPRINT_LIMITS.brandMax),
    model: clampString(input.model, BLUEPRINT_LIMITS.modelMax),
    category: clampString(input.category || 'Smartphones', 48) || 'Smartphones',
    condition: input.condition,
    storage: clampString(input.storage || '-', BLUEPRINT_LIMITS.storageMax),
    color: clampString(input.color || '-', BLUEPRINT_LIMITS.colorMax),
    costPrice:
      existingProduct && !isAdmin
        ? existingProduct.costPrice
        : Math.max(0, Number(input.costPrice) || 0),
    salePrice: Math.max(0, Number(input.salePrice) || 0),
    stock: Math.max(0, Math.floor(Number(input.stock) || 0)),
    minStock: Math.max(0, Math.floor(Number(input.minStock) || 0)),
    warrantyMonths: Math.min(60, Math.max(0, Math.floor(Number(input.warrantyMonths) || 0))),
    imeiRequired: Boolean(input.imeiRequired),
    supplier: clampString(input.supplier || 'Distribuidor Oficial', BLUEPRINT_LIMITS.supplierMax),
    location: clampString(input.location || 'Vitrina Principal', BLUEPRINT_LIMITS.locationMax),
    description: clampString(input.description || '', BLUEPRINT_LIMITS.descriptionMax),
    imageUrl: clampString(
      input.imageUrl || '/src/assets/images/phone_flagship_pro_1795020479508.jpg',
      BLUEPRINT_LIMITS.imageUrlMax
    ),
    active: existingProduct && !isAdmin ? existingProduct.active : Boolean(input.active),
    storeId: STORE_ID,
    updatedBy: uid,
  };

  await saveLocalDoc('products', productId, cleanPayload, !existingProduct);
  return productId;
}

export async function adjustProductStock(
  product: Product,
  delta: number,
  uid: string
): Promise<void> {
  const newStock = Math.max(0, product.stock + delta);
  const existing = (await getLocalDoc<Product>('products', product.id)) || product;
  await saveLocalDoc(
    'products',
    product.id,
    {
      ...existing,
      stock: newStock,
      updatedBy: uid,
    },
    false
  );
}

export async function deleteProductById(productId: string): Promise<void> {
  await deleteLocalDoc('products', productId);
}

export async function syncDailyReportForDate(
  dateKey: string,
  allSales: Sale[],
  allRepairs: RepairTicket[],
  uid: string,
  userName: string,
  closeDay = false,
  notes = ''
): Promise<void> {
  const validSales = allSales.filter((s) => s.dateKey === dateKey && s.status === 'Completada');

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
      productCounts[item.productName] = (productCounts[item.productName] || 0) + item.quantity;
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

  const repairsRevenue = allRepairs
    .filter((r) => {
      if (r.status !== 'Entregado' || r.warrantyCovered) return false;
      const dt = r.updatedAt?.toDate ? r.updatedAt.toDate() : new Date();
      const rk = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      return rk === dateKey;
    })
    .reduce((acc, r) => acc + (r.finalCost || 0), 0);

  const existing = await getLocalDoc<DailyReport>('dailyReports', dateKey);
  const existingStatus = existing?.status || 'Abierto';
  const nextStatus = closeDay ? 'Cerrado' : existingStatus;

  const payload = {
    dateKey,
    totalSalesCount: validSales.length,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalCost: Number(totalCost.toFixed(2)),
    grossProfit: Number((totalRevenue - totalCost).toFixed(2)),
    repairsRevenue: Number(repairsRevenue.toFixed(2)),
    cashTotal: Number(cashTotal.toFixed(2)),
    cardTotal: Number(cardTotal.toFixed(2)),
    transferTotal: Number(transferTotal.toFixed(2)),
    topProduct: clampString(topProduct, 120),
    generatedByUid: uid,
    generatedByName: clampString(userName || 'Sistema', 100),
    status: nextStatus,
    notes: clampString(notes || existing?.notes || '', 500),
    storeId: STORE_ID,
  };

  await saveLocalDoc('dailyReports', dateKey, payload, !existing);
}

export async function reopenDailyCashRegister(params: {
  dateKey: string;
  allSales: Sale[];
  allRepairs: RepairTicket[];
  adminUsername: string;
  adminPassword: string;
  reason?: string;
}): Promise<{ authorizedByName: string }> {
  const adminAccount = await verifyAdministratorAuthorization(
    params.adminUsername,
    params.adminPassword,
    'reabrir la caja'
  );

  const existing = await getLocalDoc<DailyReport>('dailyReports', params.dateKey);
  const nowStr = new Date().toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const reasonText = params.reason?.trim() ? ` — Motivo: ${params.reason.trim()}` : '';
  const authNote = `[${nowStr}] Caja abierta con autorización de ${adminAccount.displayName}${reasonText}`;
  const combinedNotes = existing?.notes
    ? `${existing.notes} | ${authNote}`
    : authNote;

  const validSales = params.allSales.filter(
    (s) => s.dateKey === params.dateKey && s.status === 'Completada'
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

  const repairsRevenue = params.allRepairs
    .filter((r) => {
      if (r.status !== 'Entregado' || r.warrantyCovered) return false;
      const dt = r.updatedAt?.toDate ? r.updatedAt.toDate() : new Date();
      const rk = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      return rk === params.dateKey;
    })
    .reduce((acc, r) => acc + (r.finalCost || 0), 0);

  await saveLocalDoc(
    'dailyReports',
    params.dateKey,
    {
      dateKey: params.dateKey,
      totalSalesCount: validSales.length,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      grossProfit: Number((totalRevenue - totalCost).toFixed(2)),
      repairsRevenue: Number(repairsRevenue.toFixed(2)),
      cashTotal: Number(cashTotal.toFixed(2)),
      cardTotal: Number(cardTotal.toFixed(2)),
      transferTotal: Number(transferTotal.toFixed(2)),
      topProduct: clampString(topProduct, 120),
      generatedByUid: adminAccount.uid,
      generatedByName: clampString(adminAccount.displayName || 'Administrador', 100),
      status: 'Abierto',
      notes: clampString(combinedNotes, 500),
      storeId: STORE_ID,
    },
    !existing
  );

  return { authorizedByName: adminAccount.displayName };
}

export async function processPosSale(params: {
  uid: string;
  sellerName: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: PaymentMethod;
  discount: number;
  taxRate?: number;
  taxIncluded?: boolean;
  taxLabel?: string;
  amountTendered?: number;
  cart: { product: Product; quantity: number; imei: string }[];
  existingSales: Sale[];
  existingRepairs: RepairTicket[];
  defaultPhoneWarrantyMonths?: number;
}): Promise<{
  saleId: string;
  saleNumber: string;
  warrantiesCreated: number;
  createdWarranties: Warranty[];
  sale: Sale;
}> {
  const {
    uid,
    sellerName,
    customerName,
    customerPhone,
    paymentMethod,
    discount,
    taxRate = 0,
    taxIncluded = true,
    taxLabel = 'IVA',
    amountTendered,
    cart,
    existingSales,
    existingRepairs,
    defaultPhoneWarrantyMonths = 12,
  } = params;

  const dateKey = getTodayDateKey();
  const saleId = generateLocalId('sale');
  const saleNumber = sanitizeCode(
    `VTA-${dateKey.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
    40
  );

  const items: SaleLineItem[] = cart.slice(0, BLUEPRINT_LIMITS.maxSaleItems).map((c) => ({
    productId: c.product.id,
    productName: clampString(c.product.name, 120),
    sku: sanitizeCode(c.product.sku, 40),
    quantity: Math.max(1, Math.floor(c.quantity)),
    unitPrice: Number(c.product.salePrice),
    costPrice: Number(c.product.costPrice),
    imei: clampString(c.imei || '', BLUEPRINT_LIMITS.imeiMax),
    warrantyMonths: c.product.warrantyMonths,
  }));

  const subtotal = items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
  const safeDiscount = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const netAfterDiscount = Math.max(0, Number((subtotal - safeDiscount).toFixed(2)));

  const normalizedTaxRate =
    typeof taxRate === 'number' && Number.isFinite(taxRate) && taxRate > 0
      ? Number(Math.min(100, taxRate).toFixed(2))
      : 0;
  const isTaxIncluded = taxIncluded !== false;
  let taxAmount = 0;
  let total = netAfterDiscount;

  if (normalizedTaxRate > 0) {
    if (isTaxIncluded) {
      const baseAmount = Number(
        (netAfterDiscount / (1 + normalizedTaxRate / 100)).toFixed(2)
      );
      taxAmount = Number(Math.max(0, netAfterDiscount - baseAmount).toFixed(2));
      total = netAfterDiscount;
    } else {
      taxAmount = Number(
        ((netAfterDiscount * normalizedTaxRate) / 100).toFixed(2)
      );
      total = Number((netAfterDiscount + taxAmount).toFixed(2));
    }
  }

  const totalCost = Number(
    items.reduce((acc, i) => acc + i.costPrice * i.quantity, 0).toFixed(2)
  );
  const profit = Number((total - totalCost).toFixed(2));

  let resolvedTendered: number | undefined;
  let resolvedChange: number | undefined;
  if (
    typeof amountTendered === 'number' &&
    Number.isFinite(amountTendered) &&
    amountTendered >= 0
  ) {
    resolvedTendered = Number(amountTendered.toFixed(2));
    resolvedChange = Number(Math.max(0, resolvedTendered - total).toFixed(2));
  } else if (paymentMethod === 'Efectivo') {
    resolvedTendered = total;
    resolvedChange = 0;
  }

  const newSaleData = {
    saleNumber,
    dateKey,
    customerName: clampString(customerName || 'Cliente Mostrador', BLUEPRINT_LIMITS.customerNameMax),
    customerPhone: clampString(customerPhone || 'Sin teléfono', BLUEPRINT_LIMITS.customerPhoneMax),
    paymentMethod,
    items,
    subtotal: Number(subtotal.toFixed(2)),
    discount: Number(safeDiscount.toFixed(2)),
    ...(normalizedTaxRate > 0
      ? {
          taxRate: normalizedTaxRate,
          taxAmount,
          taxIncluded: isTaxIncluded,
          taxLabel: clampString(taxLabel || 'IVA', 20),
        }
      : {
          taxRate: 0,
          taxAmount: 0,
          taxIncluded: isTaxIncluded,
          taxLabel: clampString(taxLabel || 'IVA', 20),
        }),
    total,
    ...(typeof resolvedTendered === 'number'
      ? {
          amountTendered: resolvedTendered,
          changeAmount: resolvedChange ?? 0,
        }
      : {}),
    totalCost,
    profit,
    sellerUid: uid,
    sellerName: clampString(sellerName || 'Vendedor', 100),
    status: 'Completada' as const,
    storeId: STORE_ID,
  };

  await saveLocalDoc('sales', saleId, newSaleData, true);

  for (const line of cart) {
    const freshProduct = (await getLocalDoc<Product>('products', line.product.id)) || line.product;
    await saveLocalDoc(
      'products',
      line.product.id,
      {
        ...freshProduct,
        stock: Math.max(0, freshProduct.stock - line.quantity),
        updatedBy: uid,
      },
      false
    );
  }

  const createdWarranties: Warranty[] = [];
  const nowMs = Date.now();
  for (const line of cart) {
    const isPhoneOrImei =
      line.product.category === 'Smartphones' || line.product.imeiRequired;
    const effectiveMonths =
      line.product.warrantyMonths > 0
        ? line.product.warrantyMonths
        : isPhoneOrImei
          ? Math.max(1, defaultPhoneWarrantyMonths)
          : 0;

    if (effectiveMonths > 0) {
      const warrantyId = generateLocalId('war');
      const warrantyCode = sanitizeCode(
        `GAR-${dateKey.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
        40
      );
      const warrantyPayload = {
        warrantyCode,
        saleId,
        productId: line.product.id,
        productName: clampString(line.product.name, 120),
        imei: clampString(line.imei || 'N/A', BLUEPRINT_LIMITS.imeiMax),
        customerName: clampString(
          customerName || 'Cliente Mostrador',
          BLUEPRINT_LIMITS.customerNameMax
        ),
        customerPhone: clampString(
          customerPhone || 'Sin teléfono',
          BLUEPRINT_LIMITS.customerPhoneMax
        ),
        purchaseDate: dateKey,
        expiresDate: addMonthsToDateKey(dateKey, effectiveMonths),
        warrantyMonths: effectiveMonths,
        status: 'Vigente' as WarrantyStatus,
        notes: clampString(
          `Garantía automática emitida en venta ${saleNumber}.`,
          500
        ),
        createdBy: uid,
        storeId: STORE_ID,
      };
      await saveLocalDoc('warranties', warrantyId, warrantyPayload, true);
      createdWarranties.push({
        id: warrantyId,
        ...warrantyPayload,
        createdAt: makeTimestamp(nowMs),
        updatedAt: makeTimestamp(nowMs),
      });
    }
  }

  const syntheticSale: Sale = {
    id: saleId,
    ...newSaleData,
    createdAt: makeTimestamp(nowMs),
    updatedAt: makeTimestamp(nowMs),
  };
  await syncDailyReportForDate(
    dateKey,
    [syntheticSale, ...existingSales],
    existingRepairs,
    uid,
    sellerName
  );

  return {
    saleId,
    saleNumber,
    warrantiesCreated: createdWarranties.length,
    createdWarranties,
    sale: syntheticSale,
  };
}

export async function voidSaleByAdmin(saleId: string): Promise<void> {
  const existing = await getLocalDoc<Sale>('sales', saleId);
  if (!existing) return;
  await saveLocalDoc(
    'sales',
    saleId,
    {
      ...existing,
      status: 'Anulada',
      cancelledAtMs: Date.now(),
    },
    false
  );
}

export async function cancelSaleRecord(params: {
  sale: Sale;
  allSales: Sale[];
  allRepairs: RepairTicket[];
  warranties: Warranty[];
  uid: string;
  actorName: string;
  reason?: string;
  restoreStock?: boolean;
  cancelLinkedWarranties?: boolean;
}): Promise<{ restoredUnits: number; cancelledWarranties: number }> {
  const {
    sale,
    allSales,
    allRepairs,
    warranties,
    uid,
    actorName,
    reason = '',
    restoreStock = true,
    cancelLinkedWarranties = true,
  } = params;

  const existing = (await getLocalDoc<Sale>('sales', sale.id)) || sale;
  if (existing.status === 'Anulada') {
    return { restoredUnits: 0, cancelledWarranties: 0 };
  }

  let restoredUnits = 0;
  let cancelledWarranties = 0;

  if (restoreStock) {
    for (const item of existing.items) {
      const product = await getLocalDoc<Product>('products', item.productId);
      if (product) {
        const qty = Math.max(0, Math.floor(item.quantity || 0));
        await saveLocalDoc(
          'products',
          product.id,
          {
            ...product,
            stock: Math.max(0, product.stock + qty),
            updatedBy: uid,
          },
          false
        );
        restoredUnits += qty;
      }
    }
  }

  if (cancelLinkedWarranties) {
    const linked = warranties.filter((w) => w.saleId === existing.id);
    for (const w of linked) {
      const freshW = (await getLocalDoc<Warranty>('warranties', w.id)) || w;
      if (freshW.status !== 'Anulada') {
        const noteSuffix = reason.trim()
          ? `Anulada por cancelación de venta ${existing.saleNumber}: ${reason.trim()}`
          : `Anulada por cancelación de venta ${existing.saleNumber}.`;
        await saveLocalDoc(
          'warranties',
          freshW.id,
          {
            ...freshW,
            status: 'Anulada' as WarrantyStatus,
            notes: clampString(
              freshW.notes ? `${freshW.notes} | ${noteSuffix}` : noteSuffix,
              500
            ),
          },
          false
        );
        cancelledWarranties += 1;
      }
    }
  }

  const cancelPatch = {
    ...existing,
    status: 'Anulada' as const,
    cancelReason: clampString(reason.trim(), 240),
    cancelledByName: clampString(actorName || 'Administrador', 100),
    cancelledAtMs: Date.now(),
  };

  await saveLocalDoc('sales', existing.id, cancelPatch, false);

  const cancelledSale: Sale = cancelPatch;
  const updatedSales = allSales.map((s) =>
    s.id === existing.id ? cancelledSale : s
  );
  const existingReport = await getLocalDoc<DailyReport>(
    'dailyReports',
    existing.dateKey
  );
  if (existingReport) {
    await syncDailyReportForDate(
      existing.dateKey,
      updatedSales,
      allRepairs,
      uid,
      actorName,
      existingReport.status === 'Cerrado'
    );
  }

  return { restoredUnits, cancelledWarranties };
}

export async function authorizeAdminAction(
  adminUsername: string,
  adminPassword: string,
  actionLabel = 'autorizar esta operación'
): Promise<{ displayName: string; role: UserRole }> {
  const adminAccount = await verifyAdministratorAuthorization(
    adminUsername,
    adminPassword,
    actionLabel
  );
  return { displayName: adminAccount.displayName, role: adminAccount.role };
}

export async function deleteSaleRecord(params: {
  sale: Sale;
  allSales: Sale[];
  allRepairs: RepairTicket[];
  warranties: Warranty[];
  uid: string;
  actorName: string;
  restoreStock?: boolean;
  deleteLinkedWarranties?: boolean;
}): Promise<{ restoredUnits: number; removedWarranties: number }> {
  const {
    sale,
    allSales,
    allRepairs,
    warranties,
    uid,
    actorName,
    restoreStock = true,
    deleteLinkedWarranties = true,
  } = params;

  let restoredUnits = 0;
  let removedWarranties = 0;

  if (restoreStock && sale.status === 'Completada') {
    for (const item of sale.items) {
      const product = await getLocalDoc<Product>('products', item.productId);
      if (product) {
        const qty = Math.max(0, Math.floor(item.quantity || 0));
        await saveLocalDoc(
          'products',
          product.id,
          {
            ...product,
            stock: Math.max(0, product.stock + qty),
            updatedBy: uid,
          },
          false
        );
        restoredUnits += qty;
      }
    }
  }

  if (deleteLinkedWarranties) {
    const linked = warranties.filter((w) => w.saleId === sale.id);
    for (const w of linked) {
      await deleteLocalDoc('warranties', w.id);
      removedWarranties += 1;
    }
  }

  await deleteLocalDoc('sales', sale.id);

  const remainingSales = allSales.filter((s) => s.id !== sale.id);
  const existingReport = await getLocalDoc<DailyReport>(
    'dailyReports',
    sale.dateKey
  );
  if (existingReport) {
    await syncDailyReportForDate(
      sale.dateKey,
      remainingSales,
      allRepairs,
      uid,
      actorName,
      existingReport.status === 'Cerrado'
    );
  }

  return { restoredUnits, removedWarranties };
}

export async function createManualWarranty(
  uid: string,
  input: {
    productName: string;
    productId?: string;
    imei: string;
    customerName: string;
    customerPhone: string;
    purchaseDate: string;
    warrantyMonths: number;
    notes: string;
  }
): Promise<string> {
  const warrantyId = generateLocalId('war');
  const warrantyCode = sanitizeCode(
    `GAR-${input.purchaseDate.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
    40
  );
  await saveLocalDoc(
    'warranties',
    warrantyId,
    {
      warrantyCode,
      saleId: 'MANUAL',
      productId: input.productId || 'MANUAL',
      productName: clampString(input.productName, 120),
      imei: clampString(input.imei || 'N/A', BLUEPRINT_LIMITS.imeiMax),
      customerName: clampString(input.customerName, BLUEPRINT_LIMITS.customerNameMax),
      customerPhone: clampString(input.customerPhone, BLUEPRINT_LIMITS.customerPhoneMax),
      purchaseDate: input.purchaseDate,
      expiresDate: addMonthsToDateKey(input.purchaseDate, input.warrantyMonths),
      warrantyMonths: Math.min(60, Math.max(1, input.warrantyMonths)),
      status: 'Vigente' as WarrantyStatus,
      notes: clampString(input.notes || 'Registro manual de garantía.', 500),
      createdBy: uid,
      storeId: STORE_ID,
    },
    true
  );
  return warrantyId;
}

export async function updateWarrantyStatus(
  warrantyId: string,
  status: WarrantyStatus,
  notes: string
): Promise<void> {
  const existing = await getLocalDoc<Warranty>('warranties', warrantyId);
  if (!existing) return;
  await saveLocalDoc(
    'warranties',
    warrantyId,
    {
      ...existing,
      status,
      notes: clampString(notes, 500),
    },
    false
  );
}

export async function createRepairTicket(
  uid: string,
  technicianName: string,
  input: {
    customerName: string;
    customerPhone: string;
    deviceBrand: string;
    deviceModel: string;
    imei: string;
    issueDescription: string;
    estimatedCost: number;
    warrantyCovered: boolean;
    warrantyId?: string;
  }
): Promise<string> {
  const repairId = generateLocalId('rep');
  const dateCompact = getTodayDateKey().replace(/-/g, '');
  const ticketCode = sanitizeCode(
    `REP-${dateCompact}-${Math.floor(100 + Math.random() * 900)}`,
    40
  );
  const nowStr = new Date().toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  await saveLocalDoc(
    'repairs',
    repairId,
    {
      ticketCode,
      customerName: clampString(input.customerName, 100),
      customerPhone: clampString(input.customerPhone, 32),
      deviceBrand: clampString(input.deviceBrand, 60),
      deviceModel: clampString(input.deviceModel, 80),
      imei: clampString(input.imei || 'No proporcionado', 40),
      issueDescription: clampString(input.issueDescription, 500),
      diagnosis: 'Pendiente de revisión técnica',
      partsUsed: 'Ninguno',
      estimatedCost: Math.max(0, Number(input.estimatedCost) || 0),
      finalCost: input.warrantyCovered ? 0 : Math.max(0, Number(input.estimatedCost) || 0),
      warrantyCovered: Boolean(input.warrantyCovered),
      warrantyId: input.warrantyId || '',
      status: 'Recibido' as RepairStatus,
      technicianUid: uid,
      technicianName: clampString(technicianName || 'Técnico', 100),
      historyLog: [`[${nowStr}] Ingreso a taller registrado por ${technicianName}.`],
      storeId: STORE_ID,
    },
    true
  );
  return repairId;
}

export async function updateRepairTicket(
  repair: RepairTicket,
  updates: {
    status: RepairStatus;
    diagnosis: string;
    partsUsed: string;
    estimatedCost: number;
    finalCost: number;
    warrantyCovered: boolean;
  },
  actorName: string
): Promise<void> {
  const nowStr = new Date().toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const logEntry =
    updates.status !== repair.status
      ? `[${nowStr}] Estado actualizado a "${updates.status}" por ${actorName}.`
      : `[${nowStr}] Diagnóstico / refacciones actualizados por ${actorName}.`;

  const nextLog = [...repair.historyLog, logEntry].slice(-BLUEPRINT_LIMITS.maxHistoryLog);

  const existing = (await getLocalDoc<RepairTicket>('repairs', repair.id)) || repair;
  await saveLocalDoc(
    'repairs',
    repair.id,
    {
      ...existing,
      status: updates.status,
      diagnosis: clampString(updates.diagnosis, 500),
      partsUsed: clampString(updates.partsUsed, 300),
      estimatedCost: Math.max(0, Number(updates.estimatedCost) || 0),
      finalCost: updates.warrantyCovered ? 0 : Math.max(0, Number(updates.finalCost) || 0),
      warrantyCovered: Boolean(updates.warrantyCovered),
      historyLog: nextLog,
    },
    false
  );
}

export async function createTeamMemberAccount(input: {
  displayName: string;
  username: string;
  password: string;
  role: UserRole;
  allowedTabs?: NavTab[];
}): Promise<{ uid: string; username: string }> {
  const cleanUsername = normalizeUsername(input.username);
  const cleanDisplayName = clampString(input.displayName, 100);

  if (!cleanDisplayName) {
    throw new Error('El nombre completo del colaborador es obligatorio.');
  }
  if (!isValidUsername(cleanUsername)) {
    throw new Error(
      'El usuario debe tener entre 3 y 40 caracteres (solo letras, números, puntos, guiones o guiones bajos).'
    );
  }
  if (!input.password || input.password.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres.');
  }
  if (input.allowedTabs && input.allowedTabs.length === 0) {
    throw new Error('Selecciona al menos una sección visible en el menú para el usuario.');
  }

  const safeRole: UserRole = input.role === 'admin' ? 'admin' : 'staff';

  const created = await createLocalAccount({
    displayName: cleanDisplayName,
    username: cleanUsername,
    password: input.password,
    role: safeRole,
    allowedTabs: input.allowedTabs,
  });

  return { uid: created.uid, username: created.username };
}

export async function updateUserRoleAndStatus(
  targetMember: TeamMember,
  newRole: UserRole,
  active: boolean
): Promise<void> {
  if (targetMember.role === 'developer') return;
  const safeRole: UserRole = newRole === 'admin' ? 'admin' : 'staff';
  await updateLocalAccountStatusOrRole(targetMember.uid, safeRole, active);
}

export async function updateUserAllowedTabs(
  uid: string,
  allowedTabs: NavTab[]
): Promise<void> {
  if (allowedTabs.length === 0) {
    throw new Error('El usuario debe tener al menos una sección visible en el menú.');
  }
  await updateLocalAccountAllowedTabs(uid, allowedTabs);
}

export async function updateTeamMemberPassword(
  uid: string,
  newPassword: string
): Promise<void> {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
  }
  await updateLocalAccountPassword(uid, newPassword);
}

export async function deleteTeamMemberAccount(uid: string): Promise<void> {
  await deleteLocalAccount(uid);
}

export async function seedInitialStoreCatalog(uid: string, userName: string): Promise<void> {
  const dateKey = getTodayDateKey();

  const starterProducts: ProductInput[] = [
    {
      sku: 'IPH-15PRO-256',
      barcode: '7501055301501',
      qrCodeData: 'TECNOVA:SKU=IPH-15PRO-256|BAR=7501055301501',
      name: 'iPhone 15 Pro 256GB Titanio Natural',
      brand: 'Apple',
      model: 'iPhone 15 Pro',
      category: 'Smartphones',
      condition: 'Nuevo',
      storage: '256GB',
      color: 'Titanio Natural',
      costPrice: 890,
      salePrice: 1149,
      stock: 6,
      minStock: 2,
      warrantyMonths: 12,
      imeiRequired: true,
      supplier: 'Distribuidor Apple Latam',
      location: 'Vitrina A1',
      description: 'Equipo sellado de fábrica, chip A17 Pro, USB-C y cámara pro de 48MP.',
      imageUrl: '/src/assets/images/phone_flagship_pro_1795020479508.jpg',
      active: true,
    },
    {
      sku: 'SAM-S24U-512',
      barcode: '8806095302402',
      qrCodeData: 'TECNOVA:SKU=SAM-S24U-512|BAR=8806095302402',
      name: 'Samsung Galaxy S24 Ultra 512GB',
      brand: 'Samsung',
      model: 'Galaxy S24 Ultra',
      category: 'Smartphones',
      condition: 'Nuevo',
      storage: '512GB',
      color: 'Gris Titanio',
      costPrice: 920,
      salePrice: 1199,
      stock: 4,
      minStock: 2,
      warrantyMonths: 12,
      imeiRequired: true,
      supplier: 'Samsung Mayorista',
      location: 'Vitrina A2',
      description: 'Pantalla Dynamic AMOLED 2X 6.8", S-Pen integrado y zoom óptico 5x.',
      imageUrl: '/src/assets/images/phone_flagship_pro_1795020479508.jpg',
      active: true,
    },
    {
      sku: 'XIA-RN13P-256',
      barcode: '6941812701303',
      qrCodeData: 'TECNOVA:SKU=XIA-RN13P-256|BAR=6941812701303',
      name: 'Xiaomi Redmi Note 13 Pro 5G',
      brand: 'Xiaomi',
      model: 'Redmi Note 13 Pro',
      category: 'Smartphones',
      condition: 'Nuevo',
      storage: '256GB',
      color: 'Negro Medianoche',
      costPrice: 245,
      salePrice: 349,
      stock: 9,
      minStock: 3,
      warrantyMonths: 12,
      imeiRequired: true,
      supplier: 'Xiaomi Directo',
      location: 'Vitrina B1',
      description: 'Cámara de 200MP con OIS, carga turbo de 67W y pantalla AMOLED 120Hz.',
      imageUrl: '/src/assets/images/phone_flagship_pro_1795020479508.jpg',
      active: true,
    },
    {
      sku: 'AUD-AIRP2-USBC',
      barcode: '1942537204004',
      qrCodeData: 'TECNOVA:SKU=AUD-AIRP2-USBC|BAR=1942537204004',
      name: 'Audífonos Inalámbricos Pro USB-C',
      brand: 'Apple',
      model: 'AirPods Pro 2',
      category: 'Audio',
      condition: 'Nuevo',
      storage: 'N/A',
      color: 'Blanco',
      costPrice: 165,
      salePrice: 239,
      stock: 7,
      minStock: 3,
      warrantyMonths: 6,
      imeiRequired: false,
      supplier: 'Distribuidor Apple Latam',
      location: 'Estante C1',
      description: 'Cancelación activa de ruido, audio espacial y estuche MagSafe USB-C.',
      imageUrl: '/src/assets/images/phone_accessories_bundle_1795020479568.jpg',
      active: true,
    },
    {
      sku: 'CAR-GAN65-USBC',
      barcode: '7509988100655',
      qrCodeData: 'TECNOVA:SKU=CAR-GAN65-USBC|BAR=7509988100655',
      name: 'Cargador Rápido GaN 65W + Cable Trenzado',
      brand: 'Anker',
      model: 'PowerPort GaN 65W',
      category: 'Cargadores y Cables',
      condition: 'Nuevo',
      storage: 'N/A',
      color: 'Blanco Mate',
      costPrice: 18,
      salePrice: 39,
      stock: 2,
      minStock: 5,
      warrantyMonths: 6,
      imeiRequired: false,
      supplier: 'Accesorios Tech MX',
      location: 'Estante C3',
      description: 'Tecnología GaN de alta eficiencia con doble puerto USB-C Power Delivery.',
      imageUrl: '/src/assets/images/phone_accessories_bundle_1795020479568.jpg',
      active: true,
    },
    {
      sku: 'REP-OLED-IP14',
      barcode: '7504411220146',
      qrCodeData: 'TECNOVA:SKU=REP-OLED-IP14|BAR=7504411220146',
      name: 'Módulo Pantalla OLED Original iPhone 14',
      brand: 'Apple',
      model: 'iPhone 14',
      category: 'Pantallas y Repuestos',
      condition: 'Repuesto',
      storage: 'N/A',
      color: 'Negro',
      costPrice: 78,
      salePrice: 145,
      stock: 3,
      minStock: 2,
      warrantyMonths: 3,
      imeiRequired: false,
      supplier: 'Repuestos Pro Lab',
      location: 'Taller Gaveta 2',
      description: 'Ensamble OLED con soporte True Tone listo para instalación técnica.',
      imageUrl: '/src/assets/images/phone_repair_workbench_1795020480890.jpg',
      active: true,
    },
  ];

  const createdIds: string[] = [];
  for (const item of starterProducts) {
    const id = generateLocalId('prod');
    createdIds.push(id);
    await saveLocalDoc(
      'products',
      id,
      {
        ...item,
        storeId: STORE_ID,
        updatedBy: uid,
      },
      true
    );
  }

  await saveLocalDoc(
    'warranties',
    generateLocalId('war'),
    {
      warrantyCode: 'GAR-20261118-101',
      saleId: 'SEED-001',
      productId: createdIds[0],
      productName: starterProducts[0].name,
      imei: '358491029384712',
      customerName: 'Carlos Mendoza',
      customerPhone: '+52 55 4821 9034',
      purchaseDate: dateKey,
      expiresDate: addMonthsToDateKey(dateKey, 12),
      warrantyMonths: 12,
      status: 'Vigente' as WarrantyStatus,
      notes: 'Equipo verificado en mostrador con sello intacto.',
      createdBy: uid,
      storeId: STORE_ID,
    },
    true
  );

  await saveLocalDoc(
    'repairs',
    generateLocalId('rep'),
    {
      ticketCode: 'REP-20261118-201',
      customerName: 'Sofía Herrera',
      customerPhone: '+52 55 9102 3341',
      deviceBrand: 'Apple',
      deviceModel: 'iPhone 14',
      imei: '352918475610293',
      issueDescription: 'Pantalla estrellada tras caída, táctil intermitente en zona superior.',
      diagnosis: 'Display OLED fracturado, placa base y Face ID operando normalmente.',
      partsUsed: 'Módulo Pantalla OLED Original iPhone 14',
      estimatedCost: 145,
      finalCost: 145,
      warrantyCovered: false,
      warrantyId: '',
      status: 'En Reparación' as RepairStatus,
      technicianUid: uid,
      technicianName: clampString(userName || 'Técnico Principal', 100),
      historyLog: [
        `[${dateKey} 09:10] Ingreso a taller registrado por ${userName || 'Admin'}.`,
        `[${dateKey} 09:35] Estado actualizado a "En Reparación": reemplazo de módulo OLED en curso.`,
      ],
      storeId: STORE_ID,
    },
    true
  );
}

export function exportDailyReportsCsv(reports: DailyReport[]): void {
  const headers = [
    'Fecha',
    'Estado',
    'Ventas',
    'Ingresos Totales',
    'Costo Total',
    'Ganancia Bruta',
    'Efectivo',
    'Tarjeta',
    'Transferencia',
    'Ingresos Taller',
    'Producto Estrella',
    'Generado Por',
  ];
  const rows = reports.map((r) => [
    r.dateKey,
    r.status,
    String(r.totalSalesCount),
    r.totalRevenue.toFixed(2),
    r.totalCost.toFixed(2),
    r.grossProfit.toFixed(2),
    r.cashTotal.toFixed(2),
    r.cardTotal.toFixed(2),
    r.transferTotal.toFixed(2),
    r.repairsRevenue.toFixed(2),
    `"${r.topProduct.replace(/"/g, '""')}"`,
    `"${r.generatedByName.replace(/"/g, '""')}"`,
  ]);

  const csv = `\uFEFF${[headers.join(';'), ...rows.map((row) => row.join(';'))].join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reporte-ventas-tecnova-${getTodayDateKey()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportDesktopBackupFile(): Promise<void> {
  const json = await exportDesktopDatabaseJson();
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `respaldo-tecnova-escritorio-${getTodayDateKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importDesktopBackupFile(file: File): Promise<{
  products: number;
  sales: number;
  warranties: number;
  repairs: number;
  reports: number;
  accounts: number;
}> {
  const text = await file.text();
  return importDesktopDatabaseJson(text);
}

export async function exportSettingsBackupFile(
  selectedKeys: SettingsBundleKey[] = ALL_SETTINGS_BUNDLE_KEYS,
  themeMode?: 'light' | 'dark'
): Promise<{ filename: string; count: number }> {
  const keys =
    selectedKeys.length > 0 ? selectedKeys : [...ALL_SETTINGS_BUNDLE_KEYS];
  const json = await exportSettingsBundleJson(keys, themeMode);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const filename = `configuraciones-tecnova-${getTodayDateKey()}.json`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return { filename, count: keys.length };
}

export async function inspectSettingsBackupFile(
  file: File
): Promise<ParsedSettingsBackup> {
  const text = await file.text();
  return parseSettingsBackupJson(text);
}

export async function applySettingsBackup(
  snapshot: Partial<SettingsBackupSnapshot>,
  selectedKeys: SettingsBundleKey[]
): Promise<{ appliedKeys: SettingsBundleKey[]; themeMode?: 'light' | 'dark' }> {
  return restoreSettingsFromParsedBackup(snapshot, selectedKeys);
}

export async function resetStoreSettingsToDefaults(
  selectedKeys: SettingsBundleKey[]
): Promise<{ resetKeys: SettingsBundleKey[] }> {
  return resetSettingsToFactoryDefaults(selectedKeys);
}

export async function saveStoreReceiptSettings(
  settings: ReceiptSettings
): Promise<ReceiptSettings> {
  return saveReceiptSettings(settings);
}

export async function saveStoreLoginPresentationSettings(
  settings: LoginPresentationSettings
): Promise<LoginPresentationSettings> {
  return saveLoginPresentationSettings(settings);
}

export async function saveStoreAppAppearanceSettings(
  settings: AppAppearanceSettings
): Promise<AppAppearanceSettings> {
  return saveAppAppearanceSettings(settings);
}

export async function saveStoreVisualCustomizationSettings(
  settings: VisualCustomizationSettings
): Promise<VisualCustomizationSettings> {
  return saveVisualCustomizationSettings(settings);
}

export async function saveStoreInstalledAppSettings(
  settings: InstalledAppSettings
): Promise<InstalledAppSettings> {
  return saveInstalledAppSettings(settings);
}

export async function saveStoreDeveloperSystemSettings(
  settings: DeveloperSystemSettings
): Promise<DeveloperSystemSettings> {
  return saveDeveloperSystemSettings(settings);
}

export async function saveStorePosSettings(
  settings: PosSettings
): Promise<PosSettings> {
  return savePosSettings(settings);
}

export async function saveStoreWarrantySheetSettings(
  settings: WarrantySheetSettings
): Promise<WarrantySheetSettings> {
  return saveWarrantySheetSettings(settings);
}

export async function updateDeveloperOwnAccount(
  uid: string,
  updates: { displayName?: string; newPassword?: string }
): Promise<void> {
  return updateOwnDeveloperProfile(uid, updates);
}

const PRODUCT_EXPORT_HEADERS = [
  'SKU',
  'Código de Barras',
  'Nombre',
  'Marca',
  'Modelo',
  'Categoría',
  'Condición',
  'Capacidad',
  'Color',
  'Precio Costo',
  'Precio Venta',
  'Stock',
  'Stock Mínimo',
  'Garantía (Meses)',
  'Requiere IMEI',
  'Proveedor',
  'Ubicación',
  'Descripción',
  'Imagen URL',
  'Activo',
] as const;

const PRODUCT_EXCEL_COL_WIDTHS = [
  { wch: 18 }, // SKU
  { wch: 18 }, // Código de Barras
  { wch: 32 }, // Nombre
  { wch: 14 }, // Marca
  { wch: 20 }, // Modelo
  { wch: 22 }, // Categoría
  { wch: 14 }, // Condición
  { wch: 12 }, // Capacidad
  { wch: 16 }, // Color
  { wch: 14 }, // Precio Costo
  { wch: 14 }, // Precio Venta
  { wch: 10 }, // Stock
  { wch: 14 }, // Stock Mínimo
  { wch: 16 }, // Garantía
  { wch: 14 }, // Requiere IMEI
  { wch: 22 }, // Proveedor
  { wch: 18 }, // Ubicación
  { wch: 38 }, // Descripción
  { wch: 42 }, // Imagen URL
  { wch: 10 }, // Activo
];

function productToSpreadsheetRow(p: Product): Record<string, string | number> {
  return {
    'SKU': p.sku,
    'Código de Barras': p.barcode,
    'Nombre': p.name,
    'Marca': p.brand,
    'Modelo': p.model,
    'Categoría': p.category,
    'Condición': p.condition,
    'Capacidad': p.storage,
    'Color': p.color,
    'Precio Costo': Number(p.costPrice.toFixed(2)),
    'Precio Venta': Number(p.salePrice.toFixed(2)),
    'Stock': p.stock,
    'Stock Mínimo': p.minStock,
    'Garantía (Meses)': p.warrantyMonths,
    'Requiere IMEI': p.imeiRequired ? 'SI' : 'NO',
    'Proveedor': p.supplier,
    'Ubicación': p.location,
    'Descripción': p.description,
    'Imagen URL': p.imageUrl,
    'Activo': p.active ? 'SI' : 'NO',
  };
}

export function exportProductsToExcel(products: Product[]): void {
  const rows = products.map(productToSpreadsheetRow);
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [...PRODUCT_EXPORT_HEADERS],
  });
  worksheet['!cols'] = PRODUCT_EXCEL_COL_WIDTHS;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');
  XLSX.writeFile(workbook, `inventario-productos-${getTodayDateKey()}.xlsx`);
}

function escapeCsvCell(value: string | number | boolean): string {
  const str = String(value ?? '');
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportProductsToCsv(products: Product[]): void {
  const rows = products.map((p) =>
    [
      p.sku,
      p.barcode,
      p.name,
      p.brand,
      p.model,
      p.category,
      p.condition,
      p.storage,
      p.color,
      p.costPrice.toFixed(2),
      p.salePrice.toFixed(2),
      p.stock,
      p.minStock,
      p.warrantyMonths,
      p.imeiRequired ? 'SI' : 'NO',
      p.supplier,
      p.location,
      p.description,
      p.imageUrl,
      p.active ? 'SI' : 'NO',
    ]
      .map(escapeCsvCell)
      .join(';')
  );

  const csvContent = `\uFEFF${PRODUCT_EXPORT_HEADERS.join(';')}\r\n${rows.join('\r\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventario-productos-${getTodayDateKey()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportProductsToJson(products: Product[]): void {
  const payload = products.map((p) => ({
    sku: p.sku,
    barcode: p.barcode,
    qrCodeData: p.qrCodeData,
    name: p.name,
    brand: p.brand,
    model: p.model,
    category: p.category,
    condition: p.condition,
    storage: p.storage,
    color: p.color,
    costPrice: p.costPrice,
    salePrice: p.salePrice,
    stock: p.stock,
    minStock: p.minStock,
    warrantyMonths: p.warrantyMonths,
    imeiRequired: p.imeiRequired,
    supplier: p.supplier,
    location: p.location,
    description: p.description,
    imageUrl: p.imageUrl,
    active: p.active,
  }));
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventario-productos-${getTodayDateKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadProductImportTemplateExcel(): void {
  const sampleRows: Record<string, string | number>[] = [
    {
      'SKU': 'IPH-16-128',
      'Código de Barras': '7501055309901',
      'Nombre': 'iPhone 16 128GB Negro',
      'Marca': 'Apple',
      'Modelo': 'iPhone 16',
      'Categoría': 'Smartphones',
      'Condición': 'Nuevo',
      'Capacidad': '128GB',
      'Color': 'Negro',
      'Precio Costo': 720,
      'Precio Venta': 899,
      'Stock': 5,
      'Stock Mínimo': 2,
      'Garantía (Meses)': 12,
      'Requiere IMEI': 'SI',
      'Proveedor': 'Distribuidor Oficial',
      'Ubicación': 'Vitrina A1',
      'Descripción': 'Equipo nuevo sellado de fabrica',
      'Imagen URL': '/src/assets/images/phone_flagship_pro_1795020479508.jpg',
      'Activo': 'SI',
    },
    {
      'SKU': 'CARG-USBC-25W',
      'Código de Barras': '7501055309902',
      'Nombre': 'Cargador Rápido USB-C 25W',
      'Marca': 'Samsung',
      'Modelo': 'EP-TA800',
      'Categoría': 'Cargadores y Cables',
      'Condición': 'Nuevo',
      'Capacidad': '-',
      'Color': 'Blanco',
      'Precio Costo': 12,
      'Precio Venta': 25,
      'Stock': 15,
      'Stock Mínimo': 4,
      'Garantía (Meses)': 6,
      'Requiere IMEI': 'NO',
      'Proveedor': 'Accesorios Mayorista',
      'Ubicación': 'Estante B2',
      'Descripción': 'Carga super rapida con cable incluido',
      'Imagen URL': '/src/assets/images/phone_accessories_bundle_1795020479568.jpg',
      'Activo': 'SI',
    },
  ];
  const worksheet = XLSX.utils.json_to_sheet(sampleRows, {
    header: [...PRODUCT_EXPORT_HEADERS],
  });
  worksheet['!cols'] = PRODUCT_EXCEL_COL_WIDTHS;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');
  XLSX.writeFile(workbook, 'plantilla-importar-productos.xlsx');
}

function parseDelimitedText(text: string): string[][] {
  let cleanText = text.replace(/^\uFEFF/, '');
  if (/^sep=[,;]\r?\n/i.test(cleanText)) {
    cleanText = cleanText.replace(/^sep=[,;]\r?\n/i, '');
  }
  const firstLine = cleanText.split(/\r?\n/, 1)[0] || '';
  let commaCount = 0;
  let semiCount = 0;
  let inQuotes = false;
  for (let i = 0; i < firstLine.length; i += 1) {
    const ch = firstLine[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === ',') commaCount += 1;
      else if (ch === ';') semiCount += 1;
    }
  }
  const delimiter = semiCount > commaCount ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  inQuotes = false;

  for (let i = 0; i < cleanText.length; i += 1) {
    const ch = cleanText[i];
    if (inQuotes) {
      if (ch === '"') {
        if (cleanText[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\r') {
      if (cleanText[i + 1] === '\n') i += 1;
      row.push(cell.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

function normalizeHeaderKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function parseImportNumber(val: unknown, fallback = 0): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  const str = String(val ?? '')
    .replace(/[^0-9.,-]/g, '')
    .trim();
  if (!str) return fallback;
  const normalized =
    str.includes(',') && !str.includes('.')
      ? str.replace(',', '.')
      : str.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

function parseImportBool(val: unknown, fallback = false): boolean {
  if (typeof val === 'boolean') return val;
  const s = String(val ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  if (!s) return fallback;
  if (['si', 'yes', 'true', '1', 's', 'y', 'activo'].includes(s)) return true;
  if (['no', 'false', '0', 'n', 'inactivo'].includes(s)) return false;
  return fallback;
}

function normalizeImportCategory(val: unknown): ProductCategory {
  const raw = String(val ?? '').trim();
  if (!raw) return 'Smartphones';
  const norm = normalizeHeaderKey(raw);
  const found = PRODUCT_CATEGORIES.find(
    (c) =>
      normalizeHeaderKey(c) === norm ||
      normalizeHeaderKey(c).includes(norm) ||
      norm.includes(normalizeHeaderKey(c))
  );
  return found || clampString(raw, 48) || 'Accesorios';
}

function normalizeImportCondition(val: unknown): ProductCondition {
  const raw = String(val ?? '').trim();
  if (!raw) return 'Nuevo';
  const norm = normalizeHeaderKey(raw);
  const found = PRODUCT_CONDITIONS.find((c) => normalizeHeaderKey(c) === norm);
  return found || clampString(raw, 40) || 'Nuevo';
}

function mapRawRecordToProductInput(
  raw: Record<string, unknown>,
  rowIndex: number
): { item: ProductInput | null; warning?: string } {
  const normalizedMap: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    normalizedMap[normalizeHeaderKey(k)] = v;
  }

  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const val = normalizedMap[k];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val).trim();
      }
    }
    return '';
  };

  const name = pick('nombre', 'name', 'producto', 'titulo', 'title');
  if (!name) {
    return {
      item: null,
      warning: `Fila ${rowIndex + 1}: falta el nombre del producto y fue omitida.`,
    };
  }

  const rawSku = pick('sku', 'codigo', 'code', 'codigoproducto', 'idproducto');
  const rawBarcode = pick(
    'codigodebarras',
    'codigobarras',
    'barcode',
    'barra',
    'ean',
    'upc'
  );
  const suffix = String(rowIndex + 1).padStart(3, '0');
  const sku = sanitizeCode(
    rawSku || `IMP-${Date.now().toString().slice(-4)}-${suffix}`,
    BLUEPRINT_LIMITS.skuMax
  );
  const barcode = sanitizeCode(
    rawBarcode || `7509${Date.now().toString().slice(-5)}${suffix}`,
    BLUEPRINT_LIMITS.barcodeMax
  );

  const category = normalizeImportCategory(
    pick('categoria', 'category', 'tipo')
  );
  const condition = normalizeImportCondition(
    pick('condicion', 'condition', 'estado')
  );

  const defaultImg =
    category === 'Pantallas y Repuestos'
      ? '/src/assets/images/phone_repair_workbench_1795020480890.jpg'
      : category === 'Smartphones'
        ? '/src/assets/images/phone_flagship_pro_1795020479508.jpg'
        : '/src/assets/images/phone_accessories_bundle_1795020479568.jpg';

  const brand = pick('marca', 'brand', 'fabricante') || 'Genérico';
  const model = pick('modelo', 'model') || name.slice(0, 80);
  const storage = pick('capacidad', 'almacenamiento', 'storage') || '-';
  const color = pick('color') || 'Negro';
  const costPrice = Math.max(
    0,
    parseImportNumber(pick('preciocosto', 'costprice', 'costo', 'cost'), 0)
  );
  const salePrice = Math.max(
    0,
    parseImportNumber(
      pick('precioventa', 'saleprice', 'precio', 'price', 'pvp'),
      0
    )
  );
  const stock = Math.max(
    0,
    Math.floor(
      parseImportNumber(
        pick('stock', 'existencias', 'cantidad', 'inventario', 'qty'),
        0
      )
    )
  );
  const minStock = Math.max(
    0,
    Math.floor(
      parseImportNumber(pick('stockminimo', 'minstock', 'minimo'), 2)
    )
  );
  const warrantyMonths = Math.min(
    60,
    Math.max(
      0,
      Math.floor(
        parseImportNumber(
          pick('garantiameses', 'warrantymonths', 'garantia'),
          category === 'Smartphones' ? 12 : 3
        )
      )
    )
  );
  const imeiRequired = parseImportBool(
    pick('requiereimei', 'imeirequired', 'imei'),
    category === 'Smartphones'
  );
  const supplier =
    pick('proveedor', 'supplier') || 'Distribuidor Oficial';
  const location =
    pick('ubicacion', 'location', 'vitrina') || 'Vitrina Principal';
  const description = pick('descripcion', 'description', 'notas');
  const imageUrl =
    pick('imagenurl', 'imageurl', 'imagen', 'foto', 'image') || defaultImg;
  const active = parseImportBool(pick('activo', 'active'), true);

  return {
    item: {
      sku,
      barcode,
      qrCodeData:
        pick('qrcodedata', 'qr') || `TECNOVA:SKU=${sku}|BAR=${barcode}`,
      name: clampString(name, BLUEPRINT_LIMITS.nameMax),
      brand: clampString(brand, BLUEPRINT_LIMITS.brandMax),
      model: clampString(model, BLUEPRINT_LIMITS.modelMax),
      category,
      condition,
      storage: clampString(storage, BLUEPRINT_LIMITS.storageMax),
      color: clampString(color, BLUEPRINT_LIMITS.colorMax),
      costPrice,
      salePrice,
      stock,
      minStock,
      warrantyMonths,
      imeiRequired,
      supplier: clampString(supplier, BLUEPRINT_LIMITS.supplierMax),
      location: clampString(location, BLUEPRINT_LIMITS.locationMax),
      description: clampString(description, BLUEPRINT_LIMITS.descriptionMax),
      imageUrl: clampString(imageUrl, BLUEPRINT_LIMITS.imageUrlMax),
      active,
    },
  };
}

export async function parseProductsImportFile(
  file: File
): Promise<{ items: ProductInput[]; warnings: string[] }> {
  const lower = file.name.toLowerCase();
  const warnings: string[] = [];
  const items: ProductInput[] = [];

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('El libro de Excel no contiene ninguna hoja.');
    }
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
    });
    if (rows.length === 0) {
      throw new Error(
        'La hoja de Excel no contiene filas de productos para importar.'
      );
    }
    rows.forEach((record, idx) => {
      const res = mapRawRecordToProductInput(record, idx);
      if (res.warning) warnings.push(res.warning);
      if (res.item) items.push(res.item);
    });
    return { items, warnings };
  }

  const text = await file.text();

  if (
    lower.endsWith('.json') ||
    text.trim().startsWith('[') ||
    text.trim().startsWith('{')
  ) {
    const parsed = JSON.parse(text) as unknown;
    const rawArray = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === 'object' &&
          Array.isArray((parsed as { products?: unknown[] }).products)
        ? (parsed as { products: unknown[] }).products
        : null;

    if (!rawArray) {
      throw new Error(
        'El archivo JSON debe contener una lista de productos o un arreglo válido.'
      );
    }

    rawArray.forEach((entry, idx) => {
      if (!entry || typeof entry !== 'object') {
        warnings.push(`Elemento ${idx + 1}: formato inválido.`);
        return;
      }
      const res = mapRawRecordToProductInput(
        entry as Record<string, unknown>,
        idx
      );
      if (res.warning) warnings.push(res.warning);
      if (res.item) items.push(res.item);
    });

    return { items, warnings };
  }

  const matrix = parseDelimitedText(text);
  if (matrix.length < 2) {
    throw new Error(
      'El archivo debe incluir una fila de encabezados y al menos un producto.'
    );
  }

  const headers = matrix[0];
  for (let i = 1; i < matrix.length; i += 1) {
    const rowValues = matrix[i];
    const record: Record<string, unknown> = {};
    headers.forEach((h, colIdx) => {
      record[h] = rowValues[colIdx] ?? '';
    });
    const res = mapRawRecordToProductInput(record, i);
    if (res.warning) warnings.push(res.warning);
    if (res.item) items.push(res.item);
  }

  return { items, warnings };
}

export interface ProductImportStats {
  created: number;
  updated: number;
  skipped: number;
}

export async function importProductsBatch(
  uid: string,
  items: ProductInput[],
  existingProducts: Product[],
  updateExisting: boolean,
  isAdmin: boolean
): Promise<ProductImportStats> {
  const bySku = new Map<string, Product>();
  const byBarcode = new Map<string, Product>();

  for (const p of existingProducts) {
    if (p.sku) bySku.set(p.sku.trim().toLowerCase(), p);
    if (p.barcode) byBarcode.set(p.barcode.trim().toLowerCase(), p);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const match =
      bySku.get(item.sku.trim().toLowerCase()) ||
      byBarcode.get(item.barcode.trim().toLowerCase()) ||
      null;

    if (match) {
      if (!updateExisting) {
        skipped += 1;
        continue;
      }
      await createOrUpdateProduct(uid, item, match, isAdmin);
      updated += 1;
    } else {
      await createOrUpdateProduct(uid, item, null, isAdmin);
      created += 1;
    }
  }

  return { created, updated, skipped };
}
