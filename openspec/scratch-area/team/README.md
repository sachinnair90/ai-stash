# ai-stash Build Team

Team name: `ai-stash-build`
Team config: `~/.claude/teams/ai-stash-build/config.json`
Task list: `~/.claude/tasks/ai-stash-build/`

## Team Structure

| Agent | Owns | Tasks |
|-------|------|-------|
| **lead** (you) | Coordination, unblocking, reviews | — |
| **infra** | Foundation layer | 1–4 |
| **adapters** | Adapter system + both tool adapters | 5–7 |
| **engine** | Install/update/remove engines | 8–9 |
| **tui** | All TUI components | 10–15 |
| **qa** | Testing + packaging | 16–17 |

## Dependency Graph

```
1 (scaffold)
├── 2 (config)    ─┐
├── 3 (registry)  ─┤─→ 5 (adapter interface) ─→ 6 (claude-code adapter) ─┐
├── 4 (lockfile)  ─┘                           → 7 (copilot adapter)    ─┤─→ 8 (install engine)
│                                                                          └─→ 9 (update/remove engine)
└── 10 (TUI shell)
    ├── 11 (asset list) ← also 3, 4
    ├── 12 (search/filter)
    ├── 13 (preview pane) ← also 3
    ├── 14 (install flow) ← also 8, 11, 12, 13
    └── 15 (update/remove views) ← also 9, 11

6, 7, 8, 9 → 16 (testing)
1, 16      → 17 (packaging)
```

## Spawning Agents

To resume work, spawn each agent like this (example for infra):

```
Agent tool → subagent_type: general-purpose
             team_name: ai-stash-build
             name: infra
             prompt: (see per-agent prompts below)
```

## Agent Prompts

### infra
You are the infra agent on the ai-stash-build team. Your job is to implement tasks 1–4:
scaffold the npm package, config layer, registry client, and lockfile management.
Repo: /mnt/shared/dev/repos/ai-stash
Read the task list for details. Claim tasks via TaskUpdate (owner: "infra"), work in order.
When done with a task mark it completed and pick up the next unblocked one.

### adapters
You are the adapters agent on the ai-stash-build team. Your job is to implement tasks 5–7:
adapter interface, Claude Code adapter, and Copilot adapter.
Repo: /mnt/shared/dev/repos/ai-stash
Read the task list for details. Claim tasks via TaskUpdate (owner: "adapters").

### engine
You are the engine agent on the ai-stash-build team. Your job is to implement tasks 8–9:
install engine and update/remove engine.
Repo: /mnt/shared/dev/repos/ai-stash
Read the task list for details. Claim tasks via TaskUpdate (owner: "engine").

### tui
You are the tui agent on the ai-stash-build team. Your job is to implement tasks 10–15:
all TUI components using Ink/React.
Repo: /mnt/shared/dev/repos/ai-stash
Read the task list for details. Claim tasks via TaskUpdate (owner: "tui").

### qa
You are the qa agent on the ai-stash-build team. Your job is to implement tasks 16–17:
vitest tests and npm packaging/distribution.
Repo: /mnt/shared/dev/repos/ai-stash
Read the task list for details. Claim tasks via TaskUpdate (owner: "qa").

## Resuming

1. Check task progress: TaskList (team: ai-stash-build)
2. Spawn only the agents whose tasks are unblocked and not completed
3. Agents read the task list, claim their tasks, and continue where left off
