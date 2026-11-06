# Sparky 2.0 main window: three directions

Phase 0 step 3 of `docs/plans/2026-11-05-sparky-2-file-manager.md`. **Picked 2026-11-06: C · Frost (D-2.0-8).** Workbench and Live Wire stay in the comp page for reference until Phase 2 step 8 promotes the Frost values into the theme, then the prototype folder is deleted.

**Concept line (all three):** every file is one spark away from becoming something else.
**The one bold idea:** the convert wheel. Right-click a file, choose "Convert to…", and the formats it can become fly out on spokes around the pointer: video formats on the top arc, audio on the bottom, the format last used for that type ringed in lime, a lime spark burst on the pick.

## See them

```
npm run dev:ui -w @sparky/desktop
```

Open `http://localhost:4601/prototypes/file-manager/` and switch A, B, C at the top. `?mood=livewire` opens one direction; `?wheel=0` starts with the wheel closed. Right-click a row and pick "Convert to…" to open the wheel again.

Screenshots (local only, not committed: the inspector shows a frame from a third-party YouTube video): `docs/design/2.0/shots/`. Regenerate them from the running page.

Content is real: the listing of `Downloads\Sparky\uxpeak` on 2026-11-06 and the ten targets `sparky_list_formats` reports for an mp4.

## The three moods (same bones)

| | A · Workbench | B · Live Wire | C · Frost |
|---|---|---|---|
| Feel | Calm and dense | Bold lime | Glassy and translucent |
| Rows | 26 px | 32 px | 30 px |
| Selection | Grey fill, 2 px lime rail | Solid lime row, dark text | 16% lime tint |
| Folder title | Breadcrumb only | Big folder name + counts | Breadcrumb only |
| Panels | Flush, hairlines | Flush, card sidebar | Floating, 12 px radius, blur over the desktop |
| Job pill | Outlined | Solid lime | Frosted |
| Wheel spokes | Grey, lime on hover | Lime outlines | Grey, lime on hover |

Shared bones, per the comp brief in the plan: title-bar tabs, Places sidebar (Quick Access, drives, then Convert, Download, Tools, Queue, History, then tags and "Add cloud drive"), Details list by default, inspector that opens on selection, status bar with the job pill, Satoshi and IBM Plex Mono.

## Built from

- shadcn/ui (new this step, via `apps/desktop/components.json`): Tabs, Breadcrumb, Table, Context Menu, Resizable, Scroll Area, Toggle Group, Kbd, Separator, Dropdown Menu.
- Existing Sparky parts: Button, Tooltip, FileIcon, LogoMark, Bolt.
- React Bits: Circular Text (the "Convert to" rim, spins slowly, pauses on hover) and Click Spark (the burst on a pick). Both keep their licence header.
- Hand-built: the wheel's spoke layout. No library has a radial menu (searched shadcn, Watermelon UI, Componentry and React Bits for radial, circular, pie and orbit menus).

## Self-critique (round 1 fixed before showing)

Fixed: the wheel was a grey disc with no lime in the signature moment; the rim text said VIDEO and AUDIO while spinning past the wrong arcs; the wheel covered the selected file's name; Frost's wallpaper was too dark for the glass to read; the inspector icons were oversized; the wheel spilled past the pane edge in Frost.

Still open, whichever direction wins:

1. The wheel opens at a fixed point in the comps; the real one needs edge clamping so it never leaves the pane.
2. Live Wire spends lime on three things at once (selected row, Sparky place, job pill), which dilutes the wheel's lime moment.
3. Frost depends on Windows 11 acrylic/Mica (plan step 8); on Windows 10 it falls back to opaque and looks close to Workbench.
4. Keyboard path for the wheel (arrow keys round the ring, type the extension) is not built yet.
