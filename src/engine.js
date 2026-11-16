/* Sample Hunter engine · Epsilon Sounds
   Pure functions (no DOM, no Web Audio) so they can be tested anywhere:
   onset detection, chop features, role assignment, pockets and patterns, WAV / MIDI / ZIP writers. */
(function (root) {
'use strict';
const H = {};

// ---------------------------------------------------------------- small FFT (radix-2, in place)
const fftCache = new Map();
function fftPlan(n) {
  if (fftCache.has(n)) return fftCache.get(n);
  const cos = new Float32Array(n / 2), sin = new Float32Array(n / 2), rev = new Uint32Array(n);
  for (let k = 0; k < n / 2; k++) { cos[k] = Math.cos(-2 * Math.PI * k / n); sin[k] = Math.sin(-2 * Math.PI * k / n); }
  for (let i = 0, j = 0; i < n; i++) { rev[i] = j; let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; }
  const p = { cos, sin, rev }; fftCache.set(n, p); return p;
}
function fft(re, im) {
  const n = re.length, { cos, sin, rev } = fftPlan(n);
  for (let i = 0; i < n; i++) { const j = rev[i]; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1, step = n / len;
    for (let i = 0; i < n; i += len)
      for (let k = 0; k < half; k++) {
        const c = cos[k * step], s = sin[k * step], a = i + k, b = a + half;
        const tr = re[b] * c - im[b] * s, ti = re[b] * s + im[b] * c;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
  }
}
H.fft = fft;

// ---------------------------------------------------------------- prepare: trim silence, normalise, cap length
H.MAX_SECONDS = 30;
H.prepare = function (x, sr) {
  let peak = 0; for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > peak) peak = v; }
  if (!(peak > 1e-4)) return null;                                  // silence (or NaN)
  const th = peak * 0.02;
  let a = 0, b = x.length - 1;
  while (a < b && Math.abs(x[a]) < th) a++;
  while (b > a && Math.abs(x[b]) < th) b--;
  a = Math.max(0, a - Math.round(0.005 * sr));
  b = Math.min(x.length, b + Math.round(0.05 * sr), a + Math.round(H.MAX_SECONDS * sr));
  const out = new Float32Array(b - a), g = 0.9 / peak;
  for (let i = 0; i < out.length; i++) { const v = x[a + i] * g; out[i] = Number.isFinite(v) ? v : 0; }
  return out;
};

// ---------------------------------------------------------------- onsets: log-energy + high-frequency flux, adaptive threshold
H.onsets = function (x, sr, sensitivity = 0.5) {
  const hop = 256, frame = 512, n = Math.max(0, Math.floor((x.length - frame) / hop) + 1);
  const le = new Float32Array(n), lh = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let e = 0, h = 0; const o = f * hop;
    for (let i = 1; i < frame; i++) { const v = x[o + i], d = v - x[o + i - 1]; e += v * v; h += d * d; }
    le[f] = Math.log10(e / frame + 1e-9); lh[f] = Math.log10(h / frame + 1e-9);
  }
  const nov = new Float32Array(n);
  for (let f = 1; f < n; f++) nov[f] = Math.max(0, le[f] - le[f - 1]) + 0.6 * Math.max(0, lh[f] - lh[f - 1]);
  const delta = 0.55 - 0.4 * Math.min(1, Math.max(0, sensitivity)), W = 10, gap = Math.round(0.07 * sr / hop);
  const out = [0];
  let last = -1e9;
  const tmp = [];
  for (let f = 2; f < n - 1; f++) {
    if (nov[f] < nov[f - 1] || nov[f] < nov[f + 1]) continue;
    tmp.length = 0; for (let k = Math.max(0, f - W); k <= Math.min(n - 1, f + W); k++) tmp.push(nov[k]);
    tmp.sort((p, q) => p - q);
    const med = tmp[tmp.length >> 1];
    if (nov[f] < med + delta) continue;
    if (le[f] < -4.2) continue;                                       // too quiet to be a hit
    if (f - last < gap) continue;
    // walk back to where the attack starts (the frame just before the rise)
    let at = f * hop;
    const pk = Math.abs(x[Math.min(x.length - 1, at + hop)]) + 1e-9;
    let s = at + hop; for (let i = at + hop; i > Math.max(0, at - frame); i--) { if (Math.abs(x[i]) < pk * 0.08) { s = i; break; } s = i; }
    at = Math.max(0, s - Math.round(0.002 * sr));
    if (at - out[out.length - 1] > 0.04 * sr) { out.push(at); last = f; }
  }
  return out;
};

