/**
 * scenes/final_surprise.js — Phase 7: Three Premium 3D Gift Boxes
 *
 * Three floating CSS 3D gift boxes, visible on screen.
 * The user may open ONLY ONE gift. As soon as one is selected:
 *   - It opens with a lid-fly + glow + particles reveal
 *   - Its randomly assigned surprise is shown
 *   - The other two boxes lock (dimmed, non-interactive)
 *   - A "Final Surprise" CTA appears
 *
 * Surprise content is randomly shuffled each session so the recipient
 * can't predict which box holds what.
 *
 * Dependencies: GSAP (Phase 1 import map), Companion, Particles
 */

import gsap           from 'gsap';
import { navigateTo } from '../app.js';
import { Companion }  from '../companion.js';
import { Particles }  from '../utils/particles.js';
import { sleep }      from '../utils/dom.js';

// ─── Config ─────────────────────────────────────────────────────────────────

/**
 * Surprise pool — randomly shuffled each session.
 * Gift 1 / Gift 2 / Gift 3 map to random entries; user never sees which is which
 * until they tap.
 */
const SURPRISE_POOL = [
  {
    headline: 'A Coffee Date ☕',
    detail:   'Just us, a cosy café, and too much caffeine.',
    icon:     '☕',
    companion: 'Coffee date incoming! ☕ So excited!',
  },
  {
    headline: 'Movie Night 🎬',
    detail:   "Your pick. I won't even complain. (Much.)",
    icon:     '🎬',
    companion: 'Movie night! Snacks and all! 🍿',
  },
  {
    headline: 'Candle Light Dinner 🕯️',
    detail:   "I'll cook. Or we'll figure it out together.",
    icon:     '🕯️',
    companion: 'So romantic! A candlelit dinner! 🥰',
  },
];

/**
 * Visual themes per gift slot.
 * Colors are used for the box body, shading, ribbon, and glow.
 */
const BOX_THEMES = [
  {
    // warm rose-gold
    top:    '#c4506a',
    front:  '#a83050',
    side:   '#8a1f3e',
    ribbon: '#f0c96e',
    glow:   'rgba(240,201,110,0.9)',
    float:  '-8px',
  },
  {
    // deep violet
    top:    '#7b5ea7',
    front:  '#5b3d8a',
    side:   '#412b6e',
    ribbon: '#e8a0b4',
    glow:   'rgba(232,160,180,0.9)',
    float:  '-12px',
  },
  {
    // teal-midnight
    top:    '#3a7a9c',
    front:  '#2a5a7c',
    side:   '#1a3d5c',
    ribbon: '#7ecac4',
    glow:   'rgba(126,202,196,0.9)',
    float:  '-6px',
  },
];

// ─── Module state ────────────────────────────────────────────────────────────

let _container   = null;
let _root        = null;
let _isDestroyed = false;
let _locked      = false;     // true once the user picks one gift

/** Surprise assigned to each slot (indices 0,1,2) */
let _assigned    = [];

// ─── Public API ──────────────────────────────────────────────────────────────

export async function init(container) {
  _container   = container;
  _isDestroyed = false;
  _locked      = false;

  // Shuffle surprise pool — random each session
  _assigned = [...SURPRISE_POOL].sort(() => Math.random() - 0.5);

  _root = document.createElement('section');
  _root.className = 'scene scene-surprise';
  _root.setAttribute('aria-label', 'Your gift surprises');
  _root.innerHTML = _buildHTML();

  _injectStyles();
  _wireEvents();

  _container.appendChild(_root);
}

export async function enter() {
  _root.classList.add('is-active');

  Companion.show();
  await sleep(500);
  Companion.react('surprised', 'Three gifts! Pick ONE to open! 🎁', 4500);

  // Stagger boxes floating in from bottom
  const boxes = Array.from(_root.querySelectorAll('.gift-wrap'));
  boxes.forEach((box, i) => {
    gsap.fromTo(box,
      { y: 100, opacity: 0, scale: 0.6 },
      {
        y: 0, opacity: 1, scale: 1,
        duration: 0.85,
        delay:    0.35 + i * 0.22,
        ease:     'back.out(1.5)',
      }
    );
  });

  // Keep bgm-emotional.mp3 looping continuously without interruption
  import('../audio.js').then(({ AudioManager }) => {
    AudioManager.playMusic('assets/audio/bgm-emotional.mp3', true, 0.55);
  }).catch(() => {});

  // Start gentle float loops after entrance
  await sleep(900);
  _startFloatLoop();

  // Fade in the decorative gift GIF
  const gifGift = _root.querySelector('.gif-gift');
  if (gifGift) gifGift.classList.add('is-visible');
}

