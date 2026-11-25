import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  Barcode,
  Camera,
  CheckCircle2,
  Download,
  Edit3,
  FileSpreadsheet,
  Minus,
  Package,
  Plus,
  QrCode,
  Search,
  Smartphone,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  DEFAULT_CATALOG_IMAGE_PRESETS,
  DEFAULT_DEVELOPER_SYSTEM_SETTINGS,
  formatCurrency,
  PRODUCT_CATEGORIES,
  PRODUCT_CONDITIONS,
  sanitizeCode,
  type DeveloperSystemSettings,
  type Product,
  type ProductCategory,
  type ProductCondition,
  type UserRole,
} from '../types/store';
import {
  createOrUpdateProduct,
  deleteProductById,
  downloadProductImportTemplateExcel,
  exportProductsToExcel,
  exportProductsToJson,
  importProductsBatch,
  parseProductsImportFile,
  type ProductInput,
} from '../lib/storeOperations';
import {
  addCustomProductCategory,
  subscribeCustomProductCategories,
} from '../lib/localDb';
import {
  BarcodeCaptureModal,
  BarcodeSvg,
  extractCodeToken,
  ProductLabelModal,
  QrCodeImg,
} from './BarcodeQrToolkit';

const PRESET_IMAGES = DEFAULT_CATALOG_IMAGE_PRESETS;

function ProductThumb({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
        <Smartphone className="w-4 h-4" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100"
    />
  );
}