// ---------------------------------------------------------------- chops and their features
function features(x, sr) {
  const N = 2048, re = new Float32Array(N), im = new Float32Array(N);
  for (let i = 0; i < N && i < x.length; i++) re[i] = x[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
  fft(re, im);
  let tot = 0, low = 0, cen = 0, logS = 0, cnt = 0;
  for (let k = 1; k < N / 2; k++) {
    const m = Math.hypot(re[k], im[k]) + 1e-9, hz = k * sr / N, p = m * m;
    tot += p; cen += hz * p; if (hz < 150) low += p;
    if (hz > 150 && hz < 10000) { logS += Math.log(m); cnt++; }
  }
  let arith = 0; for (let k = 1; k < N / 2; k++) { const hz = k * sr / N; if (hz > 150 && hz < 10000) arith += Math.hypot(re[k], im[k]) + 1e-9; }
  const flat = cnt ? Math.exp(logS / cnt) / (arith / cnt) : 1;
  // decay: time to fall 20 dB under the peak (5 ms envelope)
  let pk = 0, pkAt = 0; for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > pk) { pk = v; pkAt = i; } }
  const w = Math.max(16, Math.round(0.005 * sr)); let decay = x.length / sr;
  for (let i = pkAt; i + w < x.length; i += w) { let m = 0; for (let j = i; j < i + w; j++) m = Math.max(m, Math.abs(x[j])); if (m < pk * 0.1) { decay = (i - pkAt) / sr; break; } }
  // pitch: normalised autocorrelation after the attack, 50 - 1000 Hz
  const a0 = Math.min(x.length - 1, pkAt + Math.round(0.02 * sr)), L = Math.min(2048, x.length - a0);
  let pitch = 0, clarity = 0;
  if (L > 600) {
    const minLag = Math.floor(sr / 1000), maxLag = Math.min(Math.floor(sr / 50), L >> 1);
    let r0 = 0; for (let i = 0; i < L - maxLag; i++) r0 += x[a0 + i] * x[a0 + i];
    const corr = new Float32Array(maxLag + 2);
    let best = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let r = 0, e = 0; for (let i = 0; i < L - maxLag; i++) { r += x[a0 + i] * x[a0 + i + lag]; e += x[a0 + i + lag] * x[a0 + i + lag]; }
      corr[lag] = r / Math.sqrt(r0 * e + 1e-12);
      if (corr[lag] > best) best = corr[lag];
    }
    // the period is the SHORTEST lag that correlates almost as well as the best one
    // (2x, 3x the period correlate just as well and would read an octave or more too low)
    for (let lag = minLag + 1; lag < maxLag; lag++)
      if (corr[lag] >= 0.9 * best && corr[lag] >= corr[lag - 1] && corr[lag] >= corr[lag + 1]) {
        const a = corr[lag - 1], b = corr[lag], c = corr[lag + 1], den = a - 2 * b + c;
        const frac = Math.abs(den) > 1e-9 ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / den)) : 0;
        pitch = sr / (lag + frac); clarity = b; break;
      }
  }
  return { centroid: tot ? cen / tot : 0, lowRatio: tot ? low / tot : 0, flatness: flat, decay, peak: pk, pitch, clarity, dur: x.length / sr };
}
H.features = features;

H.chops = function (x, sr, sensitivity = 0.5) {
  const on = H.onsets(x, sr, sensitivity);
  const out = [];
  const maxLen = Math.round(1.6 * sr), minLen = Math.round(0.03 * sr);
  let gpk = 0; for (let i = 0; i < x.length; i++) gpk = Math.max(gpk, Math.abs(x[i]));
  for (let k = 0; k < on.length; k++) {
    const a = on[k];
    let b = Math.min(k + 1 < on.length ? on[k + 1] : x.length, a + maxLen);
    // drop the quiet end
    let pk = 0; for (let i = a; i < b; i++) pk = Math.max(pk, Math.abs(x[i]));
    if (pk < 0.06 * gpk) continue;
    const w = Math.round(0.01 * sr);
    while (b - a > minLen + w) { let m = 0; for (let i = b - w; i < b; i++) m = Math.max(m, Math.abs(x[i])); if (m > pk * 0.006) break; b -= w; }
    if (b - a < minLen) continue;
    out.push({ start: a, end: b });
  }
  // a long sustained sound with few hits: cut grains so there is always something to build a kit from
  if (out.length < 4 && x.length > 0.6 * sr) {
    const g = Math.round(Math.min(0.35, x.length / sr / 8) * sr);
    for (let a = 0; a + g <= x.length && out.length < 10; a += g) if (!out.some(c => Math.abs(c.start - a) < g / 2)) out.push({ start: a, end: a + g, grain: true });
    out.sort((p, q) => p.start - q.start);
  }
  for (const c of out) c.f = features(x.subarray(c.start, c.end), sr);
  return out;
};

