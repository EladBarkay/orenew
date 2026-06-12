import { useThumbnail } from "../hooks/useThumbnail";
import { useFramedPreview } from "../hooks/useFramedPreview";
import { MagnetEvent, Photo } from "../types";
import { basename } from "../lib/paths";

type Props = {
  event: MagnetEvent;
  photo: Photo;
  onClose: () => void;
  /** Bumped when a frame PNG changes on disk, to force preview refetch. */
  frameNonce: number;
};

export default function PreviewPanel({ event, photo, onClose, frameNonce }: Props) {
  const filename = basename(photo.path);
  const thumb = useThumbnail(photo.path, photo.content_hash);
  const framedSrc = useFramedPreview(
    event.id,
    photo.id,
    event.active_frame_preset_id,
    frameNonce
  );

  const displaySrc = framedSrc ?? thumb;
  // Orientation comes from pixel dimensions (plus any user override) to match the
  // export pipeline, which ignores EXIF — see Rust `detect_orientation`.
  const orientation = photo.orientation_override ?? inferOrientation(photo);

  return (
    <aside className="w-72 flex flex-col bg-neutral-800 border-l border-neutral-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-700">
        <span className="text-xs font-medium text-neutral-300 truncate">{filename}</span>
        <button
          onClick={onClose}
          className="ml-2 text-neutral-500 hover:text-neutral-200 text-lg leading-none flex-shrink-0"
          aria-label="Close preview"
        >
          ×
        </button>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center bg-neutral-900 p-3 overflow-hidden">
        {displaySrc ? (
          <img
            src={displaySrc}
            alt={filename}
            className="max-w-full max-h-full object-contain rounded shadow-lg"
            draggable={false}
          />
        ) : (
          <div className="w-full aspect-square bg-neutral-800 rounded animate-pulse" />
        )}
      </div>

      {/* Metadata */}
      <div className="px-3 py-3 border-t border-neutral-700 space-y-2 text-xs text-neutral-400">
        <Row label="Dimensions" value={`${photo.width} × ${photo.height}`} />
        <Row label="Orientation" value={capitalize(orientation)} />
        {framedSrc && (
          <Row label="Frame" value={activeFrameName(event) ?? "—"} />
        )}
        <div className="flex items-center justify-between">
          <span>Print count</span>
          <span
            className={
              photo.print_count > 0
                ? "font-semibold text-green-400"
                : "text-neutral-600"
            }
          >
            {photo.print_count === 0 ? "Not printed" : `×${photo.print_count}`}
          </span>
        </div>
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="text-neutral-200">{value}</span>
    </div>
  );
}

function inferOrientation(photo: Photo) {
  return photo.width >= photo.height ? "landscape" : "portrait";
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function activeFrameName(event: MagnetEvent) {
  if (!event.active_frame_preset_id) return null;
  return event.frame_presets.find((p) => p.id === event.active_frame_preset_id)?.name ?? null;
}
