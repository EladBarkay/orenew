import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Gallery from "./components/Gallery";
import PreviewPanel from "./components/PreviewPanel";
import { MagnetEvent, Photo, PhotoBatch } from "./types";

export default function App() {
  const [event, setEvent] = useState<MagnetEvent | null>(null);
  const [activeBatch, setActiveBatch] = useState<PhotoBatch | null>(null);
  const [selected, setSelected] = useState<Photo | null>(null);
  const [status, setStatus] = useState("");

  async function openFolder() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const folder = await open({ directory: true, multiple: false });
      if (!folder) return;
      setStatus("Loading…");
      const evt = await invoke<MagnetEvent>("open_event", { path: folder });
      setEvent(evt);
      setActiveBatch(evt.batches[0] ?? null);
      setSelected(null);
      setStatus("");
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  }

  const totalPhotos = event?.batches.reduce((n, b) => n + b.photos.length, 0) ?? 0;
  const photos = activeBatch?.photos ?? [];

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-neutral-100 select-none">
      {/* Toolbar */}
      <header className="flex items-center gap-3 px-4 py-2.5 bg-neutral-800 border-b border-neutral-700 shrink-0">
        <span className="font-bold text-base tracking-tight text-white">MagNet</span>
        <div className="w-px h-4 bg-neutral-600" />
        <button
          onClick={openFolder}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded text-sm font-medium transition-colors"
        >
          Open Folder
        </button>
        {event && (
          <>
            <span className="text-neutral-300 text-sm font-medium">{event.name}</span>
            <span className="text-neutral-500 text-xs">{totalPhotos} photos</span>
          </>
        )}
        {status && (
          <span className="ml-auto text-neutral-400 text-xs">{status}</span>
        )}
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 shrink-0 flex flex-col bg-neutral-850 border-r border-neutral-700 overflow-y-auto">
          {event ? (
            <>
              <Section label="Batches">
                {event.batches.map((b) => (
                  <SidebarItem
                    key={b.id}
                    label={b.name}
                    sublabel={`${b.photos.length} photos`}
                    active={b.id === activeBatch?.id}
                    onClick={() => {
                      setActiveBatch(b);
                      setSelected(null);
                    }}
                  />
                ))}
              </Section>

              <Section label="Frames">
                {event.frame_presets.length === 0 ? (
                  <p className="px-3 py-1 text-xs text-neutral-600">
                    No frames configured
                  </p>
                ) : (
                  event.frame_presets.map((p) => (
                    <SidebarItem
                      key={p.id}
                      label={p.name}
                      active={p.id === event.active_frame_preset_id}
                      onClick={() => {
                        setEvent({ ...event, active_frame_preset_id: p.id });
                      }}
                    />
                  ))
                )}
              </Section>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-neutral-600 text-xs p-4 text-center">
              Open a folder to begin
            </div>
          )}
        </aside>

        {/* Gallery */}
        {event ? (
          <div className="flex flex-1 overflow-hidden">
            <Gallery
              photos={photos}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
            {selected && (
              <PreviewPanel
                event={event}
                photo={selected}
                onClose={() => setSelected(null)}
              />
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-600">
            <svg
              className="w-16 h-16 opacity-20"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm">Open a folder to browse photos</p>
            <button
              onClick={openFolder}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium text-white transition-colors"
            >
              Open Folder
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-2">
      <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
        {label}
      </p>
      {children}
    </div>
  );
}

function SidebarItem({
  label,
  sublabel,
  active,
  onClick,
}: {
  label: string;
  sublabel?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full text-left px-3 py-1.5 text-sm transition-colors",
        active
          ? "bg-blue-600/20 text-blue-300"
          : "text-neutral-300 hover:bg-neutral-700/60",
      ].join(" ")}
    >
      <span className="block truncate">{label}</span>
      {sublabel && (
        <span className="block text-[10px] text-neutral-500">{sublabel}</span>
      )}
    </button>
  );
}
