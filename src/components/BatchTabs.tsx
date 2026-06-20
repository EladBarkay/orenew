import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OrenewEvent, PhotoBatch } from "../types";
import type { SortKey } from "../App";
import { PictureIcon, TrashIcon } from "./icons";

type Props = {
  event: OrenewEvent;
  activeBatch: PhotoBatch | null;
  draggedBatchId: string | null;
  setDraggedBatchId: (id: string | null) => void;
  onAddBatch: () => void;
  onSelectBatch: (b: PhotoBatch) => void;
  onDeleteBatch: (b: PhotoBatch) => void;
  onReorderBatch: (targetId: string) => void;
  hideEmpty: boolean;
  onToggleHideEmpty: () => void;
  cellSize: number;
  onZoom: (dir: 1 | -1) => void;
  sortKey: SortKey;
  sortDir: 1 | -1;
  onSortKey: (key: SortKey) => void;
  onToggleSortDir: () => void;
};

const MIN_CELL = 100;
const MAX_CELL = 280;

/**
 * Horizontal batch tab strip + view controls. Replaces the old vertical sidebar:
 * batches become drag-reorderable tabs; the right side holds the always-reachable
 * view controls (grid size, hide-empty). Frame/canvas presets live in the Export
 * dialog now, not here.
 */
export default function BatchTabs({
  event, activeBatch, draggedBatchId, setDraggedBatchId,
  onAddBatch, onSelectBatch, onDeleteBatch, onReorderBatch,
  hideEmpty, onToggleHideEmpty, cellSize, onZoom,
  sortKey, sortDir, onSortKey, onToggleSortDir,
}: Props) {
  const { t } = useTranslation();
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 shrink-0">
      <div className="flex items-center gap-1 overflow-x-auto">
        {event.batches.map((b) => {
          const active = b.id === activeBatch?.id;
          const isOver = dragOverId === b.id && draggedBatchId !== b.id;
          return (
            <div
              key={b.id}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData("text/plain", b.id); setDraggedBatchId(b.id); }}
              onDragOver={(e) => { e.preventDefault(); setDragOverId(b.id); }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={(e) => { e.preventDefault(); setDragOverId(null); onReorderBatch(b.id); }}
              onDragEnd={() => { setDraggedBatchId(null); setDragOverId(null); }}
              className={[
                "group relative flex items-center rounded-lg transition-colors cursor-grab",
                draggedBatchId === b.id ? "opacity-40" : "",
                isOver ? "border-s-2 border-accent" : "",
                active ? "bg-accent/15 text-accent" : "text-neutral-400 hover:bg-neutral-800",
              ].join(" ")}
            >
              <button
                onClick={() => onSelectBatch(b)}
                onDoubleClick={async () => {
                  try {
                    const { openPath } = await import("@tauri-apps/plugin-opener");
                    await openPath(b.source_path);
                  } catch (e) {
                    alert(t("common.couldNotOpenFolder", { message: String(e) }));
                  }
                }}
                title={b.source_path}
                className="flex items-center gap-1.5 ps-3 pe-7 py-1.5 cursor-grab"
              >
                <span className="text-sm font-medium whitespace-nowrap max-w-[14ch] truncate">{b.name}</span>
                <span className={["text-[10px] tabular-nums", active ? "text-accent/70" : "text-neutral-600"].join(" ")}>
                  {b.photos.length}
                </span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteBatch(b); }}
                title={t("sidebar.removeBatch")}
                className="absolute end-1 top-1/2 -translate-y-1/2 p-0.5 text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <TrashIcon className="w-3 h-3" />
              </button>
            </div>
          );
        })}
        <button
          onClick={onAddBatch}
          title={t("sidebar.addFolder")}
          className="ms-0.5 flex items-center justify-center w-7 h-7 rounded-lg text-neutral-500 hover:text-accent hover:bg-neutral-800 transition-colors text-lg leading-none"
        >
          +
        </button>
      </div>

      {/* View controls, always at the inline-end. */}
      <div className="ms-auto flex items-center gap-3 ps-2 shrink-0">
        <div className="flex items-center gap-1">
          <select
            value={sortKey}
            onChange={(e) => onSortKey(e.target.value as SortKey)}
            title={t("view.sortBy")}
            className="text-xs bg-neutral-800 text-neutral-300 rounded px-1.5 py-1 border border-neutral-700 focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="name">{t("view.sortName")}</option>
            <option value="created">{t("view.sortCreated")}</option>
            <option value="modified">{t("view.sortModified")}</option>
            <option value="size">{t("view.sortSize")}</option>
          </select>
          <button
            type="button"
            onClick={onToggleSortDir}
            title={sortDir === 1 ? t("view.sortAsc") : t("view.sortDesc")}
            className="flex items-center justify-center w-6 h-6 rounded text-neutral-300 hover:bg-neutral-800 text-sm leading-none"
          >
            {sortDir === 1 ? "↑" : "↓"}
          </button>
        </div>

        <div className="flex items-center gap-0.5 rounded-full bg-neutral-800 p-0.5">
          <ZoomButton label="−" onClick={() => onZoom(-1)} disabled={cellSize <= MIN_CELL} title={t("view.zoomOut")} />
          <PictureIcon className="w-3.5 h-3.5 text-neutral-500 mx-0.5" />
          <ZoomButton label="+" onClick={() => onZoom(1)} disabled={cellSize >= MAX_CELL} title={t("view.zoomIn")} />
        </div>

        <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer select-none whitespace-nowrap">
          {t("galleryToolbar.hideEmpty")}
          <button
            type="button"
            role="switch"
            aria-checked={hideEmpty}
            onClick={onToggleHideEmpty}
            className={[
              "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
              hideEmpty ? "bg-accent" : "bg-neutral-600",
            ].join(" ")}
          >
            <span
              className={[
                "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                hideEmpty ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0.5 rtl:-translate-x-0.5",
              ].join(" ")}
            />
          </button>
        </label>
      </div>
    </div>
  );
}

function ZoomButton({ label, onClick, disabled, title }: {
  label: string; onClick: () => void; disabled?: boolean; title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center justify-center w-5 h-5 rounded-full text-sm font-medium text-neutral-300 hover:bg-white/10 disabled:opacity-30 leading-none"
    >
      {label}
    </button>
  );
}
