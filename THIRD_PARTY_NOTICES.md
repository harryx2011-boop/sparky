# Third-party notices

Sparky itself is MIT licensed. The Windows installer also ships these separate programs, unchanged, next to the app in `resources\bin`. Sparky runs them as separate processes. Each keeps its own license, and you can get the source for each at the link given.

| Program | License | Source |
| --- | --- | --- |
| FFmpeg and FFprobe (BtbN "gpl" build) | GPL-3.0-or-later | https://github.com/BtbN/FFmpeg-Builds and https://ffmpeg.org/download.html#get-sources |
| yt-dlp | Unlicense | https://github.com/yt-dlp/yt-dlp |
| Pandoc | GPL-2.0-or-later | https://github.com/jgm/pandoc |
| 7-Zip | LGPL-2.1-or-later, with the unRAR license restriction for RAR code | https://www.7-zip.org and https://github.com/ip7z/7zip |
| Deno | MIT | https://github.com/denoland/deno |

The exact versions bundled in a release are listed in `resources\bin\VERSIONS.json` inside the installed app.

Sparky also uses these libraries, which are bundled into the app:

| Library | License |
| --- | --- |
| Electron and Chromium | MIT, plus Chromium's licenses (see `LICENSES.chromium.html` in the install folder) |
| React, React DOM | MIT |
| sharp and libvips | Apache-2.0, LGPL-3.0 (libvips) |
| better-sqlite3 and SQLite | MIT, public domain |
| pdf.js | Apache-2.0 |
| Radix UI, cmdk, sonner, lucide-react, Motion, Tailwind CSS | MIT (lucide-react: ISC) |
| Simple Icons (brand icons) | CC0-1.0; brand marks belong to their owners |
| IBM Plex Mono | SIL Open Font License 1.1 |
| Satoshi (fetched at build time, not in git) | ITF Free Font License, Indian Type Foundry via Fontshare |
