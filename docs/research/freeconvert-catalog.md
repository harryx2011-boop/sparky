# FreeConvert.com catalogue

Research report, 2026-09-25, gathered by a headless Playwright Chromium run over www.freeconvert.com (101 pages, no uploads, no accounts, robots.txt respected; `api.freeconvert.com` disallows crawling and was not read). The full machine-readable catalogue (4.6 MB) is outside the repo at `D:\sparky\research\freeconvert-catalog.json`: `categories[].tools[]` ({slug, url, from, to, kind, options, optionSet, optionsInferred}), `optionSets` (79 full option trees), `limits`, `counts`, `notes`.

Where the data comes from: the from→to matrix is the site's own `/v1/query/view/conversion-support` response; advanced options are `window.__NUXT__.state.info.advancedOptions` on each page, the same data the "Advanced settings" panel draws.

## Counts

| Measure | Count |
|---|---|
| English paths in the sitemap | 6,766 |
| Source formats in the matrix | 194: image 64, video 40, document 37, audio 27, vector 9, ebook 8, archive 7, CAD 2 |
| Unique from→to pairs | 2,773 (2,675 have their own page) |
| Converter hub pages | 205 |
| Compress sources | 42 |
| Merge sources | 58 |
| Unit converters | 10 categories, 722 pairs |
| Time-zone converters | 3,080 pairs |

Pairs per category: Video 898, Image 845, Audio 621, Document 255, Vector 73, Archive 49, Ebook 28, CAD 4.

## Target formats

- Video (16): 3gp avi flv mkv mov mp4 ogv webm wmv, plus device presets android, ipad, iphone, kindle, mobile, psp, xbox
- Audio (14): aac aiff alac amr flac m4a mp3 ogg wav wma, plus presets android, ipad, iphone, ipod
- Image (14): apng bmp eps gif ico jpeg jpg odd png psd svg tga tiff webp
- Document (19): csv doc docx excel html odp ods odt pdf ppt pptx ps rtf text txt word xls xlsx xml
- Ebook: azw3 epub mobi
- Archive: 7z gz rar tar targz tgz zip
- Vector: emf wmf
- CAD: dwg dxf

Not available as outputs: AVIF, JXL, HEIC, OPUS, M4R, SVG-from-PDF.

Source-only formats: 22 camera RAW formats plus vendor aliases; heic, heif, jxl, avif, djvu, cbr, cbz; pages, hwp, wps, pub, xps, eml, chm, lit, fb2; mxf, m2ts, dvr-ms, wtv, swf; ape, caf, midi.

## Tools that are not plain A→B conversions

- Compress (8): `video-compressor` (42 sources to 3gp/avi/flv/mkv/mov/mp4), `mp3-compressor`, `wav-compressor`, `image-compressor`, `compress-jpeg`, `compress-png`, `gif-compressor`, `compress-pdf`.
- PDF (12): `merge-pdf`, `split-pdf` (custom, N pages per file, range, odd/even, halve pages, extract all), `organize-pdf` (drag, rotate, duplicate, delete, sort), `rotate-pdf` (all/odd/even/landscape/portrait), `crop-pdf`, `resize-pdf`, `flatten-pdf`, `unlock-pdf`, `password-protect-pdf`, `pdf-page-remover`, `extract-pages-from-pdf`, `extract-images-from-pdf` (ZIP out).
- Merge: 58 image and vector sources into one PDF or one animated GIF (free plan 15 files).
- Video: `crop-video`, `video-trimmer`, `gif-maker`; gif→mp4, apng↔gif, image→gif.
- OCR and web capture: `ocr-converter`, `image-to-text` (Tesseract, ~100 languages, out txt/doc/docx/pdf), `image-to-word`, `webpage-converter`, html→pdf.
- Utilities: unit converters (length, weight, temperature, energy, area, frequency, power, electric, charge, voltage), time-zone converter, developer API.
- Sister sites (not crawled): imageresizer.com, photojoiner, ClipSnap, ProPDF.
- Not present: QR, hash, checksum, watermark.

## Option sets by tool kind

