import { LicenseInfo, MagnetEvent, PhotoBatch } from "../types";
import { ExportIcon, PrintIcon, SettingsIcon, TrashIcon } from "./icons";

type Props = {
  event: MagnetEvent | null;
  license: LicenseInfo | null;
  status: string;
  totalPhotos: number;
  activeBatch: PhotoBatch | null;
  queuedPrints: number;
  hasFramePreset: boolean;
  onOpenEvent: () => void;
  onDeleteEvent: () => void;
  onPrint: () => void;
  onExport: () => void;
  onSettings: () => void;
};

export default function Toolbar({
  event, license, status, totalPhotos, activeBatch, queuedPrints, hasFramePreset,
  onOpenEvent, onDeleteEvent, onPrint, onExport, onSettings,
}: Props) {
  const isPro = license?.tier === "pro";
  return (
    <header className="flex items-center gap-3 px-4 py-2.5 bg-neutral-800 border-b border-neutral-700 shrink-0">
      <span className="font-bold text-base tracking-tight text-white">MagNet</span>
      <div className="w-px h-4 bg-neutral-600" />
      <button onClick={onOpenEvent}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded text-sm font-medium transition-colors">
        Open Event
      </button>

      {event && (
        <>
          <span className="text-neutral-300 text-sm font-medium">{event.name}</span>
          <span className="text-neutral-500 text-xs">{totalPhotos} photos</span>

          <button
            onClick={onDeleteEvent}
            title="Delete this event"
            className="text-neutral-600 hover:text-red-400 transition-colors"
          >
            <TrashIcon />
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onPrint}
              disabled={!activeBatch || queuedPrints === 0 || !hasFramePreset}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed rounded text-sm transition-colors"
              title={
                !hasFramePreset
                  ? "Set an active frame preset first"
                  : queuedPrints === 0
                  ? "Set print quantities on photos in the gallery first"
                  : ""
              }
            >
              <PrintIcon />
              Print{queuedPrints > 0 ? ` (${queuedPrints})` : ""}
            </button>

            <button
              onClick={onExport}
              disabled={!activeBatch || activeBatch.photos.length === 0 || !hasFramePreset}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
              title={!hasFramePreset ? "Set an active frame preset first" : ""}
            >
              <ExportIcon />
              Export
            </button>
          </div>
        </>
      )}

      {status && (
        <span className={["text-xs", event ? "" : "ml-auto", "text-neutral-400"].join(" ")}>
          {status}
        </span>
      )}

      <button
        onClick={onSettings}
        title="Settings & license"
        className={[
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors",
          event ? "" : "ml-auto",
          "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700",
        ].join(" ")}
      >
        <SettingsIcon />
        <span
          className={[
            "font-semibold px-1.5 py-0.5 rounded-full text-[10px]",
            isPro ? "bg-green-700/80 text-white" : "bg-neutral-700 text-neutral-300",
          ].join(" ")}
        >
          {isPro ? "Pro" : "Free"}
        </span>
      </button>
    </header>
  );
}
