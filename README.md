# coir-plugins

Example plugins for [coir](https://github.com/aaronhg/coir) — two kinds: **edge plugins** (turn the "loaded by string name at runtime" blind spot into queryable dependency edges) and **command plugins** (add a `coir <cmd>` that's also an MCP tool).

Each file is **one plugin, `export default` a single plugin object** — zero deps, no build step (it only uses `ctx`; types come from `import('coir').Plugin`). The edge plugins are **templates**: use them as-is, or edit the `── configure ──` block at the top to match your project's naming.

## Edge plugins

| File | name | What it does | Configure |
|---|---|---|---|
| [`audio-call.mjs`](audio-call.mjs) | `audio-call` | Scans component source and links a `playAudio('bgm_title')`-style call to the audio asset of the same name (`.mp3`/`.ogg`) → edge `script → audio` | `FUNCS`: your play-audio function name(s) |
| [`i18n-label.mjs`](i18n-label.mjs) | `i18n-label` | Links an i18n label component's dot-path key (e.g. `MODULE.some_key`) in a prefab/scene to the `lang.json` that defines it → edge `prefab/scene → lang.json` | `COMPONENT`/`KEY_PROP`/`LANG_FILE`, `isLangFile()` |
| [`resources-sprite.mjs`](resources-sprite.mjs) | `resources-sprite` | Links a component that resolves sprites by frame name (a serialized `keys: string[]`) at runtime to the sprite-atlas(es) holding those frames → edge `prefab/scene → atlas` (coir's built-in atlas plugin then links atlas → texture, completing `scene → atlas → png`) | `COMPONENTS`/`KEYS_PROP` |

> All three edge plugins see **component scripts only** (plain util modules are pruned before edges run) and resolve **string literals only** (variables/enums can't be followed statically); a colliding name links to every match — these are deliberate trade-offs.

## Command plugins

Each adds a `coir <cmd> <asset>` command (headless, engine-free); because it declares an `inputSchema`, it's **also an MCP tool under `coir mcp`** (one `run` serves both). Nothing to configure.

| File | name | What it does |
|---|---|---|
| [`anim.mjs`](anim.mjs) | `anim` | `coir anim <asset>` — reads a Cocos `.anim` (AnimationClip JSON, engine-free) and prints its metadata: name, effective duration (÷ speed), sample/frames, wrapMode, track/event counts. |
| [`skel.mjs`](skel.mjs) | `skel` | `coir skel <asset>` — reads a Spine **binary `.skel` (3.8)** and prints skeleton info (version/hash/size, bone/slot/skin/event counts) plus the animation list (each name + duration). |

Both also declare an `assetMenus` contribution (a plugin-level field, separate from `commands`), so when active in the [Cocos Creator extension](https://github.com/aaronhg/coir#嵌入--整合viewer--embedder--cocos-擴充) a right-click on a `.anim`/`.skel` shows a **`Coir anim`/`Coir skel`** submenu listing each animation as `name / duration`.

```bash
coir anim walk.anim  -C /path/to/game --plugin /path/to/coir-plugins/anim.mjs            # text
coir anim walk.anim  -C /path/to/game --plugin .../anim.mjs -o json                       # structured
coir skel hero.skel  -C /path/to/game --plugin /path/to/coir-plugins/skel.mjs
```

> **`skel`'s vendored runtime**: npm's `@esotericsoftware/spine-core` is 4.x only and can't read a 3.8.99 skel (the binary format changed at 4.0), so [`vendor/spine-core-3.8.mjs`](vendor/spine-core-3.8.mjs) bundles the exact 3.8 runtime Cocos ships (pure JS, used only to read animation names/durations — no GPU; a `FakeTexture` stands in). `skel` is **node-only** (it reads the binary itself, needs `ctx.projectDir`) and requires the `.atlas` sibling next to the `.skel` (attachment parsing needs it; without it that animation's duration won't resolve). If the project's spine version changes, update this file from a matching Cocos install.

## Loading

### 1. `--plugin <file>` (this query only, repeatable)

```bash
coir -C <your-project> --plugin ./audio-call.mjs --plugin ./i18n-label.mjs uses audio/bgm_title.mp3 --where
```

### 2. A `coir.plugins.mjs` (auto-loaded)

coir auto-loads a `coir.plugins.mjs` from the **coir repo root** (global, cross-project) and from the **scanned project root** (that project only); its `default` export is a plugin or an array. Re-export the ones you want:

```js
// <your-project>/coir.plugins.mjs
import audioCall from './path/to/coir-plugins/audio-call.mjs';
import i18nLabel from './path/to/coir-plugins/i18n-label.mjs';
export default [audioCall, i18nLabel];
```

> A global/project `coir.plugins.mjs` is auto-loaded by the **CLI, the browser, and the Cocos extension**; `--plugin` applies only to that one CLI/MCP invocation. See coir's "Plugins" section for details.

## Writing your own

The plugin contract (types / edges / commands) and the `ctx` API are documented in coir's **[Plugins](https://github.com/aaronhg/coir#外掛擴充型別邊與命令)** section and in `types/index.d.ts`.
