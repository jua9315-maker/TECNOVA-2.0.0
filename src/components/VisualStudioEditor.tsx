import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CornerLeftUp,
  Eye,
  EyeOff,
  Hand,
  GripVertical,
  MousePointerClick,
  Move,
  Palette,
  RotateCcw,
  Save,
  Sliders,
  Trash2,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import {
  DEFAULT_VISUAL_CUSTOMIZATION_SETTINGS,
  type NavTab,
  type VisualCustomizationSettings,
  type VisualElementPatch,
} from '../types/store';

const MODULE_OPTIONS: { id: NavTab; defaultLabel: string }[] = [
  { id: 'dashboard', defaultLabel: 'Panel Principal' },
  { id: 'inventory', defaultLabel: 'Inventario y QR' },
  { id: 'pos', defaultLabel: 'Punto de Venta' },
  { id: 'sales', defaultLabel: 'Ventas Realizadas' },
  { id: 'warranties', defaultLabel: 'Garantías' },
  { id: 'repairs', defaultLabel: 'Reparaciones' },
  { id: 'reports', defaultLabel: 'Reportes Diarios' },
  { id: 'team', defaultLabel: 'Equipo y Roles' },
  { id: 'settings', defaultLabel: 'Opciones' },
];

function findPrimaryTextNode(el: HTMLElement): Text | null {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && (node.nodeValue || '').trim().length > 0) {
      return node as Text;
    }
  }
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node.nodeValue || '').trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || parent.closest('svg')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const first = walker.nextNode();
  return (first as Text) || null;
}

function resolveEditableTarget(rawTarget: EventTarget | null): HTMLElement | null {
  if (!(rawTarget instanceof HTMLElement || rawTarget instanceof SVGElement)) {
    return null;
  }
  const htmlEl =
    rawTarget instanceof HTMLElement
      ? rawTarget
      : (rawTarget.closest('button, a, div, span, p, h1, h2, h3, label') as HTMLElement | null);
  if (!htmlEl) return null;
  if (htmlEl.closest('[data-visual-editor-ui="true"]')) return null;

  const interactive = htmlEl.closest('button, a, label, th, td, h1, h2, h3, h4, p');
  if (
    interactive instanceof HTMLElement &&
    interactive.closest('[data-visual-scope]') &&
    !interactive.closest('[data-visual-editor-ui="true"]')
  ) {
    return interactive;
  }
  return htmlEl.closest('[data-visual-scope]') ? htmlEl : null;
}

function computeScopeSelector(
  target: HTMLElement,
  scopeRoot: HTMLElement
): string | null {
  if (target === scopeRoot) return null;
  if (target.dataset.navTab) {
    return `[data-nav-tab="${target.dataset.navTab}"]`;
  }

  const parts: string[] = [];
  let current: HTMLElement | null = target;

  while (current && current !== scopeRoot) {
    if (current.dataset.navTab) {
      parts.unshift(`[data-nav-tab="${current.dataset.navTab}"]`);
      break;
    }

    const parent: HTMLElement | null = current.parentElement;
    if (!parent) break;

    const tag = current.tagName.toLowerCase();
    const sameTagSiblings = Array.from(parent.children).filter(
      (child) => child.tagName.toLowerCase() === tag
    );
    const index = sameTagSiblings.indexOf(current) + 1;
    parts.unshift(`${tag}:nth-of-type(${Math.max(1, index)})`);
    current = parent;
  }

  if (parts.length === 0) return null;
  return parts.join(' > ');
}

function describeElement(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const labelMap: Record<string, string> = {
    button: 'Botón',
    a: 'Enlace',
    h1: 'Título Principal',
    h2: 'Subtítulo',
    h3: 'Encabezado',
    p: 'Texto',
    span: 'Etiqueta',
    label: 'Campo / Etiqueta',
    div: 'Bloque / Tarjeta',
    section: 'Sección',
    input: 'Campo de Entrada',
    select: 'Selector',
    th: 'Columna de Tabla',
    td: 'Celda',
  };
  return labelMap[tag] || tag.toUpperCase();
}

function restoreElementStyles(el: HTMLElement): void {
  if (el.dataset.ncOrigText !== undefined) {
    const textNode = findPrimaryTextNode(el);
    if (textNode) {
      textNode.nodeValue = el.dataset.ncOrigText;
    }
    delete el.dataset.ncOrigText;
  }
  el.style.translate = '';
  el.style.order = '';
  el.style.fontSize = '';
  el.style.width = '';
  el.style.height = '';
  el.style.scale = '';
  el.style.color = '';
  el.style.backgroundColor = '';
  el.style.display = '';
  el.style.opacity = '';
  el.style.outline = '';
  delete el.dataset.ncPatchedId;
}

