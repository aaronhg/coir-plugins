// i18n-label — link a prefab/scene to the lang file(s) that define the i18n key
// one of its label components points at.
//
// An i18n label component carries a dot-path key (e.g. "MODULE.some_key") that
// indexes into nested lang.json files under resources/, i.e.
//   lang.json -> { MODULE: { some_key: "..." } }
// Edge: prefab/scene -> every lang.json that DEFINES the key. coir edges are
// asset<->asset, so this is per-FILE, not per-key.
//
// Caveat: only lang.json files matched by isLangFile() below are scanned. Keys
// whose lang data is produced at BUILD time (e.g. copied in from a submodule)
// won't match a source-only scan — scan a built project, or widen isLangFile().
//
// ── configure ────────────────────────────────────────────────────────────────
const COMPONENT = 'I18nLabel';   // the i18n label component class (script basename, no .ts)
const KEY_PROP = 'dataID';       // the serialized property holding the dot-path key
const LANG_FILE = 'lang.json';   // the i18n data file basename

// Which lang files count. Default: any <LANG_FILE> under resources/. If your
// build copies a submodule's lang file into the bundle, widen this predicate
// (e.g. also accept /^submodule\/[^/]+\/resources\//.test(a.path)).
function isLangFile(a) {
  return a.hasSource && a.path.endsWith('/' + LANG_FILE) && a.path.startsWith('resources/');
}
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
const i18nLabel = {
  name: 'i18n-label',

  async edges(ctx) {
    const { assets, addEdge, readText, mapLimit, uuid: { looksCompressed, decompressUuid } } = ctx;

    // 1. Lang files, flattened to dot-path keys. key -> [langfile].
    const langFiles = [...assets.values()].filter(isLangFile);
    if (!langFiles.length) return;
    const keyToLangs = new Map();
    await mapLimit(langFiles, 16, async (a) => {
      let json;
      try { json = JSON.parse(await readText(a.path)); } catch { return; }
      (function flat(o, prefix) {
        for (const k in o) {
          const v = o[k];
          if (v && typeof v === 'object') { flat(v, `${prefix}${k}.`); continue; }
          const key = prefix + k;
          let arr = keyToLangs.get(key);
          if (!arr) keyToLangs.set(key, (arr = []));
          arr.push(a);
        }
      })(json, '');
    });
    if (!keyToLangs.size) return;

    // 2. The i18n label component-script uuid(s), by basename.
    const labelUuids = new Set(
      [...assets.values()]
        .filter((a) => a.type === 'script' && a.path.slice(a.path.lastIndexOf('/') + 1) === `${COMPONENT}.ts`)
        .map((a) => a.uuid),
    );
    if (!labelUuids.size) return;

    // 3. Scan prefab/scene for component instances -> edge to the lang file(s) holding the key.
    const docs = [...assets.values()].filter((a) => a.hasSource && (a.ext === '.prefab' || a.ext === '.scene'));
    await mapLimit(docs, 16, async (a) => {
      let json;
      try { json = JSON.parse(await readText(a.path)); } catch { return; }
      if (!Array.isArray(json)) return;
      for (const e of json) {
        const t = e && typeof e === 'object' ? e.__type__ : null;
        if (typeof t !== 'string' || !looksCompressed(t) || !labelUuids.has(decompressUuid(t))) continue;
        const key = e[KEY_PROP];
        if (typeof key !== 'string' || !key) continue;
        const loc = { nodePath: nodePathOf(json, e.node && e.node.__id__), component: COMPONENT, property: `${KEY_PROP}=${key}` };
        for (const lf of keyToLangs.get(key) || []) { // unresolved key (build-time/typo) -> no edge
          addEdge(a.uuid, lf.uuid, 'i18n', loc);
        }
      }
    });
  },
};

export default i18nLabel;