// ---------------------------------------------------------------- roles: which chop becomes what
H.ROLES = ['kick', 'snare', 'hat', 'perc', 'bass', 'keys', 'atmos'];
// the order roles choose their chop: the 808 is synthesised (its chop is only the click), so it chooses last
const PICK_ORDER = ['kick', 'snare', 'hat', 'perc', 'keys', 'atmos', 'bass'];
H.ROLE_NAMES = { kick: 'Kick', snare: 'Snare', hat: 'Hat', perc: 'Perc', bass: '808', keys: 'Keys', atmos: 'Atmos' };
function roleScore(role, f) {
  const c = Math.min(1, f.centroid / 8000), short = Math.max(0, 1 - f.decay / 0.4);
  switch (role) {
    case 'kick':  return f.lowRatio * 2.5 + (1 - c) * 1.2 + short * 0.4 + f.peak * 0.3;
    case 'snare': return f.flatness * 1.6 + (1 - Math.abs(f.centroid - 2200) / 2200) * 0.9 + short * 0.3;
    case 'hat':   return c * 2.2 + f.flatness * 0.8 + short * 0.8 - f.lowRatio;
    case 'perc':  return short * 1.0 + (1 - Math.abs(f.centroid - 1200) / 1200) * 0.6 + f.clarity * 0.3;
    case 'bass':  return short * 1.0 + f.flatness * 0.5 + c * 0.4;          // a sharp click to sit on the sub
    case 'keys':  return f.clarity * 2.2 + Math.min(f.dur, 1.2) * 0.6 - f.flatness * 0.6;
    case 'atmos': return Math.min(f.dur, 1.6) * 1.2 + (1 - short) * 0.6;
  }
  return 0;
}
/** For every role, chop indices from best to worst. The first pick prefers chops not used by an earlier role. */
H.assignRoles = function (chops) {
  const res = {}, used = new Set();
  for (const role of PICK_ORDER) {
    const order = chops.map((c, i) => [roleScore(role, c.f), i]).sort((a, b) => b[0] - a[0]).map(p => p[1]);
    const fresh = role === 'bass' ? order[0] : order.find(i => !used.has(i));
    const pick = fresh !== undefined ? fresh : order[0];
    if (pick !== undefined) used.add(pick);
    res[role] = { order, pick: order.indexOf(pick) };
  }
  return res;
};

/** The key of the hunt: the pitch class of the most clearly pitched, longest sound (low thumps excluded). 5 (F) if none. */
H.findKey = function (chops) {
  let best = null, bestW = 0;
  for (const c of chops) {
    const f = c.f;
    if (f.clarity < 0.6 || f.pitch < 80 || f.pitch > 2000 || f.flatness > 0.4) continue;
    const w = f.clarity * Math.min(1.5, f.dur);
    if (w > bestW) { bestW = w; best = f.pitch; }
  }
  return best ? ((Math.round(H.hzToMidi(best)) % 12) + 12) % 12 : 5;
};

// ---------------------------------------------------------------- notes
H.midiToHz = m => 440 * Math.pow(2, (m - 69) / 12);
H.hzToMidi = hz => 69 + 12 * Math.log2(hz / 440);
const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
H.noteName = m => NOTE[((Math.round(m) % 12) + 12) % 12] + (Math.floor(Math.round(m) / 12) - 1);
H.keyName = pc => NOTE[((pc % 12) + 12) % 12];

// ---------------------------------------------------------------- pockets (microtiming from Epsilon Bounce)
// offset = fraction of a 16th (+ later), swing = extra delay on off-16ths
H.POCKETS = {
  trap:    { name: 'Trap',     bpm: 140, swing: 0.04, offset: { 0: -0.02, 4: -0.02, 8: -0.02, 12: -0.02 } },
  drill:   { name: 'Drill',    bpm: 142, swing: 0.24, offset: { 8: 0.04, 7: -0.04, 15: -0.04 } },
  dembow:  { name: 'Dembow',   bpm: 98,  swing: 0.10, offset: { 3: 0.10, 11: 0.10, 6: -0.05, 14: -0.05 } },
  boombap: { name: 'Boom Bap', bpm: 90,  swing: 0.16, offset: { 4: 0.07, 12: 0.07 } },
  afro:    { name: 'Afro',     bpm: 106, swing: 0.16, offset: { 3: 0.06, 11: 0.06, 6: -0.04, 14: -0.04 } },
  jersey:  { name: 'Jersey',   bpm: 140, swing: 0.03, offset: { 4: -0.04, 10: -0.04, 12: -0.04 } },
};
H.POCKET_IDS = Object.keys(H.POCKETS);

