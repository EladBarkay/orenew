# MagNet Roadmap — v1.1+

## Vision

Expand MagNet beyond core photo framing into a professional event photography suite with cloud collaboration, advanced editing, and extensibility.

---

## Tier 4.1: Cloud & Collaboration (v1.1)

### Multi-Device Sync
- Sync event state across photographer's devices (laptop, tablet)
- Sync location: cloud provider (AWS S3, Dropbox, or self-hosted)
- Conflict resolution: last-modified-wins or manual merge UI
- Bandwidth-conscious: delta sync magnet.json only, not raw photos

### Cloud Backup
- Optional backup of event metadata + magnet.json
- Thumbnail cache synchronized
- License key cloud validation (optional; offline works in v1.0)
- Photographer can recover events if local device lost

### Shared Event Galleries
- Photographer exports event gallery link (read-only)
- Client views framed photos, provides feedback (star rating, notes)
- Photographer sees feedback in-app, can adjust presets accordingly
- No photo editor needed by client; purely review/feedback loop

---

## Tier 4.2: Advanced Editing (v1.2)

### In-App XMP Editor
- Modal to edit XMP adjustments per photo:
  - Exposure (brightness, black point, white point)
  - White balance (color temperature, tint)
  - Saturation, vibrance, contrast
  - Shadows, highlights, clarity
- Real-time preview of adjustments on framed image
- Copy adjustments across similar photos (batch edit)
- Save adjustments to XMP sidecar or magnet.json (photographer's choice)

### Photo Tagging & Filtering
- Star ratings (1-5) per photo
- Flags (pick, reject, review)
- Keyword tagging (e.g., "group photo", "close-up", "problematic")
- Filter gallery by: star, flag, keyword
- Persist tags to XMP sidecar

### Batch Metadata Edit
- Select multiple photos
- Apply tags, keywords, or ratings in one action
- Bulk XMP adjustments (e.g., all photos +0.3 exposure)

### Preset Library Sharing
- Export frame presets → JSON file (shareable)
- Export canvas presets → JSON file
- Import presets from community or friends
- Monetization: sell presets via Gumroad/Patreon (v1.3)

---

## Tier 4.3: RAW Ecosystem (v1.2)

### `rawloader` Crate Integration
- Support for all major RAW formats:
  - Canon: CR2, CRW
  - Nikon: NEF, NRW
  - Sony: ARW, SR2
  - Fujifilm: RAF
  - Panasonic: RW2
  - DNG (Adobe standard)
- Embedded JPEG preview for fast gallery load
- Full demosaicing for export/print (high quality)

### Color Profile Management
- Built-in sRGB, Adobe RGB, ProPhoto RGB profiles
- Camera-specific color matrices (CFA interpolation)
- Output profile selection (sRGB for web, Adobe RGB for print)
- Soft proofing in preview (simulate print output)

### Camera-Specific Demosaicing
- Bayer sensor support (most cameras)
- X-Trans sensor support (Fujifilm, Samsung)
- Edge-aware demosaicing (reduce artifacts)
- Adjustable demosaicing quality (fast vs high-quality)

---

## Tier 4.4: Feature Tier Expansion (v1.3)

### Licensing Model

| Tier | Features | Price |
|------|----------|-------|
| **Free** | JPG/PNG framing, 1 frame preset, 1 canvas preset, watermark | Free |
| **Pro** | + RAW support, no watermark, unlimited presets, XMP editing, cloud backup | $79/year |
| **Studio** | + team management, frame library, API access, white-label export | $199/year |

### Free Tier Expansion
- Current: output watermarked
- New: no watermark removal needed (watermark is v1.0 limitation, not v1.1 feature gate)
- Focus: watermark removes friction for free users to upgrade to Pro

### Pro Tier Features
- No watermark on exports
- Unlimited frame & canvas presets (free = 5 each)
- XMP editor with batch adjustments
- Cloud backup (1GB per year; pay for more)
- Priority support

### Studio Tier Features
- All Pro features
- Team management (add photographers, assign events)
- Frame library access (500+ curated frames)
- White-label export (custom branding)
- REST API for integrations (e.g., auto-export to Dropbox)
- Dedicated support

---

## Tier 4.5: Ecosystem

### Bundled Frame Library
- 50+ curated frames for different event types (wedding, portrait, event, sports)
- In-app marketplace (download individual frames or bundles)
- Community frames (photographer-submitted, curated)
- License: CC-BY-NC for Pro tier, usage rights clear

### Canvas Preset Marketplace
- Community presets (2-up, 4-up, custom grids)
- Photography-specific layouts (headshots, family groups, couple poses)
- Monetization: 70% to creator, 30% to MagNet

### Batch Print Queue
- Queue events for printing (instead of one-at-a-time)
- Schedule exports: "print all events for June on July 1st"
- Integration with print-on-demand APIs (e.g., Printful, PrintNinja)
- Order tracking in app

### Tablet Companion App (iOS/Android)
- Read-only preview of gallery on iPad
- Remote frame/canvas preset selection (send to desktop app)
- Feedback/rating on photos (syncs to desktop)
- Print queue management
- Cross-platform via React Native or Flutter

---

## Implementation Notes

### Technology Debt
- **Cloud backend**: Consider Supabase (PostgreSQL + real-time sync) vs self-hosted
- **Color management**: Embed small ICC profiles; avoid external dependencies
- **API design**: RESTful with OAuth for third-party integrations

### Monetization Timeline
- v1.1: Cloud & collaboration (free tier for individuals, Pro tier for watermark-free)
- v1.2: Advanced editing & RAW (Pro tier feature)
- v1.3: Team management, marketplace, Studio tier
- v1.4+: White-label, API, ecosystem growth

### Success Metrics (Tier 4)
- 50%+ of users upgrade to Pro (from free)
- 10+ community presets created per month
- 5+ marketplace transactions per month (v1.3+)
- NPS > 50 (user satisfaction)

---

## Post-Roadmap: Long-Term Vision

### AI-Powered Features (v2.0+)
- Auto-crop & frame detection (suggest best frame for each photo)
- Smile/eye-closed detection (flag for review)
- Background blur suggestions
- Recommended presets per event type

### Mobile-First (v2.0+)
- Native iOS/Android app with full editing
- Offline-first sync (local DB, cloud reconciliation)
- Quick export via phone camera

### Integrations (v2.0+)
- Lightroom plugin (apply presets directly)
- Capture One plugin
- Print-on-demand APIs (Printful, Printmate)
- Dropbox/Google Drive auto-sync

---

## Decision Checkpoints

Before implementing each tier:
- [ ] Tier 4.1: Confirm cloud provider (AWS S3, Dropbox, self-hosted?)
- [ ] Tier 4.2: Beta test XMP editor with 5 photographers
- [ ] Tier 4.3: Benchmark RAW demosaicing performance
- [ ] Tier 4.4: Legal review of licensing terms
- [ ] Tier 4.5: Community feedback on frame library curation

