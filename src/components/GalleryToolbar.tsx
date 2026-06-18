import { QtyButton } from "./ui";

type Props = {
  selectedCount: number;
  allQty: number;
  hideEmpty: boolean;
  scanning: boolean;
  scanProgress: { done: number; total: number } | null;
  onSetAllQty: (qty: number) => void;
  onScanFaces: () => void;
  onToggleHideEmpty: () => void;
};

/**
 * Contextual sub-bar above the gallery. Holds the per-batch controls that act on
 * the current selection (or the whole batch) — kept out of the app-level top
 * toolbar so each bar reads as one coherent unit.
 */
export default function GalleryToolbar({
  selectedCount, allQty, hideEmpty, scanning, scanProgress,
  onSetAllQty, onScanFaces, onToggleHideEmpty,
}: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-neutral-800 border-b border-neutral-700 shrink-0">
      {/* Scope chip: selection or whole batch */}
      <span className={[
        "text-[11px] font-medium px-2 py-0.5 rounded-full",
        selectedCount > 0 ? "bg-blue-600/20 text-blue-300" : "bg-neutral-700 text-neutral-400",
      ].join(" ")}>
        {selectedCount > 0 ? `${selectedCount} selected` : "All photos"}
      </span>

      {/* Copies stepper for the scope */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5 rounded-full bg-neutral-700 px-0.5 py-0.5">
          <QtyButton size="sm" label="−" onClick={() => onSetAllQty(Math.max(0, allQty - 1))} disabled={allQty <= 0} />
          <span className="min-w-[18px] text-center text-xs font-semibold text-neutral-200 tabular-nums">
            {allQty}
          </span>
          <QtyButton size="sm" label="+" onClick={() => onSetAllQty(allQty + 1)} />
        </div>
        <span className="text-xs text-neutral-500">copies</span>
      </div>

      <div className="w-px h-4 bg-neutral-700" />

      {/* Suggest copies = face count per photo; progress shows right here */}
      <button
        onClick={onScanFaces}
        disabled={scanning}
        title="Set each photo's copies to the number of faces detected"
        className="px-2.5 py-1 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-40 disabled:cursor-wait rounded text-xs font-medium transition-colors"
      >
        {scanning ? "Scanning…" : "Suggest copies (faces)"}
      </button>
      {scanning && scanProgress && (
        <span className="text-xs text-neutral-400 tabular-nums">
          {scanProgress.done}/{scanProgress.total}
        </span>
      )}

      {/* iOS-style toggle: hide photos queued for 0 copies */}
      <label className="ml-auto flex items-center gap-2 text-xs text-neutral-400 cursor-pointer select-none">
        Hide empty
        <button
          type="button"
          role="switch"
          aria-checked={hideEmpty}
          onClick={onToggleHideEmpty}
          className={[
            "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
            hideEmpty ? "bg-blue-500" : "bg-neutral-600",
          ].join(" ")}
        >
          <span
            className={[
              "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
              hideEmpty ? "translate-x-4" : "translate-x-0.5",
            ].join(" ")}
          />
        </button>
      </label>
    </div>
  );
}
