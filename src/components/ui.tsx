import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CanvasPreset } from "../types";

// Open-modal stack: the last entry is the topmost (most recently opened) dialog.
// Esc closes the top first, so A-opens-B closes B then A. Each entry holds a ref
// to its current onClose so the listener always calls the live handler.
type ModalEntry = { onClose: React.MutableRefObject<() => void> };
const modalStack: ModalEntry[] = [];
let escListenerInstalled = false;
let zSeq = 0;

function ensureEscListener() {
  if (escListenerInstalled) return;
  escListenerInstalled = true;
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || modalStack.length === 0) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
    e.preventDefault();
    e.stopPropagation();
    modalStack[modalStack.length - 1].onClose.current();
  });
}

/** True while any Modal is open — lets other Esc handlers (e.g. the lightbox) defer. */
export function anyModalOpen() {
  return modalStack.length > 0;
}

/** Centered modal with a click-to-dismiss backdrop. `size` controls max width.
 *  Esc closes the topmost open modal (see modalStack); newer modals stack above
 *  older ones regardless of JSX order via an increasing z-index. */
export function Modal({
  children,
  onClose,
  size = "md",
}: {
  children: React.ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const maxW =
    size === "sm" ? "max-w-sm" :
    size === "lg" ? "max-w-lg" :
    size === "xl" ? "max-w-4xl" : "max-w-md";

  // Keep a live ref to onClose so the stack calls the current handler.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [z] = useState(() => 50 + ++zSeq);

  useEffect(() => {
    ensureEscListener();
    const entry: ModalEntry = { onClose: onCloseRef };
    modalStack.push(entry);
    return () => {
      const i = modalStack.indexOf(entry);
      if (i >= 0) modalStack.splice(i, 1);
    };
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: z }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative z-10 w-full ${maxW} mx-4 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-5`}
      >
        {children}
      </div>
    </div>
  );
}

/** Labeled form field (label above content). */
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-neutral-400">{label}</label>
      {children}
    </div>
  );
}

/** Small pill toggle used for picking among presets. */
export function Chip({
  label,
  active,
  onClick,
  onDoubleClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={[
        "px-2.5 py-1 text-xs rounded transition-colors",
        active ? "bg-accent text-accent-fg" : "bg-neutral-700 hover:bg-neutral-600 text-neutral-300",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

/** Numeric input bound to a number state. */
export function NumInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full bg-neutral-700 rounded px-2 py-1 text-neutral-100 focus:outline-none focus:ring-1 focus:ring-accent"
    />
  );
}

/** Round +/− stepper button. `sm` is the compact toolbar variant; the default
 *  is the larger overlay variant used on gallery cards. Stops click propagation
 *  so it can sit on top of a clickable parent (e.g. a photo card). */
export function QtyButton({
  label,
  onClick,
  disabled,
  size = "md",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const variant =
    size === "sm"
      ? "w-5 h-5 bg-white/10 hover:bg-white/20 text-neutral-200 text-sm"
      : "w-7 h-7 bg-white/20 hover:bg-white/40 text-white text-base";
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      className={`flex items-center justify-center rounded-full disabled:opacity-30 leading-none font-medium ${variant}`}
    >
      {label}
    </button>
  );
}

/** File-path display + pick button (shows the basename). */
export function PathPicker({
  path,
  placeholder,
  onPick,
}: {
  path: string;
  placeholder: string;
  onPick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-2">
      <div className="flex-1 min-w-0 bg-neutral-800 rounded px-3 py-1.5 text-xs text-neutral-400 truncate">
        {path ? path.split(/[\\/]/).pop() : <span className="text-neutral-600">{placeholder}</span>}
      </div>
      <button
        onClick={onPick}
        className="shrink-0 px-2.5 py-1.5 text-xs bg-neutral-700 hover:bg-neutral-600 rounded"
      >
        {path ? t("pathPicker.change") : t("pathPicker.pickPng")}
      </button>
    </div>
  );
}

/** Selectable canvas-preset row showing its dimensions and layout. */
export function PresetOption({
  preset,
  selected,
  onSelect,
  onDoubleClick,
}: {
  preset: CanvasPreset;
  selected: boolean;
  onSelect: () => void;
  onDoubleClick?: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      className={[
        "w-full text-start px-3 py-2 rounded text-sm transition-colors",
        selected
          ? "bg-accent/15 ring-1 ring-accent text-neutral-100"
          : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300",
      ].join(" ")}
    >
      <span className="font-medium">{preset.name}</span>
      <span className="ms-2 text-xs text-neutral-500">
        {preset.canvas_width_px}×{preset.canvas_height_px} · {preset.photos_per_canvas}-up ·{" "}
        {preset.dpi} DPI
      </span>
    </button>
  );
}
