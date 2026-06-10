import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

// Module-level cache survives re-renders; blob URLs are valid for the app lifetime
const cache = new Map<string, string>();
// Track in-flight requests to avoid duplicate invocations for the same path
const inflight = new Map<string, Promise<string>>();

export function useThumbnail(photoPath: string): string | null {
  const [src, setSrc] = useState<string | null>(cache.get(photoPath) ?? null);

  useEffect(() => {
    if (cache.has(photoPath)) {
      setSrc(cache.get(photoPath)!);
      return;
    }

    let cancelled = false;

    const pending =
      inflight.get(photoPath) ??
      invoke<number[]>("get_thumbnail", { photoPath }).then((bytes) => {
        const url = URL.createObjectURL(
          new Blob([new Uint8Array(bytes)], { type: "image/jpeg" })
        );
        cache.set(photoPath, url);
        inflight.delete(photoPath);
        return url;
      });

    if (!inflight.has(photoPath)) inflight.set(photoPath, pending);

    pending.then((url) => {
      if (!cancelled) setSrc(url);
    });

    return () => {
      cancelled = true;
    };
  }, [photoPath]);

  return src;
}
