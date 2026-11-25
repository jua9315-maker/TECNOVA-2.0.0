import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Image as ImageIcon,
  Layers,
  Plus,
  RotateCcw,
  Save,
  Smartphone,
  Tag,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  DEFAULT_CATALOG_IMAGE_PRESETS,
  PRODUCT_CATEGORIES,
  PRODUCT_CONDITIONS,
  type CatalogImagePreset,
  type DeveloperSystemSettings,
} from '../types/store';
import {
  saveCustomProductCategories,
  subscribeCustomProductCategories,
} from '../lib/localDb';
import { saveStoreDeveloperSystemSettings } from '../lib/storeOperations';

function readCatalogImageResized(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(
        new Error('Selecciona una imagen válida en formato PNG, JPG, WEBP o SVG.')
      );
      return;
    }

    if (file.type === 'image/svg+xml') {
      if (file.size > 150 * 1024) {
        reject(new Error('El archivo SVG es demasiado pesado (máximo 150 KB).'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('No se pudo leer el archivo SVG.'));
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo SVG.'));
      reader.readAsDataURL(file);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 480;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo procesar la imagen.'));
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      } catch {
        reject(new Error('Error al optimizar la imagen seleccionada.'));
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo cargar la imagen seleccionada.'));
    };
    img.src = objectUrl;
  });
}

function PresetPreview({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className="w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
        <Smartphone className="w-6 h-6" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="w-20 h-20 rounded-xl object-cover border border-slate-200 bg-slate-100 shrink-0"
    />
  );
}

