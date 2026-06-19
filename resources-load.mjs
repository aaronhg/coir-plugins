// resources-load — recover Cocos *dynamic-load* edges that static __uuid__
// analysis can't see: resources.load('ui/Coin') / resources.loadDir('audio'),
// and (optionally) a bundle's someBundle.load('Boss') paired with a
// loadBundle('name') in the same file.
//
// coir's graph is static (it follows serialized __uuid__ refs), so runtime
// path-string loads are invisible — the loaded asset looks "unused" and never
// appears in the topology/closure. This plugin scans source for LITERAL load
// paths, resolves them to assets, and adds an edge:
//   <loader script | a virtual "dynamic-load" node>  ->  the loaded asset
// kind `resource-load`, so it's filterable / `~`-searchable / `deps --kind`.
//
// Unlike the other edge plugins here it scans EVERY .ts (via ctx.files), so it
// ALSO catches loaders in plain util/manager modules (which the core prunes from
// the index) — those edges hang off a virtual node so the target still gains a
// referrer. (Give a util loader `@cc.Component` for precise per-script edges.)
//
// Limitations (by design): only STRING LITERALS resolve — load('ui/' + name)
// can't be followed; declare those in DECLARED. A bare path resolves within the
// bundle you name it against.
//
// ── configure ────────────────────────────────────────────────────────────────
// Each pattern's regex captures (kind = 'load'|'loadDir', path); `bundle` is the
// bundle the path is relative to ('resources' = the built-in resources bundle).
// Add your own loader wrappers here.
const PATTERNS = [
  { re: /\bresources\.(load|loadDir)\s*\(\s*['"`]([^'"`]+)['"`]/g, bundle: 'resources' },
  // { re: /\bAssetMgr\.(loadUI|loadDir)\s*\(\s*['"`]([^'"`]+)['"`]/g, bundle: 'resources' },
];
// Also follow `someBundle.load('x')` against a `loadBundle('name')` literal in the same file.
const FOLLOW_BUNDLE_LOAD = true;
// Explicit declarations for computed paths a regex can't recover (a trailing '*' = subtree).
const DECLARED = [
  // { from: 'scripts/UIMgr.ts', bundle: 'resources', load: 'ui/*' },
];
// ─────────────────────────────────────────────────────────────────────────────

/** @type {import('coir').Plugin} */
const resourcesLoad = {
  name: 'resources-load',
  colors: { dynamic: '#ffb74d' }, // the virtual "dynamic-load" node (util loaders aren't graph nodes)

  async edges(ctx) {
    // ext-less source path -> asset, so 'resources/ui/Coin' resolves to Coin.png.
    const byNoExt = new Map();
    for (const a of ctx.assets.values()) if (a.hasSource) byNoExt.set(a.path.replace(/\.[^/.]+$/, ''), a);
    const rootOf = (name) => { const b = ctx.bundles.find((x) => x.name === name); return b ? b.root : name; }; // ctx.bundles
    const resolve = (root, rel) => byNoExt.get(`${root ? root + '/' : ''}${rel}`);
    const resolveDir = (root, rel) => {
      const pre = `${root ? root + '/' : ''}${rel}/`;
      return [...byNoExt].filter(([p]) => p.startsWith(pre)).map(([, a]) => a);
    };
    const hit = (from, root, kind, rel, label) => {
      for (const t of (kind === 'loadDir' ? resolveDir(root, rel) : [resolve(root, rel)])) if (t) ctx.addEdge(from, t.uuid, 'resource-load', null, label);
    };

    const BUNDLE_NAME = /\bloadBundle\s*\(\s*['"`]([^'"`]+)['"`]/;       // the bundle this file uses
    const BUNDLE_LOAD = /\.(load|loadDir)\s*\(\s*['"`]([^'"`]+)['"`]/g;  // someBundle.load('x')
    const srcs = ctx.files.filter((f) => /\.ts$/.test(f) && !f.endsWith('.d.ts'));

    await ctx.mapLimit(srcs, 16, async (path) => {
      let text; try { text = await ctx.readText(path); } catch { return; }
      const asset = ctx.byPath.get(path);                                // component → real node; util → undefined
      const from = asset ? asset.uuid : ctx.addNode({ path: 'dynamic-load', type: 'dynamic' });
      for (const { re, bundle } of PATTERNS) {
        const root = rootOf(bundle);
        for (const [, kind, rel] of text.matchAll(re)) hit(from, root, kind, rel, `${bundle}.${kind}('${rel}')`);
      }
      if (FOLLOW_BUNDLE_LOAD) {
        const bn = text.match(BUNDLE_NAME);
        if (bn) { const root = rootOf(bn[1]); for (const [, kind, rel] of text.matchAll(BUNDLE_LOAD)) hit(from, root, kind, rel, `${bn[1]}.${kind}('${rel}')`); }
      }
    });

    for (const d of DECLARED) {
      const from = ctx.byPath.get(d.from)?.uuid || ctx.addNode({ path: 'dynamic-load', type: 'dynamic' });
      const root = rootOf(d.bundle);
      if (d.load.endsWith('*')) for (const t of resolveDir(root, d.load.replace(/\/?\*$/, ''))) ctx.addEdge(from, t.uuid, 'resource-load', null, `declared ${d.bundle}/${d.load}`);
      else { const t = resolve(root, d.load); if (t) ctx.addEdge(from, t.uuid, 'resource-load', null, `declared ${d.bundle}/${d.load}`); }
    }
  },
};

export default resourcesLoad;
