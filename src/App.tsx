import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import Gallery from "./components/Gallery";
import PreviewPanel from "./components/PreviewPanel";
import ExportDialog from "./components/ExportDialog";
import FramePresetDialog from "./components/FramePresetDialog";
import PrintConfirmDialog from "./components/PrintConfirmDialog";
import SettingsDialog from "./components/SettingsDialog";
import CanvasPresetManager from "./components/CanvasPresetManager";
import { MagnetEvent, Photo, PhotoBatch, FramePreset, LicenseInfo } from "./types";

type Modal = "export" | "print" | "addFrame" | "settings" | "canvasPresets" | null;

function batchDisplayPath(batchPath: string, rootPath: string | null): string {
  if (!rootPath) return batchPath;
  const norm = (s: string) => s.replace(/\\/g, "/");
  const root = norm(rootPath).replace(/\/$/, "");
  const path = norm(batchPath);
  // If path is under root, show: root/relative
  if (path.startsWith(root + "/")) {
    const rel = path.slice(root.length + 1);
    return `${root}/${rel}`;
  }
  // Otherwise show absolute path
  return path;
}

export default function App() {
  const [event, setEvent] = useState<MagnetEvent | null>(null);
  const [activeBatch, setActiveBatch] = useState<PhotoBatch | null>(null);
  const [selected, setSelected] = useState<Photo | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [status, setStatus] = useState("");
  const [draggedBatchId, setDraggedBatchId] = useState<string | null>(null);
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  // Bumped whenever a frame PNG changes on disk, to force preview refetch.
  const [frameNonce, setFrameNonce] = useState(0);
  // Frame preset currently being edited (opens FramePresetDialog in edit mode).
  const [editingFrame, setEditingFrame] = useState<FramePreset | null>(null);
   // Per-photo print quantities for the current print queue (session-only,
   // separate from each photo's historical print_count).
   const [printQueue, setPrintQueue] = useState<Record<string, number>>({});
   // Per-photo export quantities for the current export queue (session-only,
   // separate from each photo's historical export_count).
   const [exportQueue, setExportQueue] = useState<Record<string, number>>({});

  // Load any saved license once on startup.
  useEffect(() => {
    invoke<LicenseInfo | null>("get_license_info")
      .then((info) => setLicense(info ?? null))
      .catch(() => {});
  }, []);

  // Stable ref so the folder-changed listener always sees current event without re-registering
  const eventRef = useRef<MagnetEvent | null>(null);
  const activeBatchRef = useRef<PhotoBatch | null>(null);
  useEffect(() => { eventRef.current = event; }, [event]);
  useEffect(() => { activeBatchRef.current = activeBatch; }, [activeBatch]);

  // Wire up the FS watcher. The backend emits the changed file path; we decide
  // whether it belongs to a batch folder (→ refresh that batch) or is a frame
  // PNG (→ bump the preview nonce so framed previews refetch).
  useEffect(() => {
    const norm = (s: string) => s.replace(/\\/g, "/");
    const parentDir = (p: string) => p.slice(0, p.lastIndexOf("/"));

    const unlistenPromise = listen<string>("fs-changed", async (e) => {
      const cur = eventRef.current;
      if (!cur) return;
      const changedPath = norm(e.payload);

      // Frame PNG change → refresh previews.
      const isFrame = cur.frame_presets.some(
        (fp) =>
          norm(fp.landscape_frame_path) === changedPath ||
          norm(fp.portrait_frame_path) === changedPath
      );
      if (isFrame) {
        setFrameNonce((n) => n + 1);
        return;
      }

      // Photo change → refresh the owning batch.
      const folder = parentDir(changedPath);
      const batch = cur.batches.find((b) => norm(b.source_path) === folder);
      if (!batch) return;
      try {
        const updated = await invoke<MagnetEvent>("refresh_batch", {
          eventId: cur.id,
          batchId: batch.id,
        });
        setEvent(updated);
        const active = activeBatchRef.current;
        if (active) {
          const refreshed = updated.batches.find((b) => b.id === active.id);
          if (refreshed) setActiveBatch(refreshed);
        }
      } catch (err) {
        console.error("refresh_batch failed:", err);
      }
    });
    return () => { unlistenPromise.then((u) => u()); };
  }, []); // register once; reads current event via ref

  async function openEvent() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const folder = await open({ directory: true, multiple: false });
      if (!folder) return;
      setStatus("Loading…");
      const evt = await invoke<MagnetEvent>("open_event", { path: folder });
      setEvent(evt);
      setActiveBatch(evt.batches[0] ?? null);
      setSelected(null);
      setPrintQueue({});
      // Re-establish FS watches for this event's batches + frame PNGs.
      invoke("sync_watches", { eventId: evt.id }).catch(() => {});
      setStatus("");
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  }

  async function deleteEvent() {
    if (!event) return;
    const { confirm } = await import("@tauri-apps/plugin-dialog");
    const yes = await confirm(
      `Delete event "${event.name}"? This removes all saved settings and cannot be undone.`,
      { title: "Delete event", kind: "warning" }
    );
    if (!yes) return;
    try {
      await invoke("delete_event", { eventId: event.id });
      setEvent(null);
      setActiveBatch(null);
      setSelected(null);
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  }

  async function deleteBatch(batch: PhotoBatch) {
    if (!event) return;
    const { confirm } = await import("@tauri-apps/plugin-dialog");
    const yes = await confirm(
      `Remove batch "${batch.name}" from this event? Files are not deleted.`,
      { title: "Remove batch", kind: "warning" }
    );
    if (!yes) return;
    try {
      const updated = await invoke<MagnetEvent>("delete_batch", { eventId: event.id, batchId: batch.id });
      updateEvent(updated);
      if (activeBatch?.id === batch.id) {
        setActiveBatch(updated.batches[0] ?? null);
        setSelected(null);
      }
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  }

  function reorderBatch(targetId: string) {
    if (!event || !draggedBatchId || draggedBatchId === targetId) return;
    const batches = [...event.batches];
    const fromIdx = batches.findIndex((b) => b.id === draggedBatchId);
    const toIdx = batches.findIndex((b) => b.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = batches.splice(fromIdx, 1);
    batches.splice(toIdx, 0, moved);
    const updated = { ...event, batches };
    setEvent(updated);
    invoke("save_event", { event: updated }).catch(() => {});
  }

  async function deleteFramePreset(preset: FramePreset) {
    if (!event) return;
    const { confirm } = await import("@tauri-apps/plugin-dialog");
    const yes = await confirm(
      `Delete frame preset "${preset.name}"? The PNG files are not deleted.`,
      { title: "Delete frame preset", kind: "warning" }
    );
    if (!yes) return;
    try {
      await invoke("delete_frame_preset", { eventId: event.id, presetId: preset.id });
      const remaining = event.frame_presets.filter((p) => p.id !== preset.id);
      updateEvent({
        ...event,
        frame_presets: remaining,
        active_frame_preset_id:
          event.active_frame_preset_id === preset.id
            ? remaining[0]?.id ?? null
            : event.active_frame_preset_id,
      });
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  }

  async function addBatch() {
    if (!event) return;
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const folder = await open({
        directory: true,
        multiple: false,
        defaultPath: event.root_path ?? undefined,
      });
      if (!folder) return;
      setStatus("Loading batch…");
      const updated = await invoke<MagnetEvent>("add_batch", { eventId: event.id, folder });
      updateEvent(updated);
      const newBatch = updated.batches[updated.batches.length - 1];
      if (newBatch) setActiveBatch(newBatch);
      setSelected(null);
      setStatus("");
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  }

  function updateEvent(updated: MagnetEvent) {
    setEvent(updated);
    if (activeBatch) {
      const refreshed = updated.batches.find((b) => b.id === activeBatch.id);
      if (refreshed) setActiveBatch(refreshed);
    }
  }

  const totalPhotos = event?.batches.reduce((n, b) => n + b.photos.length, 0) ?? 0;
  const photos = activeBatch?.photos ?? [];
  const hasFramePreset = !!event?.active_frame_preset_id;
  const queuedPrints = Object.values(printQueue).reduce((s, q) => s + q, 0);

  function adjustQty(photoId: string, delta: number) {
    setPrintQueue((prev) => {
      const next = Math.max(0, (prev[photoId] ?? 0) + delta);
      const updated = { ...prev };
      if (next === 0) delete updated[photoId];
      else updated[photoId] = next;
      return updated;
    });
  }

  // After a successful print: optimistically bump print_count for queued photos
  // (the backend has already persisted these increments) and clear the queue.
  function handlePrinted() {
    setEvent((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        batches: prev.batches.map((b) => ({
          ...b,
          photos: b.photos.map((p) =>
            printQueue[p.id]
              ? { ...p, print_count: p.print_count + printQueue[p.id] }
              : p
          ),
        })),
      };
    });
    setActiveBatch((prev) =>
      prev
        ? {
            ...prev,
            photos: prev.photos.map((p) =>
              printQueue[p.id]
                ? { ...p, print_count: p.print_count + printQueue[p.id] }
                : p
            ),
          }
        : prev
    );
    setPrintQueue({});
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-neutral-100 select-none">
      {/* Toolbar */}
      <header className="flex items-center gap-3 px-4 py-2.5 bg-neutral-800 border-b border-neutral-700 shrink-0">
        <span className="font-bold text-base tracking-tight text-white">MagNet</span>
        <div className="w-px h-4 bg-neutral-600" />
        <button onClick={openEvent}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded text-sm font-medium transition-colors">
          Open Event
        </button>

        {event && (
          <>
            <span className="text-neutral-300 text-sm font-medium">{event.name}</span>
            <span className="text-neutral-500 text-xs">{totalPhotos} photos</span>

            {/* Delete event */}
            <button
              onClick={deleteEvent}
              title="Delete this event"
              className="text-neutral-600 hover:text-red-400 transition-colors"
            >
              <TrashIcon />
            </button>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setModal("print")}
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
                onClick={() => setModal("export")}
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
          onClick={() => setModal("settings")}
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
              license?.tier === "pro" ? "bg-green-700/80 text-white" : "bg-neutral-700 text-neutral-300",
            ].join(" ")}
          >
            {license?.tier === "pro" ? "Pro" : "Free"}
          </span>
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 shrink-0 flex flex-col bg-neutral-850 border-r border-neutral-700 overflow-y-auto">
          {event ? (
            <>
              <Section
                label="Batches"
                action={
                  <button
                    onClick={addBatch}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-medium"
                  >
                    + Add
                  </button>
                }
              >
                {event.batches.length === 0 ? (
                  <p className="px-3 py-1 text-xs text-neutral-600">
                    No batches —{" "}
                    <button onClick={addBatch} className="text-blue-400 hover:text-blue-300 underline">
                      add a folder
                    </button>
                  </p>
                ) : (
                  event.batches.map((b) => {
                    const displayPath = batchDisplayPath(b.source_path, event.root_path);
                    return (
                      <div
                        key={b.id}
                        draggable
                        onDragStart={() => setDraggedBatchId(b.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); reorderBatch(b.id); }}
                        onDragEnd={() => setDraggedBatchId(null)}
                        className={`group relative ${draggedBatchId === b.id ? "opacity-40" : ""}`}
                      >
                        <button
                           onClick={() => { setActiveBatch(b); setSelected(null); }}
                           onDoubleClick={async () => {
                             try {
                               const { openPath } = await import("@tauri-apps/plugin-opener");
                               await openPath(b.source_path);
                             } catch {}
                           }}
                           className={[
                             "w-full text-left px-3 py-1.5 pr-8 text-sm transition-colors",
                             b.id === activeBatch?.id
                               ? "bg-blue-600/20 text-blue-300"
                               : "text-neutral-300 hover:bg-neutral-700/60",
                           ].join(" ")}
                         >
                           <span className="block truncate">{b.name}</span>
                           <span
                             className="block text-[10px] text-neutral-500 truncate"
                             title={b.source_path}
                           >
                             path: {displayPath}
                           </span>
                           <span className="block text-[10px] text-neutral-600">
                             {b.photos.length} photos
                           </span>
                         </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteBatch(b); }}
                          title="Remove batch"
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <SmallTrashIcon />
                        </button>
                      </div>
                    );
                  })
                )}
              </Section>

              <Section
                label="Frames"
                action={
                  <button
                    onClick={() => setModal("addFrame")}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-medium"
                  >
                    + Add
                  </button>
                }
              >
                {event.frame_presets.length === 0 ? (
                  <p className="px-3 py-1 text-xs text-neutral-600">
                    No frames —{" "}
                    <button
                      onClick={() => setModal("addFrame")}
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      add one
                    </button>
                  </p>
                ) : (
                  event.frame_presets.map((p) => (
                    <div key={p.id} className="group relative">
                      <SidebarItem
                        label={p.name}
                        sublabel={`${p.target_ratio_w}:${p.target_ratio_h} · ${p.crop_method === "center" ? "center" : "rule of thirds"}`}
                        active={p.id === event.active_frame_preset_id}
                        onClick={async () => {
                          const updated = { ...event, active_frame_preset_id: p.id };
                          setEvent(updated);
                          await invoke("save_event", { event: updated }).catch(() => {});
                        }}
                      />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingFrame(p); }}
                          title="Edit frame preset"
                          className="p-1 text-neutral-500 hover:text-blue-400"
                        >
                          <EditIcon />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteFramePreset(p); }}
                          title="Delete frame preset"
                          className="p-1 text-neutral-500 hover:text-red-400"
                        >
                          <SmallTrashIcon />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </Section>

              <Section
                label="Canvas presets"
                action={
                  <button
                    onClick={() => setModal("canvasPresets")}
                    className="text-[10px] text-blue-400 hover:text-blue-300 font-medium"
                  >
                    Manage
                  </button>
                }
              >
                {event.canvas_presets.length === 0 ? (
                  <p className="px-3 py-1 text-xs text-neutral-600">
                    No presets —{" "}
                    <button
                      onClick={() => setModal("canvasPresets")}
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      add one
                    </button>
                  </p>
                ) : (
                  event.canvas_presets.map((p) => (
                    <SidebarItem
                      key={p.id}
                      label={p.name}
                      sublabel={`${p.canvas_width_px}×${p.canvas_height_px} · ${p.photos_per_canvas}-up`}
                      active={false}
                      onClick={() => setModal("canvasPresets")}
                    />
                  ))
                )}
              </Section>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-neutral-600 text-xs p-4 text-center">
              Open an event to begin
            </div>
          )}
        </aside>

        {/* Gallery area */}
        {event ? (
          <div className="flex flex-1 overflow-hidden">
            <Gallery
              photos={photos}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              printQueue={printQueue}
              onQtyDelta={adjustQty}
              exportQueue={exportQueue}
              onExportQtyDelta={(photoId, delta) => {
                setExportQueue((prev) => ({
                  ...prev,
                  [photoId]: Math.max(0, (prev[photoId] ?? 0) + delta),
                }));
              }}
            />
            {selected && (
              <PreviewPanel
                event={event}
                photo={selected}
                onClose={() => setSelected(null)}
                frameNonce={frameNonce}
              />
            )}
          </div>
        ) : (
          <EmptyState onOpen={openEvent} />
        )}
      </div>

      {/* Modals */}
       {modal === "export" && event && activeBatch && (
         <ExportDialog
           event={event}
           batch={activeBatch}
           exportQueue={exportQueue}
           onClose={() => setModal(null)}
           onEventUpdate={updateEvent}
           onClearExportQueue={() => setExportQueue({})}
         />
       )}
      {modal === "print" && event && (
        <PrintConfirmDialog
          event={event}
          printQueue={printQueue}
          onClose={() => setModal(null)}
          onEventUpdate={updateEvent}
          onPrinted={handlePrinted}
        />
      )}
      {modal === "addFrame" && event && (
        <FramePresetDialog
          event={event}
          onCreated={(updatedEvent) => {
            updateEvent(updatedEvent);
            invoke("sync_watches", { eventId: updatedEvent.id }).catch(() => {});
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "settings" && (
        <SettingsDialog
          license={license}
          onClose={() => setModal(null)}
          onLicenseChange={setLicense}
        />
      )}
      {modal === "canvasPresets" && event && (
        <CanvasPresetManager
          event={event}
          onClose={() => setModal(null)}
          onEventUpdate={updateEvent}
        />
      )}
      {editingFrame && event && (
        <FramePresetDialog
          event={event}
          editing={editingFrame}
          onCreated={(updatedEvent) => {
            updateEvent(updatedEvent);
            invoke("sync_watches", { eventId: updatedEvent.id }).catch(() => {});
            setFrameNonce((n) => n + 1);
            setEditingFrame(null);
          }}
          onClose={() => setEditingFrame(null)}
        />
      )}
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────────────────

function Section({
  label, children, action,
}: {
  label: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="py-2">
      <div className="flex items-center justify-between px-3 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
          {label}
        </p>
        {action}
      </div>
      {children}
    </div>
  );
}

function SidebarItem({
  label, sublabel, active, onClick,
}: {
  label: string; sublabel?: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full text-left px-3 py-1.5 text-sm transition-colors",
        active ? "bg-blue-600/20 text-blue-300" : "text-neutral-300 hover:bg-neutral-700/60",
      ].join(" ")}
    >
      <span className="block truncate">{label}</span>
      {sublabel && <span className="block text-[10px] text-neutral-500">{sublabel}</span>}
    </button>
  );
}

function EmptyState({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-600">
      <svg className="w-16 h-16 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <p className="text-sm">Open an event to begin</p>
      <button onClick={onOpen}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium text-white transition-colors">
        Open Event
      </button>
    </div>
  );
}

function ExportIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function SmallTrashIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
