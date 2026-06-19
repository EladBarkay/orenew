import { useTranslation } from "react-i18next";
import { PrintIcon } from "./icons";
import { QtyButton } from "./ui";
import { useThumbnail } from "../hooks/useThumbnail";

type Props = {
  queuedTotal: number;
  visibleCount: number;
  selectedCount: number;
  allQty: number;
  scanning: boolean;
  scanProgress: { done: number; total: number } | null;
  /** How many distinct batches contribute to the (effective) queue. */
  exportBatchCount: number;
  /** Up to 3 thumbnails of queued photos, shown stacked next to Export. */
  exportThumbs: { path: string; hash: string }[];
  onSetAllQty: (qty: number) => void;
  onScanFaces: () => void;
  onClearSelection: () => void;
  onExport: () => void;
};

/**
 * Sticky bottom action bar. Default: queued totals + the single primary Export.
 * With a selection it swaps the left side to bulk controls (set copies, suggest
 * copies, clear) — absorbing the old GalleryToolbar. Export stays on the end and
 * acts on the effective (selection-scoped) queue.
 */
export default function ActionBar({
  queuedTotal, visibleCount, selectedCount, allQty, scanning, scanProgress,
  exportBatchCount, exportThumbs,
  onSetAllQty, onScanFaces, onClearSelection, onExport,
}: Props) {
  const { t } = useTranslation();
  const hasSelection = selectedCount > 0;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-neutral-900 border-t border-neutral-800 shrink-0">
      {hasSelection ? (
        <>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent/15 text-accent">
            {t("galleryToolbar.selected", { count: selectedCount })}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5 rounded-full bg-neutral-800 px-0.5 py-0.5">
              <QtyButton size="sm" label="−" onClick={() => onSetAllQty(Math.max(0, allQty - 1))} disabled={allQty <= 0} />
              <span className="min-w-[18px] text-center text-xs font-semibold text-neutral-200 tabular-nums">{allQty}</span>
              <QtyButton size="sm" label="+" onClick={() => onSetAllQty(allQty + 1)} />
            </div>
            <span className="text-xs text-neutral-500">{t("galleryToolbar.copies")}</span>
          </div>
          <button
            onClick={onScanFaces}
            disabled={scanning}
            title={t("galleryToolbar.suggestCopiesTitle")}
            className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-wait rounded text-xs font-medium transition-colors"
          >
            {scanning ? t("galleryToolbar.scanning") : t("galleryToolbar.suggestCopies")}
          </button>
          {scanning && scanProgress && (
            <span className="text-xs text-neutral-400 tabular-nums">{scanProgress.done}/{scanProgress.total}</span>
          )}
          <button
            onClick={onClearSelection}
            className="text-xs text-neutral-500 hover:text-neutral-200 transition-colors"
          >
            {t("actionBar.clear")}
          </button>
        </>
      ) : (
        <span className="text-xs text-neutral-400 tabular-nums">
          {t("actionBar.queuedSummary", { copies: queuedTotal, photos: visibleCount })}
        </span>
      )}

      <div className="ms-auto flex items-center gap-2">
        {queuedTotal > 0 && exportThumbs.length > 0 && (
          <div className="flex items-center">
            {exportThumbs.map((thumb, i) => (
              <ExportThumb key={thumb.path} path={thumb.path} hash={thumb.hash} index={i} />
            ))}
          </div>
        )}
        {exportBatchCount > 1 && (
          <span className="text-xs text-neutral-400 tabular-nums">{t("actionBar.fromBatches", { n: exportBatchCount })}</span>
        )}
        <button
          onClick={onExport}
          disabled={queuedTotal === 0}
          title={queuedTotal === 0 ? t("toolbar.setQuantitiesFirst") : ""}
          className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover active:bg-accent-active text-accent-fg disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition-colors"
        >
          <PrintIcon />
          {queuedTotal > 0 ? t("toolbar.exportCount", { count: queuedTotal }) : t("toolbar.export")}
        </button>
      </div>
    </div>
  );
}

/** A small thumbnail in the export indicator's stacked preview. */
function ExportThumb({ path, hash, index }: { path: string; hash: string; index: number }) {
  const src = useThumbnail(path, hash);
  return (
    <div
      className="w-7 h-7 rounded-md overflow-hidden ring-2 ring-neutral-900 bg-neutral-800"
      style={{ marginInlineStart: index === 0 ? 0 : -8, zIndex: 3 - index }}
    >
      {src && <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />}
    </div>
  );
}
