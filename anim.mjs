// coir plugin: an `anim` command that dumps a Cocos `.anim` clip's metadata.
//
// Engine-free — a `.anim` is serialized like a scene (a JSON array whose
// cc.AnimationClip element carries the clip fields), so we read it straight from
// `ctx.readText`, no Cocos runtime. Registered ONCE via coir's `commands` hook:
// it runs as `coir anim <asset>` on the CLI AND — because it declares an
// `inputSchema` — as the `anim` MCP tool. `run(ctx)` RETURNS { data, text } and
// never prints; coir's CLI prints `text` (JSON on -o json), MCP returns `data`.
//
// Usage (load the plugin explicitly, or auto-load via a coir.plugins.mjs):
//   coir anim walk.anim -C /path/to/game --plugin /path/to/coir-plugins/anim.mjs

// cc.WrapMode — the common values; anything else shows as its raw number.
const WRAP_MODE = { 0: 'Default', 1: 'Normal', 2: 'Loop', 22: 'PingPong', 36: 'Reverse', 38: 'LoopReverse', 58: 'PingPongReverse' };

/**
 * Parse a Cocos `.anim` (AnimationClip JSON array) into a flat metadata object.
 * Pure (no I/O); returns null if the text isn't a parseable clip.
 * @param {string} text  raw .anim JSON text
 */
export function parseAnimClip(text) {
  let j;
  try { j = JSON.parse(text); } catch { return null; }
  // The clip is the cc.AnimationClip element (fallback: anything with a _duration).
  const clip = Array.isArray(j)
    ? (j.find((o) => o && o.__type__ === 'cc.AnimationClip') || j.find((o) => o && typeof o._duration === 'number'))
    : j;
  if (!clip || typeof clip !== 'object') return null;

  const num = (v) => (typeof v === 'number' ? v : null);
  const speed = typeof clip.speed === 'number' && clip.speed ? clip.speed : 1;
  const rawDur = num(clip._duration);
  const sample = num(clip.sample);
  const playDuration = rawDur != null ? rawDur / speed : null;
  return {
    name: typeof clip._name === 'string' ? clip._name : null,
    sample,
    speed,
    duration: playDuration,                 // effective (÷ speed)
    rawDuration: rawDur,
    frames: rawDur != null && sample != null ? Math.round(rawDur * sample) : null,
    wrapMode: num(clip.wrapMode),
    tracks: Array.isArray(clip._tracks) ? clip._tracks.length : 0,
    events: Array.isArray(clip._events) ? clip._events.length : 0,
  };
}

const r2 = (n) => (n == null ? '?' : Math.round(n * 100) / 100);

function renderAnim(assetPath, m) {
  const wrap = m.wrapMode == null ? '—' : `${m.wrapMode}${WRAP_MODE[m.wrapMode] ? ` (${WRAP_MODE[m.wrapMode]})` : ''}`;
  return [
    `${assetPath}  (anim)`,
    `  name      ${m.name ?? '?'}`,
    `  duration  ${r2(m.duration)}s   (raw ${r2(m.rawDuration)} ÷ speed ${m.speed})`,
    `  sample    ${m.sample ?? '?'} fps  →  ${m.frames ?? '?'} frames`,
    `  wrapMode  ${wrap}`,
    `  tracks    ${m.tracks}`,
    `  events    ${m.events}`,
  ].join('\n');
}

/** @type {import('coir').Plugin} */
export default {
  name: 'anim',
  commands: [
    {
      name: 'anim',
      usage: 'coir anim <asset>   metadata of a Cocos .anim clip (name/duration/sample/wrapMode/tracks)',
      description:
        "A Cocos .anim clip's metadata, read engine-free from the AnimationClip JSON: " +
        'name, effective duration (÷ speed), sample rate, frame count, wrapMode, and ' +
        'track/event counts.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['asset'],
        properties: {
          asset: { type: 'string', description: 'The .anim asset by path / basename / uuid.' },
        },
      },
      positional: ['asset'],
      async run(ctx) {
        const q = ctx.args.asset;
        if (!q) return { error: 'usage: coir anim <asset>' };
        const uuid = ctx.resolveAsset(q); // CLI: candidates + exit 2 on miss · MCP: throws → clean tool error
        const asset = ctx.scan.assets.get(uuid);
        if (!asset) return { error: `resolved ${uuid} but it is not in the scan` };
        if (asset.type !== 'anim' && !/\.anim$/i.test(asset.path || '')) {
          return { error: `${asset.path} is a ${asset.type}, not a .anim clip` };
        }

        const m = parseAnimClip(await ctx.readText(asset.path));
        if (!m) return { error: `${asset.path}: not a parseable AnimationClip` };
        return {
          data: { asset: asset.path, uuid, ...m },
          text: renderAnim(asset.path, m),
        };
      },
    },
  ],
};
