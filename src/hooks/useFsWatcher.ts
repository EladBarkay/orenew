import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { OrenewEvent } from "../types";
import { EVENTS } from "../constants";
import { parentDir } from "../lib/paths";

type Handlers = {
  onEvent: (e: OrenewEvent) => void;
  onFrameChanged: () => void;
};

/**
 * Wires the backend `fs-changed` event to the UI. The backend emits the changed
 * file path; we decide whether it's a frame PNG (→ signal a preview refetch) or a
 * photo inside a folder we've browsed (→ re-scan that folder via `select_folder`).
 *
 * The listener is registered once and reads current state via refs to avoid stale
 * closures, so passing fresh `event`/`activePath` each render is fine.
 */
export function useFsWatcher(
  event: OrenewEvent | null,
  activePath: string | null,
  handlers: Handlers
) {
  const eventRef = useRef(event);
  const activePathRef = useRef(activePath);
  const handlersRef = useRef(handlers);
  useEffect(() => { eventRef.current = event; }, [event]);
  useEffect(() => { activePathRef.current = activePath; }, [activePath]);
  useEffect(() => { handlersRef.current = handlers; });

  useEffect(() => {
    const norm = (s: string) => s.replace(/\\/g, "/").replace(/\/$/, "");

    const unlistenPromise = listen<string>(EVENTS.FS_CHANGED, async (e) => {
      const cur = eventRef.current;
      if (!cur) return;
      const changedPath = e.payload.replace(/\\/g, "/");

      // Frame PNG change → clear Rust preview cache for that preset + refresh UI.
      const changedPreset = cur.frame_presets.find(
        (fp) =>
          norm(fp.landscape_frame_path) === norm(changedPath) ||
          norm(fp.portrait_frame_path) === norm(changedPath)
      );
      if (changedPreset) {
        invoke("clear_framed_preview_cache", { presetId: changedPreset.id }).catch(() => {});
        handlersRef.current.onFrameChanged();
        return;
      }

      // Photo change → re-scan the owning folder, but only if it's one we've
      // browsed to (it holds photos in the map, or it's the active folder). We
      // never watch or refresh folders the user hasn't opened.
      const folder = parentDir(changedPath);
      const known =
        norm(folder) === norm(activePathRef.current ?? "") ||
        Object.keys(cur.photos).some((p) => norm(parentDir(p)) === norm(folder));
      if (!known) return;
      try {
        const updated = await invoke<OrenewEvent>("select_folder", {
          eventId: cur.id,
          folder,
        });
        handlersRef.current.onEvent(updated);
      } catch (err) {
        console.error("select_folder (watch refresh) failed:", err);
      }
    });
    return () => { unlistenPromise.then((u) => u()); };
  }, []); // register once; reads current state via refs
}
