import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { OrenewEvent } from "../types";
import { useCanvasPage } from "../hooks/useCanvasPage";

type Props = {
  event: OrenewEvent;
  frameId: string;
  canvasId: string;
  /** Copy queue (path → qty), already scoped by App. */
  quantities: Record<string, number>;
};

/**
 * Live print preview shown inside the Export dialog: the actual export canvases
 * (frame + tiled photos) the current settings would produce, rendered page-by-page
 * in Rust at thumbnail resolution via `get_canvas_preview_page`.
 *
 * // ponytail: not virtualized — page count is bounded by the user's queue; add
 * // react-window only if a huge queue ever makes this sluggish.
 */
export default function ExportPreview({ event, frameId, canvasId, quantities }: Props) {
  const { t } = useTranslation();

  const filtered = useMemo(
    () => Object.fromEntries(Object.entries(quantities).filter(([, q]) => q > 0)),
    [quantities]
  );
  const sig = useMemo(
    () => Object.entries(filtered).map(([k, v]) => `${k}:${v}`).sort().join("|"),
    [filtered]
  );

  const canvasPreset = event.canvas_presets.find((p) => p.id === canvasId);
  const totalQty = Object.values(filtered).reduce((s, q) => s + q, 0);
  const pageCount =
    canvasPreset && totalQty > 0
      ? Math.ceil(totalQty / Math.max(1, canvasPreset.photos_per_canvas))
      : 0;
  const aspect =
    canvasPreset && canvasPreset.canvas_height_px > 0
      ? canvasPreset.canvas_width_px / canvasPreset.canvas_height_px
      : 1.5;

  let body: React.ReactNode;
  if (!frameId || !canvasId) {
    body = <Hint text={t("export.previewPickPresets")} />;
  } else if (pageCount === 0) {
    body = <Hint text={t("canvasView.queueToPreview")} />;
  } else {
    body = (
      <div className="grid grid-cols-2 gap-3 p-1">
        {Array.from({ length: pageCount }, (_, i) => (
          <PageTile
            key={i}
            eventId={event.id}
            frameId={frameId}
            canvasId={canvasId}
            quantities={filtered}
            sig={sig}
            index={i}
            aspect={aspect}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-medium text-neutral-400">{t("export.preview")}</span>
        {pageCount > 0 && (
          <span className="text-xs text-neutral-500">{t("canvasView.pageCount", { count: pageCount })}</span>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto rounded-lg bg-neutral-950 ring-1 ring-neutral-800 p-2">
        {body}
      </div>
    </div>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <div className="h-full flex items-center justify-center text-center text-xs text-neutral-600 px-4">
      {text}
    </div>
  );
}

function PageTile({
  eventId, frameId, canvasId, quantities, sig, index, aspect,
}: {
  eventId: string;
  frameId: string;
  canvasId: string;
  quantities: Record<string, number>;
  sig: string;
  index: number;
  aspect: number;
}) {
  const src = useCanvasPage(eventId, frameId, canvasId, quantities, index, sig);
  return (
    <div
      className="relative w-full overflow-hidden rounded ring-1 ring-neutral-700 bg-neutral-800"
      style={{ aspectRatio: String(aspect) }}
    >
      {src ? (
        <img src={src} className="w-full h-full object-contain" draggable={false} alt="" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-600 text-xs animate-pulse">…</div>
      )}
      <span className="absolute top-1 start-1 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-neutral-200">
        {index + 1}
      </span>
    </div>
  );
}