export function InventoryView({
  products,
  uid,
  viewRole,
  onAdjustStock,
  onOpenScanner,
  pendingEditProduct,
  pendingNewCode,
  onClearPending,
  incomingScan,
  onConsumeIncomingScan,
  developerSettings = DEFAULT_DEVELOPER_SYSTEM_SETTINGS,
}: {
  products: Product[];
  uid: string;
  viewRole: UserRole;
  onAdjustStock: (product: Product, delta: number) => Promise<void>;
  onOpenScanner: () => void;
  pendingEditProduct: Product | null;
  pendingNewCode: string | null;
  onClearPending: () => void;
  incomingScan?: { code: string; seq: number } | null;
  onConsumeIncomingScan?: () => void;
  developerSettings?: DeveloperSystemSettings;
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'Todos' | ProductCategory>('Todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [barcodeCaptureOpen, setBarcodeCaptureOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [labelProduct, setLabelProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [inventoryNotice, setInventoryNotice] = useState<string | null>(null);

  // Custom categories state
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryError, setNewCategoryError] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);

  useEffect(() => {
    return subscribeCustomProductCategories(setCustomCategories);
  }, []);

  const availableCategories = useMemo(() => {
    const base = [...PRODUCT_CATEGORIES] as string[];
    const seen = new Set(base.map((c) => c.toLowerCase()));
    for (const c of customCategories) {
      if (c && !seen.has(c.toLowerCase())) {
        seen.add(c.toLowerCase());
        base.push(c);
      }
    }
    for (const p of products) {
      if (p.category && !seen.has(p.category.toLowerCase())) {
        seen.add(p.category.toLowerCase());
        base.push(p.category);
      }
    }
    return base;
  }, [customCategories, products]);

  const catalogImagePresets = useMemo(
    () =>
      developerSettings.catalogImagePresets?.length
        ? developerSettings.catalogImagePresets
        : PRESET_IMAGES,
    [developerSettings.catalogImagePresets]
  );

  const availableConditions = useMemo(() => {
    const base = developerSettings.productConditions?.length
      ? [...developerSettings.productConditions]
      : [...PRODUCT_CONDITIONS];
    const seen = new Set(base.map((c) => c.toLowerCase()));
    for (const p of products) {
      if (p.condition && !seen.has(p.condition.toLowerCase())) {
        seen.add(p.condition.toLowerCase());
        base.push(p.condition);
      }
    }
    return base;
  }, [developerSettings.productConditions, products]);

  // Import / Export modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFileName, setImportFileName] = useState<string>('');
  const [importItems, setImportItems] = useState<ProductInput[]>([]);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [updateExistingOnImport, setUpdateExistingOnImport] = useState(true);
  const [importing, setImporting] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ProductInput>({
    sku: '',
    barcode: '',
    qrCodeData: '',
    name: '',
    brand: 'Apple',
    model: '',
    category: 'Smartphones',
    condition: 'Nuevo',
    storage: '128GB',
    color: 'Negro',
    costPrice: 0,
    salePrice: 0,
    stock: 1,
    minStock: 2,
    warrantyMonths: 12,
    imeiRequired: true,
    supplier: 'Distribuidor Oficial',
    location: 'Vitrina A1',
    description: '',
    imageUrl: PRESET_IMAGES[0].url,
    active: true,
  });

  const openNewModal = (prefillCode?: string) => {
    const randomDigits = String(Math.floor(1000000 + Math.random() * 8999999));
    const barcode = prefillCode ? sanitizeCode(prefillCode, 64) : `750105${randomDigits}`;
    const sku = prefillCode
      ? sanitizeCode(`SKU-${prefillCode.slice(0, 12)}`, 40)
      : `CEL-${randomDigits.slice(0, 5)}`;
    const prefix = developerSettings.qrCodePrefix || 'TECNOVA';
    setEditingProduct(null);
    setFormError(null);
    setAddingCategory(false);
    setNewCategoryName('');
    setNewCategoryError(null);
    setForm({
      sku,
      barcode,
      qrCodeData: `${prefix}:SKU=${sku}|BAR=${barcode}`,
      name: '',
      brand: 'Apple',
      model: '',
      category: 'Smartphones',
      condition: availableConditions[0] || 'Nuevo',
      storage: '128GB',
      color: 'Negro',
      costPrice: 0,
      salePrice: 0,
      stock: 1,
      minStock: developerSettings.lowStockDefaultMin ?? 2,
      warrantyMonths: developerSettings.defaultPhoneWarrantyMonths ?? 12,
      imeiRequired: true,
      supplier: 'Distribuidor Oficial',
      location: developerSettings.defaultStoreBranch || 'Vitrina A1',
      description: '',
      imageUrl: catalogImagePresets[0]?.url || PRESET_IMAGES[0].url,
      active: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormError(null);
    setAddingCategory(false);
    setNewCategoryName('');
    setNewCategoryError(null);
    setForm({
      sku: product.sku,
      barcode: product.barcode,
      qrCodeData: product.qrCodeData,
      name: product.name,
      brand: product.brand,
      model: product.model,
      category: product.category,
      condition: product.condition,
      storage: product.storage,
      color: product.color,
      costPrice: product.costPrice,
      salePrice: product.salePrice,
      stock: product.stock,
      minStock: product.minStock,
      warrantyMonths: product.warrantyMonths,
      imeiRequired: product.imeiRequired,
      supplier: product.supplier,
      location: product.location,
      description: product.description,
      imageUrl: product.imageUrl,
      active: product.active,
    });
    setModalOpen(true);
  };

  useEffect(() => {
    if (pendingEditProduct) {
      openEditModal(pendingEditProduct);
      onClearPending();
    } else if (pendingNewCode) {
      openNewModal(pendingNewCode);
      onClearPending();
    }
  }, [pendingEditProduct, pendingNewCode, onClearPending]);

  useEffect(() => {
    if (!incomingScan?.code) return;
    const rawToken = extractCodeToken(incomingScan.code);
    const cleanBarcode = sanitizeCode(rawToken, 64);
    if (!cleanBarcode) {
      onConsumeIncomingScan?.();
      return;
    }

    if (modalOpen) {
      const qrPrefix = developerSettings.qrCodePrefix || 'TECNOVA';
      setForm((prev) => ({
        ...prev,
        barcode: cleanBarcode,
        qrCodeData: `${qrPrefix}:SKU=${prev.sku}|BAR=${cleanBarcode}`,
      }));
      setInventoryNotice(`Código escaneado asignado al formulario: ${cleanBarcode}`);
    } else {
      const existing = products.find(
        (p) =>
          p.barcode.toLowerCase() === cleanBarcode.toLowerCase() ||
          p.sku.toLowerCase() === cleanBarcode.toLowerCase() ||
          p.qrCodeData.toLowerCase() === rawToken.toLowerCase()
      );
      if (existing) {
        openEditModal(existing);
        setInventoryNotice(
          `Producto localizado (${existing.name}). Puedes editar datos o ajustar su stock.`
        );
      } else {
        openNewModal(cleanBarcode);
        setInventoryNotice(
          `Código nuevo recibido (${cleanBarcode}). Completa los datos para registrarlo.`
        );
      }
    }

    onConsumeIncomingScan?.();
  }, [incomingScan, modalOpen, products, developerSettings.qrCodePrefix, onConsumeIncomingScan]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'Todos' && p.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.model.toLowerCase().includes(q)
      );
    });
  }, [products, search, categoryFilter]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.brand.trim() || !form.model.trim()) {
      setFormError('Completa el nombre, marca y modelo del producto.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const qrPrefix = developerSettings.qrCodePrefix || 'TECNOVA';
      const nextForm: ProductInput = {
        ...form,
        qrCodeData: form.qrCodeData.trim() || `${qrPrefix}:SKU=${form.sku}|BAR=${form.barcode}`,
      };
      await createOrUpdateProduct(uid, nextForm, editingProduct, viewRole === 'admin');
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el producto.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setNewCategoryError('Escribe el nombre de la categoría.');
      return;
    }
    setSavingCategory(true);
    setNewCategoryError(null);
    try {
      const result = await addCustomProductCategory(trimmed, PRODUCT_CATEGORIES);
      setForm((prev) => ({ ...prev, category: result.category }));
      setNewCategoryName('');
      setAddingCategory(false);
    } catch (err) {
      setNewCategoryError(
        err instanceof Error ? err.message : 'No se pudo agregar la categoría.'
      );
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (viewRole !== 'admin') return;
    await deleteProductById(product.id);
    if (detailProduct?.id === product.id) setDetailProduct(null);
  };

  const isAdmin = viewRole === 'admin';

  const openImportModal = () => {
    setImportFileName('');
    setImportItems([]);
    setImportWarnings([]);
    setImportError(null);
    setImportModalOpen(true);
  };

  const handleImportFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportError(null);
    setImportWarnings([]);
    try {
      const parsed = await parseProductsImportFile(file);
      if (parsed.items.length === 0) {
        setImportError(
          'No se detectaron productos válidos en el archivo. Descarga la plantilla Excel para ver el formato esperado.'
        );
        setImportItems([]);
        setImportFileName(file.name);
        return;
      }
      setImportFileName(file.name);
      setImportItems(parsed.items);
      setImportWarnings(parsed.warnings);
    } catch (err) {
      setImportItems([]);
      setImportFileName(file.name);
      setImportError(
        err instanceof Error
          ? err.message
          : 'No se pudo leer el archivo seleccionado.'
      );
    }
  };

  const handleConfirmImport = async () => {
    if (importItems.length === 0) return;
    setImporting(true);
    setImportError(null);
    try {
      const stats = await importProductsBatch(
        uid,
        importItems,
        products,
        updateExistingOnImport,
        isAdmin
      );
      setImportModalOpen(false);
      setInventoryNotice(
        `Importación completada: ${stats.created} agregados, ${stats.updated} actualizados${
          stats.skipped > 0 ? `, ${stats.skipped} omitidos por duplicado` : ''
        }.`
      );
    } catch (err) {
      setImportError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al importar los productos.'
      );
    } finally {
      setImporting(false);
    }
  };

  const handleExportExcel = () => {
    if (products.length === 0) {
      setInventoryNotice('No hay productos registrados para exportar.');
      return;
    }
    exportProductsToExcel(products);
    setInventoryNotice(
      `Se exportaron ${products.length} productos en archivo Excel (.xlsx) con cada especificación en su propia celda.`
    );
  };

  const existingSkuSet = useMemo(
    () => new Set(products.map((p) => p.sku.trim().toLowerCase()).filter(Boolean)),
    [products]
  );
  const existingBarcodeSet = useMemo(
    () =>
      new Set(products.map((p) => p.barcode.trim().toLowerCase()).filter(Boolean)),
    [products]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      {/* Workspace Header & Primary Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Catálogo e Inventario en Tiempo Real
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {products.length} referencias registradas · Edición, códigos de barra Code128 y etiquetas QR sincronizadas
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={openImportModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Upload className="w-4 h-4 text-blue-700" />
            Importar
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-slate-600" />
            Exportar Excel
          </button>
          <button
            type="button"
            onClick={onOpenScanner}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <QrCode className="w-4 h-4" />
            Escanear para Subir / Editar
          </button>
          <button
            type="button"
            onClick={() => openNewModal()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Nuevo Producto
          </button>
        </div>
      </div>

      {inventoryNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{inventoryNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setInventoryNotice(null)}
            className="p-1 text-emerald-700 hover:bg-emerald-100 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por modelo, marca, SKU o código de barras..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {['Todos', ...availableCategories].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  categoryFilter === cat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Inventory Data Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-900">
              No hay productos que coincidan con tu búsqueda
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Registra un smartphone, accesorio o repuesto manualmente o escanea su código de barras para darlo de alta.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <button
                type="button"
                onClick={onOpenScanner}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Escanear Código
              </button>
              <button
                type="button"
                onClick={() => openNewModal()}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Agregar Producto
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4">SKU / Barra</th>
                  <th className="py-3 px-4">Categoría</th>
                  {isAdmin && <th className="py-3 px-4 text-right">Costo</th>}
                  <th className="py-3 px-4 text-right">Precio</th>
                  <th className="py-3 px-4 text-center">Stock</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredProducts.map((p) => {
                  const stockState =
                    p.stock === 0
                      ? { label: 'Agotado', color: 'text-red-600' }
                      : p.stock <= p.minStock
                        ? { label: 'Stock bajo', color: 'text-amber-700' }
                        : { label: 'Óptimo', color: 'text-emerald-700' };

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => setDetailProduct(p)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3 min-w-[220px]">
                          <ProductThumb src={p.imageUrl} alt={p.name} />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate max-w-[260px]">
                              {p.name}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {p.brand} · {p.storage !== '-' ? `${p.storage} · ` : ''}
                              {p.color} · {p.location}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        <p className="text-slate-900 font-medium">{p.sku}</p>
                        <p className="text-slate-400">{p.barcode}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {p.category}
                        <span className="block text-[11px] text-slate-400">
                          Garantía {p.warrantyMonths}m
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                          {formatCurrency(p.costPrice)}
                        </td>
                      )}
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        {formatCurrency(p.salePrice)}
                      </td>
                      <td
                        className="py-3 px-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5 border border-slate-200 rounded-lg bg-white px-1.5 py-1">
                          <button
                            type="button"
                            disabled={p.stock <= 0}
                            onClick={() => void onAdjustStock(p, -1)}
                            className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                            aria-label="Restar 1"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center font-mono tabular-nums text-xs font-semibold text-slate-900">
                            {p.stock}
                          </span>
                          <button
                            type="button"
                            onClick={() => void onAdjustStock(p, 1)}
                            className="p-1 text-slate-500 hover:text-slate-900"
                            aria-label="Sumar 1"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`text-xs font-medium ${stockState.color}`}>
                          {stockState.label}
                        </span>
                      </td>
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setLabelProduct(p)}
                            className="p-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Imprimir código de barras y QR"
                          >
                            <Tag className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Editar ficha completa"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => void handleDelete(p)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar producto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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

      {/* Product Detail Drawer */}
      {detailProduct && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/35 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg h-full border-l border-slate-200 overflow-y-auto p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <p className="text-xs font-mono text-slate-500">
                  {detailProduct.sku} · {detailProduct.category}
                </p>
                <h2 className="text-lg font-semibold text-slate-900 mt-1">
                  {detailProduct.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailProduct(null)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-slate-500">Marca / Modelo</p>
                <p className="font-medium text-slate-900 mt-0.5">
                  {detailProduct.brand} {detailProduct.model}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Capacidad / Color</p>
                <p className="font-medium text-slate-900 mt-0.5">
                  {detailProduct.storage} · {detailProduct.color}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Condición / Ubicación</p>
                <p className="font-medium text-slate-900 mt-0.5">
                  {detailProduct.condition} · {detailProduct.location}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Garantía / IMEI</p>
                <p className="font-medium text-slate-900 mt-0.5">
                  {detailProduct.warrantyMonths} meses ·{' '}
                  {detailProduct.imeiRequired ? 'Requiere IMEI' : 'Sin IMEI'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Proveedor</p>
                <p className="font-medium text-slate-900 mt-0.5">{detailProduct.supplier}</p>
              </div>
              <div>
                <p className="text-slate-500">Precio de Venta</p>
                <p className="font-mono font-bold text-slate-900 mt-0.5">
                  {formatCurrency(detailProduct.salePrice)}
                </p>
              </div>
            </div>

            {detailProduct.description && (
              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Especificaciones</p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {detailProduct.description}
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 space-y-4">
              <p className="text-xs font-semibold text-slate-700">
                Identificación Digital (Barras y QR)
              </p>
              <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="min-w-0 flex-1">
                  <BarcodeSvg value={detailProduct.barcode} height={42} />
                </div>
                <QrCodeImg
                  value={detailProduct.qrCodeData || detailProduct.barcode}
                  size={84}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setLabelProduct(detailProduct);
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                <Tag className="w-4 h-4" />
                Imprimir Etiqueta
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = detailProduct;
                  setDetailProduct(null);
                  openEditModal(target);
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                <Edit3 className="w-4 h-4" />
                Editar Producto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editingProduct ? 'Editar Ficha de Producto' : 'Subir Nuevo Producto'}
                </h2>
                <p className="text-xs text-slate-500">
                  Información técnica completa, código de barras y QR automático
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nombre comercial del producto
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ej: iPhone 15 Pro 256GB Titanio Natural"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Categoría
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={form.category}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value as ProductCategory })
                      }
                      className="flex-1 min-w-0 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
                    >
                      {availableCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      {form.category &&
                        !availableCategories.some(
                          (c) => c.toLowerCase() === form.category.toLowerCase()
                        ) && <option value={form.category}>{form.category}</option>}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingCategory((prev) => !prev);
                        setNewCategoryError(null);
                      }}
                      title={
                        addingCategory
                          ? 'Cerrar nueva categoría'
                          : 'Agregar nueva categoría'
                      }
                      aria-label={
                        addingCategory
                          ? 'Cerrar nueva categoría'
                          : 'Agregar nueva categoría'
                      }
                      className={`p-2 rounded-lg border transition-colors shrink-0 cursor-pointer ${
                        addingCategory
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {addingCategory ? (
                        <X className="w-4 h-4" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {addingCategory && (
                    <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          autoFocus
                          maxLength={48}
                          value={newCategoryName}
                          onChange={(e) => {
                            setNewCategoryName(e.target.value);
                            if (newCategoryError) setNewCategoryError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void handleCreateCategory();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setAddingCategory(false);
                              setNewCategoryError(null);
                            }
                          }}
                          placeholder="Ej: Tablets, Fundas, Audio Pro..."
                          className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
                        />
                        <button
                          type="button"
                          disabled={savingCategory}
                          onClick={() => void handleCreateCategory()}
                          className="px-2.5 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-md transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                        >
                          {savingCategory ? '...' : 'Agregar'}
                        </button>
                      </div>
                      {newCategoryError && (
                        <p className="text-[11px] text-red-600">{newCategoryError}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Marca</label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Modelo</label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Capacidad / Var.
                  </label>
                  <input
                    type="text"
                    maxLength={32}
                    value={form.storage}
                    onChange={(e) => setForm({ ...form, storage: e.target.value })}
                    placeholder="256GB / N/A"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Color</label>
                  <input
                    type="text"
                    maxLength={40}
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
              </div>

              {/* Barcode & QR Section */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5">
                    <Barcode className="w-4 h-4 text-blue-700" />
                    Identificación por Código de Barras y QR
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBarcodeCaptureOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Escanear con Teléfono / Cámara
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const code = `750${Math.floor(1000000000 + Math.random() * 8999999999)}`;
                        const qrPrefix = developerSettings.qrCodePrefix || 'TECNOVA';
                        setForm((prev) => ({
                          ...prev,
                          barcode: code,
                          qrCodeData: `${qrPrefix}:SKU=${prev.sku}|BAR=${code}`,
                        }));
                      }}
                      className="text-xs font-medium text-blue-700 hover:underline px-1.5 py-1"
                    >
                      Generar código nuevo
                    </button>
                  </div>
                </div>

                {(() => {
                  const cleanBar = form.barcode.trim().toLowerCase();
                  const duplicateProduct = cleanBar
                    ? products.find(
                        (p) =>
                          p.id !== editingProduct?.id &&
                          p.barcode.trim().toLowerCase() === cleanBar
                      )
                    : undefined;
                  if (!duplicateProduct) return null;
                  return (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
                      <span>
                        Este código ya pertenece a <strong>{duplicateProduct.name}</strong> (Stock:{' '}
                        {duplicateProduct.stock}).
                      </span>
                      <button
                        type="button"
                        onClick={() => openEditModal(duplicateProduct)}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-amber-700 hover:bg-amber-800 text-white rounded-md"
                      >
                        Abrir producto existente
                      </button>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">SKU Interno</label>
                    <input
                      type="text"
                      required
                      maxLength={40}
                      value={form.sku}
                      onChange={(e) => {
                        const sku = sanitizeCode(e.target.value, 40);
                        const qrPrefix = developerSettings.qrCodePrefix || 'TECNOVA';
                        setForm({
                          ...form,
                          sku,
                          qrCodeData: `${qrPrefix}:SKU=${sku}|BAR=${form.barcode}`,
                        });
                      }}
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Código de Barras</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        required
                        maxLength={64}
                        value={form.barcode}
                        onChange={(e) => {
                          const barcode = sanitizeCode(e.target.value, 64);
                          const qrPrefix = developerSettings.qrCodePrefix || 'TECNOVA';
                          setForm({
                            ...form,
                            barcode,
                            qrCodeData: `${qrPrefix}:SKU=${form.sku}|BAR=${barcode}`,
                          });
                        }}
                        className="w-full min-w-0 px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setBarcodeCaptureOpen(true)}
                        title="Escanear código con cámara"
                        aria-label="Escanear código con cámara"
                        className="px-2.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg shrink-0"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Payload QR</label>
                    <input
                      type="text"
                      maxLength={128}
                      value={form.qrCodeData}
                      onChange={(e) => setForm({ ...form, qrCodeData: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {isAdmin && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Costo ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.costPrice}
                      onChange={(e) =>
                        setForm({ ...form, costPrice: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Precio Venta ($)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={form.salePrice}
                    onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Stock Inicial
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Stock Mínimo
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.minStock}
                    onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Garantía (meses)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={form.warrantyMonths}
                    onChange={(e) =>
                      setForm({ ...form, warrantyMonths: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Condición
                  </label>
                  <select
                    value={form.condition}
                    onChange={(e) =>
                      setForm({ ...form, condition: e.target.value as ProductCondition })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    {availableConditions.map((cond) => (
                      <option key={cond} value={cond}>
                        {cond}
                      </option>
                    ))}
                    {form.condition &&
                      !availableConditions.some(
                        (c) => c.toLowerCase() === form.condition.toLowerCase()
                      ) && <option value={form.condition}>{form.condition}</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Ubicación Física
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Proveedor
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={form.supplier}
                    onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>Imagen de Catálogo</span>
                    {form.imageUrl && (
                      <img
                        src={form.imageUrl}
                        alt="Vista previa"
                        className="w-5 h-5 rounded object-cover border border-slate-200 bg-slate-100"
                      />
                    )}
                  </label>
                  <select
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    {catalogImagePresets.map((img) => (
                      <option key={img.id} value={img.url}>
                        {img.label}
                      </option>
                    ))}
                    {form.imageUrl &&
                      !catalogImagePresets.some((img) => img.url === form.imageUrl) && (
                        <option value={form.imageUrl}>
                          Imagen actual del producto
                        </option>
                      )}
                  </select>
                </div>

                <label className="flex items-center gap-2.5 pt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.imeiRequired}
                    onChange={(e) => setForm({ ...form, imeiRequired: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-blue-700"
                  />
                  <span className="text-xs font-medium text-slate-700">
                    Exigir captura de IMEI / Serie al vender (Smartphones)
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Descripción / Notas Técnicas
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-50"
                >
                  {saving
                    ? 'Guardando...'
                    : editingProduct
                      ? 'Guardar Cambios'
                      : 'Publicar en Inventario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import & Export Products Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-3xl my-8 overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-blue-700" />
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Importar y Exportar Productos
                  </h2>
                  <p className="text-xs text-slate-500">
                    Carga masiva desde Excel (.xlsx / .xls), CSV o JSON para agregar o actualizar inventario
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Quick Template & Export Row */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    Plantilla Excel y exportación del catálogo
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Cada especificación (SKU, Código de Barras, Nombre, Marca, Modelo, Categoría, Precio Costo, Precio Venta, Stock, etc.) va en su propia columna.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => downloadProductImportTemplateExcel()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Plantilla Excel (.xlsx)
                  </button>
                  {products.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        exportProductsToJson(products);
                        setInventoryNotice(
                          `Se exportaron ${products.length} productos en formato JSON.`
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Exportar JSON
                    </button>
                  )}
                </div>
              </div>

              {/* File Upload */}
              <div className="space-y-3">
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/json"
                  onChange={handleImportFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => importFileInputRef.current?.click()}
                  className="w-full py-6 px-4 border-2 border-dashed border-slate-300 hover:border-blue-600 rounded-xl bg-slate-50/50 hover:bg-blue-50/30 transition-colors flex flex-col items-center justify-center gap-1.5 text-center"
                >
                  <Upload className="w-6 h-6 text-blue-700" />
                  <span className="text-xs font-semibold text-slate-900">
                    {importFileName
                      ? `Archivo cargado: ${importFileName}`
                      : 'Seleccionar archivo Excel (.xlsx / .xls), CSV o JSON'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Compatible con hojas de Excel (.xlsx), CSV separado por ; o , y JSON
                  </span>
                </button>

                <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={updateExistingOnImport}
                    onChange={(e) => setUpdateExistingOnImport(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-700"
                  />
                  <span className="text-xs text-slate-700">
                    Actualizar productos existentes si coincide el SKU o Código de barras (si se desmarca, solo se agregan nuevos)
                  </span>
                </label>
              </div>

              {importError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}

              {importWarnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1 text-xs text-amber-800">
                  <p className="font-semibold">
                    Avisos durante la lectura ({importWarnings.length}):
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 max-h-24 overflow-y-auto">
                    {importWarnings.slice(0, 10).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {importItems.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">
                      Vista previa ({importItems.length} productos detectados)
                    </span>
                    <span className="text-slate-500">
                      Mostrando {Math.min(importItems.length, 50)} de {importItems.length}
                    </span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                          <th className="py-2 px-3">SKU</th>
                          <th className="py-2 px-3">Producto</th>
                          <th className="py-2 px-3">Categoría</th>
                          <th className="py-2 px-3 text-right">Precio</th>
                          <th className="py-2 px-3 text-center">Stock</th>
                          <th className="py-2 px-3">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importItems.slice(0, 50).map((item, idx) => {
                          const exists =
                            existingSkuSet.has(item.sku.trim().toLowerCase()) ||
                            existingBarcodeSet.has(
                              item.barcode.trim().toLowerCase()
                            );
                          const actionLabel = !exists
                            ? 'Nuevo'
                            : updateExistingOnImport
                              ? 'Actualizar'
                              : 'Omitir';
                          const actionClass = !exists
                            ? 'text-emerald-700'
                            : updateExistingOnImport
                              ? 'text-blue-700'
                              : 'text-slate-400';

                          return (
                            <tr key={`${item.sku}-${idx}`}>
                              <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">
                                {item.sku}
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-900 max-w-[200px] truncate">
                                {item.name}
                              </td>
                              <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                                {item.category}
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                                {formatCurrency(item.salePrice)}
                              </td>
                              <td className="py-2 px-3 text-center font-mono tabular-nums text-slate-700">
                                {item.stock}
                              </td>
                              <td
                                className={`py-2 px-3 font-medium whitespace-nowrap ${actionClass}`}
                              >
                                {actionLabel}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={importItems.length === 0 || importing}
                  onClick={() => void handleConfirmImport()}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-45 rounded-lg"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {importing
                    ? 'Importando...'
                    : `Importar ${importItems.length} Productos`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ProductLabelModal product={labelProduct} onClose={() => setLabelProduct(null)} />

      <BarcodeCaptureModal
        isOpen={barcodeCaptureOpen}
        title="Escanear Código para Inventario"
        subtitle="Apunta la cámara de tu teléfono al código de barras del equipo o caja"
        onDetected={(rawCode) => {
          const cleanBarcode = sanitizeCode(extractCodeToken(rawCode), 64);
          if (!cleanBarcode) return;
          const qrPrefix = developerSettings.qrCodePrefix || 'TECNOVA';
          setForm((prev) => ({
            ...prev,
            barcode: cleanBarcode,
            qrCodeData: `${qrPrefix}:SKU=${prev.sku}|BAR=${cleanBarcode}`,
          }));
        }}
        onClose={() => setBarcodeCaptureOpen(false)}
      />
    </motion.div>
  );
}
