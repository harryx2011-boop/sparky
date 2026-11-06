# Sparky 2.0 file manager

Status: agreed (Harry, 2026-11-06)   ·   Date: 2026-11-05   ·   Plan: `docs/plans/2026-11-05-sparky-2-file-manager.md`

## Goal
People browse, organise and act on files in Sparky instead of Explorer, and every action (convert, compress, copy, move, rename, delete, download) runs through the same queue that the CLI and agents use. Phase-level specs may split from this file as each phase starts.

## Behaviours

Listing and navigation
- **S1: Big folder opens fast.** Given a folder of 5,000 files on a warm disk. When the user opens it. Then all 5,000 rows with size and modified date are listed within 300 ms.
- **S2: Long and network paths open.** Given a path over 260 characters, or `\\server\share`. When the user opens it. Then its contents are listed.
- **S3: Folder stays live.** Given an open folder. When another app adds, renames or removes a file there. Then the list shows the change within 1 s without a refresh.
- **S4: Blocked folder.** Given a folder the user may not read. When they open it. Then a plain message says access was refused and the previous folder stays shown.
- **S5: Typed path.** Given the breadcrumb. When the user clicks it, types a path and presses Enter. Then that folder opens; an unknown path shows "That folder doesn't exist" and nothing else changes.
- **S6: Back and forward.** Given the user opened A, then B. When they press Alt+Left, then Alt+Right. Then A shows, then B shows, each with its earlier selection.
- **S7: Type to select.** Given a listed folder. When the user types "rep". Then the first item whose name starts with "rep" is selected.

Selection and opening
- **S8: Multi-select.** Given a list. When the user clicks one row, then Shift-clicks the fifth. Then five rows are selected and the status bar says "5 selected".
- **S9: Open.** Given a selected file. When the user presses Enter. Then it opens in its default app; a selected folder opens in the pane.

File operations
- **S10: Name clash.** Given the target already holds `a.txt`. When the user copies `a.txt` there. Then they are asked Skip, Keep both or Replace; Keep both makes `a (2).txt`.
- **S11: Cancel copy.** Given a copy in progress. When the user cancels it. Then no partial file is left at the target.
- **S12: Same-drive move.** Given a 10 GB file. When the user moves it to a folder on the same drive. Then it finishes in under 1 s (a rename, not a copy).
- **S13: Delete to Recycle Bin.** Given a selected file. When the user presses Delete. Then the file is in the Recycle Bin and can be restored there.
- **S14: Undo.** Given the user just moved 3 files. When they press Ctrl+Z. Then the 3 files are back where they were.
- **S15: Preview before a big batch.** Given 21 or more selected files. When the user starts a move, rename or delete. Then a list of planned results shows first and nothing changes until they confirm.
- **S16: Agent limits.** Given an MCP agent on the `all` profile. When it asks to move or delete a file outside its allowed folders. Then the call is refused; inside them, delete goes to the Recycle Bin only.

Menu, wheel, command bar
- **S17: Searchable right-click.** Given a selected `.mov`. When the user right-clicks and types "gif". Then only the matching actions remain, with "Make GIF" first.
- **S18: Convert wheel.** Given a selected `.heic`. When the user opens the wheel. Then the targets offered are image formats, and picking WebP puts a job in the job pill.
- **S19: Command bar actions.** Given two selected PDFs. When the user presses Ctrl+K and types "merge". Then "Merge PDFs" is offered and runs on those two files.
- **S20: Paste a link.** Given the command bar is open. When the user pastes a YouTube link and presses Enter. Then a download job is queued.

Tabs, panes, search
- **S21: Tabs come back.** Given three tabs open. When the user quits and reopens Sparky. Then the same three tabs open at the same folders.
- **S22: Drag between panes.** Given two panes on different drives. When the user drags a file across. Then it is copied; on the same drive it is moved; Shift forces a move, Ctrl a copy.
- **S23: Search with Everything.** Given Everything is running. When the user searches "invoice". Then results come from Everything as a virtual folder.
- **S24: Search without Everything.** Given Everything is not running and the folder was indexed. When the user searches "invoice". Then results come from Sparky's index within 200 ms.

Preview and inspector
- **S25: Space preview.** Given a selected video in a format the window can't play. When the user presses Space. Then a preview plays from a proxy file.
- **S26: Inspector.** Given a selected image. When the inspector is open. Then it shows the preview, dimensions, size, dates and image actions.

Extras, cloud, look
- **S27: Batch rename.** Given 10 selected photos and the pattern `trip-{n}`. When the user applies it. Then they are `trip-1` to `trip-10` in the shown order, and Ctrl+Z restores the old names.
- **S28: Archive as folder.** Given a `.zip`. When the user opens it. Then its contents list like a folder, and dragging a file out extracts it.
- **S29: Tags survive renames.** Given a file tagged red. When it is renamed. Then it still shows the red tag.
- **S30: Folder sizes.** Given a folder holding 3 files of 1 MB. When the size column is on. Then it shows 3 MB.
- **S31: Cloud remote.** Given a connected SFTP server. When the user opens it in Places and copies a file to Downloads. Then the file arrives and the copy shows in the job pill.
- **S32: Theme switch.** Given the Sparky dark theme. When the user picks Nord. Then the window restyles at once and Nord is still set after a restart.
- **S33: Window first.** Given Sparky is closed. When the user starts it. Then the window shows before the engine loads, within 1 s on a warm start.

## Edge cases
- A file in use by another app -> copy works, move and delete report "in use by another app" and leave it in place (part of S10-S13 tests).
- Copy to a full disk -> the job fails with "Not enough space", no partial file (S11 test file).
- A rename to an existing name -> asked like S10.

## Out of scope
Other apps' Explorer menu items, Win+E takeover, encrypted folders, disk-space map, extensions, Miller columns, drive mounting, macOS and Linux.

## Test map (planned; filled as each phase lands)
| Scenarios | Test file |
|---|---|
| S1-S2, S4 (error code) | `packages/fs-native/test/list.test.ts` (S4 message in the window: `apps/desktop/src/main/fs.test.ts`) |
| S3-S9 | `apps/desktop/src/main/fs.test.ts`, `apps/desktop/src/renderer/src/browse/*.test.tsx` |
| S10-S15, S27 | `packages/engine/test/file-ops.test.ts` |
| S16 | `packages/cli/test/mcp-limits.test.ts` |
| S17-S20 | `apps/desktop/src/renderer/src/command/*.test.tsx` |
| S21-S24 | `apps/desktop/src/renderer/src/shell/*.test.tsx`, `packages/engine/test/search.test.ts` |
| S25-S26 | `apps/desktop/src/renderer/src/preview/*.test.tsx` |
| S28-S31 | `packages/engine/test/{archive,tags,folder-size,remote}.test.ts` |
| S32-S33 | `apps/desktop/src/renderer/src/theme.test.tsx`, `packages/engine/test/gpu-cache.test.ts` (S33) |