export async function exit() {
  _stopFloatLoop();
  Particles.stop();
  _root.classList.remove('is-active');
  await new Promise(r =>
    gsap.to(_root, { opacity: 0, duration: 0.55, ease: 'power2.in', onComplete: r })
  );
}

export function destroy() {
  _stopFloatLoop();
  Particles.stop();
  _root?.remove();
  _root        = null;
  _container   = null;
  _isDestroyed = true;
}

// ─── Float animation loop ────────────────────────────────────────────────────

let _floatTweens = [];

function _startFloatLoop() {
  if (_isDestroyed) return;
  const wraps = _root?.querySelectorAll('.gift-wrap') ?? [];
  wraps.forEach((wrap, i) => {
    const theme = BOX_THEMES[i];
    const tween = gsap.to(wrap, {
      y:          theme.float,
      duration:   2.1 + i * 0.35,
      repeat:     -1,
      yoyo:       true,
      ease:       'sine.inOut',
      delay:      i * 0.4,
    });
    _floatTweens.push(tween);
  });
}

function _stopFloatLoop() {
  _floatTweens.forEach(t => t.kill());
  _floatTweens = [];
}

// ─── Event wiring ────────────────────────────────────────────────────────────

function _wireEvents() {
  _root.querySelectorAll('.gift-wrap').forEach((el, i) => {
    el.addEventListener('click', () => _onGiftClick(i));
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _onGiftClick(i); }
    });
  });

  _root.querySelector('#btn-surprise-next')
    ?.addEventListener('click', _handleNextPhase);
}

// ─── Gift open sequence ──────────────────────────────────────────────────────

async function _onGiftClick(index) {
  if (_isDestroyed || _locked) return;
  _locked = true;  // no more gifts can be opened

  const wrap    = _root.querySelector(`.gift-wrap[data-index="${index}"]`);
  const lid     = wrap?.querySelector('.gift-lid-group');
  const ribbon  = wrap?.querySelector('.gift-ribbon-bow');
  const glowEl  = wrap?.querySelector('.gift-glow');
  const card    = _root.querySelector(`.reveal-card[data-index="${index}"]`);
  if (!wrap || !lid || !card) return;

  // Stop floating for the chosen box
  _stopFloatLoop();

  // Dim & lock the other two immediately
  _root.querySelectorAll('.gift-wrap').forEach((el, i) => {
    if (i === index) return;
    el.style.pointerEvents = 'none';
    el.setAttribute('aria-disabled', 'true');
    gsap.to(el, { opacity: 0.28, scale: 0.88, duration: 0.55, ease: 'power2.out' });
  });

  // 1 ── Chosen box: lift forward + wiggle ────────────────────────────────────
  gsap.to(wrap, {
    scale:    1.12,
    y:        -18,
    duration: 0.4,
    ease:     'back.out(1.4)',
  });

  await new Promise(r =>
    gsap.to(wrap, {
      x: 8, duration: 0.07, repeat: 7, yoyo: true, ease: 'none', onComplete: r,
    })
  );
  gsap.set(wrap, { x: 0 });

  // 2 ── Ribbon bow pops off ──────────────────────────────────────────────────
  gsap.to(ribbon, {
    y:       -28,
    scale:    1.3,
    opacity:  0,
    duration: 0.32,
    ease:     'power2.out',
  });

  // 3 ── Inner glow leaks ─────────────────────────────────────────────────────
  gsap.to(glowEl, {
    opacity: 1,
    scale:   1.6,
    duration: 0.55,
    ease:    'power2.out',
  });

  await sleep(360);

  // 4 ── Lid flies off ───────────────────────────────────────────────────────
  await new Promise(r =>
    gsap.to(lid, {
      y:       -180,
      rotateX:  60,
      rotateZ:  (Math.random() - 0.5) * 45,
      opacity:  0,
      duration: 0.65,
      ease:     'power3.out',
      onComplete: r,
    })
  );

  // 5 ── Light burst + particles ─────────────────────────────────────────────
  const burst = _root.querySelector(`.light-burst[data-index="${index}"]`);
  if (burst) {
    gsap.set(burst, { opacity: 1, scale: 0 });
    gsap.to(burst, { scale: 4, opacity: 0, duration: 0.7, ease: 'power2.out' });
  }

  const rect = wrap.getBoundingClientRect();
  Particles.burst({
    x:      (rect.left + rect.width  / 2) / window.innerWidth,
    y:      (rect.top  + rect.height / 2) / window.innerHeight,
    count:  80,
    spread: 1.8,
  });

  import('../audio.js').then(({ AudioManager }) => {
    AudioManager.playSFX('assets/audio/gift open.mp3', 0.85);
  }).catch(() => {});

  Companion.react('celebrating', _assigned[index].companion, 4000);

  await sleep(350);

  // 6 ── Fade box out, reveal card ──────────────────────────────────────────
  gsap.to(wrap, { opacity: 0, scale: 0.65, duration: 0.38, ease: 'power2.in' });
  await sleep(280);
  wrap.style.display = 'none';

  gsap.set(card, { display: 'flex' });
  gsap.fromTo(card,
    { scale: 0.5, opacity: 0, y: 30 },
    { scale: 1,   opacity: 1, y: 0, duration: 0.65, ease: 'back.out(1.7)' }
  );

  // 7 ── Show CTA after short pause ─────────────────────────────────────────
  await sleep(1100);
  Companion.react('celebrating', 'Your surprise is chosen! 🌟 One more thing…', 5000);
  await sleep(400);

  const btn = _root.querySelector('#btn-surprise-next');
  if (btn) {
    gsap.to(btn, {
      opacity:       1,
      y:             0,
      pointerEvents: 'auto',
      duration:      0.7,
      ease:          'back.out(1.5)',
    });
  }
}