/** Where step s (0..15) of a bar lands, in 16ths, with the pocket at `amount` and extra swing (0..1). */
H.stepTime = function (pocketId, s, amount = 1, swing = 0) {
  const p = H.POCKETS[pocketId] || H.POCKETS.trap;
  const odd = (s & 1) === 1;
  return s + ((p.offset[s] || 0) + (odd ? p.swing : 0)) * amount + (odd ? swing / 3 : 0);
};

// seeded random
H.rng = function (seed) { let a = seed >>> 0 || 1; return () => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; }; };

/** A one-bar pattern for a pocket. tracks: kick, snare, hat, perc = 0/1 velocity per step (hat may be 2 = roll);
    bass and keys = semitone offsets from the key root (null = rest). */
H.generate = function (pocketId, seed) {
  const r = H.rng(seed), P = Array.from({ length: 16 }), z = () => P.map(() => 0), nn = () => P.map(() => null);
  const t = { kick: z(), snare: z(), hat: z(), perc: z(), bass: nn(), keys: nn(), atmos: z() };
  const on = (k, steps, v = 1) => steps.forEach(s => t[k][s] = v);
  const maybe = (k, steps, p, v = 1) => steps.forEach(s => { if (r() < p) t[k][s] = v; });
  switch (pocketId) {
    case 'drill':
      on('kick', [0]); maybe('kick', [5, 6, 10, 11, 14], 0.35);
      on('snare', [8]); maybe('snare', [13, 15], 0.4, 0.6);
      on('hat', [0, 3, 6, 8, 11, 14]); maybe('hat', [5, 13], 0.5, 0.7);
      maybe('perc', [2, 7, 10, 15], 0.4, 0.7); break;
    case 'dembow':
      on('kick', [0, 4, 8, 12]); on('snare', [3, 6, 11, 14]); on('hat', [2, 6, 10, 14], 0.7);
      maybe('perc', [1, 5, 9, 13, 15], 0.35, 0.6); break;
    case 'boombap':
      on('kick', [0, 10]); maybe('kick', [7, 3, 13], 0.45); on('snare', [4, 12]); maybe('snare', [15, 9], 0.25, 0.5);
      on('hat', [0, 2, 4, 6, 8, 10, 12, 14], 0.8); maybe('hat', [5, 13], 0.3, 0.5);
      maybe('perc', [3, 11, 14], 0.3, 0.7); break;
    case 'afro':
      on('kick', [0, 8]); maybe('kick', [6, 11, 14], 0.5); on('snare', [4, 12], 0.8);
      on('perc', [3, 6, 10]); maybe('perc', [11, 14, 15], 0.5, 0.7);
      for (let s = 0; s < 16; s++) t.hat[s] = s % 2 ? 0.55 : 0.85; break;
    case 'jersey':
      on('kick', [0, 4, 8, 10, 12]); maybe('kick', [14, 15], 0.4); on('snare', [4, 12]);
      maybe('hat', [2, 6, 10, 14], 0.7, 0.7); maybe('perc', [3, 7, 11, 15], 0.4, 0.7); break;
    default: // trap
      on('kick', [0]); maybe('kick', [6, 7, 10, 11, 14], 0.4); if (!t.kick.slice(1).some(Boolean)) t.kick[10] = 1;
      on('snare', [8]); maybe('snare', [15], 0.25, 0.5);
      for (let s = 0; s < 16; s++) t.hat[s] = s % 2 ? 0.6 : 0.9;
      [6, 7, 14, 15].forEach(s => { if (r() < 0.35) t.hat[s] = 2; });   // rolls
      maybe('perc', [3, 11, 13], 0.35, 0.7);
  }
  // 808 on the kicks: root, sometimes the 5th / octave before the snare; keys: a minor-scale motif
  const minor = [0, 2, 3, 5, 7, 8, 10];
  for (let s = 0; s < 16; s++) if (t.kick[s]) t.bass[s] = r() < 0.2 ? 7 : r() < 0.15 ? -5 : 0;
  if (r() < 0.5) t.bass[7] = t.bass[7] ?? 12;
  const motif = [0, 3, 7, 10, 7, 5, 3, 2].map(i => i);
  const starts = pocketId === 'dembow' || pocketId === 'jersey' ? [0, 3, 6, 10, 12] : [0, 3, 6, 8, 11, 14];
  let deg = 0;
  for (const s of starts) { if (r() < 0.8) { const d = motif[(deg++ + Math.floor(r() * 3)) % motif.length]; t.keys[s] = minor.includes(d % 12) ? d : 0; } }
  t.atmos[0] = 1;
  return t;
};

