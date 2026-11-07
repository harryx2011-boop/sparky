Status: DONE (2026-11-07)

# Sparky 2.0 step 11: navigation in the Browse page

Goal: move around folders and select files in Browse with the mouse and keyboard the way Explorer does (spec S5-S9).

Parent plan: `2026-11-05-sparky-2-file-manager.md` step 11. Spec: `docs/specs/file-manager.md` S5-S9.

## Decisions

Harry skipped the questions on 2026-11-07 ("use sensible defaults"). Each call below is a default, not confirmed.

1. **History lives in app state.** `openFolder` pushes an entry, so Places, Up, double-click and the path bar all feed one back/forward stack. Each entry has an id; the Browse page remembers the selection per entry id (S6). Revisiting a folder makes a fresh entry. Default, not confirmed.
2. **Path bar.** The breadcrumb (shadcn Breadcrumb) shows one button per folder. Clicking the empty part of the bar, Ctrl+L, Alt+D or F4 turns it into a text field with the path selected. Enter checks the path with the existing `folders:list` call; a bad path shows the main process message ("That folder doesn't exist.") under the field and nothing else changes (S5). Escape or leaving the field cancels. Quotes and forward slashes are cleaned up. Default, not confirmed.
3. **Keys.** Arrows move by the view's own step (Details: up/down; List: up/down, left/right by a column; Grid: left/right, up/down by a row of tiles). Shift extends from the anchor, Ctrl moves only the cursor, Ctrl+Space toggles it, Home/End, Ctrl+A. Enter opens (S9). Backspace and Alt+Left go back, Alt+Right forward, Alt+Up up. Mouse back and forward buttons work. Typing selects the first name that starts with what was typed in the last second (S7). Default, not confirmed.
4. **Enter on several items.** One folder opens in the pane; selected files each open in their default app; folders in a mixed selection are skipped. Default, not confirmed.
5. **"N selected" goes in the shell status bar** (S8), through a small page-status slot any page can set. Default, not confirmed.
6. **Reveal.** The view menu gets "Open in File Explorer": it shows the one selected item in Explorer, or opens the current folder. Default, not confirmed.

## Out of scope

Thumbnails (step 12), context menu, rename/delete/copy (later steps), drag-select with a box, PageUp/PageDown, the start page moving to Browse (step 34).

## Steps

1. Pure models with tests first: `browse/selection.ts` (click, Shift, Ctrl, arrows, type-to-select, what Enter opens), `browse/history.ts` (back/forward, selection memory), path helpers in `browse/model.ts` (breadcrumb parts, typed path check). Verify: `npx vitest run src/renderer/src/browse` in `apps/desktop`.
2. Wire it in: history in `lib/state.tsx`, `browse/PathBar.tsx`, keyboard and selection in the views, the status slot in `shell/StatusBar.tsx`. Verify: `npm run typecheck` and `npm test` in `apps/desktop`, then drive the built app (memory `drive-dev-app-from-script`) through S5-S9.
3. Docs: parent plan step 11 marked Done with what was measured, `context.md`, `NEXT-SESSION-PROMPT.md`.

## Risks and rollback

- Key handling could fight text fields (path bar, menus). Keys are handled on the view's scroller, not the window, except Alt+arrows and the mouse buttons.
- Rollback: the work is one commit on `sparky-2`; `git revert` it.
