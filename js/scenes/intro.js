/**
 * scenes/intro.js — Cinematic Cherry Blossom Tree & Birthday Reveal
 *
 * Sequence:
 *   1. Beating 3D heart in center ("tap to begin ✨").
 *   2. On click/tap, heart falls smoothly toward the ground with smooth easing.
 *   3. Impact point creates a shockwave ring & golden spark burst.
 *   4. From that exact impact point, trunk visibly grows progressively from the ground.
 *   5. Main branches grow organically one by one.
 *   6. Smaller branches progressively grow from the main branches.
 *   7. Hundreds of 3D heart blossom particles pop & bloom progressively across the canopy.
 *   8. Blossoms spring in with bouncy scale (easeOutBack) and rising motion.
 *   9. Continuous floating & falling petals drift in the wind and accumulate on the ground.
 *  10. Soft bokeh, radiant god rays, sparkles (twinkles), and warm dawn glow.
 *  11. Tree breathes and sways gently in the breeze.
 *  12. Camera / scene composition smoothly pans the tree to the right for the final layout.
 *  13. Glassmorphism card fades/slides in word-by-word only AFTER the tree is ready.
 *  14. "Next Surprise 🎈" button enters with smooth bounce animation.
 *  15. All canvas tree, branch recursion, heart polynomial, blossom sprites, and petal mechanics
 *      are powered by the engine from Tree_Original_Source.
 */

import gsap           from 'gsap';
import { navigateTo } from '../app.js';
import { Companion }  from '../companion.js';
import { sleep }      from '../utils/dom.js';

const BIRTHDAY_NAME = 'Kunnu';

// ─── Module State ──────────────────────────────────────────────────────────
let _container   = null;
let _root        = null;
let _isDestroyed = false;
let _hasStarted  = false;

let canvas, ctx;
let treeStage, heartStage, targetHeartWrap, targetHeart, heartGlow, tapHint, impactRing;
let introCard, cardTitle, cardSub, btnNext, replay;

const reduceMotion = false; // Always run the complete cinematic animated sequence as requested

// ─── MATH HELPERS (from Tree_Original_Source) ──────────────────────────────
const rand  = (a, b) => a + Math.random() * (b - a);
const pick  = (a)    => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp  = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack  = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// ─── TREE ENGINE (Canvas 2D from Tree_Original_Source) ─────────────────────
const BLOSSOM = [
  { c0: '#ffe1ec', c1: '#ff80aa' }, // soft pink
  { c0: '#ffd0e0', c1: '#f4577f' }, // blush rose
  { c0: '#ffc4d2', c1: '#e23b67' }, // deep rose
  { c0: '#ffd9c4', c1: '#ff8a5b' }, // warm apricot
  { c0: '#ffeec2', c1: '#f6b13e' }, // golden yellow
  { c0: '#ffd2e6', c1: '#e84d9a' }, // vivid magenta pink
  { c0: '#ffccd5', c1: '#c9184a' }, // rich red
];

/* Cinematic timing (seconds relative to treeStart) */
const T = {
  trunkStart: 0.10, // trunk starts immediately after impact
  branchSpan: 2.10, // branches finish extending by 2.1s
  bloomT0:    1.20, // blossom hearts start popping at 1.2s
  bloomSpan:  2.40, // blossoms continue popping progressively
  petalT0:    2.40, // falling petals begin at 2.4s
  done:       4.60, // tree is fully formed; camera pan begins
};

const SS = 168;

function heartShape(c, x, top, w, h) {
  c.beginPath();
  c.moveTo(x, top + h * 0.28);
  c.bezierCurveTo(x, top, x - w * 0.5, top, x - w * 0.5, top + h * 0.28);
  c.bezierCurveTo(x - w * 0.5, top + h * 0.60, x - w * 0.16, top + h * 0.80, x, top + h);
  c.bezierCurveTo(x + w * 0.16, top + h * 0.80, x + w * 0.5, top + h * 0.60, x + w * 0.5, top + h * 0.28);
  c.bezierCurveTo(x + w * 0.5, top, x, top, x, top + h * 0.28);
  c.closePath();
}

