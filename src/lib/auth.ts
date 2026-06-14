import { invoke } from "@tauri-apps/api/core";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Entitlement } from "../types";

/// Hand a freshly obtained Supabase session to Rust (the source of truth), which
/// verifies the JWT, fetches the entitlement, and persists the session. Rust now
/// owns the session, so we drop the local supabase copy.
export async function establishFromSession(session: Session): Promise<Entitlement> {
  const entitlement = await invoke<Entitlement>("establish_session", {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? 0,
  });
  await supabase.auth.signOut({ scope: "local" });
  return entitlement;
}
