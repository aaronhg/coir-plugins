// resources-sprite — link a prefab/scene to the sprite-atlas(es) a component
// resolves by FRAME NAME at runtime.
//
// Some components don't reference a SpriteFrame directly; they hold a list of
// frame-name strings (a serialized `keys: string[]`) and look each up at runtime
// from a dynamically-loaded atlas (e.g. atlas.getSpriteFrame(key)). This plugin
// adds an edge:
//   prefab/scene -> the sprite-atlas(es) that contain that frame
// coir's built-in atlas plugin then links atlas -> texture, completing the chain
// scene -> atlas -> png. (Localized atlases exist per-language, so one key fans
// out to each atlas that has it.)
//
// ── configure ────────────────────────────────────────────────────────────────
// The component classes that resolve sprites by frame name (script basenames, no .ts).
const COMPONENTS = new Set(['ResourcesSprite', 'ResSprite']);
const KEYS_PROP = 'keys';   // the serialized string[] property holding the frame names
// ─────────────────────────────────────────────────────────────────────────────

// Build a node path "Canvas/UI/Btn" for a node-index in a prefab/scene array
// (walk _parent/_name to the root) — matches coir's own nodePath, so the "used
// where" popup shows the real node instead of "(root)". Empty -> null.
function nodePathOf(json, nodeId) {
  const names = []; let cur = nodeId, guard = 0; const seen = new Set();
  while (cur != null && json[cur] && guard++ < 500 && !seen.has(cur)) {
    seen.add(cur);
    const o = json[cur];
    if (o._name) names.unshift(o._name);
    cur = o._parent && o._parent.__id__ != null ? o._parent.__id__ : null;
  }
  return names.join('/') || null;
}

/** @type {import('coir').Plugin} */
const resourcesSprite = {
  name: 'resources-sprite',

  async edges(ctx) {
    const { assets, addEdge, readText, mapLimit, uuid: { looksCompressed, decompressUuid } } = ctx;

    // 1. frame name -> [sprite-atlas asset], from each atlas's sub sprite-frames.
    const frameToAtlas = new Map();
    for (const a of assets.values()) {
      if (a.type !== 'atlas') continue;
      for (const sa of a.subAssets) {
        if (sa.kind !== 'sprite-frame' || !sa.name) continue;
        let arr = frameToAtlas.get(sa.name);
        if (!arr) frameToAtlas.set(sa.name, (arr = []));
        arr.push(a);
      }
    }
    if (!frameToAtlas.size) return;

    // 2. The components that resolve frame names, by basename.
    const compName = new Map(
      [...assets.values()]
        .filter((a) => a.type === 'script' && COMPONENTS.has(a.path.slice(a.path.lastIndexOf('/') + 1).replace(/\.ts$/, '')))
        .map((a) => [a.uuid, a.path.slice(a.path.lastIndexOf('/') + 1).replace(/\.ts$/, '')]),
    );
    if (!compName.size) return;

    // 3. Scan prefab/scene; each instance's keys[] -> atlas(es) holding that frame.
    const docs = [...assets.values()].filter((a) => a.hasSource && (a.ext === '.prefab' || a.ext === '.scene'));
    await mapLimit(docs, 16, async (a) => {
      let json;
      try { json = JSON.parse(await readText(a.path)); } catch { return; }
      if (!Array.isArray(json)) return;
      for (const e of json) {
        const t = e && typeof e === 'object' ? e.__type__ : null;
        if (typeof t !== 'string' || !looksCompressed(t)) continue;
        const comp = compName.get(decompressUuid(t));
        const keys = comp ? e[KEYS_PROP] : null;
        if (!comp || !Array.isArray(keys)) continue;
        const np = nodePathOf(json, e.node && e.node.__id__);
        for (const key of keys) {
          if (typeof key !== 'string' || !key) continue;
          for (const atlas of frameToAtlas.get(key) || []) {
            addEdge(a.uuid, atlas.uuid, 'res-sprite', { nodePath: np, component: comp, property: `${KEYS_PROP}=${key}` });
          }
        }
      }
    });
  },
};

export default resourcesSprite;