export function applyVisualPatchesToDom(
  settings: VisualCustomizationSettings,
  isEditMode: boolean
): void {
  const patches = settings.patches || {};
  const activePatchIds = new Set(Object.keys(patches));

  // Restore any elements whose patch was removed
  const previouslyPatched = document.querySelectorAll<HTMLElement>('[data-nc-patched-id]');
  previouslyPatched.forEach((el) => {
    const pid = el.dataset.ncPatchedId;
    if (!pid || !activePatchIds.has(pid)) {
      restoreElementStyles(el);
    }
  });

  // Apply all active patches whose scope is currently mounted
  for (const patch of Object.values(patches)) {
    const scopeRoot = document.querySelector<HTMLElement>(
      `[data-visual-scope="${patch.scope}"]`
    );
    if (!scopeRoot) continue;

    let target: HTMLElement | null = null;
    try {
      target = scopeRoot.querySelector<HTMLElement>(patch.selector);
    } catch {
      target = null;
    }
    if (!target) continue;

    target.dataset.ncPatchedId = patch.id;

    // Text override (only touches text node, preserving SVG icons)
    if (patch.customText !== undefined) {
      const textNode = findPrimaryTextNode(target);
      if (textNode) {
        if (target.dataset.ncOrigText === undefined) {
          target.dataset.ncOrigText = textNode.nodeValue || '';
        }
        const orig = target.dataset.ncOrigText;
        const leadingSpace = /^\s+/.test(orig) ? ' ' : '';
        const trailingSpace = /\s+$/.test(orig) ? ' ' : '';
        textNode.nodeValue = `${leadingSpace}${patch.customText}${trailingSpace}`;
      }
    } else if (target.dataset.ncOrigText !== undefined) {
      const textNode = findPrimaryTextNode(target);
      if (textNode) textNode.nodeValue = target.dataset.ncOrigText;
      delete target.dataset.ncOrigText;
    }

    // Offset X/Y via individual CSS translate property (safe with Tailwind/Motion transforms)
    const ox = patch.offsetX || 0;
    const oy = patch.offsetY || 0;
    target.style.translate = ox !== 0 || oy !== 0 ? `${ox}px ${oy}px` : '';

    // Flex / Grid Order
    target.style.order =
      typeof patch.orderOffset === 'number' ? String(patch.orderOffset) : '';

    // Font size & colors
    target.style.fontSize =
      typeof patch.fontSizePx === 'number' && patch.fontSizePx > 0
        ? `${patch.fontSizePx}px`
        : '';
    target.style.width =
      typeof patch.widthPx === 'number' && patch.widthPx > 0
        ? `${patch.widthPx}px`
        : '';
    target.style.height =
      typeof patch.heightPx === 'number' && patch.heightPx > 0
        ? `${patch.heightPx}px`
        : '';
    target.style.scale =
      typeof patch.scalePercent === 'number' && patch.scalePercent > 0
        ? String(patch.scalePercent / 100)
        : '';
    target.style.color = patch.textColor || '';
    target.style.backgroundColor = patch.bgColor || '';

    // Visibility
    if (patch.hidden) {
      if (isEditMode) {
        target.style.display = '';
        target.style.opacity = '0.32';
        target.style.outline = '1px dashed #f43f5e';
      } else {
        target.style.display = 'none';
        target.style.opacity = '';
        target.style.outline = '';
      }
    } else {
      target.style.display = '';
      target.style.opacity = '';
      target.style.outline = '';
    }
  }
}

export function VisualPatchApplier({
  settings,
  isEditMode,
}: {
  settings: VisualCustomizationSettings;
  isEditMode: boolean;
}) {
  useEffect(() => {
    let rafId: number | null = null;
    const scheduleApply = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        applyVisualPatchesToDom(settings, isEditMode);
      });
    };

    scheduleApply();

    const shellEl = document.getElementById('app-shell') || document.body;
    const observer = new MutationObserver(() => {
      scheduleApply();
    });
    observer.observe(shellEl, {
      childList: true,
      subtree: true,
    });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [settings, isEditMode]);

  return null;
}

interface SelectedElementState {
  patchId: string;
  scope: string;
  selector: string;
  element: HTMLElement;
  rect: DOMRect;
  kindLabel: string;
  originalText: string;
  hasEditableText: boolean;
  canReorderSiblings: boolean;
  navTabId?: NavTab;
}