// ─── Navigation ──────────────────────────────────────────────────────────────

function _handleNextPhase() {
  navigateTo(() => import('./finale.js'), { type: 'dissolve', duration: 1500 });
}

// ─── HTML builder ────────────────────────────────────────────────────────────

function _buildHTML() {
  const boxes = BOX_THEMES.map((t, i) => {
    const s = _assigned[i];
    return `
    <div class="gift-slot" data-index="${i}">
      <!-- The whole gift-wrap is the clickable, focusable unit -->
      <div class="gift-wrap" data-index="${i}"
           role="button" tabindex="0"
           aria-label="Gift ${i + 1} — tap to open your surprise">

        <!-- 3D gift box rendered purely with divs + perspective CSS -->
        <div class="gift-box3d">

          <!-- Lid group (flies off on open) -->
          <div class="gift-lid-group">
            <div class="face lid-top"   style="background:${t.top}"></div>
            <div class="face lid-front" style="background:${t.front}"></div>
            <div class="face lid-back"  style="background:${t.side}"></div>
            <div class="face lid-left"  style="background:${t.side}"></div>
            <div class="face lid-right" style="background:${t.front}"></div>
            <!-- Ribbon cross on top -->
            <div class="lid-ribbon-h" style="background:${t.ribbon}"></div>
            <div class="lid-ribbon-v" style="background:${t.ribbon}"></div>
          </div>

          <!-- Base box (stays) -->
          <div class="gift-base-group">
            <div class="face base-front" style="background:${t.front}"></div>
            <div class="face base-back"  style="background:${t.side}"></div>
            <div class="face base-left"  style="background:${t.side}"></div>
            <div class="face base-right" style="background:${t.front}"></div>
            <div class="face base-bot"   style="background:${t.side}"></div>
            <!-- Ribbon stripe on front/sides -->
            <div class="base-ribbon-h" style="background:${t.ribbon}"></div>
            <div class="base-ribbon-fl" style="background:${t.ribbon}"></div>
            <div class="base-ribbon-fr" style="background:${t.ribbon}"></div>
          </div>

          <!-- Inner glow (light leak) -->
          <div class="gift-glow" style="--glow-col:${t.glow}"></div>
        </div>

        <!-- Bow on top of lid -->
        <div class="gift-ribbon-bow" style="--ribbon-col:${t.ribbon}">🎀</div>

        <!-- Subtle floating shadow -->
        <div class="gift-shadow"></div>
      </div>

      <!-- Light burst (behind box in slot) -->
      <div class="light-burst" data-index="${i}"></div>

      <!-- Reveal card (shown after selection) -->
      <div class="reveal-card" data-index="${i}" style="display:none">
        <span class="reveal-icon">${s.icon}</span>
        <h3 class="reveal-headline">${s.headline}</h3>
        <p  class="reveal-detail">${s.detail}</p>
      </div>
    </div>`;
  }).join('');

  return `
  <h2 class="gifts-title display">Your Surprises 🎁</h2>
  <p  class="gifts-hint">Pick ONE gift to reveal your surprise ✨</p>

  <div class="gifts-row">
    ${boxes}
  </div>

  <!-- Decorative GIF: gift section celebration -->
  <img class="gif-overlay gif-gift"
       src="gif/gift section.gif"
       alt=""
       aria-hidden="true" />

  <button id="btn-surprise-next" class="btn-surprise-next"
          style="opacity:0; pointer-events:none; transform:translateY(20px)">
    One Last Thing… 💌
  </button>
  `;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function _injectStyles() {
  if (document.getElementById('surprise-styles')) {
    document.getElementById('surprise-styles').remove(); // always refresh
  }
  const s = document.createElement('style');
  s.id = 'surprise-styles';

  /* ── Constants ────────────────────────────────────────────────────────────
     Box total size: 96px wide × 110px tall
     Lid height:  30px   →  translateZ = 48px (half-width)
     Base height: 80px   →  translateZ = 48px
     All faces use actual pixel values so 3D works without hidden overflow.
  ──────────────────────────────────────────────────────────────────────── */

  s.textContent = `
  /* ── Scene ─────────────────────────────────────────────────────────────── */
  .scene-surprise {
    background: var(--scene-bg-default);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.6rem;
    overflow: hidden;
    padding: 2rem 1rem;
  }

  /* ── Headings ──────────────────────────────────────────────────────────── */
  .gifts-title {
    font-size: clamp(1.8rem, 4vw, 3rem);
    color: var(--text-primary);
    text-align: center;
    margin: 0;
  }
  .gifts-hint {
    font-size: 0.9rem;
    color: var(--text-subtle);
    letter-spacing: 0.04em;
    text-align: center;
    margin: 0;
  }

  /* ── Row of gifts ──────────────────────────────────────────────────────── */
  .gifts-row {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: clamp(2rem, 6vw, 5rem);
    flex-wrap: wrap;
  }

  /* ── Single slot ───────────────────────────────────────────────────────── */
  .gift-slot {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  /* ── Clickable wrapper — starts invisible, GSAP fades in ─────────────── */
  .gift-wrap {
    position: relative;
    width: 96px;
    height: 160px;          /* enough room for box + bow + shadow */
    cursor: pointer;
    outline: none;
    -webkit-tap-highlight-color: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    opacity: 0;             /* GSAP animates this to 1 */
    will-change: transform, opacity;
  }
  .gift-wrap:focus-visible .gift-box3d {
    outline: 2px solid var(--accent);
    outline-offset: 6px;
    border-radius: 4px;
  }

  /* Hover: lift and slightly rotate the whole box */
  .gift-wrap:not([aria-disabled="true"]):hover .gift-box3d {
    transform: perspective(400px) rotateX(-18deg) rotateY(32deg) scale(1.06);
  }

  /* ── 3D gift box container ──────────────────────────────────────────────
     perspective + preserve-3d on the container, then each face is placed
     with rotateX/Y + translateZ — this is the only reliable cross-browser
     approach for CSS 3D cuboids.
  ──────────────────────────────────────────────────────────────────────── */
  .gift-box3d {
    position: relative;
    width: 96px;
    height: 110px;
    transform-style: preserve-3d;
    transform: perspective(400px) rotateX(-16deg) rotateY(28deg);
    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    pointer-events: none; /* clicks go to .gift-wrap */
  }

  /* ─── Generic face reset ───────────────────────────────────────────────── */
  .face {
    position: absolute;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  /* ══ LID GROUP (top 30px of the cube) ═══════════════════════════════════ */
  .gift-lid-group {
    position: absolute;
    width: 96px;
    height: 30px;
    top: 0;
    left: 0;
    transform-style: preserve-3d;
    /* will-change keeps this layer on GPU for smooth lid fly-off */
    will-change: transform, opacity;
  }

  /* lid top face */
  .lid-top {
    width: 96px; height: 96px;
    left: 0; top: 0;
    transform: rotateX(90deg) translateZ(-48px);
    /* rotate 90° around X so it faces up, then push to top edge */
  }
  /* lid front face */
  .lid-front {
    width: 96px; height: 30px;
    left: 0; top: 0;
    transform: translateZ(48px);
  }
  /* lid back face */
  .lid-back {
    width: 96px; height: 30px;
    left: 0; top: 0;
    transform: rotateY(180deg) translateZ(48px);
  }
  /* lid left face */
  .lid-left {
    width: 96px; height: 30px;
    left: 0; top: 0;
    transform: rotateY(-90deg) translateZ(48px);
  }
  /* lid right face */
  .lid-right {
    width: 96px; height: 30px;
    left: 0; top: 0;
    transform: rotateY(90deg) translateZ(48px);
  }

  /* Ribbon cross on lid top */
  .lid-ribbon-h,
  .lid-ribbon-v {
    position: absolute;
    background: transparent; /* overridden inline */
    opacity: 0.92;
    pointer-events: none;
    transform-style: preserve-3d;
  }
  /* horizontal strip on the top face */
  .lid-ribbon-h {
    width: 96px; height: 16px;
    top: 7px; left: 0;
    transform: rotateX(90deg) translateZ(-39px);
  }
  /* vertical strip on the top face */
  .lid-ribbon-v {
    width: 16px; height: 96px;
    top: 0; left: 40px;
    transform: rotateX(90deg) translateZ(-39px);
  }

  /* ══ BASE GROUP (bottom 80px of the cube) ════════════════════════════════ */
  .gift-base-group {
    position: absolute;
    width: 96px;
    height: 80px;
    top: 30px;
    left: 0;
    transform-style: preserve-3d;
  }

  .base-front {
    width: 96px; height: 80px;
    left: 0; top: 0;
    transform: translateZ(48px);
    /* Highlight sheen */
    background-image: linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 60%);
    background-repeat: no-repeat;
  }
  .base-back {
    width: 96px; height: 80px;
    left: 0; top: 0;
    transform: rotateY(180deg) translateZ(48px);
  }
  .base-left {
    width: 96px; height: 80px;
    left: 0; top: 0;
    transform: rotateY(-90deg) translateZ(48px);
  }
  .base-right {
    width: 96px; height: 80px;
    left: 0; top: 0;
    transform: rotateY(90deg) translateZ(48px);
  }
  .base-bot {
    width: 96px; height: 96px;
    left: 0; top: 80px;
    transform: rotateX(-90deg) translateZ(-16px);
  }

  /* Ribbon stripe on base front */
  .base-ribbon-h {
    position: absolute;
    width: 96px; height: 16px;
    top: 32px; left: 0;
    transform: translateZ(49px);
    opacity: 0.88;
    pointer-events: none;
    transform-style: preserve-3d;
  }
  /* Ribbon stripe on base left face */
  .base-ribbon-fl {
    position: absolute;
    width: 96px; height: 16px;
    top: 32px; left: 0;
    transform: rotateY(-90deg) translateZ(49px);
    opacity: 0.88;
    pointer-events: none;
    transform-style: preserve-3d;
  }
  /* Ribbon stripe on base right face */
  .base-ribbon-fr {
    position: absolute;
    width: 96px; height: 16px;
    top: 32px; left: 0;
    transform: rotateY(90deg) translateZ(49px);
    opacity: 0.88;
    pointer-events: none;
    transform-style: preserve-3d;
  }

  /* ── Inner glow (light leak before burst) ───────────────────────────────── */
  .gift-glow {
    position: absolute;
    top: 50%; left: 50%;
    width: 10px; height: 10px;
    transform: translate(-50%, -50%) translateZ(20px);
    border-radius: 50%;
    background: #fff;
    box-shadow:
      0 0 24px 12px var(--glow-col, rgba(240,201,110,0.9)),
      0 0 60px 30px rgba(255,255,255,0.25);
    opacity: 0;
    pointer-events: none;
    transform-style: preserve-3d;
  }

  /* ── Bow (rendered above the 3D box, aligned via flex) ────────────────── */
  .gift-ribbon-bow {
    position: absolute;
    top: -4px;
    font-size: 2.2rem;
    line-height: 1;
    filter:
      drop-shadow(0 2px 6px rgba(0,0,0,0.45))
      drop-shadow(0 0 8px var(--ribbon-col, #f0c96e));
    pointer-events: none;
    will-change: transform, opacity;
    transform-origin: 50% 100%;
  }

  /* ── Floating shadow beneath the box ──────────────────────────────────── */
  .gift-shadow {
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
    width: 70px;
    height: 16px;
    border-radius: 50%;
    background: radial-gradient(ellipse, rgba(0,0,0,0.35) 0%, transparent 70%);
    pointer-events: none;
    will-change: transform;
  }

  /* ── Light burst (centred in slot, behind box) ─────────────────────────── */
  .light-burst {
    position: absolute;
    top: 50%; left: 50%;
    width: 80px; height: 80px;
    transform: translate(-50%, -50%) scale(0);
    border-radius: 50%;
    background: radial-gradient(circle, #fff 0%, var(--c-gold) 35%, transparent 68%);
    pointer-events: none;
    z-index: 10;
    opacity: 0;
  }

  /* ── Reveal card (replaces the box after selection) ─────────────────────── */
  .reveal-card {
    width: 150px;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    background: rgba(22,13,36,0.76);
    backdrop-filter: blur(18px) saturate(140%);
    -webkit-backdrop-filter: blur(18px) saturate(140%);
    border: 1px solid rgba(242,160,174,0.26);
    border-radius: 18px;
    padding: 1.4rem 1rem;
    text-align: center;
    box-shadow: 0 10px 36px rgba(0,0,0,0.55);
    z-index: 5;
  }
  .reveal-icon {
    font-size: 2.4rem;
    line-height: 1;
  }
  .reveal-headline {
    font-family: var(--font-display);
    font-size: 1.15rem;
    color: var(--text-primary);
    margin: 0;
    font-weight: 500;
    line-height: 1.3;
  }
  .reveal-detail {
    font-size: 0.82rem;
    color: var(--text-subtle);
    line-height: 1.55;
    margin: 0;
  }

  /* ── Final CTA ─────────────────────────────────────────────────────────── */
  .btn-surprise-next {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--accent);
    color: var(--bg-base);
    font-family: var(--font-body);
    font-size: 1rem;
    font-weight: 600;
    padding: 0.9rem 2.4rem;
    border: none;
    border-radius: 40px;
    cursor: pointer;
    box-shadow: 0 4px 24px rgba(232,99,122,0.50);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .btn-surprise-next:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(232,99,122,0.68);
  }
  .btn-surprise-next:active  { transform: scale(0.96); }
  .btn-surprise-next:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }

  /* ── Mobile ─────────────────────────────────────────────────────────────── */
  @media (max-width: 540px) {
    .gifts-row { gap: 1.5rem; }
    .gift-box3d {
      width: 80px;
      height: 92px;
      transform: perspective(340px) rotateX(-14deg) rotateY(26deg);
    }
    .gift-wrap { width: 80px; height: 140px; }
    .lid-top, .lid-ribbon-v { width: 80px; }
    .lid-ribbon-h  { width: 80px; height: 13px; top: 5px; }
    .lid-ribbon-v  { width: 13px; left: 34px; }
    .lid-front, .lid-back, .lid-left, .lid-right { width: 80px; height: 26px; }
    .lid-top { height: 80px; }
    .lid-front  { transform: translateZ(40px); }
    .lid-back   { transform: rotateY(180deg) translateZ(40px); }
    .lid-left   { transform: rotateY(-90deg) translateZ(40px); }
    .lid-right  { transform: rotateY(90deg)  translateZ(40px); }
    .lid-top    { transform: rotateX(90deg) translateZ(-40px); }
    .lid-ribbon-h { transform: rotateX(90deg) translateZ(-31px); }
    .lid-ribbon-v { transform: rotateX(90deg) translateZ(-31px); }
    .base-front, .base-back, .base-left, .base-right { width: 80px; height: 66px; }
    .base-bot   { width: 80px; height: 80px; }
    .base-front { transform: translateZ(40px); }
    .base-back  { transform: rotateY(180deg) translateZ(40px); }
    .base-left  { transform: rotateY(-90deg) translateZ(40px); }
    .base-right { transform: rotateY(90deg)  translateZ(40px); }
    .base-bot   { transform: rotateX(-90deg) translateZ(-14px); }
    .base-ribbon-h  { width: 80px; height: 13px; top: 27px; transform: translateZ(41px); }
    .base-ribbon-fl { width: 80px; height: 13px; top: 27px; transform: rotateY(-90deg) translateZ(41px); }
    .base-ribbon-fr { width: 80px; height: 13px; top: 27px; transform: rotateY(90deg) translateZ(41px); }
    .gift-gift-group { top: 26px; height: 66px; }
    .reveal-card { width: 130px; }
    .reveal-headline { font-size: 1rem; }
  }
  `;

  document.head.appendChild(s);
}
