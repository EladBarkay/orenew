import { memo } from "react";
import { useThumbnail } from "../hooks/useThumbnail";
import { Photo } from "../types";
import { basename } from "../lib/paths";

type Props = {
  photo: Photo;
  /** In the multi-selection (shows a ring). */
  selected: boolean;
  /** The last-clicked photo (preview/anchor) — stronger ring. */
  active: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  cellSize: number;
  /** Number queued for the next process run. */
  qty: number;
  /** Adjust the queued quantity by `delta` (clamped at 0). */
  onQtyDelta: (delta: number) => void;
};

function PhotoCard({ photo, selected, active, onClick, onDoubleClick, cellSize, qty, onQtyDelta }: Props) {
  const src = useThumbnail(photo.path, photo.content_hash);
  const filename = basename(photo.path);

  return (
    <div
      className={[
        "relative w-full h-full rounded-lg overflow-hidden group",
        "transition-all duration-150",
        // Dim photos queued for 0 copies and not selected — won't be printed/exported.
        qty === 0 && !selected ? "opacity-40 hover:opacity-100" : "",
        active
          ? "ring-2 ring-accent ring-offset-1 ring-offset-neutral-950"
          : selected
          ? "ring-2 ring-accent/70"
          : "hover:ring-1 hover:ring-neutral-600 hover:ring-offset-1 hover:ring-offset-neutral-950",
      ].join(" ")}
      title={filename}
    >
      {/* Thumbnail (click selects, double-click opens the full-screen review) */}
      <button onClick={onClick} onDoubleClick={onDoubleClick} className="block w-full h-full focus:outline-none">
        {src ? (
          <img
            src={src}
            alt={filename}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-neutral-800 animate-pulse" />
        )}
      </button>

      {/* Bottom overlay: filename above a full-width −/count/+ stepper */}
      <div
        className={[
          "absolute bottom-0 inset-x-0 flex flex-col",
          "bg-gradient-to-t from-black/85 via-black/55 to-transparent pt-4",
          "transition-opacity",
          qty > 0 || selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        ].join(" ")}
      >
        {cellSize >= 140 && (
          <span className="px-2 text-[10px] text-neutral-200 truncate leading-tight pointer-events-none">
            {filename}
          </span>
        )}
        <div className="flex items-stretch h-9 mt-1">
          <StepButton label="−" onClick={() => onQtyDelta(-1)} disabled={qty <= 0} />
          <span className="flex-1 flex items-center justify-center text-base font-bold text-white tabular-nums select-none">
            {qty}
          </span>
          <StepButton label="+" onClick={() => onQtyDelta(+1)} />
        </div>
      </div>
    </div>
  );
}

export default memo(PhotoCard);

/** Half-width, full-height stepper button for the gallery card overlay. */
function StepButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      className="flex-1 flex items-center justify-center text-xl font-bold leading-none text-white bg-white/10 hover:bg-white/25 active:bg-white/35 disabled:opacity-25 disabled:hover:bg-white/10 transition-colors"
    >
      {label}
    </button>
  );
}