export function VisualStudioEditor({
  isOpen,
  activeTab,
  settings,
  onNavigateTab,
  onSaveSettings,
  onClose,
}: {
  isOpen: boolean;
  activeTab: NavTab;
  settings: VisualCustomizationSettings;
  onNavigateTab: (tab: NavTab) => void;
  onSaveSettings: (next: VisualCustomizationSettings) => Promise<unknown>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<VisualCustomizationSettings>(settings);
  const [historyStack, setHistoryStack] = useState<VisualCustomizationSettings[]>([]);
  const [interactionMode, setInteractionMode] = useState<'edit' | 'navigate'>('edit');
  const [selected, setSelected] = useState<SelectedElementState | null>(null);
  const [hoverRect, setHoverRect] = useState<{ rect: DOMRect; label: string } | null>(null);
  const [showNavPanel, setShowNavPanel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [inspectorPosition, setInspectorPosition] = useState<{ x: number; y: number } | null>(null);
  const initialSettingsRef = useRef<VisualCustomizationSettings>(settings);
  const inspectorRef = useRef<HTMLDivElement | null>(null);

  const inspectorDragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    origOffsetX: number;
    origOffsetY: number;
    targetEl: HTMLElement;
    patchId: string;
    scope: string;
    selector: string;
    kindLabel: string;
  } | null>(null);

  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    if (isOpen) {
      initialSettingsRef.current = JSON.parse(
        JSON.stringify(settings)
      ) as VisualCustomizationSettings;
      setInspectorPosition(null);
    }
  }, [isOpen]);

  // Keep selected element rect synced on scroll / resize / DOM edits
  const refreshSelectedRect = useCallback(() => {
    setSelected((prev) => {
      if (!prev || !document.contains(prev.element)) return null;
      return {
        ...prev,
        rect: prev.element.getBoundingClientRect(),
      };
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSelected(null);
      setHoverRect(null);
      return;
    }
    window.addEventListener('scroll', refreshSelectedRect, true);
    window.addEventListener('resize', refreshSelectedRect);
    return () => {
      window.removeEventListener('scroll', refreshSelectedRect, true);
      window.removeEventListener('resize', refreshSelectedRect);
    };
  }, [isOpen, refreshSelectedRect]);

  const commitDraft = useCallback(
    async (next: VisualCustomizationSettings, recordHistory = true) => {
      if (recordHistory) {
        setHistoryStack((prev) => [...prev.slice(-19), draftRef.current]);
      }
      draftRef.current = next;
      setDraft(next);
      applyVisualPatchesToDom(next, true);
      setSaving(true);
      try {
        await onSaveSettings(next);
      } finally {
        setSaving(false);
      }
    },
    [onSaveSettings]
  );

  const selectDomElement = useCallback((el: HTMLElement) => {
    const scopeEl = el.closest<HTMLElement>('[data-visual-scope]');
    if (!scopeEl) return;
    const scope = scopeEl.dataset.visualScope || 'dashboard';
    const selector = computeScopeSelector(el, scopeEl);
    if (!selector) return;

    const patchId = `${scope}::${selector}`;
    const textNode = findPrimaryTextNode(el);
    const origText =
      el.dataset.ncOrigText !== undefined
        ? el.dataset.ncOrigText
        : textNode?.nodeValue?.trim() || '';

    const parent = el.parentElement;
    const canReorderSiblings = Boolean(
      parent && parent.children.length >= 2 && parent !== scopeEl
    );

    const navTabId = el.dataset.navTab as NavTab | undefined;

    setSelected({
      patchId,
      scope,
      selector,
      element: el,
      rect: el.getBoundingClientRect(),
      kindLabel: describeElement(el),
      originalText: origText.trim(),
      hasEditableText: Boolean(textNode),
      canReorderSiblings,
      navTabId,
    });
  }, []);

  // Capture pointer events in Edit Mode
  useEffect(() => {
    if (!isOpen || interactionMode !== 'edit') {
      setHoverRect(null);
      return;
    }

    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (drag && drag.active) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          drag.moved = true;
        }
        if (drag.moved) {
          const nextX = Math.round(drag.origOffsetX + dx);
          const nextY = Math.round(drag.origOffsetY + dy);
          drag.targetEl.style.translate = `${nextX}px ${nextY}px`;
          setSelected((prev) =>
            prev
              ? { ...prev, rect: drag.targetEl.getBoundingClientRect() }
              : null
          );
        }
        return;
      }

      const candidate = resolveEditableTarget(e.target);
      if (!candidate) {
        setHoverRect(null);
        return;
      }
      setHoverRect({
        rect: candidate.getBoundingClientRect(),
        label: describeElement(candidate),
      });
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const raw = e.target as HTMLElement | null;
      if (raw?.closest('[data-visual-editor-ui="true"]')) return;

      const candidate = resolveEditableTarget(e.target);
      if (!candidate) return;

      e.preventDefault();
      e.stopPropagation();

      const scopeEl = candidate.closest<HTMLElement>('[data-visual-scope]');
      if (!scopeEl) return;
      const scope = scopeEl.dataset.visualScope || activeTab;
      const selector = computeScopeSelector(candidate, scopeEl);
      if (!selector) return;

      const patchId = `${scope}::${selector}`;
      const existingPatch = draftRef.current.patches[patchId];

      selectDomElement(candidate);

      dragRef.current = {
        active: true,
        moved: false,
        startX: e.clientX,
        startY: e.clientY,
        origOffsetX: existingPatch?.offsetX || 0,
        origOffsetY: existingPatch?.offsetY || 0,
        targetEl: candidate,
        patchId,
        scope,
        selector,
        kindLabel: describeElement(candidate),
      };
    };

    const handlePointerUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !drag.active) return;
      dragRef.current = null;

      if (drag.moved) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        const nextX = Math.round(drag.origOffsetX + dx);
        const nextY = Math.round(drag.origOffsetY + dy);

        const prevPatches = draftRef.current.patches;
        const existing = prevPatches[drag.patchId];
        const updatedPatch: VisualElementPatch = {
          ...(existing || {
            id: drag.patchId,
            scope: drag.scope,
            selector: drag.selector,
            label: drag.kindLabel,
          }),
          offsetX: nextX,
          offsetY: nextY,
        };

        void commitDraft({
          ...draftRef.current,
          patches: {
            ...prevPatches,
            [drag.patchId]: updatedPatch,
          },
        });
      }
    };

    const handleClickCapture = (e: MouseEvent) => {
      const raw = e.target as HTMLElement | null;
      if (raw?.closest('[data-visual-editor-ui="true"]')) return;
      if (raw?.closest('[data-visual-scope]')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('pointermove', handlePointerMove, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointerup', handlePointerUp, true);
    document.addEventListener('click', handleClickCapture, true);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('pointerup', handlePointerUp, true);
      document.removeEventListener('click', handleClickCapture, true);
    };
  }, [isOpen, interactionMode, activeTab, selectDomElement, commitDraft]);

  if (!isOpen) return null;

  const currentPatch: VisualElementPatch | undefined = selected
    ? draft.patches[selected.patchId]
    : undefined;

  const updateSelectedPatch = (
    changes: Partial<VisualElementPatch>,
    recordHistory = true,
    extraNavLabel?: { tabId: NavTab; label: string }
  ) => {
    if (!selected) return;
    const currentDraft = draftRef.current;
    const base: VisualElementPatch = currentDraft.patches[selected.patchId] || {
      id: selected.patchId,
      scope: selected.scope,
      selector: selected.selector,
      label: selected.kindLabel,
    };
    const merged: VisualElementPatch = { ...base, ...changes };

    const nextNavLabels = { ...(currentDraft.navLabels || {}) };
    if (extraNavLabel) {
      if (extraNavLabel.label.trim()) {
        nextNavLabels[extraNavLabel.tabId] = extraNavLabel.label;
      } else {
        delete nextNavLabels[extraNavLabel.tabId];
      }
    }

    void commitDraft(
      {
        ...currentDraft,
        navLabels: nextNavLabels,
        patches: {
          ...currentDraft.patches,
          [selected.patchId]: merged,
        },
      },
      recordHistory
    );
    window.setTimeout(refreshSelectedRect, 20);
  };

  const resetSelectedElement = () => {
    if (!selected) return;
    const currentDraft = draftRef.current;
    const nextPatches = { ...currentDraft.patches };
    delete nextPatches[selected.patchId];
    restoreElementStyles(selected.element);
    void commitDraft({
      ...currentDraft,
      patches: nextPatches,
    });
    window.setTimeout(refreshSelectedRect, 20);
  };

  const reorderSelectedSibling = (direction: -1 | 1) => {
    if (!selected) return;
    const parent = selected.element.parentElement;
    const scopeEl = selected.element.closest<HTMLElement>('[data-visual-scope]');
    if (!parent || !scopeEl) return;

    const children = Array.from(parent.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement
    );
    if (children.length < 2) return;

    const currentDraft = draftRef.current;

    // Sort children by effective visual order (existing orderOffset or DOM index)
    const ordered = children
      .map((child, idx) => {
        const sel = computeScopeSelector(child, scopeEl);
        const pid = sel ? `${selected.scope}::${sel}` : '';
        const existingOrder =
          pid && typeof currentDraft.patches[pid]?.orderOffset === 'number'
            ? (currentDraft.patches[pid].orderOffset as number)
            : idx * 10;
        return { child, idx, sel, pid, sortVal: existingOrder };
      })
      .sort((a, b) => a.sortVal - b.sortVal || a.idx - b.idx);

    const pos = ordered.findIndex((item) => item.child === selected.element);
    if (pos < 0) return;
    const targetPos = pos + direction;
    if (targetPos < 0 || targetPos >= ordered.length) return;

    const swapped = [...ordered];
    const [moved] = swapped.splice(pos, 1);
    swapped.splice(targetPos, 0, moved);

    const nextPatches = { ...currentDraft.patches };
    swapped.forEach((item, rank) => {
      if (!item.sel || !item.pid) return;
      const prev = nextPatches[item.pid] || {
        id: item.pid,
        scope: selected.scope,
        selector: item.sel,
        label: describeElement(item.child),
      };
      nextPatches[item.pid] = {
        ...prev,
        orderOffset: (rank + 1) * 10,
      };
    });

    void commitDraft({
      ...currentDraft,
      patches: nextPatches,
    });
    window.setTimeout(refreshSelectedRect, 30);
  };

  const moveNavModule = (tabId: NavTab, delta: -1 | 1) => {
    const currentDraft = draftRef.current;
    const order = [
      ...(currentDraft.navOrder || DEFAULT_VISUAL_CUSTOMIZATION_SETTINGS.navOrder),
    ];
    const idx = order.indexOf(tabId);
    if (idx < 0) return;
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= order.length) return;
    const [item] = order.splice(idx, 1);
    order.splice(nextIdx, 0, item);
    void commitDraft({
      ...currentDraft,
      navOrder: order,
    });
  };

  const updateNavLabel = (tabId: NavTab, label: string) => {
    const currentDraft = draftRef.current;
    const nextLabels = { ...(currentDraft.navLabels || {}) };
    if (label.trim()) {
      nextLabels[tabId] = label;
    } else {
      delete nextLabels[tabId];
    }
    void commitDraft({
      ...currentDraft,
      navLabels: nextLabels,
    });
  };

  const handleResetCurrentModule = () => {
    const currentDraft = draftRef.current;
    const nextPatches: Record<string, VisualElementPatch> = {};
    for (const [k, v] of Object.entries(currentDraft.patches)) {
      if (v.scope !== activeTab) {
        nextPatches[k] = v;
      }
    }
    setSelected(null);
    void commitDraft({
      ...currentDraft,
      patches: nextPatches,
    });
    setStatusMsg('Módulo restaurado a su diseño original.');
    window.setTimeout(() => setStatusMsg(null), 2500);
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const prev = historyStack[historyStack.length - 1];
    setHistoryStack((s) => s.slice(0, -1));
    void commitDraft(prev, false);
    window.setTimeout(refreshSelectedRect, 20);
  };

  const handleCancel = async () => {
    const original = initialSettingsRef.current;
    draftRef.current = original;
    setDraft(original);
    setSelected(null);
    setHoverRect(null);
    setHistoryStack([]);
    setInspectorPosition(null);
    applyVisualPatchesToDom(original, false);
    setSaving(true);
    try {
      await onSaveSettings(original);
    } finally {
      setSaving(false);
      onClose();
    }
  };

  const modulePatchCount = Object.values(draft.patches).filter(
    (p) => p.scope === activeTab
  ).length;

  return createPortal(
    <>
      {/* Hover Highlight Box */}
      {interactionMode === 'edit' && hoverRect && (
        <div
          data-visual-editor-ui="true"
          className="fixed z-[70] pointer-events-none border-2 border-dashed border-cyan-400 rounded-md"
          style={{
            top: hoverRect.rect.top - 2,
            left: hoverRect.rect.left - 2,
            width: hoverRect.rect.width + 4,
            height: hoverRect.rect.height + 4,
          }}
        >
          <span className="absolute -top-5 left-0 px-1.5 py-0.5 text-[10px] font-semibold bg-cyan-500 text-slate-950 rounded-xs whitespace-nowrap">
            {hoverRect.label} · Clic o arrastra
          </span>
        </div>
      )}

      {/* Selected Element Outline */}
      {selected && (
        <div
          data-visual-editor-ui="true"
          className="fixed z-[71] pointer-events-none border-2 border-fuchsia-500 rounded-md shadow-[0_0_0_2px_rgba(217,70,239,0.25)]"
          style={{
            top: selected.rect.top - 3,
            left: selected.rect.left - 3,
            width: selected.rect.width + 6,
            height: selected.rect.height + 6,
          }}
        />
      )}

      {/* Top Floating Developer Studio Bar */}
      <div
        data-visual-editor-ui="true"
        className="fixed top-3 left-1/2 -translate-x-1/2 z-[80] w-[96vw] max-w-5xl rounded-2xl bg-slate-950 text-white border border-cyan-500/40 shadow-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center text-slate-950 shrink-0">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold tracking-tight text-white">
              Editor Visual Sin Código
            </p>
            <p className="text-[11px] text-cyan-300">
              {saving
                ? 'Guardando cambios...'
                : statusMsg ||
                  (selected
                    ? `${selected.kindLabel} seleccionado`
                    : 'Haz clic en un texto, botón o tarjeta para mostrar sus opciones')}
            </p>
          </div>
        </div>

        {/* Mode Switcher: Edit vs Navigate */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/10">
          <button
            type="button"
            onClick={() => setInteractionMode('edit')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              interactionMode === 'edit'
                ? 'bg-cyan-400 text-slate-950 font-semibold'
                : 'text-slate-200 hover:text-white'
            }`}
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            Seleccionar y Mover
          </button>
          <button
            type="button"
            onClick={() => {
              setInteractionMode('navigate');
              setSelected(null);
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              interactionMode === 'navigate'
                ? 'bg-amber-400 text-slate-950 font-semibold'
                : 'text-slate-200 hover:text-white'
            }`}
          >
            <Hand className="w-3.5 h-3.5" />
            Navegar / Abrir Vistas
          </button>
        </div>

        {/* Module Quick Switcher + Tools */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={activeTab}
            onChange={(e) => {
              setSelected(null);
              onNavigateTab(e.target.value as NavTab);
            }}
            aria-label="Cambiar de módulo"
            className="px-2.5 py-1.5 text-xs font-medium bg-white/10 border border-white/15 rounded-lg text-white focus:outline-none cursor-pointer"
          >
            {MODULE_OPTIONS.map((m) => (
              <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                Módulo: {draft.navLabels?.[m.id] || m.defaultLabel}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowNavPanel((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
              showNavPanel
                ? 'bg-fuchsia-500/25 border-fuchsia-400 text-fuchsia-200'
                : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10'
            }`}
          >
            Ordenar Menú
          </button>

          <button
            type="button"
            disabled={historyStack.length === 0}
            onClick={handleUndo}
            title="Deshacer último cambio"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 disabled:opacity-35 cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleResetCurrentModule}
            title="Restaurar este módulo"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Módulo
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 whitespace-nowrap cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Listo
          </button>
          <button
            type="button"
            onClick={() => void handleCancel()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/25 hover:bg-rose-500/35 border border-rose-400/40 text-rose-200 whitespace-nowrap cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Cancelar
          </button>
        </div>
      </div>

      {/* Floating Sidebar Module Order & Rename Panel */}
      {showNavPanel && (
        <div
          data-visual-editor-ui="true"
          className="fixed top-20 left-4 z-[80] w-80 max-h-[75vh] overflow-y-auto rounded-2xl bg-slate-950 text-white border border-fuchsia-500/40 shadow-2xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <h3 className="text-xs font-bold text-white">
              Mover y Renombrar Módulos del Menú
            </h3>
            <button
              type="button"
              onClick={() => setShowNavPanel(false)}
              className="p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {(draft.navOrder || DEFAULT_VISUAL_CUSTOMIZATION_SETTINGS.navOrder).map(
              (tabId, idx, arr) => {
                const modMeta = MODULE_OPTIONS.find((m) => m.id === tabId);
                if (!modMeta) return null;
                return (
                  <div
                    key={tabId}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={draft.navLabels?.[tabId] ?? modMeta.defaultLabel}
                      onChange={(e) => updateNavLabel(tabId, e.target.value)}
                      className="flex-1 min-w-0 px-2 py-1 text-xs bg-slate-900 border border-white/15 rounded-md text-white focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveNavModule(tabId, -1)}
                      className="p-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 cursor-pointer"
                      title="Subir módulo"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === arr.length - 1}
                      onClick={() => moveNavModule(tabId, 1)}
                      className="p-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 cursor-pointer"
                      title="Bajar módulo"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              }
            )}
          </div>
        </div>
      )}

      {/* Floating Element Inspector Panel */}
      {!selected && (
        <div
          data-visual-editor-ui="true"
          className="fixed bottom-4 right-4 z-[80] w-[92vw] max-w-sm rounded-2xl bg-slate-950/75 backdrop-blur-md text-white border border-cyan-400/45 shadow-2xl p-4 space-y-2 pointer-events-none"
        >
          <p className="text-xs font-bold text-cyan-300">
            Opciones de edición
          </p>
          <p className="text-xs text-white">
            Haz clic en el elemento que quieras modificar. Al seleccionarlo aparecerán aquí los controles de texto, tamaño, color y posición.
          </p>
          <p className="text-[11px] text-slate-300">
            Si quieres usar botones o cambiar de pantalla, activa “Navegar / Abrir Vistas”.
          </p>
        </div>
      )}

      {selected && (
        <div
          ref={inspectorRef}
          data-visual-editor-ui="true"
          className={
            inspectorPosition
              ? 'fixed z-[80] w-[92vw] max-w-sm max-h-[78vh] overflow-y-auto rounded-2xl bg-slate-950/75 backdrop-blur-md text-white border border-fuchsia-400/45 shadow-2xl p-4 space-y-4'
              : 'fixed bottom-4 right-4 z-[80] w-[92vw] max-w-sm max-h-[78vh] overflow-y-auto rounded-2xl bg-slate-950/75 backdrop-blur-md text-white border border-fuchsia-400/45 shadow-2xl p-4 space-y-4'
          }
          style={
            inspectorPosition
              ? { left: inspectorPosition.x, top: inspectorPosition.y }
              : undefined
          }
        >
          <div
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              if (e.target instanceof HTMLElement && e.target.closest('button, input')) return;
              const rect = inspectorRef.current?.getBoundingClientRect();
              inspectorDragRef.current = {
                active: true,
                startX: e.clientX,
                startY: e.clientY,
                origX: rect?.left ?? 16,
                origY: rect?.top ?? 16,
              };
              setInspectorPosition({
                x: rect?.left ?? 16,
                y: rect?.top ?? 16,
              });
              e.currentTarget.setPointerCapture(e.pointerId);
              e.preventDefault();
            }}
            onPointerMove={(e) => {
              const drag = inspectorDragRef.current;
              if (!drag?.active) return;
              const panel = inspectorRef.current;
              const width = panel?.offsetWidth || 384;
              const height = panel?.offsetHeight || 500;
              const nextX = Math.min(
                window.innerWidth - width - 8,
                Math.max(8, drag.origX + e.clientX - drag.startX)
              );
              const nextY = Math.min(
                window.innerHeight - height - 8,
                Math.max(8, drag.origY + e.clientY - drag.startY)
              );
              setInspectorPosition({ x: nextX, y: nextY });
            }}
            onPointerUp={(e) => {
              if (inspectorDragRef.current) {
                inspectorDragRef.current.active = false;
              }
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
            }}
            onPointerCancel={() => {
              if (inspectorDragRef.current) {
                inspectorDragRef.current.active = false;
              }
            }}
            className="flex items-start justify-between gap-2 pb-2.5 border-b border-white/10 cursor-move select-none"
          >
            <GripVertical className="w-4 h-4 mt-0.5 shrink-0 text-fuchsia-300/80" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-fuchsia-300">
                {selected.kindLabel} seleccionado
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {selected.originalText || 'Contenedor visual'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {selected.element.parentElement &&
                selected.element.parentElement.closest('[data-visual-scope]') &&
                selected.element.parentElement !==
                  selected.element.closest('[data-visual-scope]') && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selected.element.parentElement) {
                        selectDomElement(selected.element.parentElement);
                      }
                    }}
                    title="Seleccionar contenedor padre"
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-white/10 hover:bg-white/20 rounded-md text-cyan-300 cursor-pointer"
                  >
                    <CornerLeftUp className="w-3 h-3" />
                    Contenedor
                  </button>
                )}
              <button
                type="button"
                aria-label="Cerrar ventana de corrección"
                title="Cerrar ventana de corrección"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelected(null);
                  setInspectorPosition(null);
                }}
                className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 1. Corregir Letras / Texto */}
          {selected.hasEditableText && (
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-cyan-300">
                <Type className="w-3.5 h-3.5" />
                Corregir Texto / Letras
              </label>
              <input
                type="text"
                value={
                  currentPatch?.customText !== undefined
                    ? currentPatch.customText
                    : selected.originalText
                }
                onChange={(e) => {
                  const val = e.target.value;
                  updateSelectedPatch(
                    { customText: val },
                    false,
                    selected.navTabId
                      ? { tabId: selected.navTabId, label: val }
                      : undefined
                  );
                }}
                className="w-full px-3 py-2 text-xs bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
          )}

          {/* 2. Cambiar Orden en Fila o Cuadrícula */}
          {selected.canReorderSiblings && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-300">
                Cambiar Posición en Fila / Lista
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => reorderSelectedSibling(-1)}
                  className="inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium bg-white/10 hover:bg-white/15 border border-white/15 rounded-lg cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Mover Antes
                </button>
                <button
                  type="button"
                  onClick={() => reorderSelectedSibling(1)}
                  className="inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium bg-white/10 hover:bg-white/15 border border-white/15 rounded-lg cursor-pointer"
                >
                  Mover Después
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* 3. Mover Posición Libre X / Y */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                <Move className="w-3.5 h-3.5 text-fuchsia-400" />
                Posición Libre (X / Y)
              </span>
              <button
                type="button"
                onClick={() => updateSelectedPatch({ offsetX: 0, offsetY: 0 })}
                className="text-[11px] text-cyan-300 hover:underline cursor-pointer"
              >
                Centrar (0, 0)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/15">
                <span className="text-slate-400">X</span>
                <input
                  type="number"
                  step={4}
                  value={currentPatch?.offsetX || 0}
                  onChange={(e) =>
                    updateSelectedPatch({ offsetX: Number(e.target.value) || 0 })
                  }
                  className="w-16 text-right font-mono bg-transparent text-white focus:outline-none"
                />
              </label>
              <label className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/15">
                <span className="text-slate-400">Y</span>
                <input
                  type="number"
                  step={4}
                  value={currentPatch?.offsetY || 0}
                  onChange={(e) =>
                    updateSelectedPatch({ offsetY: Number(e.target.value) || 0 })
                  }
                  className="w-16 text-right font-mono bg-transparent text-white focus:outline-none"
                />
              </label>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() =>
                  updateSelectedPatch({
                    offsetX: (currentPatch?.offsetX || 0) - 8,
                  })
                }
                className="py-1.5 rounded-lg bg-white/10 hover:bg-white/20 flex justify-center cursor-pointer"
                title="Mover izquierda"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  updateSelectedPatch({
                    offsetY: (currentPatch?.offsetY || 0) - 8,
                  })
                }
                className="py-1.5 rounded-lg bg-white/10 hover:bg-white/20 flex justify-center cursor-pointer"
                title="Mover arriba"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  updateSelectedPatch({
                    offsetY: (currentPatch?.offsetY || 0) + 8,
                  })
                }
                className="py-1.5 rounded-lg bg-white/10 hover:bg-white/20 flex justify-center cursor-pointer"
                title="Mover abajo"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  updateSelectedPatch({
                    offsetX: (currentPatch?.offsetX || 0) + 8,
                  })
                }
                className="py-1.5 rounded-lg bg-white/10 hover:bg-white/20 flex justify-center cursor-pointer"
                title="Mover derecha"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 4. Tamaño y Colores Rápidos */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <Palette className="w-3.5 h-3.5 text-emerald-400" />
              Tamaño y Colores
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <label className="space-y-1">
                <span className="text-slate-400 block">Letra (px)</span>
                <input
                  type="number"
                  min={10}
                  max={48}
                  placeholder="Auto"
                  value={currentPatch?.fontSizePx || ''}
                  onChange={(e) =>
                    updateSelectedPatch({
                      fontSizePx: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-2 py-1 rounded bg-white/10 border border-white/15 font-mono text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400 block">Ancho (px)</span>
                <input
                  type="number"
                  min={20}
                  max={2000}
                  placeholder="Auto"
                  value={currentPatch?.widthPx || ''}
                  onChange={(e) =>
                    updateSelectedPatch({
                      widthPx: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-2 py-1 rounded bg-white/10 border border-white/15 font-mono text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400 block">Alto (px)</span>
                <input
                  type="number"
                  min={20}
                  max={2000}
                  placeholder="Auto"
                  value={currentPatch?.heightPx || ''}
                  onChange={(e) =>
                    updateSelectedPatch({
                      heightPx: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-2 py-1 rounded bg-white/10 border border-white/15 font-mono text-white"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400 block">Escala (%)</span>
                <input
                  type="number"
                  min={50}
                  max={200}
                  step={5}
                  placeholder="100"
                  value={currentPatch?.scalePercent || ''}
                  onChange={(e) =>
                    updateSelectedPatch({
                      scalePercent: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-2 py-1 rounded bg-white/10 border border-white/15 font-mono text-white"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <label className="space-y-1">
                <span className="text-slate-400 block">Color Texto</span>
                <input
                  type="color"
                  value={currentPatch?.textColor || '#ffffff'}
                  onChange={(e) =>
                    updateSelectedPatch({ textColor: e.target.value })
                  }
                  className="w-full h-7 rounded bg-transparent border border-white/15 cursor-pointer"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400 block">Fondo</span>
                <input
                  type="color"
                  value={currentPatch?.bgColor || '#1d4ed8'}
                  onChange={(e) =>
                    updateSelectedPatch({ bgColor: e.target.value })
                  }
                  className="w-full h-7 rounded bg-transparent border border-white/15 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* 5. Ocultar / Restaurar */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                updateSelectedPatch({ hidden: !currentPatch?.hidden })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/15 rounded-lg cursor-pointer"
            >
              {currentPatch?.hidden ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-emerald-300" />
                  Mostrar
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-amber-300" />
                  Ocultar
                </>
              )}
            </button>

            <button
              type="button"
              onClick={resetSelectedElement}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-200 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 rounded-lg cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Restaurar Elemento
            </button>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
