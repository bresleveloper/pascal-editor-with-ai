# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Pascal Editor — a 3D building editor (React Three Fiber + WebGPU) with an autonomous AI agent subsystem layered on top of the scene API.

## Commands

Run from the **repo root** unless noted. The dev server only hot-reloads packages when launched from root (Turbo runs all watchers).

```bash
bun install              # install all workspaces
bun dev                  # builds packages, starts editor at http://localhost:3002
bun build                # turbo run build (all packages)
bun check                # biome lint + format
bun check:fix            # biome lint + format with --write
bun check-types          # turbo run check-types (per-package tsc --noEmit)
bun test                 # turbo run test (per-package; agent packages use bun:test)
bun kill                 # kill stuck dev server on :3002
```

Per-package tests (run from the package dir):

```bash
cd packages/scene-api    && bun test src/__tests__/*.test.ts
cd packages/agent-core   && bun test src/__tests__/*.test.ts
cd packages/agent-models && bun test src/__tests__/*.test.ts
```

Single test file: `bun test path/to/file.test.ts`. Single test: `bun test -t "<name>"`.

CLI (built binary at `apps/cli/dist/index.js`, exposed as `pascal-agent`):

```bash
pascal-agent doctor                          # check providers + config
pascal-agent ask "<prompt>" --dry-run        # plan a scene edit
pascal-agent resolve "<english reference>"   # English → wall ID
pascal-agent scene summary --scene scene.json --json
```

## Port discrepancy

`README.md` and `SETUP.md` say port **3000**, but `apps/editor/package.json` runs on **3002** (and `bun kill` targets 3002). Use 3002 — the docs are stale.

## Workspace map

Turborepo monorepo, Bun workspaces (`apps/*`, `packages/*`, `tooling/*`). The README only documents `core` / `viewer` / editor app — the others below are recent additions.

| Package | Role |
|---|---|
| `apps/editor` | Next.js 16 app, the actual editor UI (port 3002) |
| `apps/cli` | `pascal-agent` headless CLI (commander, ESM) |
| `packages/core` (`@pascal-app/core`) | Node schemas (Zod), `useScene` Zustand store, core systems, scene registry, event bus |
| `packages/viewer` (`@pascal-app/viewer`) | R3F canvas, default renderers, `useViewer` store, post-processing |
| `packages/editor` (`@pascal-app/editor`) | Editor UI components extracted from `apps/editor` (panels, tools, AI chat) |
| `packages/ui` | Shared low-level UI primitives |
| `packages/scene-api` (`@pascal/scene-api`) | Pure typed domain API + impact engine over scene state. **No React, no Three.js.** |
| `packages/agent-models` (`@pascal/agent-models`) | Provider abstractions: mock, ollama, openai-compatible |
| `packages/agent-core` (`@pascal/agent-core`) | Planner, executor, runtime, tool registry, retry/blocker policy, reference resolver |
| `packages/agent-testkit` (`@pascal/agent-testkit`) | Fixtures, scenario harnesses, deterministic stubs, golden tests |
| `tooling/*` | Shared `typescript-config`, `eslint-config` |

Two ecosystems coexist: the **3D editor** (`@pascal-app/*`) and the **AI agent** (`@pascal/*`). The agent never touches React; it talks to the scene through `@pascal/scene-api`, which wraps `@pascal-app/core`.

## Architectural rules (enforced)

These live in `.cursor/rules/` (symlinked into `.claude/rules/`). Read the relevant rule before editing the area it covers.

- **Viewer isolation** — `packages/viewer` MUST NOT import from `apps/editor`, `@pascal-app/editor`, or reference `useEditor` / tool / phase concepts. Editor-specific behaviour is injected as `<Viewer>` children. The viewer must keep working in the read-only `/viewer/[id]` route.
- **Three stores, three scopes** — `useScene` (core: scene data, persisted to IndexedDB with Zundo undo/redo), `useViewer` (viewer: presentation — selection, camera mode, level mode, theme), `useEditor` (editor app: active tool, phase, panels). State must live in the store that matches its scope; do not promote editor state into the viewer.
- **Renderers vs Systems** — Renderers (`packages/viewer/src/components/renderers/`) only mount Three meshes, register with `useRegistry(id, type, ref)`, and spread `useNodeEvents(node, type)`. Geometry generation, mitering, CSG, constraints all belong in **systems** (`packages/{core,viewer}/src/systems/`). Core systems must not import Three; viewer systems must not contain domain logic.
- **Dirty nodes** — `createNode` / `updateNode` / `deleteNode` automatically mark IDs in `useScene.getState().dirtyNodes`. Systems consume them in `useFrame` and clear them. Don't run expensive per-frame work without a dirty check.
- **Node schemas** — All node types are Zod schemas in `packages/core/src/schema/nodes/`. **Always use `MyNode.parse({...})`** to construct nodes (it generates the typed ID and fills defaults). Add new types to the `AnyNode` union in `schema/types.ts` or the store will reject them.
- **Scene registry** — `sceneRegistry.nodes.get(id)` for O(1) lookups; `sceneRegistry.byType.<type>` to iterate. Only `useRegistry` writes to it. Core systems must not use it (they work on plain data).
- **Events** — Typed `mitt` bus, keys are `<nodeType>:<suffix>` (e.g. `wall:click`, `grid:pointerdown`). Renderers only **emit** (via `useNodeEvents`), selection managers and tools **listen**. Always `emitter.off` with the same function ref on cleanup.
- **Selection managers** — Two separate components: viewer's (hierarchical Building→Level→Zone→Elements, in `packages/viewer`) and editor's (phase-aware: site/structure/furnish, in `apps/editor`). The editor's overrides the viewer's via the children injection pattern. `useViewer.selection` is the single source of truth.
- **Tools** — Live only in `apps/editor/components/tools/`. They mutate `useScene` directly; they don't call Three APIs and don't import from `@pascal-app/viewer`. Preview geometry is local to the tool component.
- **Spatial queries** — Use `useSpatialQuery()` (`canPlaceOnFloor` / `canPlaceOnWall` / `canPlaceOnCeiling`) in every placement tool. For wall placement use the returned `adjustedY`, not the raw cursor Y. Always pass `[item.id]` in `ignoreIds` when validating an existing draft so it doesn't collide with itself.
- **Three.js layers** — Use the named constants, never hardcoded numbers: `SCENE_LAYER` (0) and `ZONE_LAYER` (2) in `@pascal-app/viewer`, `EDITOR_LAYER` (1) in `apps/editor`. Zones must set `layers={ZONE_LAYER}` (composited via a separate post-processing pass); editor helpers must set `layers={EDITOR_LAYER}` (excluded from thumbnail exports).

