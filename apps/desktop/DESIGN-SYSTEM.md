# Design system: Sparky Desktop

Scope: the Electron app's renderer, the main product UI (`src/renderer/src`). The landing site has its own style source; see Brand. Values live in `TOKENS.md`; this file names them and never repeats a hex value.

## 1. Principles
- Monochrome on purpose. Colour shows only for states and the Performance bars (`../../packages/ui/src/styles.css:6`).
- Lime is the one accent, shared with the ElixirLabs suite. It is never body text, borders or backgrounds (`../../packages/ui/src/styles.css:7-8`).
- Dark is the app default (`../../context.md`, Decisions).
- Plain language everywhere; no codec, encoder or tool names in user-facing copy outside the credits line (`../../context.md`, Decisions; `../../CONTRIBUTING.md`, Style).

## 2. Type scale
- Families: `--font-sans` (Satoshi, with a metric-matched fallback) for all UI text; `--font-mono` (IBM Plex Mono) for labels, counts and queue text. See `TOKENS.md` Type.
- Base size is 14px on `html` (`src/renderer/src/index.css:11`). Components set their own sizes with Tailwind utilities: `text-[13px]` on buttons and inputs (`src/renderer/src/components/ui/button.tsx:7`), `text-xs` on secondary controls, `text-[10px]` and `text-[11px]` on mono labels (`src/renderer/src/components/QueueDock.tsx:50`).
- Those sizes are not yet tokens. Add a `TOKENS.md` row before reusing one.
- In-app headings are Title Case and fit on one line; body copy and hints stay sentence case (`../../context.md`, Decisions).

## 3. Layout
- Window: frameless Electron window, 1180 by 780, minimum 880 by 600 (`src/main/index.ts:72-77`).
- Shell: title bar, then a row of sidebar and main, then the queue dock and footer (`src/renderer/src/App.tsx:13-34`).
- Title bar: `h-9` (2.25rem, 31.5px at the 14px root), window buttons 46px wide (`src/renderer/src/components/TitleBar.tsx:13,15`).
- Sidebar: 196px expanded, 52px collapsed, animated over 200ms (`src/renderer/src/components/Sidebar.tsx:23`).
- Main: content column capped at 980px, centred, `px-7` and `py-6` (rem units: 24.5px and 21px at the 14px root) (`src/renderer/src/App.tsx:25`).
- Dialog: 420px wide, centred, capped to the window width minus 32px (`src/renderer/src/components/ui/dialog.tsx:31`); overlay is `bg-black/50` (`src/renderer/src/components/ui/dialog.tsx:28`).
- Toasts sit top right, offset 48px from the top and 20px from the right (`src/renderer/src/App.tsx:37`).
- Breakpoints: none. The renderer has no width media query; its only media query is `prefers-color-scheme` (`src/renderer/src/lib/state.tsx:96`).
- Spacing: the style sources define no spacing tokens. Spacing comes from Tailwind utilities.

## 4. Components
| component | file | notes |
| --- | --- | --- |
| Button | `src/renderer/src/components/ui/button.tsx` | default is lime; variants secondary, ghost, destructive, link; sizes default h-8, sm, lg, icon |
| Input | `src/renderer/src/components/ui/input.tsx` | h-8, rounded-lg, placeholder in subtle text |
| Switch | `src/renderer/src/components/ui/switch.tsx` | checked state is lime |
| Select and combobox | `src/renderer/src/components/ui/select.tsx`, `src/renderer/src/components/ui/combobox.tsx` | h-8 triggers, popover menus |
| Segmented | `src/renderer/src/components/ui/segmented.tsx` | on state uses secondary fill |
| Checkbox | `src/renderer/src/components/ui/checkbox.tsx` | checked state is primary |
| Accordion | `src/renderer/src/components/ui/accordion.tsx` | chevron rotates when open |
| Progress | `src/renderer/src/components/ui/progress.tsx` | h-1 track, indeterminate when no value |
| Tooltip | `src/renderer/src/components/ui/tooltip.tsx` | popover surface, small text |
| Dialog | `src/renderer/src/components/ui/dialog.tsx` | 420px, overlay black at 50% |
| Sidebar | `src/renderer/src/components/Sidebar.tsx` | six sections, Ctrl+1 to 6, active item has a 3px lime rail |
| Title bar | `src/renderer/src/components/TitleBar.tsx` | frameless drag region, double-click maximizes |
| Queue dock | `src/renderer/src/components/QueueDock.tsx` | live queue at the bottom, lime dot while running, drag top edge to resize |
| Job row and job icons | `src/renderer/src/components/JobRow.tsx` | source and result icons, progress and controls |
| Performance picker | `src/renderer/src/components/Controls.tsx` | Low, Normal, Max with the animated bars |
| Operation form | `src/renderer/src/components/OpForm.tsx` | form generated from the operation's input schema |
| File drop overlay | `src/renderer/src/components/FileDropOverlay.tsx` | full-window drag-over state |
| Clipboard chip | `src/renderer/src/components/ClipboardChip.tsx` | offers a download when a video link is on the clipboard |
| Spark burst | `src/renderer/src/components/SparkBurst.tsx` | short burst above the dock when a job succeeds |
| Performance bars | `../../packages/ui/src/PerformanceBars.tsx` | five bars: one Low, three Normal, five Max |
| Compression slider | `../../packages/ui/src/CompressionSlider.tsx`, `../../packages/ui/src/FlowingTrack.tsx` | lime pill track with sheen and sparks |
| Resolution picker | `../../packages/ui/src/ResolutionPicker.tsx` | 720p to 4K options, locked options explain why in a tooltip |
| Logo and brand marks | `../../packages/ui/src/icons.tsx`, `../../packages/ui/src/brands.tsx` | brand marks in their own colours |
| File icons | `../../packages/ui/src/file-icons/` | vendored VS Code icon subset, fallback for file rows |

