import { useEffect } from "react";
import { onOpenUrl, getCurrent } from "@tauri-apps/plugin-deep-link";
import { supabase } from "../lib/supabase";
import { establishFromSession } from "../lib/auth";
import type { Entitlement } from "../types";

/// Handles the OAuth deep-link callback `magnet://auth-callback?code=…`:
/// exchanges the PKCE code for a Supabase session, then hands it to Rust.
export function useAuthDeepLink(onEntitlement: (e: Entitlement) => void) {
  useEffect(() => {
    let unsub: (() => void) | undefined;

    async function handle(urls: string[]) {
      for (const raw of urls) {
        if (!raw.startsWith("magnet://auth-callback")) continue;
        try {
          const code = new URL(raw).searchParams.get("code");
          if (!code) continue;
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error || !data.session) continue;
          const entitlement = await establishFromSession(data.session);
          onEntitlement(entitlement);
        } catch {
          // Ignore malformed/expired callbacks.
        }
      }
    }

    // Handle a link that launched the app, plus any while it's running.
    getCurrent().then((urls) => { if (urls) handle(urls); }).catch(() => {});
    onOpenUrl(handle).then((fn) => { unsub = fn; }).catch(() => {});

    return () => { unsub?.(); };
  }, [onEntitlement]);
}
