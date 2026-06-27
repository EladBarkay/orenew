import { useRef, useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { List, type RowComponentProps } from "react-window";
import { OrenewEvent } from "../types";
import { useCanvasPage } from "../hooks/useCanvasPage";
import { Field, Chip, PresetOption } from "./ui";

const GAP = 24;
const MAX_PAGE_W = 1100;

type Props = {
  event: OrenewEvent;
  /** The shared copy queue (path → quantity). Read-only here. */
  photoQueue: Record<string, number>;
};

type PageData = {
  eventId: string;
  frameId: string;
  canvasId: string;
  quantities: Record<string, number>;
  sig: string;
  pageW: number;
  pageH: number;
};

// Module-level so react-window re-renders rows without remounting them.
function PageRow({
  index,
  style,
  eventId,
  frameId,
  canvasId,
  quantities,
  sig,
  pageW,
  pageH,
}: RowComponentProps<PageData>) {
  const src = useCanvasPage(eventId, frameId, canvasId, quantities, index, sig);
  return (
    <div style={style} className="flex justify-center">
      <div
        style={{ width: pageW, height: pageH }}
        className="relative self-start shadow-lg ring-1 ring-neutral-700 bg-neutral-800 overflow-hidden"
      >
        {src ? (
          <img src={src} className="w-full h-full object-contain" draggable={false} alt="" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-600 text-xs animate-pulse">
            …
          </div>
        )}
        <span className="absolute top-1 start-1 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-neutral-200">
          {index + 1}
        </span>
      </div>
    </div>
  );
}

/**
 * Read-only preview of the actual export canvases. Tiles the queued photos
 * (copies-expanded, path order) onto the chosen canvas preset exactly as export
 * would — rendered page-by-page in Rust at thumbnail resolution. Page count is
 * derived client-side (same chunk-by-photos_per_canvas math the backend uses).
 */
export default function CanvasPreview({ event, photoQueue }: Props) {
  const { t } = useTranslation();
  const [frameId, setFrameId] = useState(
    event.active_frame_preset_id ?? event.frame_presets[0]?.id ?? ""
  );
  const [canvasId, setCanvasId] = useState(
    event.active_canvas_preset_id ?? event.canvas_presets[0]?.id ?? ""
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Filtered queue + a cheap signature so pages re-render on copy changes.
  const quantities = useMemo(
    () => Object.fromEntries(Object.entries(photoQueue).filter(([, q]) => q > 0)),
    [photoQueue]
  );
  const sig = useMemo(
    () =>
      Object.entries(quantities)
        .map(([k, v]) => `${k}:${v}`)
        .sort()
        .join("|"),
    [quantities]
  );

  const canvasPreset = event.canvas_presets.find((p) => p.id === canvasId);
  const totalQty = Object.values(quantities).reduce((s, q) => s + q, 0);
  const pageCount =
    canvasPreset && totalQty > 0
      ? Math.ceil(totalQty / Math.max(1, canvasPreset.photos_per_canvas))
      : 0;

  const aspect =
    canvasPreset && canvasPreset.canvas_height_px > 0
      ? canvasPreset.canvas_width_px / canvasPreset.canvas_height_px
      : 1.5;
  const pageW = Math.min(Math.max(1, size.width - 2 * GAP), MAX_PAGE_W);
  const pageH = Math.round(pageW / aspect);
  const rowHeight = pageH + GAP;

  const rowProps: PageData = {
    eventId: event.id,
    frameId,
    canvasId,
    quantities,
    sig,
    pageW,
    pageH,
  };

  const ready = frameId && canvasId && pageCount > 0;
  const hint =
    event.frame_presets.length === 0 || event.canvas_presets.length === 0
      ? t("canvasView.needPresets")
      : t("canvasView.queueToPreview");

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Preset pickers */}
      <div className="flex flex-wrap items-end gap-4 px-3 py-2 bg-neutral-900 border-b border-neutral-800 shrink-0">
        <Field label={t("export.framePreset")}>
          <div className="flex flex-wrap gap-1.5">
            {event.frame_presets.map((p) => (
              <Chip key={p.id} label={p.name} active={p.id === frameId} onClick={() => setFrameId(p.id)} />
            ))}
          </div>
        </Field>
        <Field label={t("export.canvasPreset")}>
          <div className="flex flex-wrap gap-1.5">
            {event.canvas_presets.map((p) => (
              <div key={p.id} className="min-w-44">
                <PresetOption preset={p} selected={p.id === canvasId} onSelect={() => setCanvasId(p.id)} />
              </div>
            ))}
          </div>
        </Field>
        {pageCount > 0 && (
          <span className="ms-auto text-xs text-neutral-500 pb-1">
            {t("canvasView.pageCount", { count: pageCount })}
          </span>
        )}
      </div>

      {/* Pages */}
      <div ref={containerRef} className="flex-1 overflow-hidden bg-neutral-950">
        {!ready ? (
          <div className="h-full flex items-center justify-center text-neutral-600 text-sm px-6 text-center">
            {hint}
          </div>
        ) : (
          size.width > 0 && (
            <List
              rowComponent={PageRow}
              rowProps={rowProps}
              rowCount={pageCount}
              rowHeight={rowHeight}
              overscanCount={1}
              style={{ width: size.width, height: size.height, paddingTop: GAP }}
            />
          )
        )}
      </div>
    </div>
  );
}