## 5. States
- Focus: `:focus-visible` draws a 2px lime outline with a 2px offset (`../../packages/ui/src/styles.css:167-170`). Components draw a `ring-2 ring-ring` instead and opt out with `focus-visible:outline-none` (`src/renderer/src/components/ui/button.tsx:7`).
- Hover: primary fills step to `bg-lime/90`; ghost and secondary fills move to `bg-accent`; text moves to `text-foreground` (`src/renderer/src/components/ui/button.tsx:11-13`).
- Active: the selected sidebar item has `bg-accent` and a 3px lime rail (`src/renderer/src/components/Sidebar.tsx:34`).
- Disabled: buttons drop to 40% opacity and stop pointer events; inputs and switches to 50% (`src/renderer/src/components/ui/button.tsx:7`, `input.tsx:8`, `switch.tsx:9`). A paused compression pill stops its sheen and sparks (`../../packages/ui/src/styles.css:307-310`).
- Loading: a running job shows the lime pulse `.sp-running` and the running Performance bars (`../../packages/ui/src/styles.css:189,208-211`). Placeholder blocks use `animate-pulse` on the secondary fill (`src/renderer/src/pages/DownloadPage.tsx:177`).
- Empty: not defined in the style sources or `packages/ui`. Add a row here when a shared empty state exists.
- Error: destructive fill `bg-destructive` with white text (`src/renderer/src/components/ui/button.tsx:14`); error toasts use the toast layer in `src/renderer/src/App.tsx:37`.
- Drag over: dashed lime border on a 8% lime fill, over a background scrim (`src/renderer/src/components/FileDropOverlay.tsx:63,66`).

## 6. Motion
- Easing token: the compression pill and thumb use `--sp-flow-ease` (see `TOKENS.md` Motion).
- Page change: content rises 6px and fades over 0.16s on section switch (`src/renderer/src/App.tsx:19-24`).
- Overlays and rows: the drop overlay fades over 0.12s (`src/renderer/src/components/FileDropOverlay.tsx:62`); queue rows enter over 0.2s (`src/renderer/src/components/QueueDock.tsx:77`).
- Progress fill: width animates over 300ms (`src/renderer/src/components/ui/progress.tsx:11`).
- Ambient: Performance bars flow over 2.2s, the running pulse runs over 1.6s, sparks twinkle over 3.2s (`../../packages/ui/src/styles.css:187,210,221`).
- Reduced motion: the Performance bars, running pulse and sparks stop; the compression pill keeps its plain fill; every other transition settles at once (`../../packages/ui/src/styles.css:362-381`).
- Not yet tokens: the component durations above (0.12s, 0.16s, 0.2s, 200ms, 300ms) are raw values in components. Add them to `TOKENS.md` before reuse.

## 7. Brand
- Mark: the bolt on a dark tile, drawn in `../../packages/ui/src/icons.tsx` as `LogoMark`. It is the same drawing as the app icon and the favicon.
- Icon source of truth: `../../scripts/make-icons.mjs` (`../../context.md`, Decisions).
- Favicon: `src/renderer/public/favicon.svg`, linked from `src/renderer/index.html:11`.
- Brand marks for sites and services are real marks in their own colours, from `../../packages/ui/src/brands.tsx` and `../../packages/ui/src/icons.tsx` (`../../context.md`, Brand marks).
- Voice: plain and friendly. Write "graphics card", not "GPU encoder"; "shrink", not "transcode" (`../../CONTRIBUTING.md`, Style).
- Landing site: its style source is `../../apps/web/src/index.css`. It is outside this file's scope.

## 8. Do / Don't
- Do use lime for the primary action, live or on states, the focus ring, text selection and the drag-over state (`../../packages/ui/src/styles.css:7-8`).
- Don't use lime for body text, borders, backgrounds or gradients (`../../packages/ui/src/styles.css:8`).
- Do keep Performance bars, success, warning and destructive in their own colours (`../../context.md`, Decisions).
- Do keep keyboard focus visible on every control (`../../packages/ui/src/styles.css:166-167`).
- Do honour `prefers-reduced-motion` (`../../packages/ui/src/styles.css:362`).
- Don't narrate demos with captions, typewriter lines or step tickers (`../../context.md`, Decisions).
- Don't put text or pills above headings, use pill or chip rows, or place copy over an unmasked busy background (`../../context.md`, Decisions).
- Do use Title Case for in-app headings, one line each; leave body copy in sentence case (`../../context.md`, Decisions).
