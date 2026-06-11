import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LicenseInfo } from "../types";

type Props = {
  license: LicenseInfo | null;
  onClose: () => void;
  onLicenseChange: (license: LicenseInfo | null) => void;
};

export default function SettingsDialog({ license, onClose, onLicenseChange }: Props) {
  const [email, setEmail] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isPro = license?.tier === "pro";

  async function activate() {
    if (!email.trim() || !key.trim()) {
      setError("Enter both email and license key");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const info = await invoke<LicenseInfo>("validate_license", {
        key: key.trim(),
        email: email.trim(),
      });
      onLicenseChange(info);
      setKey("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    try {
      await invoke("clear_license");
      onLicenseChange(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-neutral-100">Settings</h2>

        {/* License status */}
        <div className="rounded-lg bg-neutral-800 p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              License
            </span>
            <span
              className={[
                "text-xs font-semibold px-2 py-0.5 rounded-full",
                isPro ? "bg-green-700/80 text-white" : "bg-neutral-700 text-neutral-300",
              ].join(" ")}
            >
              {isPro ? "Pro" : "Free"}
            </span>
          </div>
          {license ? (
            <div className="text-xs text-neutral-400">
              <p>{license.email}</p>
              <p>Expires {license.expiry}</p>
            </div>
          ) : (
            <p className="text-xs text-neutral-500">
              Free tier — exported and printed canvases are watermarked.
            </p>
          )}
        </div>

        {isPro ? (
          <button
            onClick={deactivate}
            disabled={busy}
            className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40"
          >
            Remove license
          </button>
        ) : (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-400">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full bg-neutral-700 rounded px-2 py-1.5 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <label className="block text-xs font-medium text-neutral-400">
              License key
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="MAGNET-…"
                className="mt-1 w-full bg-neutral-700 rounded px-2 py-1.5 text-sm font-mono text-neutral-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200"
          >
            Close
          </button>
          {!isPro && (
            <button
              onClick={activate}
              disabled={busy}
              className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded font-medium"
            >
              {busy ? "Activating…" : "Activate"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-5">
        {children}
      </div>
    </div>
  );
}
