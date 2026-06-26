export type Orientation = "landscape" | "portrait";

export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Photo = {
  // A photo's identity is its absolute path — there is no separate id.
  path: string;
  width: number;
  height: number;
  exif_orientation: Orientation | null;
  orientation_override: Orientation | null;
  crop_override: CropRect | null;
  print_count: number;
  save_count: number;
  content_hash: string;
  copies: number;
  size_bytes: number;
  created: number;
  modified: number;
};

// One immediate subfolder in the lazy sidebar tree. `photo_count` is direct
// image files; `has_subfolders` drives the expand chevron.
export type FolderEntry = {
  name: string;
  path: string;
  photo_count: number;
  has_subfolders: boolean;
};

export type FramePreset = {
  id: string;
  name: string;
  landscape_frame_path: string;
  portrait_frame_path: string;
  target_ratio_w: number;
  target_ratio_h: number;
};

export type CanvasPreset = {
  id: string;
  name: string;
  canvas_width_px: number;
  canvas_height_px: number;
  photos_per_canvas: number;
  dpi: number;
  cols: number;
  rows: number;
};

export type Tier = "free" | "pro" | "studio";

export type Entitlement = {
  email: string | null;
  tier: Tier;
  expires_at: string | null; // ISO date or null (active subscription, no fixed end)
  last_verified: string; // ISO datetime
};

// A machine registered to the subscription (occupies a seat).
export type Device = {
  device_hash: string;
  device_label: string;
  last_seen: string | null;
};

// Result of an auth/provision call: either signed in, or the subscription is at
// its device-seat limit and the user must disconnect one to proceed.
export type AuthResult =
  | ({ kind: "entitlement" } & Entitlement)
  | { kind: "device_limit"; devices: Device[] };

export type OrenewEvent = {
  id: string;
  name: string;
  root_path: string | null;
  // Per-photo state keyed by absolute file path. No batch grouping — the folder
  // structure is read live from disk; this holds only browsed photos.
  photos: Record<string, Photo>;
  frame_presets: FramePreset[];
  canvas_presets: CanvasPreset[];
  output_folder: string | null;
  active_frame_preset_id: string | null;
  active_canvas_preset_id: string | null;
};
