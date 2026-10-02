import ops from '../data/ops.json'

export type Block =
  | { p: string }
  | { ul: string[] }
  | { ol: string[] }
  | { table: { head: string[]; rows: string[][] } }
  | { note: string }
  | { code: string }

export interface DocSection {
  h: string
  blocks: Block[]
}

export interface DocPage {
  slug: string
  nav: string
  group: 'Get Started' | 'Configure' | 'Privacy' | 'Help'
  title: string
  intro: string
  sections: DocSection[]
  next: { slug: string; why: string }[]
}

const TOOL_GROUPS: [category: string, label: string][] = [
  ['pdf', 'PDF'],
  ['video', 'Video and audio'],
  ['image', 'Images'],
  ['tool', 'Reading text'],
]

const toolLists = TOOL_GROUPS.map(([category, label]) => {
  const labels = ops.filter((o) => o.category === category).map((o) => o.label)
  return labels.length ? `${label}: ${labels.join(', ')}.` : ''
}).filter(Boolean)

const API_CALL = [
  String.raw`$token = Get-Content "$env:APPDATA\Sparky\api-token"`,
  `$body = '{"op":"pdf.merge","args":{"files":["C:/a.pdf","C:/b.pdf"]}}'`,
  'Invoke-RestMethod -Method Post http://127.0.0.1:8600/v1/jobs `',
  '  -Headers @{ Authorization = "Bearer $token" } `',
  "  -ContentType 'application/json' -Body $body",
].join('\n')

