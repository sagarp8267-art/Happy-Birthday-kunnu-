/**
 * scenes/balloons.js — Phase 3: Balloon Celebration + 3 Poppable Balloons
 *
 * Stage A: Many balloons + "Happy Birthday" text float up from the bottom.
 * Stage B: 3 premium interactive 3D-style balloons appear — each poppable,
 *          each revealing a unique personal message. After all 3 are popped,
 *          the next-section button appears.
 *
 * Dependencies: GSAP (Phase 1 import map), Companion, Particles
 */

import gsap           from 'gsap';
import { navigateTo } from '../app.js';
import { Companion }  from '../companion.js';
import { Particles }  from '../utils/particles.js';
import { qs, el, sleep } from '../utils/dom.js';

// ─── Config — easy to change ───────────────────────────────────────────────

/**
 * Personal messages revealed when each premium balloon is popped.
 * Edit text freely. Order matches LEFT → CENTRE → RIGHT balloon.
 */
const BALLOON_MESSAGES = [
  {
    emoji:   '🌸',
    label:   'A little secret…',
    message: 'You make every ordinary day feel like a celebration. 💕',
  },
  {
    emoji:   '✨',
    label:   'You should know…',
    message: 'The world is genuinely brighter because you\'re in it. 🌟',
  },
  {
    emoji:   '🎀',
    label:   'One more thing…',
    message: 'I am endlessly grateful that I get to be part of your story. 🥹',
  },
];

/** Colours for the three premium balloons (left, centre, right) */
const PREMIUM_COLORS = [
  { main: '#e8637a', shine: 'rgba(255,180,190,0.55)' },  // blush
  { main: '#b99bc7', shine: 'rgba(220,190,240,0.55)' },  // violet
  { main: '#f0c96e', shine: 'rgba(255,230,150,0.55)' },  // gold
];

/** How many ambient balloons to float up in Stage A */
const AMBIENT_COUNT = 22;

// ─── Module state ──────────────────────────────────────────────────────────

let _container    = null;
let _root         = null;
let _ambientTimer = null;
let _poppedCount  = 0;
let _isDestroyed  = false;

// ─── Public API ────────────────────────────────────────────────────────────

export async function init(container) {
  _container   = container;
  _isDestroyed = false;
  _poppedCount = 0;

  _root = el('section', {
    cls:   'scene scene-balloons',
    attrs: { 'aria-label': 'Balloon celebration' },
  });

  _root.innerHTML = _buildHTML();
  _injectStyles();

  // Wire premium balloon clicks
  _root.querySelectorAll('.pballoon').forEach((node, i) => {
    node.addEventListener('click', () => _popBalloon(node, i), { once: true });
  });

  // Wire continue button
  qs('#btn-balloon-next', _root).addEventListener('click', _handleNextPhase);

  _container.appendChild(_root);
}

