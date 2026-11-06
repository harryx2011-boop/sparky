Status: IN PROGRESS

# Next session prompt

```
Sparky repo: D:\sparky\sparky (live, branch main). Setup revamp work is on branch setup-revamp in C:\Builds\setup-revamp\wt\sparky_sparky (local commit, not pushed).

Read first, in order:
1. context.md (canonical state)
2. docs/plans/README.md
3. docs/plans/ROADMAP.md (open items)
4. docs/plans/DECISIONS.md (D-2.0-1..7)
5. docs/plans/2026-11-05-sparky-2-file-manager.md (Sparky 2.0 file manager plan)
6. D:\sparky\reports\Sparky file manager remap.md (research behind it, outside the repo)

State:
- Sparky 2.0 file manager: planned 2026-11-05, no code. Work goes on branch sparky-2 (not created yet). Phase 0 next: spec (docs/specs/file-manager.md), two ADRs, three design comps in docs/design/2.0/ for Harry to pick.
- main: 1.3.0 in the manifests, installed locally, not tagged or released. Latest published release 1.1.1.
- Transcript op and progress bar changes are on main, not in the installed app.
- Untracked in the live checkout (not repo content): .aether/, .worktrees/, design/.

Next steps:
0. Sparky 2.0 Phase 0, steps 1-3 of the plan (spec, ADRs, design directions; Harry picks a direction before any shell code).
1. Harry reviews and merges setup-revamp (CLAUDE.md, docs/plans set, archived 1.1 plan, context.md note).
2. Rebuild the installed app: node ~/.claude/scripts/desktop-apps.mjs --rebuild sparky (use --no-test).
3. Memory folder for sparky (SPK-2) is handled by the memory track, not this repo.
4. Decide whether to tag 1.3.0 and publish a release (Harry's call).
```
