# @sparky-labs/cli

Sparky from the terminal and for agents. Convert files, run the PDF, video, image and OCR tools, and download from links, all on your own PC. The same tools are served to agents over MCP (stdio) and a local HTTP API.

The Windows installer from [sparky-labs.vercel.app](https://sparky-labs.vercel.app) already puts `sparky` on your PATH, with every tool bundled. This package is for machines without the app, or for using Sparky from Node.

## Install

Node 22 or later.

```sh
npm i -g @sparky-labs/cli
sparky setup
```

Or run it once without installing:

```sh
npx @sparky-labs/cli --help
```

`sparky setup` downloads FFmpeg, yt-dlp, Pandoc, 7-Zip and Deno into Sparky's data folder (`%APPDATA%\Sparky\bin`). It is Windows only; on macOS and Linux, install `ffmpeg`, `yt-dlp` and `pandoc` with your package manager and Sparky finds them on PATH. Run `sparky ops` to see which tools can run on this machine.

## Examples

```sh
sparky convert photo.heic --to jpg
sparky pdf merge a.pdf b.pdf --out merged.pdf
sparky ocr scan.png
```

Add `--json` for machine-readable output. Exit codes: 0 done, 1 a job failed, 2 wrong usage or input, 3 a needed program is missing, 130 stopped with Ctrl+C. When the Sparky app is open, jobs run in the app and show in its Queue; `--local` runs them in the terminal instead.

## Agents over MCP

Add Sparky to an agent client in one step:

```sh
sparky init --client claude-code
```

Clients: `claude-code`, `cursor`, `codex`, `windsurf`, or `all`. Add `--dry-run` to see the change first. On Windows the entry runs `cmd /c sparky mcp`, since clients start commands without a shell and `sparky` is a `.cmd` file there.

To add it by hand, the server is `sparky mcp` on stdin/stdout:

```json
{
  "mcpServers": {
    "sparky": {
      "command": "cmd",
      "args": ["/c", "sparky", "mcp"]
    }
  }
}
```

On macOS and Linux, use `"command": "sparky", "args": ["mcp"]`. With Claude Code: `claude mcp add --scope user sparky -- cmd /c sparky mcp`.

When the Sparky app updates, its installer closes any `sparky mcp` server it started, since the server runs from the app's folder. Claude Code restarts an MCP server on its next call to it; with another client, restart the client if Sparky's tools stop answering.

## Local HTTP API

The Sparky app serves the API on `127.0.0.1:8600` while it is open; without the app, run `sparky serve`. Every request needs the bearer token from `%APPDATA%\Sparky\api-token`, which only your user can read.

```powershell
$token = Get-Content "$env:APPDATA\Sparky\api-token"
$body = '{"op":"pdf.merge","args":{"files":["C:/docs/a.pdf","C:/docs/b.pdf"],"out":"C:/docs/merged.pdf"}}'
Invoke-RestMethod -Method Post http://127.0.0.1:8600/v1/jobs -Headers @{ Authorization = "Bearer $token" } -ContentType 'application/json' -Body $body
```

`GET /v1/ops` lists every op and its input schema; `GET /v1/jobs/:id` reports a job queued with `"wait": false`. The API listens on loopback only.

## Environment

| Variable | Effect |
|---|---|
| `SPARKY_DATA_DIR` | Data folder for history, settings and the API token (default `%APPDATA%\Sparky`). |
| `SPARKY_BIN_DIR` | Folder searched first for ffmpeg, yt-dlp and the other tools. The installer's shim sets it. |
| `SPARKY_API_PORT` | Port of the running app or `sparky serve` (default 8600). |
| `SPARKY_LOCAL=1` | Always run jobs in this process (same as `--local`). |

## License

MIT. Sparky bundles or downloads third-party tools under their own licenses; see `THIRD_PARTY_NOTICES.md` in the [repository](https://github.com/harryx2011-boop/sparky).