export async function enter() {
  _root.classList.add('is-active');

  const arena   = qs('.balloon-arena',     _root);
  const hbText  = qs('.balloon-hb-text',   _root);
  const stageB  = qs('.balloon-stage-b',   _root);

  Companion.show();
  Companion.react('celebrating', 'Balloons!! 🎉 Pop them all!', 4000);

  // Audio: play sfx-success.mp3 once, keep bgm-main.mp3 playing continuously
  import('../audio.js').then(({ AudioManager }) => {
    AudioManager.playSFX('assets/audio/sfx-success.mp3', 0.75);
    AudioManager.playMusic('assets/audio/bgm-main.mp3', true, 0.5);
  }).catch(() => {});

  // ── Stage A: Opening animation — swarm of balloons float upward from bottom ──
  // Spawn 24 balloons in staggered waves
  for (let i = 0; i < 24; i++) {
    setTimeout(() => _spawnAmbient(arena), i * 110);
  }

  // Particle burst
  Particles.burst({ count: 55, spread: 1.5 });

  // Fade in the balloon GIF decoration
  const gifBalloon = _root.querySelector('.gif-balloon-ambient');
  if (gifBalloon) {
    setTimeout(() => gifBalloon.classList.add('is-visible'), 600);
  }

  await sleep(400);

  // "Happy Birthday 🎂" text reveals and floats upward
  gsap.set(hbText, { opacity: 0, y: 50, scale: 0.9 });
  gsap.to(hbText, { opacity: 1, y: 0, scale: 1, duration: 1.1, ease: 'power3.out' });

  // Spawn continuous ambient balloons while text is shown
  _ambientTimer = setInterval(() => {
    if (!_isDestroyed) _spawnAmbient(arena);
  }, 350);

  // Let the balloons float up across the screen for 4.2 seconds
  await sleep(3800);

  // ── Stage A → B transition: Happy Birthday text fades, balloons finish floating up ──
  clearInterval(_ambientTimer);
  _ambientTimer = null;

  gsap.to(hbText, { opacity: 0, y: -40, duration: 0.8, ease: 'power2.in' });

  await sleep(800);

  // ── Stage B: 3 premium poppable balloons ──
  gsap.set(stageB, { display: 'flex', opacity: 0 });
  gsap.to(stageB, { opacity: 1, duration: 0.6, ease: 'power2.out' });

  // Stagger the three balloons in
  const pballoons = Array.from(_root.querySelectorAll('.pballoon'));
  pballoons.forEach((pb, i) => {
    gsap.fromTo(pb,
      { y: 120, opacity: 0, scale: 0.4 },
      { y: 0, opacity: 1, scale: 1,
        duration: 0.9,
        delay: i * 0.2,
        ease: 'back.out(1.6)',
      }
    );
  });

  // Companion hint
  await sleep(1200);
  Companion.react('surprised', 'Tap each balloon! 🎈', 3500);
}

export async function exit() {
  _cleanupAmbient();
  Particles.stop();
  gsap.killTweensOf('*');
  _root.classList.remove('is-active');
  await new Promise(r =>
    gsap.to(_root, { opacity: 0, duration: 0.55, ease: 'power2.in', onComplete: r })
  );
}

export function destroy() {
  _cleanupAmbient();
  _root?.remove();
  _root = null;
  _container = null;
  _isDestroyed = true;
}

// ─── Pop mechanic ──────────────────────────────────────────────────────────