- Video convert: codec (auto, VP8, VP9, x264, x265, NVENC h264/hevc/av1, theora, wmv2, mpeg4/xvid/dx50, flv1, huffyuv, copy; filtered by target); rate control CRF/CBR, bitrate presets 250k–16000k, VBR, speed preset, tune, profile, level; resolution presets 240p–1440p, portrait sizes, custom; aspect presets; fit (max, crop, scale, pad); fps 1–59.94; rotate 90/180/270; flip; "compatible with old devices"; subtitles (none/copy/upload, burned or soft); audio codec, bitrate, sample rate, channels, volume 0–300%, fade, remove audio; trim; crop W×H + X/Y.
- Audio convert: codec; rate control, bitrate, sample rate, channels; volume; fade; reverse; trim; FLAC compression level 0–12.
- Image convert: resize (keep, width, height, W×H, percent); auto-orient; strip metadata. JPG: background colour, quality 1–100 or max KB. PNG: compression level, colour to transparency. WEBP: lossless. TIFF: compression (lzw, zip, jpeg, RLE, Group4), DPI. ICO: sizes 16–256. GIF: merge frames, alignment, compression. SVG vectorise: colour/B&W, stacked/cutout, precision, gradient step, speckle, curve mode, thresholds.
- Image or SVG → PDF: page size (A4, A3, Letter, Legal, ArchA, ArchB, B4, B5, Ledger, Tabloid, same as image, custom mm/in); orientation; margin; 9-point alignment; enlarge to fit; strip metadata; merge into one PDF; SVG pixel density.
- PDF → image: resize, compression, convert or extract embedded images, DPI 150/300/600, page range, password.
- Office → PDF: page range, optimise for screen/print, PDF/A, bookmarks, password; pptx handout layouts; xlsx fit-to-page, print areas, separators, zoom.
- PDF → HTML: page range, zoom, outline, embed JS/fonts/CSS/images, split pages, background format.
- HTML → PDF: page size, orientation, margin, viewport width, delay, hide cookie notices, print stylesheet.
- Ebook: reader profile (~20 devices), heuristics, margins, font rescale, ASCII-ise, encoding, title, author.
- Archive, PDF→Word, PDF→TXT: password only.
- Compressors: video (codec x264/x265/NVENC; target by % size, MB, CRF, resolution 144p–8K, or max bitrate; speed); JPEG (quality, max KB, %, lossless, progressive, chroma 4:2:0, grayscale, resize); PNG (quality, speed, 8–256 colours, resize); GIF (level 1–200, drop frames, colours/dither, transparency fuzz); MP3 (%, MB, quality); PDF (none, screen, printer, prepress, grayscale).
- PDF tools: resize presets A0–A8, B0–B5, C4–C6, Letter, Legal, Tabloid, custom, DPI; protect/organize password; optional output compression.
- GIF from video: trim, width, loop count, transparency, fps 1–30, compression, static-background optimisation.
- Crop video: ~30 aspect presets or free, W×H, X/Y. Trim video: start and end.

## Limits

| Plan | Price | Conversion minutes | Max file | Encoding |
|---|---|---|---|---|
| Free | — | 20 per day, 5 per file | 1 GB | CPU |
| Basic | $12.99/mo | 1,500 per month | 1.5 GB | CPU |
| Standard | $24.99/mo | 2,000 per month | 2 GB | CPU |
| Pro | $29.99/mo | 4,000 per month | 5 GB | GPU/CPU |
| Scale | on demand | up to 1M per month | up to 20 GB | GPU/CPU |

Free plan also: 15 conversions a day, 5 at once, merge up to 15 files, 10 downloads per file, jobs killed after 120 s, ads. Files deleted after 8 hours.

## What a desktop tool does better

1. No caps: no size ceiling, no minutes, no per-file kill, no merge limit, no queue.
2. Privacy: passwords, protect/unlock and OCR scans never leave the machine.
3. Real batch work: folders with recursion, presets, a job list that survives restart, folder watch, Explorer "Convert to…".
4. Local GPU for free (FreeConvert charges for NVENC).
5. Output gaps to fill: AVIF, JXL, HEIC, OPUS, M4R; lossless remux by default; HDR passthrough.
6. Automation: CLI and MCP with the same option names, no API credits.
7. Instant local preview for trim, crop and PDF organise.

## Not reached

Post-upload editors (merge, split, organize, crop, rotate PDF; crop and trim video) and the live "Convert to" dropdown (populated from the same matrix captured). No option schema on: image-compressor, gif→mp4, apng↔gif, image→word, txt→pdf, the ocr and webpage hubs. Only 79 pairs checked directly; others carry `optionsInferred: true`.