export function CatalogSettingsView({
  developerSettings,
}: {
  developerSettings: DeveloperSystemSettings;
}) {
  const [presets, setPresets] = useState<CatalogImagePreset[]>(
    developerSettings.catalogImagePresets?.length
      ? developerSettings.catalogImagePresets
      : DEFAULT_CATALOG_IMAGE_PRESETS
  );
  const [conditions, setConditions] = useState<string[]>(
    developerSettings.productConditions?.length
      ? developerSettings.productConditions
      : [...PRODUCT_CONDITIONS]
  );
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [newConditionInput, setNewConditionInput] = useState('');

  const [savingPresets, setSavingPresets] = useState(false);
  const [savingCategories, setSavingCategories] = useState(false);
  const [savingConditions, setSavingConditions] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setPresets(
      developerSettings.catalogImagePresets?.length
        ? developerSettings.catalogImagePresets.map((p) => ({ ...p }))
        : DEFAULT_CATALOG_IMAGE_PRESETS.map((p) => ({ ...p }))
    );
    setConditions(
      developerSettings.productConditions?.length
        ? [...developerSettings.productConditions]
        : [...PRODUCT_CONDITIONS]
    );
  }, [developerSettings]);

  useEffect(() => {
    return subscribeCustomProductCategories(setCustomCategories);
  }, []);

  const showSuccess = (msg: string) => {
    setErrorMsg(null);
    setNotice(msg);
  };

  const updatePreset = (
    id: string,
    patch: Partial<Pick<CatalogImagePreset, 'label' | 'url'>>
  ) => {
    setPresets((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
    setNotice(null);
  };

  const movePreset = (index: number, delta: -1 | 1) => {
    const nextIdx = index + delta;
    if (nextIdx < 0 || nextIdx >= presets.length) return;
    setPresets((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(nextIdx, 0, moved);
      return copy;
    });
    setNotice(null);
  };

  const addPreset = () => {
    const newId = `preset_${Date.now().toString(36)}`;
    setPresets((prev) => [
      ...prev,
      {
        id: newId,
        label: `Imagen ${prev.length + 1}`,
        url: DEFAULT_CATALOG_IMAGE_PRESETS[0].url,
      },
    ]);
    setNotice(null);
  };

  const removePreset = (id: string) => {
    if (presets.length <= 1) {
      setErrorMsg('Debe existir al menos 1 opción de imagen de catálogo.');
      return;
    }
    setPresets((prev) => prev.filter((p) => p.id !== id));
    setNotice(null);
    setErrorMsg(null);
  };

  const handleUploadPresetImage = async (
    id: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await readCatalogImageResized(file);
      updatePreset(id, { url: dataUrl });
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar la imagen seleccionada.'
      );
    }
  };

  const handleSavePresets = async () => {
    const cleaned = presets
      .map((p, idx) => ({
        id: p.id || `preset_${idx + 1}`,
        label: p.label.trim(),
        url: p.url.trim(),
      }))
      .filter((p) => p.label && p.url);

    if (cleaned.length === 0) {
      setErrorMsg(
        'Completa al menos una opción con nombre y URL/imagen válida.'
      );
      return;
    }

    setSavingPresets(true);
    setErrorMsg(null);
    try {
      await saveStoreDeveloperSystemSettings({
        ...developerSettings,
        catalogImagePresets: cleaned,
      });
      showSuccess(
        'Opciones de Imagen de Catálogo actualizadas. Ya están activas al crear o editar productos.'
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudieron guardar las imágenes de catálogo.'
      );
    } finally {
      setSavingPresets(false);
    }
  };

  const handleRestoreDefaultPresets = async () => {
    const defaults = DEFAULT_CATALOG_IMAGE_PRESETS.map((p) => ({ ...p }));
    setPresets(defaults);
    setSavingPresets(true);
    try {
      await saveStoreDeveloperSystemSettings({
        ...developerSettings,
        catalogImagePresets: defaults,
      });
      showSuccess('Imágenes de catálogo restauradas a los valores de fábrica.');
    } finally {
      setSavingPresets(false);
    }
  };

  const handleAddCustomCategory = async () => {
    const trimmed = newCategoryInput.trim().slice(0, 48);
    if (!trimmed) return;
    const allExisting = [...PRODUCT_CATEGORIES, ...customCategories];
    if (allExisting.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(`La categoría "${trimmed}" ya existe.`);
      return;
    }
    setSavingCategories(true);
    try {
      const next = await saveCustomProductCategories([
        ...customCategories,
        trimmed,
      ]);
      setCustomCategories(next);
      setNewCategoryInput('');
      showSuccess(`Categoría "${trimmed}" agregada al inventario y POS.`);
    } finally {
      setSavingCategories(false);
    }
  };

  const handleRenameCustomCategory = (index: number, value: string) => {
    setCustomCategories((prev) =>
      prev.map((c, idx) => (idx === index ? value : c))
    );
    setNotice(null);
  };

  const handleRemoveCustomCategory = async (index: number) => {
    setSavingCategories(true);
    try {
      const next = await saveCustomProductCategories(
        customCategories.filter((_, idx) => idx !== index)
      );
      setCustomCategories(next);
      showSuccess('Categoría personalizada eliminada de la lista.');
    } finally {
      setSavingCategories(false);
    }
  };

  const handleSaveCustomCategories = async () => {
    setSavingCategories(true);
    try {
      const next = await saveCustomProductCategories(customCategories);
      setCustomCategories(next);
      showSuccess('Lista de categorías personalizadas guardada.');
    } finally {
      setSavingCategories(false);
    }
  };

  const handleAddCondition = () => {
    const trimmed = newConditionInput.trim().slice(0, 40);
    if (!trimmed) return;
    if (conditions.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(`La condición "${trimmed}" ya está en la lista.`);
      return;
    }
    setConditions((prev) => [...prev, trimmed]);
    setNewConditionInput('');
    setNotice(null);
    setErrorMsg(null);
  };

  const handleUpdateCondition = (index: number, value: string) => {
    setConditions((prev) => prev.map((c, i) => (i === index ? value : c)));
    setNotice(null);
  };

  const handleRemoveCondition = (index: number) => {
    if (conditions.length <= 1) {
      setErrorMsg('Debe existir al menos una condición de producto.');
      return;
    }
    setConditions((prev) => prev.filter((_, i) => i !== index));
    setNotice(null);
  };

  const handleSaveConditions = async () => {
    const cleaned = conditions.map((c) => c.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      setErrorMsg('Agrega al menos una condición válida.');
      return;
    }
    setSavingConditions(true);
    setErrorMsg(null);
    try {
      await saveStoreDeveloperSystemSettings({
        ...developerSettings,
        productConditions: cleaned,
      });
      showSuccess('Condiciones de producto guardadas correctamente.');
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudieron guardar las condiciones.'
      );
    } finally {
      setSavingConditions(false);
    }
  };

  const handleRestoreConditions = async () => {
    const defaults = [...PRODUCT_CONDITIONS];
    setConditions(defaults);
    setSavingConditions(true);
    try {
      await saveStoreDeveloperSystemSettings({
        ...developerSettings,
        productConditions: defaults,
      });
      showSuccess('Condiciones restauradas a los valores de fábrica.');
    } finally {
      setSavingConditions(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-2.5 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Catalog Image Presets Editor */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-blue-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Opciones de &quot;Imagen de Catálogo&quot; (Cada Elemento Editable)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Edita el nombre, cambia la fotografía o URL, reordena o agrega nuevas opciones para el selector de Imagen de Catálogo al registrar productos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={addPreset}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar Opción
            </button>
            <button
              type="button"
              onClick={() => void handleRestoreDefaultPresets()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar
            </button>
            <button
              type="button"
              disabled={savingPresets}
              onClick={() => void handleSavePresets()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 rounded-lg cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {savingPresets ? 'Guardando...' : 'Guardar Imágenes'}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {presets.map((preset, idx) => (
            <div
              key={preset.id}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center gap-4"
            >
              <PresetPreview src={preset.url} alt={preset.label} />

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Nombre visible en el selector #{idx + 1}
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={preset.label}
                    onChange={(e) =>
                      updatePreset(preset.id, { label: e.target.value })
                    }
                    placeholder="Ej: Smartphone Titanio"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    URL de imagen o archivo local subido
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={
                        preset.url.startsWith('data:image/')
                          ? '(Imagen local optimizada)'
                          : preset.url
                      }
                      readOnly={preset.url.startsWith('data:image/')}
                      onChange={(e) =>
                        updatePreset(preset.id, { url: e.target.value })
                      }
                      placeholder="/src/assets/... o https://..."
                      className="flex-1 min-w-0 px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                    <input
                      ref={(el) => {
                        fileInputRefs.current[preset.id] = el;
                      }}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(e) => void handleUploadPresetImage(preset.id, e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[preset.id]?.click()}
                      className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg shrink-0 cursor-pointer"
                      title="Subir fotografía desde el equipo"
                    >
                      <Upload className="w-3.5 h-3.5 text-blue-700" />
                      Subir
                    </button>
                    {preset.url.startsWith('data:image/') && (
                      <button
                        type="button"
                        onClick={() =>
                          updatePreset(preset.id, {
                            url: DEFAULT_CATALOG_IMAGE_PRESETS[0].url,
                          })
                        }
                        className="px-2 py-2 text-[11px] text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg shrink-0 cursor-pointer"
                        title="Cambiar a ruta/URL de texto"
                      >
                        URL
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => movePreset(idx, -1)}
                  className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-35 cursor-pointer"
                  title="Subir orden"
                >
                  <ArrowUp className="w-3.5 h-3.5 text-slate-700" />
                </button>
                <button
                  type="button"
                  disabled={idx === presets.length - 1}
                  onClick={() => movePreset(idx, 1)}
                  className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-35 cursor-pointer"
                  title="Bajar orden"
                >
                  <ArrowDown className="w-3.5 h-3.5 text-slate-700" />
                </button>
                <button
                  type="button"
                  onClick={() => removePreset(preset.id)}
                  className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-rose-50 text-rose-600 cursor-pointer"
                  title="Eliminar opción"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Categories & Conditions Editors */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Categories Manager */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-700" />
              <h3 className="text-sm font-semibold text-slate-900">
                Categorías del Inventario
              </h3>
            </div>
            {customCategories.length > 0 && (
              <button
                type="button"
                disabled={savingCategories}
                onClick={() => void handleSaveCustomCategories()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Guardar Nombres
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              maxLength={48}
              value={newCategoryInput}
              onChange={(e) => setNewCategoryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAddCustomCategory();
                }
              }}
              placeholder="Nueva categoría (Ej: Tablets, Smartwatches)..."
              className="flex-1 min-w-0 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
            <button
              type="button"
              disabled={savingCategories}
              onClick={() => void handleAddCustomCategory()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-medium text-slate-500">
              Categorías base del sistema
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRODUCT_CATEGORIES.map((cat) => (
                <span
                  key={cat}
                  className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-md border border-slate-200"
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <p className="text-[11px] font-medium text-slate-500">
              Categorías personalizadas ({customCategories.length})
            </p>
            {customCategories.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                Aún no has agregado categorías personalizadas.
              </p>
            ) : (
              <div className="space-y-2">
                {customCategories.map((cat, idx) => (
                  <div
                    key={`${idx}-${cat}`}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      maxLength={48}
                      value={cat}
                      onChange={(e) =>
                        handleRenameCustomCategory(idx, e.target.value)
                      }
                      className="flex-1 min-w-0 px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => void handleRemoveCustomCategory(idx)}
                      className="p-1.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title="Eliminar categoría"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Product Conditions Manager */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-700" />
              <h3 className="text-sm font-semibold text-slate-900">
                Opciones de &quot;Condición&quot; del Producto
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleRestoreConditions()}
                className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Restaurar
              </button>
              <button
                type="button"
                disabled={savingConditions}
                onClick={() => void handleSaveConditions()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {savingConditions ? 'Guardando...' : 'Guardar Condiciones'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              maxLength={40}
              value={newConditionInput}
              onChange={(e) => setNewConditionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCondition();
                }
              }}
              placeholder="Ej: Reacondicionado, Exhibición, Open Box..."
              className="flex-1 min-w-0 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
            <button
              type="button"
              onClick={handleAddCondition}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar
            </button>
          </div>

          <div className="space-y-2">
            {conditions.map((cond, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400 w-5 text-center shrink-0">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  maxLength={40}
                  value={cond}
                  onChange={(e) => handleUpdateCondition(idx, e.target.value)}
                  className="flex-1 min-w-0 px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveCondition(idx)}
                  className="p-1.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                  title="Eliminar condición"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
