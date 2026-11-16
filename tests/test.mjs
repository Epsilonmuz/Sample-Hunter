// Sample Hunter test bench: headless Chrome at iPhone size.
// Demo hunt, file import, live mic (fake device), kit, beat timing, export ZIP; screenshots.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(dir, '../shots'); fs.mkdirSync(out, { recursive: true });
const html = fs.readFileSync(path.join(dir, '../docs/index.html'));
const server = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html); }).listen(8765);

let fails = 0;
const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) fails++; };

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: [
  '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
  `--use-file-for-fake-audio-capture=${path.join(dir, 'test-knocks.wav')}`] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:8765/');
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(out, '1-hunt.png') });

// --- demo hunt
await page.tap('#demoBtn');
await page.waitForFunction(() => window.__hunter.S.kit.atmos, null, { timeout: 20000 });
const s1 = await page.evaluate(() => { const S = window.__hunter.S; return { chops: S.chops.length, key: S.key, roles: Object.fromEntries(Object.entries(S.kit).map(([r, k]) => [r, { chop: k.chop, root: k.root, dur: k.buf.duration }])) }; });
console.log(JSON.stringify(s1));
check(s1.chops >= 8, 'demo: hunted ' + s1.chops + ' sounds');
check(Object.keys(s1.roles).length === 7, 'demo: all 7 kit voices designed');
check(s1.key === 5, 'demo: key found from the bottle tonk (F = 5): ' + s1.key);
const distinct = new Set(['kick', 'snare', 'hat', 'perc'].map(r => s1.roles[r].chop)).size;
check(distinct >= 3, 'demo: drum voices come from different chops (' + distinct + ' distinct)');
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(out, '2-kit.png'), fullPage: false });
await page.evaluate(() => document.querySelector('main').scrollTop = 500);
await page.screenshot({ path: path.join(out, '2b-kit-cards.png') });

// role sanity: kick should be the low one, hat the bright one
const feats = await page.evaluate(() => { const S = window.__hunter.S; const f = r => S.chops[S.kit[r].chop].f; return { kick: f('kick'), hat: f('hat') }; });
check(feats.kick.lowRatio > feats.hat.lowRatio && feats.hat.centroid > feats.kick.centroid, 'roles: kick is lower and the hat brighter than each other');

// --- beat
await page.tap('nav button[data-v=beat]');
await page.waitForTimeout(300);
await page.tap('#pockets button:nth-child(2)');   // drill
const bpm = await page.evaluate(() => window.__hunter.S.bpm);
check(bpm === 142, 'drill pocket sets 142 BPM');
await page.tap('#play');
await page.waitForTimeout(2200);
await page.screenshot({ path: path.join(out, '3-beat.png') });
const playingOk = await page.evaluate(() => window.__hunter.S.playing && document.querySelectorAll('#playhead i.now').length === 1);
check(playingOk, 'beat plays and the playhead moves');
await page.tap('#play');
await page.evaluate(() => document.querySelector('main').scrollTop = 600);
await page.screenshot({ path: path.join(out, '3b-pads.png') });

// timing: the rendered beat has hits where the pattern says
const timing = await page.evaluate(async () => {
  const H = window.Hunter, S = window.__hunter.S;
  const saved = JSON.parse(JSON.stringify(S.pattern));
  for (const k of ['kick', 'snare', 'hat', 'perc', 'atmos']) S.pattern[k].fill(0); S.pattern.bass.fill(null); S.pattern.keys.fill(null);
  [0, 4, 8, 12].forEach(s => S.pattern.kick[s] = 1);
  const prevPocket = S.pocket; S.pocket = 'trap'; const sw = S.swing; S.swing = 0; const amt = S.amount; S.amount = 1;
  const beat = await window.__hunter.renderBeat(1);
  const d = beat[0], sr = S.sr, step = 60 / S.bpm / 4, on = [];
  let quiet = 1e9; for (let i = 0; i < d.length; i++) { if (Math.abs(d[i]) > 0.05) { if (quiet > 0.08 * sr) on.push(i / sr); quiet = 0; } else quiet++; }
  const want = [0, 4, 8, 12].map(s => H.stepTime('trap', s, 1, 0) * step);
  S.pattern = saved; S.pocket = prevPocket; S.swing = sw; S.amount = amt;
  return { on, want, L: d.length / sr };
});
const worst = Math.max(...timing.want.map((w, i) => Math.abs((timing.on[i] ?? 99) - w))) * 1000;
console.log('on', timing.on.map(v=>(v*1000).toFixed(2)).join(' '), 'want', timing.want.map(v=>(v*1000).toFixed(2)).join(' '));
// a hit the pocket pushes before beat 1 wraps to the end of the loop (and its body shows at 0): match modulo the loop
const loopLen = timing.L;
const wantW = timing.want.map(w => (w + loopLen) % loopLen);
const errs = wantW.map(w => Math.min(...timing.on.map(o => Math.min(Math.abs(o - w), loopLen - Math.abs(o - w)))));
const worstMs = Math.max(...errs) * 1000;
check(worstMs < 1.5, 'export timing: every kick within ' + worstMs.toFixed(2) + ' ms of the pocket grid (compressor look-ahead removed)');

// --- export
await page.tap('nav button[data-v=export]');
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(out, '4-export.png') });
const zipB64 = await page.evaluate(async () => { const r = await window.__hunter.buildZip(); let s = ''; const u = r.zip; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return { b64: btoa(s), name: r.filename }; });
fs.writeFileSync(path.join(out, 'export.zip'), Buffer.from(zipB64.b64, 'base64'));
check(zipB64.name.endsWith('.zip'), 'export: ' + zipB64.name);

// --- file import (a WAV through the file picker)
await page.tap('nav button[data-v=hunt]');
await page.setInputFiles('#fileInput', path.join(dir, 'test-knocks.wav'));
await page.waitForFunction(() => window.__hunter.S.name === 'test-knocks' && window.__hunter.S.kit.atmos && !document.getElementById('busy').classList.contains('show'), null, { timeout: 20000 });
const s2 = await page.evaluate(() => window.__hunter.S.chops.length);
check(s2 >= 6, 'file import: hunted ' + s2 + ' sounds from a WAV');

// --- live mic (fake device plays test-knocks.wav)
await page.waitForTimeout(900);              // the app moves to the Kit view after a hunt
await page.tap('nav button[data-v=hunt]');
await page.tap('#huntBtn');
await page.waitForTimeout(3500);
await page.screenshot({ path: path.join(out, '5-recording.png') });
await page.tap('#huntBtn');
await page.waitForFunction(() => /^Hunt /.test(window.__hunter.S.name) && !document.getElementById('busy').classList.contains('show'), null, { timeout: 20000 }).catch(() => {});
const s3 = await page.evaluate(() => ({ name: window.__hunter.S.name, n: window.__hunter.S.chops.length }));
check(/^Hunt /.test(s3.name) && s3.n >= 3, 'live mic: recorded and hunted ' + s3.n + ' sounds');
await page.tap('nav button[data-v=hunt]');
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(out, '6-hunt-found.png') });

check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close(); server.close();
console.log('\n' + fails + ' failure(s)');
process.exit(fails ? 1 : 0);