async function _popBalloon(node, index) {
  if (_isDestroyed) return;

  const cfg = BALLOON_MESSAGES[index];
  const rect = node.getBoundingClientRect();
  const cx   = (rect.left + rect.right)  / 2 / window.innerWidth;
  const cy   = (rect.top  + rect.bottom) / 2 / window.innerHeight;

  // ── Pop animation ─────────────────────────────────────────────────────────
  // Quick inflate then vanish
  await new Promise(r =>
    gsap.to(node.querySelector('.pballoon-body'), {
      scale: 1.25, duration: 0.12, ease: 'power2.out', onComplete: r,
    })
  );

  // Particle burst at balloon position
  Particles.burst({ x: cx, y: cy, count: 45, spread: 1.3 });

  // Play "pop.mp3" once per balloon pop
  import('../audio.js').then(({ AudioManager }) => {
    AudioManager.playSFX('assets/audio/pop.mp3', 0.85);
  }).catch(() => {});

  // Balloon pops out
  await new Promise(r =>
    gsap.to(node, { scale: 0, opacity: 0, duration: 0.2, ease: 'power3.in', onComplete: r })
  );

  node.style.display = 'none';
  node.style.pointerEvents = 'none';

  // ── Reveal message card in this specific column ───────────────────────────
  const col  = _root.querySelector(`.pballoon-col[data-index="${index}"]`);
  const card = col?.querySelector('.pballoon-card');
  if (card) {
    gsap.set(card,  { display: 'flex', scale: 0.65, opacity: 0, y: 15 });
    await new Promise(r =>
      gsap.to(card, { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.8)', onComplete: r })
    );
  }

  _poppedCount++;
  Companion.react('romantic', ['💕', '🥹', '🌟'][index] + ' Beautiful!', 2500);

  // ── All three popped → show CTA ───────────────────────────────────────────
  if (_poppedCount >= BALLOON_MESSAGES.length) {
    await sleep(800);
    const btn = qs('#btn-balloon-next', _root);
    gsap.to(btn, {
      opacity: 1, y: 0, pointerEvents: 'auto',
      duration: 0.7, ease: 'back.out(1.5)',
    });
    Companion.react('celebrating', 'Time to make a wish! 🎂', 4000);
  }
}

// ─── Navigation ────────────────────────────────────────────────────────────

function _handleNextPhase() {
  navigateTo(() => import('./cake.js'), { type: 'dissolve', duration: 1500 });
}

// ─── Ambient balloon spawner ───────────────────────────────────────────────

const AMBIENT_COLORS = [
  'var(--c-blush)', 'var(--c-petal)', 'var(--c-gold)', '#b99bc7', '#ffffff',
];

function _spawnAmbient(container) {
  if (_isDestroyed) return;
  const b = document.createElement('div');
  b.className = 'balloon-ambient';

  const color    = AMBIENT_COLORS[Math.floor(Math.random() * AMBIENT_COLORS.length)];
  const scale    = 0.45 + Math.random() * 0.55;
  const dur      = 3.6 + Math.random() * 1.5;
  const xPos     = Math.random() * 95;
  const rotStart = (Math.random() - 0.5) * 16;
  const rotEnd   = (Math.random() - 0.5) * 32;
  const blur     = scale < 0.7 ? `blur(${(0.7 - scale) * 4}px)` : 'none';

  b.style.cssText = `
    position:absolute; bottom:-140px;
    left:${xPos}%; width:66px; height:95px;
    color:${color};
    z-index:${Math.floor(scale * 8)};
    filter:drop-shadow(0 10px 10px rgba(0,0,0,0.25));
    --s:${scale}; --rot-start:${rotStart}deg; --rot-end:${rotEnd}deg;
    animation: balloonFloat ${dur}s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
  `;
  b.innerHTML = `
    <svg viewBox="0 0 100 140" fill="none" style="width:100%;height:100%;filter:${blur}">
      <path d="M 50 5 C 80 5,95 30,95 65 C 95 100,65 108,50 108 C 35 108,5 100,5 65 C 5 30,20 5,50 5 Z"
            fill="currentColor"/>
      <path d="M 35 15 C 20 25,15 45,18 60 C 20 50,28 30,45 20 Z" fill="rgba(255,255,255,0.38)"/>
      <path d="M 50 108 Q 55 120,50 135" stroke="rgba(255,255,255,0.28)" stroke-width="1.5" fill="none"/>
    </svg>
  `;

  container.appendChild(b);
  b.addEventListener('animationend', () => b.remove(), { once: true });
}

function _cleanupAmbient() {
  if (_ambientTimer) { clearInterval(_ambientTimer); _ambientTimer = null; }
  Particles.stop();
  gsap.killTweensOf('*');
}

// ─── HTML builder ──────────────────────────────────────────────────────────

function _buildHTML() {
  const balloons = PREMIUM_COLORS.map((col, i) => {
    const cfg = BALLOON_MESSAGES[i];
    const sideClass = i === 0 ? 'pballoon-col--left' : (i === 1 ? 'pballoon-col--center' : 'pballoon-col--right');
    return `
    <!-- Balloon column ${i} (${cfg.label}) -->
    <div class="pballoon-col ${sideClass}" data-index="${i}">
      <!-- Premium balloon -->
      <div class="pballoon" data-index="${i}" role="button" tabindex="0"
           aria-label="Pop balloon ${i + 1}: ${cfg.label}" style="opacity:0">
        <div class="pballoon-body" style="--col:${col.main}; --shine:${col.shine}">
          <svg viewBox="0 0 110 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Shadow -->
            <ellipse cx="55" cy="146" rx="22" ry="4" fill="rgba(0,0,0,0.18)"/>
            <!-- String -->
            <path d="M 55 118 Q 62 128,55 140" stroke="rgba(255,255,255,0.35)"
                  stroke-width="1.8" fill="none" stroke-linecap="round"/>
            <!-- Knot -->
            <path d="M 52 116 L 58 116 L 60 120 L 50 120 Z" fill="${col.main}" opacity="0.9"/>
            <!-- Body -->
            <path d="M 55 6 C 88 6,104 34,104 72 C 104 108,74 118,55 118
                     C 36 118,6 108,6 72 C 6 34,22 6,55 6 Z" fill="${col.main}"/>
            <!-- Top specular (bright) -->
            <path d="M 38 18 C 20 30,15 54,20 72 C 23 57,34 33,52 22 Z"
                  fill="${col.shine}"/>
            <!-- Small secondary shine -->
            <ellipse cx="72" cy="28" rx="8" ry="5"
                     fill="rgba(255,255,255,0.22)" transform="rotate(-25 72 28)"/>
          </svg>
          <span class="pballoon-emoji">${cfg.emoji}</span>
        </div>
        <p class="pballoon-label">${cfg.label}</p>
      </div>

      <!-- Message card for balloon ${i} (revealed in this column) -->
      <div class="pballoon-card" data-index="${i}" style="display:none">
        <span class="card-emoji">${cfg.emoji}</span>
        <p class="card-msg">${cfg.message}</p>
      </div>
    </div>`;
  }).join('');

  return `
  <!-- ── Stage A: ambient arena + HB text ── -->
  <div class="balloon-arena" aria-hidden="true"></div>
  <!-- Decorative GIF: ambient balloon celebration -->
  <img class="gif-overlay gif-balloon-ambient"
       src="gif/ballon sectio 1.gif"
       alt=""
       aria-hidden="true" />
  <div class="balloon-hb-text" aria-hidden="true">
    <span>Happy Birthday</span>
    <span>🎂</span>
  </div>

  <!-- ── Stage B: 3 interactive balloons ── -->
  <div class="balloon-stage-b" style="display:none">
    <p class="stage-b-hint">Pop each balloon to reveal a message 🎈</p>
    <div class="pballoons-row">
      ${balloons}
    </div>
    <button id="btn-balloon-next" class="btn-balloon-next"
            style="opacity:0;pointer-events:none;transform:translateY(16px)">
      Make a Wish 🎂
    </button>
  </div>
  `;
}

// ─── Styles ────────────────────────────────────────────────────────────────

function _injectStyles() {
  if (document.getElementById('balloon-styles')) return;
  const style = document.createElement('style');
  style.id = 'balloon-styles';
  style.textContent = `
  /* ── Scene ── */
  .scene-balloons {
    background: var(--scene-bg-default);
    overflow: hidden;
  }

  /* ── Ambient arena ── */
  .balloon-arena {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: 0;
  }

  /* ── Ambient balloon float keyframe ── */
  @keyframes balloonFloat {
    0%   { transform: translateY(0)    scale(var(--s)) rotate(var(--rot-start)); opacity: 0; }
    5%   { opacity: 1; }
    95%  { opacity: 1; }
    100% { transform: translateY(-115vh) scale(var(--s)) rotate(var(--rot-end)); opacity: 0; }
  }

  /* ── HB text ── */
  .balloon-hb-text {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    pointer-events: none;
  }
  .balloon-hb-text span:first-child {
    font-family: var(--font-display);
    font-size: clamp(var(--text-2xl), 7vw, var(--text-4xl));
    color: var(--text-primary);
    text-shadow: 0 4px 28px rgba(0,0,0,0.75);
    letter-spacing: -0.01em;
  }
  .balloon-hb-text span:last-child {
    font-size: clamp(2.5rem, 7vw, 4.5rem);
  }

  /* ── Stage B wrapper ── */
  .balloon-stage-b {
    position: absolute;
    inset: 0;
    z-index: 5;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
    padding: var(--space-8);
  }
  .stage-b-hint {
    font-size: var(--text-md);
    color: var(--text-subtle);
    letter-spacing: 0.04em;
    max-width: none;
  }

  /* ── Premium balloon row & columns ── */
  .pballoons-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(1rem, 3.5vw, 3rem);
    width: 100%;
    max-width: 960px;
    margin: 0 auto;
  }
  .pballoon-col {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  /* ── Single premium balloon ── */
  .pballoon {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    position: relative;
    user-select: none;
    /* Gentle hover bob */
    animation: premBob 3.2s ease-in-out infinite;
  }
  .pballoon:nth-child(odd)  { animation-duration: 3.6s; }
  .pballoon:nth-child(even) { animation-duration: 2.8s; animation-delay: -1s; }
  .pballoon:focus-visible { outline: 2px solid var(--accent); border-radius: 4px; }

  @keyframes premBob {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-14px); }
  }

  .pballoon-body {
    width: clamp(90px, 14vw, 130px);
    height: auto;
    position: relative;
    filter: drop-shadow(0 16px 24px rgba(0,0,0,0.4))
            drop-shadow(0 0 12px color-mix(in srgb, var(--col) 50%, transparent));
    transform-origin: bottom center;
    transition: filter 0.2s ease;
  }
  .pballoon:hover .pballoon-body {
    filter: drop-shadow(0 20px 30px rgba(0,0,0,0.5))
            drop-shadow(0 0 22px color-mix(in srgb, var(--col) 70%, transparent));
  }

  .pballoon-emoji {
    position: absolute;
    top: 38%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: clamp(1.4rem, 3.5vw, 2.2rem);
    pointer-events: none;
  }

  .pballoon-label {
    font-size: var(--text-sm);
    color: var(--text-subtle);
    text-align: center;
    max-width: none;
    line-height: 1.3;
  }

  /* ── Message card (revealed on pop in its dedicated column) ── */
  .pballoon-card {
    position: relative;
    width: 100%;
    max-width: 260px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    background: rgba(22,13,36,0.82);
    backdrop-filter: blur(18px) saturate(140%);
    -webkit-backdrop-filter: blur(18px) saturate(140%);
    border: 1px solid rgba(242,160,174,0.22);
    border-radius: 18px;
    padding: clamp(1rem, 2vw, 1.4rem) clamp(0.8rem, 1.8vw, 1.2rem);
    text-align: center;
    box-shadow: 0 8px 32px rgba(0,0,0,0.55);
    box-sizing: border-box;
    z-index: 10;
  }
  .pballoon-card .card-emoji { font-size: 2rem; margin-bottom: 0.2rem; }
  .pballoon-card .card-msg {
    font-size: clamp(0.92rem, 1.35vw, 1.05rem);
    color: var(--text-primary);
    line-height: 1.55;
    max-width: none;
    margin: 0;
  }

  @media (max-width: 640px) {
    .pballoons-row {
      flex-direction: column;
      gap: 1.2rem;
      max-width: 290px;
    }
    .pballoon-col {
      width: 100%;
    }
  }

  /* ── CTA ── */
  .btn-balloon-next {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--accent);
    color: var(--bg-base);
    font-family: var(--font-body);
    font-size: var(--text-base);
    font-weight: 500;
    padding: 0.85rem 2.2rem;
    border: none;
    border-radius: 40px;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(232,99,122,0.45);
    transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.4s ease;
  }
  .btn-balloon-next:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(232,99,122,0.6);
  }
  .btn-balloon-next:active { transform: scale(0.96); }
  .btn-balloon-next:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
  `;
  document.head.appendChild(style);
}
