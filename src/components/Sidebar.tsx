import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CanvasPreset, FramePreset, MagnetEvent, PhotoBatch } from "../types";
import { batchDisplayPath, parentDir } from "../lib/paths";
import { EditIcon, TrashIcon } from "./icons";

type Props = {
  event: MagnetEvent;
  activeBatch: PhotoBatch | null;
  draggedBatchId: string | null;
  setDraggedBatchId: (id: string | null) => void;
  onAddBatch: () => void;
  onSelectBatch: (b: PhotoBatch) => void;
  onDeleteBatch: (b: PhotoBatch) => void;
  onReorderBatch: (targetId: string) => void;
  draggedFrameId: string | null;
  setDraggedFrameId: (id: string | null) => void;
  onReorderFrame: (targetId: string) => void;
  onAddFrame: () => void;
  onEditFrame: (p: FramePreset) => void;
  onDeleteFrame: (p: FramePreset) => void;
  draggedCanvasId: string | null;
  setDraggedCanvasId: (id: string | null) => void;
  onReorderCanvas: (targetId: string) => void;
  onAddCanvas: () => void;
  onEditCanvas: (p: CanvasPreset) => void;
  onDeleteCanvas: (p: CanvasPreset) => void;
};

export default function Sidebar({
  event, activeBatch, draggedBatchId, setDraggedBatchId,
  onAddBatch, onSelectBatch, onDeleteBatch, onReorderBatch,
  draggedFrameId, setDraggedFrameId, onReorderFrame,
  onAddFrame, onEditFrame, onDeleteFrame,
  draggedCanvasId, setDraggedCanvasId, onReorderCanvas,
  onAddCanvas, onEditCanvas, onDeleteCanvas,
}: Props) {
  const { t } = useTranslation();
  const [dragOverBatchId, setDragOverBatchId] = useState<string | null>(null);
  const [dragOverFrameId, setDragOverFrameId] = useState<string | null>(null);
  const [dragOverCanvasId, setDragOverCanvasId] = useState<string | null>(null);

  return (
    <aside className="w-52 shrink-0 flex flex-col bg-neutral-850 border-e border-neutral-700 overflow-y-auto">
      <Section label={t("sidebar.batches")} action={
        <button onClick={onAddBatch} className="text-[10px] text-blue-400 hover:text-blue-300 font-medium">{t("sidebar.add")}</button>
      }>
        {event.batches.length === 0 ? (
          <p className="px-3 py-1 text-xs text-neutral-600">
            {t("sidebar.noBatches")}{" "}
            <button onClick={onAddBatch} className="text-blue-400 hover:text-blue-300 underline">
              {t("sidebar.addFolder")}
            </button>
          </p>
        ) : (
          event.batches.map((b) => {
            const displayPath = batchDisplayPath(b.source_path, event.root_path ? parentDir(event.root_path) : null);
            const isOver = dragOverBatchId === b.id && draggedBatchId !== b.id;
            return (
              <div
                key={b.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData("text/plain", b.id); setDraggedBatchId(b.id); }}
                onDragOver={(e) => { e.preventDefault(); setDragOverBatchId(b.id); }}
                onDragLeave={() => setDragOverBatchId(null)}
                onDrop={(e) => { e.preventDefault(); setDragOverBatchId(null); onReorderBatch(b.id); }}
                onDragEnd={() => { setDraggedBatchId(null); setDragOverBatchId(null); }}
                className={[
                  "group relative cursor-grab",
                  draggedBatchId === b.id ? "opacity-40" : "",
                  isOver ? "border-t-2 border-blue-500" : "",
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
                  className={[
                    "w-full text-start px-3 py-1.5 pe-8 text-sm transition-colors cursor-grab",
                    b.id === activeBatch?.id
                      ? "bg-blue-600/20 text-blue-300"
                      : "text-neutral-300 hover:bg-neutral-700/60",
                  ].join(" ")}
                >
                  <span className="block truncate">{b.name}</span>
                  <span className="block text-[10px] text-neutral-500 truncate" title={b.source_path}>
                    {t("sidebar.path", { path: displayPath })}
                  </span>
                  <span className="block text-[10px] text-neutral-600">{t("common.photos", { count: b.photos.length })}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteBatch(b); }}
                  title={t("sidebar.removeBatch")}
                  className="absolute end-1.5 top-1/2 -translate-y-1/2 p-1 text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <TrashIcon className="w-3 h-3" />
                </button>
              </div>
            );
          })
        )}
      </Section>

      <Section label={t("sidebar.frames")} action={
        <button onClick={onAddFrame} className="text-[10px] text-blue-400 hover:text-blue-300 font-medium">{t("sidebar.add")}</button>
      }>
        {event.frame_presets.length === 0 ? (
          <p className="px-3 py-1 text-xs text-neutral-600">
            {t("sidebar.noFrames")}{" "}
            <button onClick={onAddFrame} className="text-blue-400 hover:text-blue-300 underline">
              {t("sidebar.addOne")}
            </button>
          </p>
        ) : (
          event.frame_presets.map((p) => {
            const isOver = dragOverFrameId === p.id && draggedFrameId !== p.id;
            return (
              <div
                key={p.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData("text/plain", p.id); setDraggedFrameId(p.id); }}
                onDragOver={(e) => { e.preventDefault(); setDragOverFrameId(p.id); }}
                onDragLeave={() => setDragOverFrameId(null)}
                onDrop={(e) => { e.preventDefault(); setDragOverFrameId(null); onReorderFrame(p.id); }}
                onDragEnd={() => { setDraggedFrameId(null); setDragOverFrameId(null); }}
                className={[
                  "group relative cursor-grab",
                  draggedFrameId === p.id ? "opacity-40" : "",
                  isOver ? "border-t-2 border-blue-500" : "",
                ].join(" ")}
              >
                <div className="w-full px-3 py-1.5 pe-16 text-sm text-neutral-300">
                  <span className="block truncate">{p.name}</span>
                  <span className="block text-[10px] text-neutral-500">
                    {`${p.target_ratio_w}:${p.target_ratio_h}`}
                  </span>
                </div>
                <div className="absolute end-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); onEditFrame(p); }}
                    title={t("sidebar.editFrame")}
                    className="p-1 text-neutral-500 hover:text-blue-400"
                  >
                    <EditIcon />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteFrame(p); }}
                    title={t("sidebar.deleteFrame")}
                    className="p-1 text-neutral-500 hover:text-red-400"
                  >
                    <TrashIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </Section>

      <Section label={t("sidebar.canvasPresets")} action={
        <button onClick={onAddCanvas} className="text-[10px] text-blue-400 hover:text-blue-300 font-medium">{t("sidebar.add")}</button>
      }>
        {event.canvas_presets.length === 0 ? (
          <p className="px-3 py-1 text-xs text-neutral-600">
            {t("sidebar.noPresets")}{" "}
            <button onClick={onAddCanvas} className="text-blue-400 hover:text-blue-300 underline">
              {t("sidebar.addOne")}
            </button>
          </p>
        ) : (
          event.canvas_presets.map((p) => {
            const isOver = dragOverCanvasId === p.id && draggedCanvasId !== p.id;
            return (
              <div
                key={p.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData("text/plain", p.id); setDraggedCanvasId(p.id); }}
                onDragOver={(e) => { e.preventDefault(); setDragOverCanvasId(p.id); }}
                onDragLeave={() => setDragOverCanvasId(null)}
                onDrop={(e) => { e.preventDefault(); setDragOverCanvasId(null); onReorderCanvas(p.id); }}
                onDragEnd={() => { setDraggedCanvasId(null); setDragOverCanvasId(null); }}
                className={[
                  "group relative cursor-grab",
                  draggedCanvasId === p.id ? "opacity-40" : "",
                  isOver ? "border-t-2 border-blue-500" : "",
                ].join(" ")}
              >
                <div className="w-full px-3 py-1.5 pe-16 text-sm text-neutral-300">
                  <span className="block truncate">{p.name}</span>
                  <span className="block text-[10px] text-neutral-500">
                    {`${p.canvas_width_px}×${p.canvas_height_px} · ${p.photos_per_canvas}-up`}
                  </span>
                </div>
                <div className="absolute end-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); onEditCanvas(p); }}
                    title={t("sidebar.editCanvas")}
                    className="p-1 text-neutral-500 hover:text-blue-400"
                  >
                    <EditIcon />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteCanvas(p); }}
                    title={t("sidebar.deleteCanvas")}
                    className="p-1 text-neutral-500 hover:text-red-400"
                  >
                    <TrashIcon className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </Section>
    </aside>
  );
}

function Section({
  label, children, action,
}: {
  label: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="py-2">
      <div className="flex items-center justify-between px-3 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">{label}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