function makeBlossom({ c0, c1 }, soft) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = SS;
  const c = cv.getContext('2d');
  const w = SS * 0.62, h = SS * 0.58, x = SS / 2, top = SS * 0.17;

  c.save();
  c.shadowColor = 'rgba(150,38,72,0.32)';
  c.shadowBlur = SS * 0.085;
  c.shadowOffsetY = SS * 0.05;
  c.fillStyle = c1;
  heartShape(c, x, top, w, h);
  c.fill();
  c.restore();

  const g = c.createRadialGradient(x - w * 0.20, top + h * 0.20, h * 0.04, x, top + h * 0.42, h * 0.92);
  g.addColorStop(0, c0);
  g.addColorStop(0.55, c1);
  g.addColorStop(1, shade(c1, -26));
  heartShape(c, x, top, w, h);
  c.fillStyle = g;
  c.fill();

  c.save();
  heartShape(c, x, top, w, h);
  c.clip();
  const g2 = c.createLinearGradient(0, top, 0, top + h);
  g2.addColorStop(0, 'rgba(255,255,255,0)');
  g2.addColorStop(0.65, 'rgba(110,16,46,0)');
  g2.addColorStop(1, 'rgba(110,16,46,0.26)');
  c.fillStyle = g2;
  c.fillRect(0, 0, SS, SS);
  c.globalAlpha = 0.55;
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.ellipse(x - w * 0.15, top + h * 0.24, w * 0.17, h * 0.11, -0.5, 0, Math.PI * 2);
  c.fill();
  c.restore();

  if (!soft) return cv;

  const cv2 = document.createElement('canvas');
  cv2.width = cv2.height = SS;
  const c2 = cv2.getContext('2d');
  c2.filter = 'blur(2.6px)';
  c2.drawImage(cv, 0, 0);
  c2.filter = 'none';
  c2.globalCompositeOperation = 'source-atop';
  c2.globalAlpha = 0.42;
  c2.fillStyle = '#fff3ea';
  c2.fillRect(0, 0, SS, SS);
  return cv2;
}

