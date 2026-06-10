# MagNet

MagNet is a desktop application designed for event photographers to batch-apply custom frames to photos.

## Features
- **Batch Processing**: High-performance frame overlay and cropping using Rust.
- **Orientation Auto-detection**: Automatically handles landscape and portrait photo orientations.
- **Print Management**: Tracks print counts per photo for easy reprint management.
- **Non-destructive**: All source files remain untouched.

## Tech Stack
- **Framework**: [Tauri](https://tauri.app/) (Rust + React)
- **Language**: Rust (Backend), TypeScript (Frontend)
- **Image Processing**: `image-rs`
- **Database**: SQLite (via `rusqlite`)

## Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v24+)
- [Rust](https://rustup.rs/) (latest stable)

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the App
Start the development environment:
```bash
npm run tauri dev
```

## License
MIT License.
