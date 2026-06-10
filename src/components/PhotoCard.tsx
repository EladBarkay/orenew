import { memo } from "react";
import { useThumbnail } from "../hooks/useThumbnail";
import { Photo } from "../types";

type Props = {
  photo: Photo;
  selected: boolean;
  onClick: () => void;
  cellSize: number;
};

function PhotoCard({ photo, selected, onClick, cellSize }: Props) {
  const src = useThumbnail(photo.path);
  const filename = photo.path.split(/[\\/]/).pop() ?? photo.path;

  return (
    <button
      onClick={onClick}
      className={[
        "relative w-full h-full rounded overflow-hidden group focus:outline-none",
        "transition-all duration-100",
        selected
          ? "ring-2 ring-blue-400 ring-offset-1 ring-offset-neutral-900"
          : "hover:ring-1 hover:ring-neutral-500 hover:ring-offset-1 hover:ring-offset-neutral-900",
      ].join(" ")}
      title={filename}
    >
      {/* Thumbnail */}
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

      {/* Bottom overlay: filename + print count */}
      <div
        className={[
          "absolute bottom-0 inset-x-0 flex items-end justify-between px-1.5 py-1",
          "bg-gradient-to-t from-black/70 to-transparent",
          "opacity-0 group-hover:opacity-100 transition-opacity",
          selected ? "opacity-100" : "",
        ].join(" ")}
      >
        {cellSize >= 140 && (
          <span className="text-[10px] text-neutral-300 truncate leading-tight max-w-[80%]">
            {filename}
          </span>
        )}
        {photo.print_count > 0 && (
          <PrintBadge count={photo.print_count} />
        )}
      </div>

      {/* Always-visible print badge (top-right) when count > 0 */}
      {photo.print_count > 0 && (
        <div className="absolute top-1 right-1">
          <PrintBadge count={photo.print_count} />
        </div>
      )}
    </button>
  );
}

function PrintBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 bg-green-700/90 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
      ×{count}
    </span>
  );
}

export default memo(PhotoCard);