function makeBokeh(rgb) {
  const S = 128, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, `rgba(${rgb},0.9)`);
  g.addColorStop(0.45, `rgba(${rgb},0.22)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = g;
  c.fillRect(0, 0, S, S);
  return cv;
}

function makeSparkle() {
  const S = 64, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const c = cv.getContext('2d');
  const m = S / 2;
  const g = c.createRadialGradient(m, m, 0, m, m, m);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.25, 'rgba(255,236,200,0.5)');
  g.addColorStop(1, 'rgba(255,236,200,0)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(m, m, m, 0, 6.2832);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.95)';
  c.translate(m, m);
  for (let k = 0; k < 2; k++) {
    c.beginPath();
    c.moveTo(0, -m);
    c.quadraticCurveTo(0, 0, m, 0);
    c.quadraticCurveTo(0, 0, 0, m);
    c.quadraticCurveTo(0, 0, -m, 0);
    c.quadraticCurveTo(0, 0, 0, -m);
    c.fill();
    c.rotate(Math.PI / 4);
    c.scale(0.5, 0.5);
  }
  return cv;
}

let SPR = { crisp: [], soft: [] }, BOKEH = [], SPARKLE = null;
function buildSprites() {
  SPR = {
    crisp: BLOSSOM.map((b) => makeBlossom(b, false)),
    soft:  BLOSSOM.map((b) => makeBlossom(b, true)),
  };
  BOKEH = [makeBokeh('255,224,188'), makeBokeh('255,196,214'), makeBokeh('255,238,210')];
  SPARKLE = makeSparkle();
}

function drawSprite(sprite, x, y, size, rot, alpha) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, -size * 0.5, -size * 0.47, size, size);
  ctx.restore();
}

let heartPoly = null;
function buildHeartPoly() {
  const raw = [];
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let i = 0; i <= 160; i++) {
    const t = (i / 160) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    raw.push([x, y]);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
  const hw = (maxX - minX) / 2,   hh = (maxY - minY) / 2;
  heartPoly = raw.map(([x, y]) => [(x - midX) / hw, (y - midY) / hh]);
}

function pointInPoly(x, y) {
  let inside = false;
  const p = heartPoly;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

let W = 0, H = 0, dpr = 1;
let cx = 0, cy = 0, rx = 0, ry = 0, groundY = 0;
let branches = [], hearts = [], petals = [], rested = [], orbs = [], floaters = [], twinkles = [];
let bgGrad = null, glowGrad = null, groundGrad = null;

const quad = (b, t) => {
  const m = 1 - t, a = m * m, k = 2 * m * t, d = t * t;
  return { x: a * b.x1 + k * b.cx + d * b.x2, y: a * b.y1 + k * b.cy + d * b.y2 };
};

function barkGrad(x1, y1, x2, y2, depth) {
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  g.addColorStop(0, `hsl(348 26% ${26 + depth * 3}%)`);
  g.addColorStop(1, `hsl(346 24% ${40 + depth * 5}%)`);
  return g;
}

function buildScene() {
  branches = []; hearts = []; petals = []; rested = []; twinkles = []; orbs = []; floaters = [];
  buildHeartPoly();

  const wide = W / H > 1.2;
  cx = W * 0.5; // Always center for initial vertical heart impact
  cy = H * (wide ? 0.38 : 0.40);
  ry = Math.min(H * (wide ? 0.34 : 0.33), W * 0.34);
  rx = ry * 1.16;
  groundY = H * 0.92;

  bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#fff3e9');
  bgGrad.addColorStop(0.46, '#ffe7d6');
  bgGrad.addColorStop(0.78, '#fcd9c4');
  bgGrad.addColorStop(1, '#f3c4b5');

  glowGrad = ctx.createRadialGradient(cx, cy, ry * 0.1, cx, cy, ry * 1.55);
  glowGrad.addColorStop(0, 'rgba(255,219,170,0.6)');
  glowGrad.addColorStop(0.5, 'rgba(255,170,150,0.2)');
  glowGrad.addColorStop(1, 'rgba(255,170,150,0)');

  groundGrad = ctx.createRadialGradient(cx, H * 1.02, ry * 0.2, cx, H * 1.02, ry * 1.6);
  groundGrad.addColorStop(0, 'rgba(255,205,165,0.5)');
  groundGrad.addColorStop(1, 'rgba(255,205,165,0)');

  for (let i = 0; i < 11; i++) {
    orbs.push({
      x: rand(0, W), y: rand(0, H), r: rand(W * 0.05, W * 0.17),
      vy: rand(-6, -16), drift: rand(-0.3, 0.3), phase: rand(0, 6.28),
      alpha: rand(0.05, 0.13), sprite: pick(BOKEH),
    });
  }

  const FN = wide ? 18 : 15;
  for (let i = 0; i < FN; i++) {
    const depth = Math.random();
    floaters.push({
      x: rand(0, W), y: rand(-H * 0.1, H * 1.1), depth,
      idx: (Math.random() * BLOSSOM.length) | 0,
      box: lerp(Math.min(W, H) * 0.025, Math.min(W, H) * 0.075, depth),
      vy: lerp(7, 20, depth), sway: rand(8, 22), phase: rand(0, 6.28),
      rot: rand(-0.4, 0.4), vrot: rand(-0.5, 0.5),
      baseA: lerp(0.16, 0.5, depth), soft: depth < 0.45,
    });
  }

  const baseX = cx, baseY = groundY;
  const trunkTopY = cy + ry * 0.62;
  const trunkW = Math.max(9, W * 0.024);
  const limbLen = ry * 0.6;
  const insidePx = (x, y, m = 0.9) => pointInPoly((x - cx) / (rx * m), (cy - y) / (ry * m));

  function addBranch(x, y, ang, len, w0, depth, t0) {
    let ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len, clipped = false;
    if (!insidePx(ex, ey)) {
      let lo = 0, hi = 1;
      for (let k = 0; k < 12; k++) {
        const mid = (lo + hi) / 2;
        (insidePx(x + Math.cos(ang) * len * mid, y + Math.sin(ang) * len * mid) ? lo = mid : hi = mid);
      }
      ex = x + Math.cos(ang) * len * lo;
      ey = y + Math.sin(ang) * len * lo;
      clipped = true;
    }
    const mx = (x + ex) / 2, my = (y + ey) / 2;
    const perp = ang + Math.PI / 2, bend = rand(-1, 1) * len * 0.12, w1 = w0 * 0.66;
    branches.push({
      x1: x, y1: y, cx: mx + Math.cos(perp) * bend, cy: my + Math.sin(perp) * bend,
      x2: ex, y2: ey, w0, w1, t0, dur: Math.max(0.14, 0.32 - depth * 0.03), depth,
      grad: barkGrad(x, y, ex, ey, depth),
    });
    return { ex, ey, w1, clipped };
  }

  function grow(x, y, ang, len, w, depth, t0) {
    const r = addBranch(x, y, ang, len, w, depth, t0);
    if (r.clipped || depth >= 6 || len < ry * 0.06) return;
    const childT0 = t0 + (0.32 - depth * 0.03) * 0.6;
    const n = Math.random() < 0.55 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const spread = 0.6 * (i - (n - 1) / 2) + rand(-0.22, 0.22);
      const lift = -0.06 + rand(-0.05, 0.05);
      grow(r.ex, r.ey, ang + spread + lift, len * rand(0.74, 0.84), r.w1, depth + 1, childT0 + i * 0.03);
    }
  }

  addBranch(baseX, baseY, -Math.PI / 2, baseY - trunkTopY, trunkW, 0, T.trunkStart);
  branches[0].dur = 0.55;
  const limbT0 = T.trunkStart + 0.36, L = 3;
  for (let i = 0; i < L; i++) {
    const ang = -Math.PI / 2 + 0.62 * (i - (L - 1) / 2) + rand(-0.12, 0.12);
    grow(baseX, trunkTopY, ang, limbLen, trunkW * 0.7, 1, limbT0 + i * 0.05);
  }
  const maxT0 = branches.reduce((m, b) => Math.max(m, b.t0 + b.dur), 0);
  const sc = (T.branchSpan - T.trunkStart) / (maxT0 - T.trunkStart);
  for (const b of branches) b.t0 = T.trunkStart + (b.t0 - T.trunkStart) * sc;

  const COUNT = Math.round(clamp(rx * ry / 54, 280, 460));
  const baseBox = clamp(Math.min(W, H) * 0.115, 30, 74);
  let guard = 0;
  while (hearts.length < COUNT && guard < COUNT * 50) {
    guard++;
    const u = rand(-1.06, 1.06), v = rand(-1.06, 1.06);
    if (!pointInPoly(u, v)) continue;
    const x = cx + u * rx, y = cy - v * ry;
    const d = clamp01(Math.hypot(u, v + 1) / 2.4);
    const t0 = T.bloomT0 + d * (T.bloomSpan * 0.82) + rand(0, T.bloomSpan * 0.18);
    const soft = Math.random() < 0.42;
    hearts.push({
      x, y, idx: (Math.random() * BLOSSOM.length) | 0, soft,
      box: baseBox * (soft ? rand(0.6, 0.85) : rand(0.78, 1.12)),
      rot: rand(-0.55, 0.55), sway: rand(0, 6.28), t0,
    });
  }
  hearts.sort((a, b) => (a.soft === b.soft ? a.y - b.y : a.soft ? -1 : 1));
}

function drawBackground() {
  ctx.globalAlpha = 1;
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1;
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawGodRays(t, intensity) {
  if (intensity <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const ox = cx, oy = cy - ry * 0.35, R = Math.hypot(W, H) * 1.1;
  const rays = 9, sweep = Math.sin(t * 0.07) * 0.18;
  for (let i = 0; i < rays; i++) {
    const a = -Math.PI / 2 + sweep + (i - (rays - 1) / 2) * 0.2;
    const hw = 0.035 + 0.02 * (0.5 + 0.5 * Math.sin(t * 0.5 + i * 1.7));
    const a1 = a - hw, a2 = a + hw;
    const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(a) * R, oy + Math.sin(a) * R);
    g.addColorStop(0, `rgba(255,232,190,${0.10 * intensity})`);
    g.addColorStop(0.5, `rgba(255,214,170,${0.05 * intensity})`);
    g.addColorStop(1, 'rgba(255,214,170,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(a1) * R, oy + Math.sin(a1) * R);
    ctx.lineTo(ox + Math.cos(a2) * R, oy + Math.sin(a2) * R);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawGlow(t) {
  const gi = clamp01((t - T.bloomT0) / (T.bloomSpan * 0.9));
  if (gi <= 0) return;
  ctx.save();
  ctx.globalAlpha = gi;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawBokeh(t, dt) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const o of orbs) {
    o.y += o.vy * dt;
    o.x += Math.sin(t * 0.3 + o.phase) * o.drift;
    if (o.y < -o.r) { o.y = H + o.r; o.x = rand(0, W); }
    ctx.globalAlpha = o.alpha;
    ctx.drawImage(o.sprite, o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
  }
  ctx.restore();
}

function drawFloaters(t, dt, front) {
  const appear = clamp01((t - 0.2) / 1.4);
  if (appear <= 0) return;
  for (const f of floaters) {
    if ((f.depth >= 0.6) !== front) continue;
    f.y -= f.vy * dt;
    f.x += Math.sin(t * 0.5 + f.phase) * f.sway * dt;
    f.rot += f.vrot * dt;
    if (f.y < -f.box) { f.y = H + f.box; f.x = rand(0, W); }
    drawSprite((f.soft ? SPR.soft : SPR.crisp)[f.idx], f.x, f.y, f.box, f.rot, f.baseA * appear);
  }
}

function drawBranches(t) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const wind = Math.sin(t * 1.1) * (Math.min(W, H) * 0.007);
  for (const b of branches) {
    const f = clamp01((t - b.t0) / b.dur);
    if (f <= 0) continue;
    const e = easeOutCubic(f);
    ctx.strokeStyle = b.grad;
    const steps = 12, last = Math.max(1, Math.ceil(steps * e));
    let prev = quad(b, 0);
    for (let i = 1; i <= last; i++) {
      const tt = Math.min(e, i / steps), p = quad(b, tt);
      ctx.lineWidth = lerp(b.w0, b.w1, tt);
      // Subtle wind sway anchored at trunk base
      const wx = wind * Math.pow(clamp01((groundY - p.y) / (groundY - (cy - ry))), 1.5);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x + wx, p.y);
      ctx.stroke();
      prev = { x: p.x + wx, y: p.y };
    }
  }
}

function drawHearts(t) {
  const breathe = 1 + Math.sin(t * 0.8) * 0.012;
  const wind = Math.sin(t * 1.1) * (Math.min(W, H) * 0.007);
  for (const h of hearts) {
    const p = clamp01((t - h.t0) / 0.6);
    if (p <= 0) continue;
    const scale = Math.max(0, easeOutBack(p));
    let alpha = clamp01(p * 1.7);
    if (h.soft) alpha *= 0.8;
    const settled = clamp01((t - h.t0 - 0.6) / 0.7);
    const sway = settled * Math.sin(t * 1.5 + h.sway) * (h.box * 0.05);
    const rise = (1 - easeOutCubic(p)) * h.box * 0.45;
    const wx = wind * Math.pow(clamp01((groundY - h.y) / (groundY - (cy - ry))), 1.5);
    const hx = cx + (h.x - cx) * breathe + sway + wx;
    const hy = cy + (h.y - cy) * breathe - rise;
    drawSprite((h.soft ? SPR.soft : SPR.crisp)[h.idx], hx, hy, h.box * scale, h.rot + sway * 0.012, alpha);
  }
}

function updateTwinkles(t, dt) {
  const active = t > T.bloomT0 + T.bloomSpan * 0.45;
  if (active && twinkles.length < 9 && Math.random() < 0.5) {
    const h = hearts[(Math.random() * hearts.length) | 0];
    if (h) twinkles.push({ x: h.x, y: h.y, size: rand(0.6, 1.3) * (Math.min(W, H) * 0.05), age: 0, life: rand(0.7, 1.2), rot: rand(0, 6.28) });
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = twinkles.length - 1; i >= 0; i--) {
    const s = twinkles[i];
    s.age += dt;
    const k = s.age / s.life;
    if (k >= 1) { twinkles.splice(i, 1); continue; }
    const a = Math.sin(k * Math.PI);
    drawSprite(SPARKLE, s.x, s.y, s.size * (0.6 + 0.4 * a), s.rot + k * 1.2, a);
  }
  ctx.restore();
}

function spawnPetal() {
  const h = hearts[(Math.random() * hearts.length) | 0];
  if (!h) return;
  petals.push({
    x: h.x + rand(-8, 8), y: h.y + rand(-8, 8), vy: rand(14, 30), vx: rand(-8, 8),
    sway: rand(0.6, 1.4), phase: rand(0, 6.28), box: h.box * rand(0.34, 0.6),
    idx: h.idx, rot: rand(0, 6.28), vrot: rand(-1.4, 1.4), age: 0,
    land: groundY + rand(-6, H * 0.05),
  });
}

function drawPetals(t, dt) {
  for (let i = petals.length - 1; i >= 0; i--) {
    const p = petals[i];
    p.age += dt;
    p.vy += 8 * dt;
    p.x += (p.vx + Math.sin(t * p.sway + p.phase) * 16) * dt;
    p.y += p.vy * dt;
    p.rot += p.vrot * dt;
    if (p.y >= p.land) {
      rested.push({ x: clamp(p.x, 6, W - 6), y: p.land, box: p.box, idx: p.idx, rot: p.rot, a: rand(0.7, 0.95) });
      if (rested.length > 90) rested.shift();
      petals.splice(i, 1);
      continue;
    }
    const a = p.age < 0.3 ? p.age / 0.3 : 1;
    drawSprite(SPR.crisp[p.idx], p.x, p.y, p.box, p.rot, a);
  }
}

function drawRested() {
  for (const r of rested) drawSprite(SPR.crisp[r.idx], r.x, r.y, r.box, r.rot, r.a);
}

// ─── Impact Sparks & Mini Hearts ───────────────────────────────────────────
function burstHearts(ox, oy) {
  const cols = ['#ff6f97', '#ffb14e', '#ff8fae', '#ffd36a', '#e23b67', '#d90429'];
  const frag = document.createDocumentFragment();
  const nodes = [];
  for (let i = 0; i < 16; i++) {
    const isHeart = i < 10;
    const el = document.createElement('span');
    el.className = 'burst-particle';
    const s = isHeart ? rand(14, 24) : rand(5, 9);
    el.style.cssText = `position:absolute;left:${ox}px;top:${oy}px;width:${s}px;height:${s}px;margin:${-s / 2}px 0 0 ${-s / 2}px;pointer-events:none;z-index:10;`;
    if (isHeart) {
      el.innerHTML = `<svg viewBox="0 0 24 22" width="100%" height="100%"><path d="M12 20C5.5 15 1.5 11.4 1.5 6.9 1.5 3.6 4 1.5 7 1.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3 0 5.5 2.1 5.5 5.4C23.5 11.4 19.5 15 12 20Z" fill="${pick(cols)}"/></svg>`;
    } else {
      el.style.borderRadius = '50%';
      el.style.background = 'radial-gradient(circle,#fff,rgba(255,210,150,0) 70%)';
    }
    frag.appendChild(el);
    nodes.push({ el, isHeart });
  }
  _root.appendChild(frag);
  nodes.forEach(({ el, isHeart }) => {
    const ang = rand(-Math.PI * 0.95, -Math.PI * 0.05);
    const dist = rand(isHeart ? 60 : 35, isHeart ? 180 : 110);
    gsap.to(el, {
      x: Math.cos(ang) * dist,
      y: Math.sin(ang) * dist - rand(15, 45),
      rotation: rand(-120, 120),
      scale: isHeart ? rand(0.7, 1.2) : rand(0.4, 1),
      duration: rand(0.7, 1.1),
      ease: 'power2.out',
    });
    gsap.to(el, {
      opacity: 0,
      duration: 0.45,
      delay: rand(0.4, 0.65),
      ease: 'power1.in',
      onComplete: () => el.remove(),
    });
  });
}

// ─── Animation Loop (rAF) ──────────────────────────────────────────────────
let treeStartT = 0, treeLastT = 0, treeRAF = 0, lastPetal = 0;
window.bdayDone = false;

function treeFrame(now) {
  if (!treeStartT) { treeStartT = now; treeLastT = now; }
  const t  = (now - treeStartT) / 1000;
  const dt = Math.min(0.05, (now - treeLastT) / 1000);
  treeLastT = now;

  const rays = clamp01((t - T.bloomT0) / T.bloomSpan);

  drawBackground();
  drawGodRays(t, rays);
  drawGlow(t);
  drawBokeh(t, dt);
  drawFloaters(t, dt, false);
  drawBranches(t);
  drawHearts(t);
  updateTwinkles(t, dt);
  if (t > T.petalT0 && now - lastPetal > 160) {
    spawnPetal();
    spawnPetal();
    lastPetal = now;
  }
  drawPetals(t, dt);
  drawRested();
  drawFloaters(t, dt, true);

  // When tree fully matures (~4.6s), smoothly shift composition to make room for card
  if (!window.bdayDone && t >= T.done) {
    window.bdayDone = true;
    _onTreeComplete();
  }

  treeRAF = requestAnimationFrame(treeFrame);
}

function treeStart() {
  treeStartT = 0;
  treeLastT = 0;
  lastPetal = 0;
  window.bdayDone = false;
  buildScene();
  if (!treeRAF) treeRAF = requestAnimationFrame(treeFrame);
}

function treeStop() {
  if (treeRAF) {
    cancelAnimationFrame(treeRAF);
    treeRAF = 0;
  }
  if (ctx && W && H) ctx.clearRect(0, 0, W, H);
}

function drawFinal() {
  buildScene();
  drawBackground();
  drawGodRays(0, 1);
  drawGlow(T.done);
  drawBokeh(0, 0);
  drawFloaters(99, 0, false);
  drawBranches(99);
  drawHearts(99);
  for (let i = 0; i < 40; i++) {
    const h = hearts[(Math.random() * hearts.length) | 0];
    if (h) rested.push({ x: clamp(h.x + rand(-W * 0.3, W * 0.3), 6, W - 6), y: groundY + rand(-6, H * 0.05), box: h.box * 0.5, idx: h.idx, rot: rand(0, 6.28), a: 0.85 });
  }
  drawRested();
  drawFloaters(99, 0, true);
  window.bdayDone = true;
}

// ─── Stage Completion: Camera Shift & Birthday Text Reveal ─────────────────
async function _onTreeComplete() {
  if (_isDestroyed) return;

  const isMobile = window.innerWidth <= 640;

  // 1. Animate camera / scene composition smoothly into final balance
  gsap.to(treeStage, {
    x: isMobile ? 0 : '16vw',
    y: isMobile ? '-14vh' : 0,
    scale: isMobile ? 0.74 : 0.88,
    duration: 1.3,
    ease: 'power3.inOut',
  });

  // 2. Slide in glassmorphism birthday card centered vertically
  if (isMobile) {
    gsap.set(introCard, {
      display: 'flex',
      top: 'auto',
      bottom: '1.5rem',
      left: '1.25rem',
      right: '1.25rem',
      yPercent: 0,
      x: 0,
    });
    gsap.fromTo(introCard,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out' }
    );
  } else {
    gsap.set(introCard, {
      display: 'flex',
      top: '50%',
      bottom: 'auto',
      left: 'clamp(2rem, 5vw, 4.5rem)',
      yPercent: -50,
      y: 0,
    });
    gsap.fromTo(introCard,
      { opacity: 0, x: -40 },
      { opacity: 1, x: 0, duration: 0.85, ease: 'power3.out' }
    );
  }

  await sleep(220);

  // 3. Word-by-word reveal for title
  await _revealWords(cardTitle);
  await sleep(150);

  // 4. Word-by-word reveal for subtitle
  await _revealWords(cardSub);
  await sleep(180);

  // 5. Pop in "Next Surprise 🎈" button with smooth bounce
  gsap.to(btnNext, {
    opacity: 1,
    y: 0,
    scale: 1,
    pointerEvents: 'auto',
    duration: 0.65,
    ease: 'back.out(1.8)',
  });

  // 6. Arm replay button in corner
  if (replay) {
    replay.hidden = false;
    requestAnimationFrame(() => replay.classList.add('is-shown'));
  }
}

function _wrapWords(text) {
  return text.split(' ').map(w => `<span class="word">${w}</span>`).join(' ');
}

async function _revealWords(el) {
  if (!el) return;
  const words = Array.from(el.querySelectorAll('.word'));
  for (const w of words) {
    gsap.to(w, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.45, ease: 'power2.out' });
    await sleep(75);
  }
}

function _gsapTo(target, vars) {
  return new Promise(resolve => gsap.to(target, { ...vars, onComplete: resolve }));
}

// ─── Interaction: Heart Tap Sequence ───────────────────────────────────────
async function _onHeartTap() {
  if (_hasStarted || _isDestroyed) return;
  _hasStarted = true;

  // Kill idle beating loops
  gsap.killTweensOf(targetHeart);
  gsap.killTweensOf(heartGlow);

  // Fade out tap hint
  gsap.to(tapHint, { opacity: 0, duration: 0.3 });

  // Calculate ground impact coordinates
  const rect = targetHeartWrap.getBoundingClientRect();
  const startY = rect.top + rect.height * 0.5;
  const dropDist = groundY - startY;

  // 1. Heart falls smoothly toward the ground with smooth easing
  await _gsapTo(targetHeartWrap, {
    y: dropDist,
    scale: 0.65,
    rotation: 9,
    duration: 0.85,
    ease: 'power2.in',
  });

  // 2. Impact point creates shockwave ring & golden spark burst
  const centerX = window.innerWidth * 0.5;
  impactRing.style.left = centerX + 'px';
  impactRing.style.top  = groundY + 'px';
  gsap.fromTo(impactRing,
    { scale: 0, opacity: 1 },
    { scale: 4.5, opacity: 0, duration: 0.75, ease: 'power2.out' }
  );

  burstHearts(centerX, groundY);

  // 3. Heart impact flash & smooth fadeout of heartStage backdrop
  gsap.to(targetHeartWrap, {
    scale: 1.6,
    opacity: 0,
    duration: 0.22,
    ease: 'power1.out',
  });
  gsap.to(heartStage, {
    opacity: 0,
    duration: 0.55,
    ease: 'power2.out',
    onComplete: () => {
      heartStage.style.display = 'none';
    },
  });

  // 4. Launch tree growth directly from the impact point on the ground
  treeStart();
}

function resetAll() {
  treeStop();
  _hasStarted = false;
  window.bdayDone = false;

  // Reset transforms & visibility
  if (replay) { replay.classList.remove('is-shown'); replay.hidden = true; }
  gsap.set(treeStage, { x: 0, y: 0, scale: 1 });
  gsap.set(introCard, { display: 'none', opacity: 0 });
  gsap.set(btnNext, { opacity: 0, y: 12, scale: 0.95, pointerEvents: 'none' });

  // Reset words in card
  cardTitle.innerHTML = _wrapWords(`Happy Birthday, ${BIRTHDAY_NAME}! ✨`);
  cardSub.innerHTML   = _wrapWords(`Today is a very special day... here's to a year that blooms 🌸`);

  // Restore beating heart
  heartStage.style.display = 'flex';
  gsap.set(heartStage, { opacity: 1 });
  gsap.set(targetHeartWrap, { y: 0, scale: 1, rotation: 0, opacity: 1 });
  gsap.set(tapHint, { opacity: 0.85 });
  _startHeartPulse();
}