export const DOCS: DocPage[] = [
  {
    slug: 'quickstart',
    nav: 'Quickstart',
    group: 'Get Started',
    title: 'Quickstart',
    intro:
      'This guide takes you from download to your first converted file and your first saved video. It takes about five minutes.',
    sections: [
      {
        h: 'Before you begin',
        blocks: [
          {
            ul: [
              'Windows 10 or 11, 64-bit. Sparky is a Windows app.',
              'An internet connection for the installer and for saving videos. Converting files you already have needs none.',
              'No account. Sparky has no sign-in.',
            ],
          },
        ],
      },
      {
        h: 'Step 1: install Sparky',
        blocks: [
          { p: 'Download Sparky-Setup.exe from the download page, then run it.' },
          {
            ol: [
              'Windows SmartScreen may warn that the app is from an unknown publisher, because the installer is not code-signed. Choose More info, then Run anyway.',
              'Read the licence and choose an install folder, or keep the default.',
              'Sparky installs for your Windows user only, adds Start menu and desktop shortcuts, and opens when setup finishes.',
            ],
          },
          { note: 'Setup also adds a sparky command for terminals. See Settings and tools if you want to use it.' },
        ],
      },
      {
        h: 'Step 2: convert a file',
        blocks: [
          {
            ol: [
              'Open Convert. Drag files onto the window, or select click to browse.',
              'Pick a format under Output format. Sparky lists only formats your files can become.',
              'Leave Performance and Compression as they are for a first try. Compression starts on Balanced.',
              'Select Convert, which names the number of files you added.',
            ],
          },
          {
            p: 'Converted files go to Downloads\\Sparky, sorted into Video, Audio, Images, Documents and Archives folders. Your originals stay where they were.',
          },
        ],
      },
      {
        h: 'Step 3: save a video from a link',
        blocks: [
          {
            ol: [
              'Open Download. Paste a link, or select Paste.',
              'Select Preview. Sparky shows the title, and a list of videos if the link is a playlist.',
              'Under Keep, choose Video or Audio. For video, pick a quality. For a playlist, tick the items you want.',
              'Select Download.',
            ],
          },
          {
            p: 'Downloads go to Downloads\\Sparky\\Downloads. When a single video finishes, File Explorer opens to the file. Turn that off in Settings under Open folder when a download finishes.',
          },
        ],
      },
      {
        h: 'Step 4: check the result',
        blocks: [
          {
            ul: [
              'Queue shows every job with its progress and the time left. Pause all, drag waiting jobs into a new order, or cancel a job.',
              'History keeps each finished job with its settings. Search it, show the file in its folder, or run a job again.',
              'A Windows notification appears when a job finishes or fails. Click it to open the file, or the folder when a job made several.',
            ],
          },
        ],
      },
      {
        h: 'Common first-run problems',
        blocks: [
          {
            ul: [
              'Windows blocks the installer: see “Windows warns about the installer” in Help.',
              'A link will not preview or download: see “A download fails” in Help.',
              'A file type is greyed out or missing from the format list: see “A format or tool is unavailable” in Help.',
            ],
          },
        ],
      },
    ],
    next: [
      { slug: 'how-it-works', why: 'to see what runs on your PC and what it does.' },
      { slug: 'settings-and-tools', why: 'to choose speed, size and where files are saved.' },
      { slug: 'help', why: 'if something does not work.' },
    ],
  },
  {
    slug: 'how-it-works',
    nav: 'How It Works',
    group: 'Get Started',
    title: 'How it works',
    intro: 'The plain picture of what Sparky does on your PC, and the few times it uses the internet.',
    sections: [
      {
        h: 'What runs where',
        blocks: [
          {
            p: 'Sparky is one Windows app. When you convert a file, Sparky hands it to a small program that does the work on your PC, then saves the result in your output folder. The installer includes these programs, so there is nothing else to install for most jobs.',
          },
          {
            table: {
              head: ['Job', 'Done by', 'Comes with Sparky'],
              rows: [
                ['Video, audio and image conversion', 'FFmpeg', 'Yes'],
                ['Reading file details', 'FFprobe', 'Yes'],
                ['Saving videos from links', 'yt-dlp', 'Yes'],
                ['Documents', 'Pandoc, plus Sparky’s own code for spreadsheets and data files', 'Yes'],
                ['Archives', '7-Zip', 'Yes'],
                ['Helping YouTube links work', 'Deno', 'Yes. Settings shows whether it was found.'],
                ['Reading text in images and PDFs', 'Tesseract', 'Yes, English only. Other languages download once.'],
                ['Shrinking a PDF, adding or removing a PDF password', 'Ghostscript', 'No. A free program you install yourself.'],
                ['Older Word, Excel and PowerPoint files, and OpenOffice files', 'LibreOffice', 'No. A free program you install yourself.'],
              ],
            },
          },
        ],
      },
      {
        h: 'Jobs and the queue',
        blocks: [
          {
            p: 'Every conversion, download and tool run is a job in one queue. Sparky starts jobs in order and runs several at once when Batch conversion is on (it is on by default). Performance sets how many, and how hard each one works.',
          },
          {
            ul: [
              'Low runs one job at a time, keeps your PC free and does not use the graphics card.',
              'Normal runs up to two jobs, each using about half your processor.',
              'Max uses everything your PC has, and a graphics card when one can help. With Batch conversion on, it runs half your processor’s threads as jobs, between two and four.',
            ],
          },
        ],
      },
      {
        h: 'Where things are saved',
        blocks: [
          {
            ul: [
              'Your files: Downloads\\Sparky, sorted into Video, Audio, Images, Documents, Archives and Downloads. Change it in Settings.',
              'History and settings: a small database in %APPDATA%\\Sparky.',
              'Working files while a job runs: %TEMP%\\Sparky.',
            ],
          },
        ],
      },
      {
        h: 'When Sparky uses the internet',
        blocks: [
          {
            p: 'Converting files you already have does not use the internet. Saving videos does, and so do update checks and the first use of a new text-reading language. Privacy and data lists each one.',
          },
        ],
      },
      {
        h: 'Open source parts',
        blocks: [
          { p: 'Sparky itself is free and open source under the MIT license. The programs it ships keep their own licenses:' },
          {
            table: {
              head: ['Program', 'License'],
              rows: [
                ['FFmpeg and FFprobe', 'GPL-3.0-or-later'],
                ['yt-dlp', 'Unlicense'],
                ['Pandoc', 'GPL-2.0-or-later'],
                ['7-Zip', 'LGPL-2.1-or-later, with the unRAR restriction for RAR code'],
                ['Deno', 'MIT'],
              ],
            },
          },
          { p: 'THIRD_PARTY_NOTICES.md in Sparky’s install folder lists the rest, with links to the source.' },
        ],
      },
    ],
    next: [
      { slug: 'privacy-and-data', why: 'for the full list of what uses the internet.' },
      { slug: 'settings-and-tools', why: 'for every setting and tool.' },
    ],
  },
  {
    slug: 'settings-and-tools',
    nav: 'Settings and Tools',
    group: 'Configure',
    title: 'Settings and tools',
    intro: 'Every setting, the tools on the Tools page, and how to run Sparky from a terminal or another program.',
    sections: [
      {
        h: 'Settings',
        blocks: [
          {
            table: {
              head: ['Setting', 'What it does'],
              rows: [
                ['Save to', 'Where finished files go. Starts as Downloads\\Sparky.'],
                ['Batch conversion', 'Works on several files at once. On by default.'],
                ['Performance', 'Low, Normal or Max. See How it works.'],
                ['Compression', 'How small the file gets. See the table below.'],
                ['Video type', 'Standard (H.264) plays everywhere. Newer (HEVC) and Newest (AV1) make smaller files, and AV1 needs recent devices to play.'],
                ['Theme', 'Match Windows, Light or Dark.'],
                ['Keep running in the tray', 'Closing the window leaves jobs going. Quit from the tray icon.'],
                ['Notifications', 'A Windows notification when a job finishes or fails.'],
                ['Open folder when a download finishes', 'Opens File Explorer to the saved file. On by default.'],
                ['Offer links from the clipboard', 'When you switch to Sparky with a link copied, it asks if you want to download it.'],
                ['Downloader updates', 'Update now fetches a newer downloader. Sparky also does this when it starts.'],
              ],
            },
          },
        ],
      },
      {
        h: 'Compression levels',
        blocks: [
          {
            table: {
              head: ['Level', 'Meaning', 'Sound quality', 'Image quality'],
              rows: [
                ['Lossless', 'Original quality export', '320 kbps', '95'],
                ['High', 'Hard to tell apart, a bit smaller', '256 kbps', '88'],
                ['Balanced', 'Good quality at a sensible size. The default.', '192 kbps', '80'],
                ['Small', 'Easy to share, some detail lost', '128 kbps', '70'],
                ['Tiny', 'As small as it gets. Video is half size.', '96 kbps', '55'],
              ],
            },
          },
          {
            p: 'Archives are always lossless, so the same slider reads Fastest, Fast, Normal, Smaller and Smallest. It trades speed for size.',
          },
        ],
      },
      {
        h: 'Video size',
        blocks: [
          {
            p: 'Downloads can be 720p, 1080p, 1440p or 4K. 1440p and 4K need Performance on Max and a graphics card that can help (NVIDIA, AMD and Intel cards are supported). Sparky never makes a video bigger than it started.',
          },
        ],
      },
      {
        h: 'Tools',
        blocks: [
          { p: 'The Tools page (Ctrl+3) holds everything beyond converting and downloading. Its forms are built from each tool’s own fields, so the options match what the tool can do.' },
          { ul: toolLists },
          {
            p: 'Shrink a PDF, Add a password to a PDF and Remove a PDF password need Ghostscript. An unavailable tool is greyed out, with one line saying what is missing. Reading text works on images and PDFs, and gives a text file, a searchable PDF or both.',
          },
        ],
      },
      {
        h: 'Keyboard shortcuts',
        blocks: [
          {
            table: {
              head: ['Shortcut', 'Opens'],
              rows: [
                ['Ctrl+1', 'Convert'],
                ['Ctrl+2', 'Download'],
                ['Ctrl+3', 'Tools'],
                ['Ctrl+4', 'Queue'],
                ['Ctrl+5', 'History'],
                ['Ctrl+6', 'Settings'],
              ],
            },
          },
        ],
      },
      {
        h: 'Use Sparky from a terminal or another program',
        blocks: [
          { p: 'The installer adds a sparky command to your PATH. Every tool is a command, and --json gives output a script can read.' },
          { code: 'sparky convert clip.mov --to mp4\nsparky pdf merge a.pdf b.pdf' },
          {
            p: 'AI agents can use the same tools. Settings has an Agents section with one-click setup for Claude Code, Cursor, Codex and Windsurf, for each one it finds on your PC. For Claude Code by hand:',
          },
          { code: 'claude mcp add --scope user sparky -- cmd /c sparky mcp' },
          {
            p: 'Any program can also send jobs to Sparky while the app is open. It listens on 127.0.0.1, port 8600, an address only this PC can reach, and every request must carry the token from %APPDATA%\\Sparky\\api-token. Set SPARKY_API_PORT to use a different port. Settings shows the port and has a button that shows the token file.',
          },
          { code: API_CALL },
        ],
      },
    ],
    next: [
      { slug: 'privacy-and-data', why: 'for what stays on your PC.' },
      { slug: 'help', why: 'for problems and fixes.' },
    ],
  },
  {
    slug: 'privacy-and-data',
    nav: 'Privacy and Data',
    group: 'Privacy',
    title: 'Privacy and data',
    intro: 'What stays on your PC, what uses the internet and where it goes, where Sparky keeps files, and how to delete them.',
    sections: [
      {
        h: 'What stays on your PC',
        blocks: [
          {
            ul: [
              'Files you convert. Converting, the PDF tools and the image and video tools run on your PC. Sparky does not upload your files.',
              'No account and no tracking. Sparky has no sign-in and no analytics or usage reporting.',
              'The clipboard. If Offer links from the clipboard is on, Sparky looks at your copied text when you switch to it, only to see whether it is a link. It sends the text nowhere.',
              'Passwords you type for PDF tools. They are used for that one job and never saved to History.',
            ],
          },
        ],
      },
      {
        h: 'What needs the internet',
        blocks: [
          {
            table: {
              head: ['What', 'When', 'Where it goes'],
              rows: [
                ['Previewing and saving a video', 'When you select Preview or Download', 'The site you pasted a link from, which sees the request like any other download'],
                ['Skip sponsor segments', 'Only when that option is on', 'A community list of sponsor segments, asked for the video you chose'],
                ['App update check', 'Each time Sparky starts, in the installed app', 'Sparky’s releases on GitHub. A new version installs when you quit.'],
                ['Downloader update', 'Each time Sparky starts in the installed app, and when you select Update now', 'The downloader’s own release source'],
                ['A text-reading language', 'The first time you use a language other than English', 'A public file host (jsDelivr), once. Sparky keeps the language afterwards.'],
                ['The installer', 'When you download Sparky', 'GitHub Releases'],
              ],
            },
          },
        ],
      },
      {
        h: 'What works with no connection',
        blocks: [
          {
            ul: [
              'Converting video, audio, images, documents and archives you already have.',
              'Every tool on the Tools page, including reading English text in images and PDFs.',
              'History, Queue and Settings.',
            ],
          },
          { p: 'Saving from a link, update checks and new text-reading languages wait until you are online.' },
        ],
      },
      {
        h: 'Where Sparky keeps things',
        blocks: [
          {
            table: {
              head: ['What', 'Where'],
              rows: [
                ['Finished files', 'Downloads\\Sparky, or the folder you chose in Settings'],
                ['History and settings', '%APPDATA%\\Sparky'],
                ['The downloader’s updatable copy', '%APPDATA%\\Sparky\\bin'],
                ['The API token', '%APPDATA%\\Sparky\\api-token'],
                ['Working files during a job', '%TEMP%\\Sparky'],
              ],
            },
          },
        ],
      },
      {
        h: 'Delete your data',
        blocks: [
          {
            ul: [
              'History: remove one row, or select Clear history on the History page.',
              'Files: delete them from Downloads\\Sparky yourself. Removing a History row does not delete the file.',
              'Originals: kept by default. If you choose to replace or remove them, they go to the Recycle Bin, where you can restore them.',
              'Everything else: uninstalling leaves %APPDATA%\\Sparky in place. Delete that folder to remove History, settings and the token.',
            ],
          },
        ],
      },
      {
        h: 'Saving from websites',
        blocks: [
          {
            p: 'Sparky saves what a site serves to your PC when you give it a link. It does not check whether you may save or share a video. That depends on the site’s terms and the content’s license.',
          },
        ],
      },
    ],
    next: [
      { slug: 'how-it-works', why: 'for what runs on your PC.' },
      { slug: 'help', why: 'for problems and fixes.' },
    ],
  },
  {
    slug: 'help',
    nav: 'Help',
    group: 'Help',
    title: 'Help',
    intro: 'Find the symptom, then try the fix beside it.',
    sections: [
      {
        h: 'Install and start',
        blocks: [
          {
            table: {
              head: ['Symptom', 'Cause', 'Fix'],
              rows: [
                ['Windows warns about the installer', 'The installer is not code-signed, so SmartScreen has no publisher to show.', 'Choose More info, then Run anyway.'],
                ['Setup asks to close Sparky’s command-line tools', 'An agent or terminal is running the sparky command from the install folder.', 'Let setup close them. The agent starts them again on its next call.'],
                ['Sparky opened and vanished', 'It was already running, and the second copy hands focus to the first.', 'Look for Sparky in the tray, or in the taskbar.'],
              ],
            },
          },
        ],
      },
      {
        h: 'Converting',
        blocks: [
          {
            table: {
              head: ['Symptom', 'Cause', 'Fix'],
              rows: [
                ['Can’t convert this type', 'Sparky does not read that kind of file.', 'Sparky skips it and says so. Convert the files it can read.'],
                ['This file looks damaged', 'The file is broken, or is not what its name says.', 'Open it in another app to check, then try a fresh copy.'],
                ['A format or tool is unavailable', 'It needs a program that is not installed: LibreOffice for older Office files, Ghostscript for shrinking or locking PDFs.', 'Install it, then restart Sparky. Settings shows what was found.'],
                ['This file is password protected', 'Sparky cannot open protected files or archives.', 'Remove the protection in the app that made it first.'],
                ['Sparky can’t save into that folder', 'The folder is read-only, missing or blocked.', 'Pick another folder in Settings.'],
                ['The drive is full', 'Not enough room for the result.', 'Free up space and try again.'],
              ],
            },
          },
        ],
      },
      {
        h: 'Downloading',
        blocks: [
          {
            table: {
              head: ['Symptom', 'Cause', 'Fix'],
              rows: [
                ['A download fails', 'Sites change how they work often, and an old downloader stops working.', 'Open Settings, then Diagnostics, then select Update now. Try again.'],
                ['Couldn’t reach the site', 'No connection, or the site is down.', 'Check your internet connection.'],
                ['This site isn’t supported yet', 'The downloader does not know the site.', 'Update the downloader. If it still fails, the site is not supported.'],
                ['Private, age-restricted or sign-in videos', 'The video needs an account, which Sparky does not use.', 'These cannot be downloaded.'],
                ['That quality isn’t offered', 'The video does not come in that size.', 'Choose a lower quality.'],
                ['The site asks for a sign-in check', 'The site is limiting requests right now.', 'Wait a few minutes and try again.'],
              ],
            },
          },
        ],
      },
      {
        h: 'Questions',
        blocks: [
          {
            ol: [
              'Does Sparky work offline? Converting and the tools do. Saving from links and update checks need a connection. See Privacy and data.',
              'Is it free? Yes. It is open source under the MIT license.',
              'Where did my file go? Downloads\\Sparky, in a folder named for its type. Select Show in folder in History to open it.',
              'Can I keep it running in the background? Yes. Closing the window leaves jobs going when Keep running in the tray is on.',
              'How do I reach a person? Email harryx2011@gmail.com or open an issue on GitHub.',
            ],
          },
        ],
      },
    ],
    next: [
      { slug: 'settings-and-tools', why: 'to change settings.' },
      { slug: 'privacy-and-data', why: 'to see what uses the internet.' },
    ],
  },
]
