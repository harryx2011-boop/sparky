Status: IN PROGRESS

# Next session prompt

```
Sparky repo: D:\sparky\sparky (live, branch main). Setup revamp work is on branch setup-revamp in C:\Builds\setup-revamp\wt\sparky_sparky (local commit, not pushed).

Read first, in order:
1. context.md (canonical state)
2. docs/plans/README.md
3. docs/plans/ROADMAP.md (open items)
4. docs/plans/DECISIONS.md

State:
- main: 1.3.0 in the manifests, installed locally, not tagged or released. Latest published release 1.1.1.
- Transcript op and progress bar changes are on main, not in the installed app.
- Untracked in the live checkout (not repo content): .aether/, .worktrees/, design/.

Next steps:
1. Harry reviews and merges setup-revamp (CLAUDE.md, docs/plans set, archived 1.1 plan, context.md note).
2. Rebuild the installed app: node ~/.claude/scripts/desktop-apps.mjs --rebuild sparky (use --no-test).
3. Memory folder for sparky (SPK-2) is handled by the memory track, not this repo.
4. Decide whether to tag 1.3.0 and publish a release (Harry's call).
```