function _startHeartPulse() {
  gsap.to(targetHeart, {
    scale: 1.09,
    duration: 0.85,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
  });
  gsap.to(heartGlow, {
    opacity: 0.85,
    scale: 1.25,
    duration: 0.85,
    repeat: -1,
    yoyo: true,
    ease: 'sine.inOut',
  });
}

function resize() {
  if (!canvas) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth || window.innerWidth;
  H = canvas.clientHeight || window.innerHeight;
  canvas.width  = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildSprites();
  buildScene();

  if (window.bdayDone) {
    drawFinal();
  }
}

let resizeRAF = 0;
function onWindowResize() {
  if (resizeRAF) return;
  resizeRAF = requestAnimationFrame(() => {
    resizeRAF = 0;
    resize();
  });
}

function _handleNextPhase() {
  navigateTo(() => import('./balloons.js'), { type: 'dissolve', duration: 1500 });
}

// ─── HTML Template ─────────────────────────────────────────────────────────
function _buildHTML() {
  return `
    <!-- Tree Canvas Stage -->
    <div class="tree-stage" id="treeStage">
      <canvas id="tree" class="tree" aria-label="A blossom tree grows and blooms into a heart made of petals" role="img"></canvas>
    </div>

    <!-- Act 1: Initial Beating Heart Interaction Stage -->
    <div class="intro-heart-stage" id="heartStage">
      <div class="heart-stage__bg" aria-hidden="true"></div>
      <div class="intro-heart-wrap" id="targetHeartWrap" role="button" tabindex="0" aria-label="Tap the heart to begin">
        <span class="heart__glow" id="heartGlow" aria-hidden="true"></span>
        <div class="target__heart" id="targetHeart">
          <svg class="heart__svg" viewBox="0 0 100 92" aria-hidden="true">
            <defs>
              <radialGradient id="hg" cx="38%" cy="30%" r="80%">
                <stop offset="0%"  stop-color="#ffd9e4" />
                <stop offset="42%" stop-color="#ff6f97" />
                <stop offset="82%" stop-color="#d81e57" />
                <stop offset="100%" stop-color="#9d0f3e" />
              </radialGradient>
              <linearGradient id="hsheen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stop-color="rgba(255,255,255,.88)" />
                <stop offset="34%" stop-color="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>
            <path d="M50 86.5C26 68 10.5 53.6 10.5 34.6 10.5 20.4 21 11 33.2 11c8.6 0 14.2 4.7 16.8 11.4C52.6 15.7 58.2 11 66.8 11 79 11 89.5 20.4 89.5 34.6 89.5 53.6 74 68 50 86.5Z" fill="url(#hg)" />
            <path d="M50 86.5C26 68 10.5 53.6 10.5 34.6 10.5 20.4 21 11 33.2 11c8.6 0 14.2 4.7 16.8 11.4C52.6 15.7 58.2 11 66.8 11 79 11 89.5 20.4 89.5 34.6 89.5 53.6 74 68 50 86.5Z" fill="url(#hsheen)" opacity=".7" />
            <ellipse cx="34" cy="30" rx="8.5" ry="5.4" fill="#fff" opacity=".72" style="mix-blend-mode:screen" />
          </svg>
        </div>
      </div>
      <p class="intro-tap-hint" id="tapHint">tap to begin ✨</p>
    </div>

    <!-- Impact Ring -->
    <div class="impact-ring" id="impactRing" aria-hidden="true"></div>

    <!-- Glassmorphism Birthday Card -->
    <div class="intro-card" id="introCard" role="region" aria-label="Birthday message">
      <p class="card-eyebrow">A very special wish</p>
      <h1 class="card-title display" id="cardTitle"></h1>
      <p class="card-subtitle" id="cardSub"></p>
      <button id="btn-next-surprise" class="btn-next-surprise" aria-label="Next surprise">
        Next Surprise 🎈
      </button>
    </div>

    <!-- Replay Button -->
    <button class="replay" id="replay" type="button" hidden aria-label="Play again">
      <svg viewBox="0 0 24 24" aria-hidden="true" width="15" height="15">
        <path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" fill="currentColor" />
      </svg>
      Again
    </button>

    <!-- Cinematic Vignette / Grain Grade -->
    <div class="grade" aria-hidden="true">
      <div class="grade__vignette"></div>
      <div class="grade__grain"></div>
    </div>
  `;
}

