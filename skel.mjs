// coir plugin: a `skel` command that dumps a Cocos/Spine binary `.skel`'s
// skeleton info + animation list (each name + duration).
//
// A 3.8 `.skel` is a sequential binary with no offsets, so we let the real spine
// parser do the full read. npm's @esotericsoftware/spine-core is 4.x and CANNOT
// read a 3.8.99 skel (the binary format changed at 4.0), so we vendor the exact
// 3.8 runtime Cocos ships (vendor/spine-core-3.8.mjs, pure JS, no GPU — a
// FakeTexture stands in). The paired `.atlas` (a sibling file) is required by the
// parser (attachments need it).
//
// Node-only: it reads the binary itself via node fs (commands run headless in
// coir's CLI / MCP, never the browser). Registered ONCE via coir's `commands`
// hook: `coir skel <asset>` on the CLI AND — because it declares an `inputSchema`
// — the `skel` MCP tool. `run(ctx)` RETURNS { data, text } and never prints.
//
// Usage (load the plugin explicitly, or auto-load via a coir.plugins.mjs):
//   coir skel hero.skel -C /path/to/game --plugin /path/to/coir-plugins/skel.mjs
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import spine from './vendor/spine-core-3.8.mjs';

/**
 * Read a spine 3.8 binary `.skel` → skeleton metadata + animations. Pure given
 * the bytes; the atlas text is required (attachments crash a null loader).
 * @param {Uint8Array} skelBytes  raw .skel bytes
 * @param {string} atlasText      the paired .atlas text
 */
export function readSkel(skelBytes, atlasText) {
  const atlas = new spine.TextureAtlas(atlasText || '', () => new spine.FakeTexture({ width: 2, height: 2 }));
  const loader = new spine.AtlasAttachmentLoader(atlas);
  const data = new spine.SkeletonBinary(loader).readSkeletonData(skelBytes);
  return {
    version: data.version || null,
    hash: data.hash || null,
    width: typeof data.width === 'number' ? data.width : null,
    height: typeof data.height === 'number' ? data.height : null,
    fps: typeof data.fps === 'number' ? data.fps : null,
    bones: (data.bones || []).length,
    slots: (data.slots || []).length,
    skins: (data.skins || []).length,
    events: (data.events || []).length,
    // FILE ORDER (Cocos getAnimsEnum maps <None>=0 then anims i→i+1).
    animations: (data.animations || []).map((a) => ({ name: a.name, duration: a.duration })),
  };
}

// Read + parse the binary `.skel` at `assetPath` (via node fs) plus its paired
// `.atlas`. Returns { m, atlasPath }; throws on read/parse failure. Shared by the
// `skel` command and the asset-menu contribution so neither duplicates the IO.
async function loadSkel(projectDir, scan, assetPath, readText) {
  const bytes = new Uint8Array(await readFile(path.join(projectDir, 'assets', assetPath)));
  const atlasPath = findAtlasPath(scan, assetPath);
  const atlasText = atlasPath ? await readText(atlasPath) : '';
  return { m: readSkel(bytes, atlasText), atlasPath };
}

// The .atlas paired with a .skel: a sibling in the same dir, preferring the same
// basename, else the only/first .atlas there (Cocos pairs them by folder).
function findAtlasPath(scan, skelPath) {
  const dir = path.posix.dirname(skelPath);
  const base = path.posix.basename(skelPath).replace(/\.skel$/i, '');
  let only = null;
  for (const a of scan.assets.values()) {
    if (!a.path || !/\.atlas$/i.test(a.path)) continue;
    if (path.posix.dirname(a.path) !== dir) continue;
    if (path.posix.basename(a.path).replace(/\.atlas$/i, '') === base) return a.path; // exact basename
    if (!only) only = a.path;
  }
  return only;
}

const r2 = (n) => (n == null ? '?' : Math.round(n * 100) / 100);

function renderSkel(assetPath, m, atlasPath) {
  const lines = [
    `${assetPath}  (spine)`,
    `  spine     ${m.version || '?'}${m.hash ? `  hash=${m.hash}` : ''}${m.width != null && m.height != null ? `  ${m.width}×${m.height}` : ''}`,
    `  rig       ${m.bones} bones · ${m.slots} slots · ${m.skins} skins · ${m.events} events`,
    `  atlas     ${atlasPath || '(none found — UVs faked)'}`,
    `  animations (${m.animations.length}):`,
  ];
  if (!m.animations.length) lines.push('    (none)');
  m.animations.forEach((a, i) => lines.push(`    ${i + 1}. ${a.name}    dur=${r2(a.duration)}s`));
  return lines.join('\n');
}

/** @type {import('coir').Plugin} */
export default {
  name: 'skel',
  commands: [
    {
      name: 'skel',
      usage: 'coir skel <asset>   skeleton info + animation list of a Spine binary .skel',
      description:
        'A Spine binary .skel (3.8): version/hash/size, bone/slot/skin/event counts, and the ' +
        'animation list (name + duration), parsed by the bundled spine 3.8 runtime. The paired ' +
        '.atlas (a sibling file) is required.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['asset'],
        properties: {
          asset: { type: 'string', description: 'The .skel asset by path / basename / uuid.' },
        },
      },
      positional: ['asset'],
      async run(ctx) {
        const q = ctx.args.asset;
        if (!q) return { error: 'usage: coir skel <asset>' };
        const uuid = ctx.resolveAsset(q); // CLI: candidates + exit 2 on miss · MCP: throws → clean tool error
        const asset = ctx.scan.assets.get(uuid);
        if (!asset) return { error: `resolved ${uuid} but it is not in the scan` };
        if (!/\.skel$/i.test(asset.path || '')) {
          return { error: `${asset.path} is not a binary .skel (a JSON spine skeleton isn't read by this command)` };
        }
        if (!ctx.projectDir) return { error: 'skel needs ctx.projectDir to read the binary file' };

        let m, atlasPath;
        try {
          ({ m, atlasPath } = await loadSkel(ctx.projectDir, ctx.scan, asset.path, ctx.readText));
        } catch (e) {
          return { error: `${asset.path}: failed to read .skel — ${e.message}` };
        }
        return {
          data: { asset: asset.path, uuid, atlas: atlasPath || null, ...m },
          text: renderSkel(asset.path, m, atlasPath),
        };
      },
    },
  ],
  // Editor right-click menu (e.g. the Cocos extension) — independent of the command.
  // One row per animation: its name + duration.
  assetMenus: [
    {
      ext: ['.skel'],
      label: 'Coir skel',
      async rows(ctx) {
        const { m } = await loadSkel(ctx.projectDir, ctx.scan, ctx.asset.path, ctx.readText);
        return m.animations.map((a) => ({ label: `${a.name} / ${r2(a.duration)}s` }));
      },
    },
  ],
};
