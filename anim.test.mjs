// Unit test for the engine-free .anim parser (anim.mjs).
//   node --test anim.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAnimClip } from './anim.mjs';

// A .anim is serialized as an array; the clip is the cc.AnimationClip element.
const clip = (o) => JSON.stringify([{ __type__: 'cc.AnimationClip', _name: 'walk', sample: 60, speed: 1, _duration: 1.5, wrapMode: 2, _tracks: [{}, {}], _events: [{}], ...o }]);

test('anim: name, duration (÷ speed), frames, wrapMode, counts', () => {
  const m = parseAnimClip(clip());
  assert.equal(m.name, 'walk');
  assert.equal(m.duration, 1.5);
  assert.equal(m.rawDuration, 1.5);
  assert.equal(m.sample, 60);
  assert.equal(m.frames, 90); // 1.5 * 60
  assert.equal(m.wrapMode, 2);
  assert.equal(m.tracks, 2);
  assert.equal(m.events, 1);
});

test('anim: duration divides by speed', () => {
  const m = parseAnimClip(clip({ _duration: 2, speed: 2 }));
  assert.equal(m.duration, 1); // 2 / 2
  assert.equal(m.rawDuration, 2);
});

test('anim: bad JSON / non-clip → null (no throw)', () => {
  assert.equal(parseAnimClip('not json'), null);
  assert.equal(parseAnimClip(JSON.stringify([{ __type__: 'cc.Node' }])), null);
});