// ---------------------------------------------------------------- WAV (24-bit PCM), MIDI, ZIP (stored)
H.wav = function (channels, sr) {
  const nCh = channels.length, n = channels[0].length, bps = 3, data = n * nCh * bps;
  const buf = new ArrayBuffer(44 + data), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + data, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, nCh, true); v.setUint32(24, sr, true); v.setUint32(28, sr * nCh * bps, true);
  v.setUint16(32, nCh * bps, true); v.setUint16(34, 24, true); str(36, 'data'); v.setUint32(40, data, true);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < nCh; c++) {
    let s = channels[c][i]; s = Number.isFinite(s) ? Math.max(-1, Math.min(1, s)) : 0;
    const q = Math.round(s * 8388607); v.setUint8(o, q & 255); v.setUint8(o + 1, (q >> 8) & 255); v.setUint8(o + 2, (q >> 16) & 255); o += 3;
  }
  return new Uint8Array(buf);
};

/** Type-1 MIDI: tempo track + drums (ch 10, GM notes) + 808 (ch 2) + keys (ch 1). steps: one bar, repeated `bars` times. */
H.midi = function (pattern, bpm, rootMidi, bars = 4) {
  const ppq = 96, sixteenth = ppq / 4;
  const vlq = n => { const b = [n & 0x7f]; while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80); return b; };
  const track = events => {
    events.sort((a, b) => a.t - b.t || a.off - b.off);
    const out = []; let last = 0;
    for (const e of events) { out.push(...vlq(e.t - last), ...e.bytes); last = e.t; }
    out.push(0, 0xff, 0x2f, 0);
    return [0x4d, 0x54, 0x72, 0x6b, (out.length >>> 24) & 255, (out.length >>> 16) & 255, (out.length >>> 8) & 255, out.length & 255, ...out];
  };
  const tempo = Math.round(60000000 / bpm);
  const t0 = [{ t: 0, off: 0, bytes: [0xff, 0x51, 0x03, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255] }, { t: 0, off: 0, bytes: [0xff, 0x58, 4, 4, 2, 24, 8] }];
  const note = (ev, ch, n, vel, t, len) => { ev.push({ t, off: 1, bytes: [0x90 | ch, n & 127, vel] }, { t: t + len, off: 0, bytes: [0x80 | ch, n & 127, 0] }); };
  const drums = [], bass = [], keys = [];
  const gm = { kick: 36, snare: 38, hat: 42, perc: 39 };
  for (let b = 0; b < bars; b++) for (let s = 0; s < 16; s++) {
    const t = (b * 16 + s) * sixteenth;
    for (const k of Object.keys(gm)) { const v = pattern[k][s]; if (v) note(drums, 9, gm[k], Math.min(127, Math.round((v === 2 ? 0.8 : v) * 110)), t, sixteenth / 2); }
    if (pattern.bass[s] !== null && pattern.bass[s] !== undefined) note(bass, 1, 36 + (((rootMidi % 12) + 12) % 12) + pattern.bass[s], 110, t, sixteenth * 2);
    if (pattern.keys[s] !== null && pattern.keys[s] !== undefined) note(keys, 0, 60 + (((rootMidi % 12) + 12) % 12) + pattern.keys[s], 96, t, sixteenth * 2);
  }
  const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 4, (ppq >> 8) & 255, ppq & 255];
  return new Uint8Array([...header, ...track(t0), ...track(drums), ...track(bass), ...track(keys)]);
};

const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
H.crc32 = function (u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = crcTable[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
/** ZIP with stored (uncompressed) entries: files = [{name, data: Uint8Array}] -> Uint8Array */
H.zip = function (files) {
  const enc = new TextEncoder(), parts = [], central = [];
  let offset = 0;
  const u16 = n => [n & 255, (n >> 8) & 255], u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  for (const f of files) {
    const name = enc.encode(f.name), crc = H.crc32(f.data), size = f.data.length;
    const local = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0)]);
    parts.push(local, name, f.data);
    central.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), name);
    offset += local.length + name.length + size;
  }
  const cdSize = central.reduce((a, p) => a + p.length, 0);
  const end = new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), 0, 0]);
  const all = [...parts, ...central, end], total = all.reduce((a, p) => a + p.length, 0), out = new Uint8Array(total);
  let o = 0; for (const p of all) { out.set(p, o); o += p.length; }
  return out;
};

root.Hunter = H;
})(typeof window !== 'undefined' ? window : globalThis);
