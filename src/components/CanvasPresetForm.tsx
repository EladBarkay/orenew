import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { CanvasPreset, OrenewEvent } from "../types";
import { Field, NumInput } from "./ui";
import { useAsyncForm } from "../hooks/useAsyncForm";

type Props = {
  event: OrenewEvent;
  onCreated: (preset: CanvasPreset, updatedEvent: OrenewEvent) => void;
  onCancel: () => void;
  /** When provided, the form edits this preset instead of creating a new one. */
  editing?: CanvasPreset;
};

const PRESETS = [
  { label: "1-up  2400×1600", w: 2400, h: 1600, n: 1 },
  { label: "2-up  2400×1600", w: 2400, h: 1600, n: 2 },
  { label: "4-up  3600×2400", w: 3600, h: 2400, n: 4 },
  { label: "Custom", w: 0, h: 0, n: 0 },
];

/**
 * Auto-derive the grid from the photo count + canvas aspect so the user only
 * picks "photos / canvas". Slots stay close to the canvas shape; `rows` rounds up
 * so there are always at least `n` slots.
 */
function deriveGrid(n: number, w: number, h: number): { cols: number; rows: number } {
  const cols = Math.min(n, Math.max(1, Math.round(Math.sqrt((n * w) / h))));
  return { cols, rows: Math.ceil(n / cols) };
}

export default function CanvasPresetForm({ event, onCreated, onCancel, editing }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState(editing?.name ?? "");
  const [w, setW] = useState(editing?.canvas_width_px ?? 2400);
  const [h, setH] = useState(editing?.canvas_height_px ?? 1600);
  const [n, setN] = useState(editing?.photos_per_canvas ?? 2);
  const [dpi, setDpi] = useState(editing?.dpi ?? 300);
  const { error, setError, loading: saving, run } = useAsyncForm();

  const { cols, rows } = deriveGrid(n, w, h);

  function applyTemplate(idx: number) {
    const t = PRESETS[idx];
    if (t.n === 0) return; // custom — leave fields as-is
    setW(t.w); setH(t.h); setN(t.n);
    if (!name) setName(t.label.replace(/\s+/g, " ").trim());
  }

  async function save() {
    if (!name.trim()) { setError(t("canvasPreset.nameRequired")); return; }
    const input = { name: name.trim(), canvas_width_px: w, canvas_height_px: h,
      photos_per_canvas: n, dpi, cols, rows };
    await run(async () => {
      if (editing) {
        const preset = await invoke<CanvasPreset>("update_canvas_preset", {
          eventId: event.id, presetId: editing.id, preset: input,
        });
        onCreated(preset, {
          ...event,
          canvas_presets: event.canvas_presets.map((p) => (p.id === preset.id ? preset : p)),
        });
      } else {
        const preset = await invoke<CanvasPreset>("create_canvas_preset", {
          eventId: event.id, preset: input,
        });
        onCreated(preset, { ...event, canvas_presets: [...event.canvas_presets, preset] });
      }
    });
  }

  return (
    <div className="bg-neutral-800 rounded-lg p-4 space-y-3">
      <p className="text-sm font-medium text-neutral-200">
        {editing ? t("canvasPreset.editTitle") : t("canvasPreset.newTitle")}
      </p>

      {/* Quick-pick templates */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((tpl, i) => (
          <button
            key={tpl.label}
            onClick={() => applyTemplate(i)}
            className="px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 rounded"
          >
            {tpl.n === 0 ? t("canvasPreset.custom") : tpl.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="col-span-2">
          <Field label={t("canvasPreset.name")}>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-neutral-700 rounded px-2 py-1 text-neutral-100 focus:outline-none focus:ring-1 focus:ring-accent" />
          </Field>
        </div>
        <Field label={t("canvasPreset.width")}>
          <NumInput value={w} onChange={setW} min={100} />
        </Field>
        <Field label={t("canvasPreset.height")}>
          <NumInput value={h} onChange={setH} min={100} />
        </Field>
        <Field label={t("canvasPreset.photosPerCanvas")}>
          <NumInput value={n} onChange={setN} min={1} max={16} />
        </Field>
        <Field label={t("canvasPreset.gridColsRows")}>
          <div className="px-2 py-1 text-neutral-300 tabular-nums">
            {t("canvasPreset.gridAuto", { cols, rows })}
          </div>
        </Field>
        <Field label={t("canvasPreset.dpi")}>
          <NumInput value={dpi} onChange={setDpi} min={72} max={600} />
        </Field>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel}
          className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200">
          {t("common.cancel")}
        </button>
        <button onClick={save} disabled={saving}
          className="px-3 py-1.5 text-xs bg-accent hover:bg-accent-hover disabled:opacity-50 rounded font-medium">
          {saving ? t("canvasPreset.saving") : editing ? t("canvasPreset.saveChanges") : t("canvasPreset.savePreset")}
        </button>
      </div>
    </div>
  );
}