// ─── Scene Lifecycle API ───────────────────────────────────────────────────
export async function init(container) {
  _container   = container;
  _isDestroyed = false;
  _hasStarted  = false;

  _root = document.createElement('section');
  _root.className = 'scene scene-intro';
  _root.setAttribute('aria-label', 'Cherry blossom tree intro');
  _root.innerHTML = _buildHTML();

  const $ = (id) => _root.querySelector('#' + id);

  canvas          = $('tree');
  ctx             = canvas.getContext('2d');
  treeStage       = $('treeStage');
  heartStage      = $('heartStage');
  targetHeartWrap = $('targetHeartWrap');
  targetHeart     = $('targetHeart');
  heartGlow       = $('heartGlow');
  tapHint         = $('tapHint');
  impactRing      = $('impactRing');
  introCard       = $('introCard');
  cardTitle       = $('cardTitle');
  cardSub         = $('cardSub');
  btnNext         = $('btn-next-surprise');
  replay          = $('replay');

  // Pre-wrap words for word-by-word reveal
  cardTitle.innerHTML = _wrapWords(`Happy Birthday, ${BIRTHDAY_NAME}! ✨`);
  cardSub.innerHTML   = _wrapWords(`Today is a very special day... here's to a year that blooms 🌸`);

  buildSprites();

  // Wire heart tap
  targetHeartWrap.addEventListener('click', _onHeartTap);
  targetHeartWrap.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      _onHeartTap();
    }
  });

  replay.addEventListener('click', resetAll);
  btnNext.addEventListener('click', _handleNextPhase);

  _container.appendChild(_root);
}

export async function enter() {
  Companion.hide();
  _root.classList.add('is-active');

  resize();
  window.addEventListener('resize', onWindowResize);

  // Canvas starts completely empty — no tree rendered yet!
  ctx.clearRect(0, 0, W, H);
  _startHeartPulse();
}

export async function exit() {
  treeStop();
  window.removeEventListener('resize', onWindowResize);
  gsap.killTweensOf(_root.querySelectorAll('*'));
  _root.classList.remove('is-active');
  await new Promise((r) => {
    gsap.to(_root, { opacity: 0, duration: 0.8, ease: 'power2.in', onComplete: r });
  });
}

export function destroy() {
  treeStop();
  window.removeEventListener('resize', onWindowResize);
  if (resizeRAF) { cancelAnimationFrame(resizeRAF); resizeRAF = 0; }
  _root?.remove();
  _root = null;
  _container = null;
  _isDestroyed = true;
}
