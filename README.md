<p align="center">
  <img src="apps/desktop/build/icon.png" width="88" height="88" alt="Sparky logo">
</p>

<h1 align="center">Sparky</h1>

<p align="center"><b>Convert anything. Download everything.</b><br>
A free, open-source file converter and link downloader for Windows. Everything happens on your PC.</p>

<p align="center">
  <a href="https://github.com/harryx2011-boop/sparky/releases/latest">Download for Windows</a> ·
  <a href="https://sparky-labs.vercel.app">Website</a> ·
  <a href="docs/SPEC.md">Product spec</a>
</p>

---

## What it does

- **Converts files** between common formats: video (MP4, WEBM, MKV, MOV, GIF), audio (MP3, WAV, FLAC, M4A, OGG), images (PNG, JPG, WEBP, AVIF, ICO, and HEIC or BMP in), documents (PDF, DOCX, MD, HTML, TXT) and archives (ZIP, 7Z, and RAR in).
- **Shrinks files** without changing their format. Pick the same format and slide **Compression** from *Lossless* (an original quality export) to *Tiny*.
- **Downloads from links**: YouTube, TikTok, Instagram, X, Vimeo, SoundCloud, Twitch, Reddit, Facebook and well over a thousand other sites, including whole playlists and channels, up to 4K. You can turn a download into MP3 (or anything else) in the same step.
- **Lets you choose how hard it works**: *Low* stays quiet, *Normal* is everyday speed, and *Max* uses your graphics card and all of your processor. 1440p and 4K unlock on Max when your video and graphics card allow it.
- **Handles the small things**: batch conversion (drop a whole folder and several files run at the same time), one queue for everything, history you can re-run, clipboard link detection, tray mode, Windows notifications, cover art and tags, subtitles, and skipping sponsor segments.

No uploads, no account, nothing to set up. Your originals are kept unless you ask otherwise, and even then they go to the Recycle Bin.

## Tools

Beyond converting and downloading, the **Tools** page (Ctrl+3) and the `sparky` command run:

- **PDF**: images to PDF, PDF to images, merge, split, rotate, remove or extract pages, save the images inside, flatten, and (with Ghostscript) shrink, add or remove a password.
- **Video and audio**: trim, crop, turn, resize, change speed or volume, shrink to a target size, make thumbnails, turn a clip into a GIF.
- **Images**: resize, rotate, strip metadata, make a Windows icon, turn several images into a GIF.
- **Text**: read the text in an image or PDF, as plain text or a searchable PDF.

`sparky ops` lists them all and which ones can run on this PC.

## For agents

Every tool is also open to AI agents, scripts and other programs. The work runs on your PC and your files never leave it.

- **Claude Code and other agents (MCP):** `claude mcp add --scope user sparky -- cmd /c sparky mcp`, or open **Settings → Agents** in the app and add Sparky to your agent with one click. `sparky init --client claude-code|cursor|codex|windsurf` does the same from a terminal.
- **Terminal:** the installer puts `sparky` on your PATH.

  ```sh
  sparky pdf merge a.pdf b.pdf
  sparky convert clip.mov --to mp4
  ```

  Add `--json` for output a script can read. The `sparky` command is installed with Sparky.
- **Any program (HTTP):** while the app is open it takes jobs at `http://127.0.0.1:8600`, reachable only from this PC. Each request carries the token in `%APPDATA%\Sparky\api-token`, which only your Windows account can read.

  ```powershell
  $token = Get-Content "$env:APPDATA\Sparky\api-token"
  $body = '{"op":"pdf.merge","args":{"files":["C:/a.pdf","C:/b.pdf"]}}'
  Invoke-RestMethod -Method Post http://127.0.0.1:8600/v1/jobs `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType 'application/json' -Body $body
  ```

Full details: [packages/cli/README.md](packages/cli/README.md).

## Install

Download `Sparky-Setup.exe` from the [latest release](https://github.com/harryx2011-boop/sparky/releases/latest) and run it. Sparky needs Windows 10 or 11 (64-bit). It updates itself, and it keeps its downloader current so sites keep working.

Two optional extras, used only if you install them yourself:

- [Ghostscript](https://ghostscript.com/releases/gsdnld.html) lets Sparky shrink PDFs.
- [LibreOffice](https://www.libreoffice.org/) gives more faithful Word-to-PDF conversion. Without it, Sparky still makes a clean PDF.

## Build from source

You need Node.js 22+ and npm.

```bash
git clone https://github.com/harryx2011-boop/sparky.git
cd sparky
npm install

npm run dev:web          # the landing site at http://localhost:4600
npm run dev:ui -w @sparky/desktop   # the app's interface in a browser, with sample data
npm run fetch-fonts      # download the Satoshi font (optional; falls back to system fonts)
npm run fetch-tools      # download FFmpeg, yt-dlp, Pandoc, 7-Zip and Deno (Windows builds)
npm run dev:app          # the real app in Electron
npm run package:win      # build Sparky-Setup.exe (run on Windows)
```

`npm run check` runs every type check and test and builds everything.

## How it's put together

```
apps/
  desktop/        Electron app
    src/main/         window, tray, notifications, IPC
    src/preload/      the small API the interface is allowed to use
    src/renderer/     React + Tailwind + shadcn/ui interface
  web/            landing site (React + Tailwind + Motion, canvas sprite field), deployed to Vercel; its Tools list is src/data/ops.json, written by scripts/gen-site-ops.mjs
packages/
  cli/            the sparky command, MCP server and init, bundled into the installer and published to npm
  core/           shared logic: formats, levels, 1440p/4K rules, tool command lines, progress parsing
  engine/         op registry, job queue, tool runners, history (no Electron imports, tested on its own)
  ui/             shared look: theme, Performance bars, Compression slider, Resolution picker
scripts/          fetch-tools (bundled binaries), make-icons, stage-cli and gen-site-ops
docs/             product spec and the original design mockup
```

The interface never touches the file system. Every conversion and download is a job in one queue in the main process, so progress, cancelling and history behave the same everywhere.

| Job | Tool |
| --- | --- |
| Video, audio, some images | [FFmpeg](https://ffmpeg.org) |
| Fast image paths | [sharp](https://sharp.pixelplumbing.com) |
| Documents | [Pandoc](https://pandoc.org), plus Chromium's PDF printer built into Electron |
| PDF text | [pdf.js](https://mozilla.github.io/pdf.js/) |
| Archives | [7-Zip](https://www.7-zip.org) |
| Downloads | [yt-dlp](https://github.com/yt-dlp/yt-dlp), with [Deno](https://deno.com) for YouTube |
| History and settings | SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |

## Testing

```bash
npm test
```

The engine tests run real conversions when you point `SPARKY_TEST_BIN` at a folder containing `ffmpeg`, `ffprobe`, `pandoc`, `7z` (or `7za`) and, optionally, `yt-dlp`. Without it, those tests are skipped. CI installs the tools and runs everything.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Contact

- Email: [harryx2011@gmail.com](mailto:harryx2011@gmail.com)
- Discord: `ogexr.`

## License

Sparky is [MIT licensed](LICENSE). The tools it bundles keep their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