When the same mistake is made twice, add a new rule under `.cursor/rules/` and symlink into `.claude/rules/` (see `.cursor/rules/creating-rules.mdc`).

## Agent subsystems

**Two separate implementations** — easy to conflate:

1. **CLI / backend agent** (`packages/scene-api` + `agent-models` + `agent-core` + `agent-testkit`, exposed via `apps/cli` as `pascal-agent`). Pure TypeScript, no React. Planner → TaskRunner → Executor → Tools → SceneApi → Impact Engine → Validation. All mutations support **dry-run**; wall changes return impact on connected walls, openings, and zones. Provider fallback: configured → Ollama local → mock. Env: `AGENT_PROVIDER` (`mock`|`ollama`|`openai-compatible`), `AGENT_MODEL`, `AGENT_API_KEY`, `AGENT_BASE_URL`, `OLLAMA_BASE_URL`. Docs: `docs/agent/01-architecture.md` … `05-scenarios.md`.

2. **In-editor AI chat** (`packages/editor/src/lib/agent/` + `components/ui/ai-chat/`, mounted as a sidebar tab in `apps/editor/app/page.tsx`). Browser-side. Calls Ollama **directly from the browser** at `http://localhost:11434/api/chat` — so Ollama's `OLLAMA_ORIGINS` must allow the dev origin (`http://localhost:3002` is allowed by default in recent Ollama). Default model: `glm-5.1:cloud`. Two code paths:
   - **Local fallback** (`localFallback()` in `agent-service.ts`) — regex patterns catch "create a house", "add a wall from (0,0) to (5,0)", etc. Instant, no LLM.
   - **LLM path** (`sendToAgent()`) — builds a system prompt with scene summary + tool defs, sends to Ollama, parses ```json blocks for `{"tool_calls":[...]}`, executes, loops up to `maxRounds`. The LLM sometimes returns a "planning" response with no tool_calls (e.g. "I'll set that up for you!") — the orchestrator detects first-round planning phrases and re-prompts. Tools in `scene-tools.ts` mutate `useScene` directly and return a human-readable message.

Adding a sidebar tab: `Editor` takes `sidebarTabs: (SidebarTab & { component: React.ComponentType })[]`. See `apps/editor/app/page.tsx` for the AI Agent wiring.

## Gotchas

- **Persisted scene shape drift (IndexedDB)** — `useScene` persists with Zustand persist middleware. Refactoring how nodes are stored (e.g. `site.children` from embedded objects → ID strings) breaks **existing** browser sessions silently: the persisted old shape is re-loaded, renderers bail partially, you see zone labels but no walls. Symptoms: "works in Incognito / Playwright, fails in my normal browser." Fix: test in Incognito/Private, or **Application → Storage → Clear site data** in DevTools. Handle both shapes in any migration code that reads persisted nodes.
- **Windows symlinks** — `CLAUDE.md`, `.claude/CLAUDE.md`, and `.claude/rules/*.md` were originally tracked as symlinks to `AGENTS.md` / `.cursor/rules/*.mdc`. On Windows with `core.symlinks=false` (the default without Developer Mode) they check out as plain text files containing just the symlink target. If they get "broken" again on a fresh clone, either enable git symlinks + Windows Dev Mode, or copy content from `.cursor/rules/*.mdc` into `.claude/rules/*.md`.

## Code style

Biome (`biome.jsonc`): 2-space indent, 100-char line, single quotes, JSX double quotes, semicolons `asNeeded`, trailing commas everywhere. The editor app excludes `components/ui` (shadcn-style primitives) from linting. Run `bun check:fix` before committing.

## Releases

GitHub Actions via `gh`:

```bash
bun release           # both packages, patch bump
bun release:viewer    # viewer only
bun release:core      # core only
bun release:minor     # both, minor bump
```
