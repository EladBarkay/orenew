import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type Event = {
  id: string;
  name: string;
  batches: PhotoBatch[];
  frame_presets: FramePreset[];
  canvas_presets: CanvasPreset[];
  output_folder: string | null;
  active_frame_preset_id: string | null;
};

type PhotoBatch = {
  id: string;
  name: string;
  source_path: string;
  photos: Photo[];
};

type Photo = {
  id: string;
  path: string;
  width: number;
  height: number;
  print_count: number;
  orientation_override: "landscape" | "portrait" | null;
};

type FramePreset = {
  id: string;
  name: string;
};

type CanvasPreset = {
  id: string;
  name: string;
};

function App() {
  const [event, setEvent] = useState<Event | null>(null);
  const [status, setStatus] = useState("Open a photo folder to start.");

  async function openFolder() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const folder = await open({ directory: true, multiple: false });
      if (!folder) return;
      setStatus("Loading…");
      const evt = await invoke<Event>("open_event", { path: folder });
      setEvent(evt);
      setStatus(`Loaded: ${evt.name}`);
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  }

  const totalPhotos = event?.batches.flatMap((b) => b.photos).length ?? 0;

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-neutral-100">
      {/* Toolbar */}
      <header className="flex items-center gap-4 px-4 py-3 bg-neutral-800 border-b border-neutral-700">
        <span className="font-bold text-lg tracking-tight">MagNet</span>
        <button
          onClick={openFolder}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium"
        >
          Open Folder
        </button>
        {event && (
          <span className="text-neutral-400 text-sm">
            {event.name} · {totalPhotos} photos
          </span>
        )}
        <span className="ml-auto text-neutral-500 text-xs">{status}</span>
      </header>

      {/* Main */}
      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 bg-neutral-800 border-r border-neutral-700 p-3 flex flex-col gap-3">
          <div>
            <p className="text-xs uppercase text-neutral-500 mb-1">Batches</p>
            {event?.batches.map((b) => (
              <div key={b.id} className="text-sm py-1 px-2 rounded hover:bg-neutral-700 cursor-pointer">
                {b.name} ({b.photos.length})
              </div>
            ))}
            {!event && <p className="text-xs text-neutral-600">No event open</p>}
          </div>
          <div>
            <p className="text-xs uppercase text-neutral-500 mb-1">Frames</p>
            {event?.frame_presets.map((p) => (
              <div key={p.id} className="text-sm py-1 px-2 rounded hover:bg-neutral-700 cursor-pointer">
                {p.name}
              </div>
            ))}
            {event && event.frame_presets.length === 0 && (
              <p className="text-xs text-neutral-600">No frames configured</p>
            )}
          </div>
        </aside>

        {/* Gallery placeholder */}
        <section className="flex-1 flex items-center justify-center text-neutral-600">
          {event
            ? `${totalPhotos} photos — gallery coming soon`
            : "Open a folder to begin"}
        </section>
      </main>
    </div>
  );
}

export default App;
