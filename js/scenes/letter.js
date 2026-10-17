/**
 * scenes/letter.js — Phase 5: Sealed Envelope + Word-by-Word Letter
 *
 * Stage A: Sealed envelope floats in — tap to open.
 *          3D CSS flap rotates open with perspective + bounce.
 * Stage B: Letter paper unfolds from envelope with word-by-word reveal.
 *          Ends with "One More Surprise" CTA.
 *
 * Dependencies: GSAP (Phase 1 import map), Companion, Particles
 */

import gsap           from 'gsap';
import { navigateTo } from '../app.js';
import { Companion }  from '../companion.js';
import { Particles }  from '../utils/particles.js';
import { qs, sleep }  from '../utils/dom.js';

// ─── Letter content — easy to edit ─────────────────────────────────────────

/**
 * The letter text, split into sentences.
 * Each sentence is revealed word-by-word in sequence.
 * Add or remove sentences freely.
 */
const LETTER_LINES = [
    "Mere favourite person ke naam… ❤️🌙",
"Pata hai, tum meri life ka woh hissa ho jise main kabhi khona nahi chahti. 🫶💗 Tumse baat karna, tumhe pareshan karna aur tumhare saath chhoti-chhoti khushiyan share karna—mere liye sab kuch hai. 🥹💞",
"Ek shayari sirf tumhare liye… 🥀❤️",
"Tujhe chah kar kyun kisi aur ki chahat karun… 💞",
"Tujhe bhool kar kyun khud ko tabaah karun… 🔥✨",
"Tu zindagi hi nahi, ishq hai mera… 🧿❤️",
"Kyun kisi aur ko soch kar gunaah karun… 😊💗",
"Bas itna sa kehna hai ki tum mere liye bahut special ho. ❤️ Main chahti hoon ki tumhara har birthday par tumhare chehre par aisi hi smile ho aur hum saath mein aur bhi khoobsurat memories banayein. 🎂",
  "Happy Birthday, my love. 🌸",
];

// ─── Module state ──────────────────────────────────────────────────────────

let _container   = null;
let _root        = null;
let _isDestroyed = false;
let _envelopeOpened = false;

// ─── Public API ────────────────────────────────────────────────────────────

export async function init(container) {
  _container      = container;
  _isDestroyed    = false;
  _envelopeOpened = false;

  _root = document.createElement('section');
  _root.className = 'scene scene-letter';
  _root.setAttribute('aria-label', 'A letter from the heart');

  _root.innerHTML = _buildHTML();
  _injectStyles();

  // Tap envelope to open
  qs('.envelope-wrap', _root)
    .addEventListener('click', _openEnvelope, { once: true });

  // CTA
  qs('#btn-letter-next', _root)
    .addEventListener('click', _handleNextPhase);

  _container.appendChild(_root);
}

export async function enter() {
  _root.classList.add('is-active');

  // Smoothly switch to "bgm-emotional.mp3" looping
  import('../audio.js').then(({ AudioManager }) => {
    AudioManager.playMusic('assets/audio/bgm-emotional.mp3', true, 0.55);
  }).catch(() => {});

  // Companion stays hidden during this emotional moment
  Companion.hide();

  // Sparse gold ember particles
  Particles.rain(10);

  await sleep(400);

  // Float the envelope in from below
  const env = qs('.envelope-wrap', _root);
  gsap.fromTo(env,
    { y: 80, opacity: 0, scale: 0.85 },
    { y: 0,  opacity: 1, scale: 1, duration: 1.1, ease: 'back.out(1.4)' }
  );

  // Gentle idle bob on envelope
  await sleep(1100);
  gsap.to(env, {
    y:        -8,
    duration: 2.2,
    repeat:   -1,
    yoyo:     true,
    ease:     'sine.inOut',
  });

  // Tap hint pulses in
  const hint = qs('.env-hint', _root);
  gsap.to(hint, { opacity: 1, duration: 0.6, delay: 0.4 });
}

export async function exit() {
  Particles.stop();
  gsap.killTweensOf('*');
  _root.classList.remove('is-active');
  await new Promise(r =>
    gsap.to(_root, { opacity: 0, duration: 0.6, ease: 'power2.in', onComplete: r })
  );
}

export function destroy() {
  Particles.stop();
  gsap.killTweensOf('*');
  _root?.remove();
  _root        = null;
  _container   = null;
  _isDestroyed = true;
}

// ─── Stage A: Envelope open ────────────────────────────────────────────────

async function _openEnvelope() {
  if (_envelopeOpened || _isDestroyed) return;
  _envelopeOpened = true;

  const envWrap = qs('.envelope-wrap', _root);
  const flap    = qs('.env-flap',      _root);
  const hint    = qs('.env-hint',      _root);

  // Kill idle bob
  gsap.killTweensOf(envWrap);

  // Hide hint
  gsap.to(hint, { opacity: 0, duration: 0.25 });

  // Small press-down then release
  await new Promise(r =>
    gsap.to(envWrap, { scale: 0.95, duration: 0.12, ease: 'power2.in', onComplete: r })
  );

  // Flap opens: rotate around the top edge (transform-origin: top centre)
  // CSS perspective is set on the parent .envelope-3d
  await new Promise(r =>
    gsap.to(flap, {
      rotateX:  -165,
      duration: 0.65,
      ease:     'power3.out',
      onComplete: r,
    })
  );

  // Bounce
  await new Promise(r =>
    gsap.to(flap, {
      rotateX:  -172,
      duration: 0.18,
      ease:     'power2.inOut',
      yoyo:     true,
      repeat:   1,
      onComplete: r,
    })
  );

  // Small particle shower from envelope
  const rect = envWrap.getBoundingClientRect();
  Particles.burst({
    x:      (rect.left + rect.width / 2)  / window.innerWidth,
    y:      (rect.top  + rect.height / 2) / window.innerHeight,
    count:  30,
    spread: 0.8,
  });

  // Scale envelope down to make room for the letter paper
  gsap.to(envWrap, {
    scale:    0.78,
    y:        window.innerHeight * 0.28,
    duration: 0.7,
    ease:     'power2.inOut',
  });

  await sleep(300);

  // ── Stage B: Letter paper unfolds ──────────────────────────────────────────
  await _revealLetter();
}

// ─── Stage B: Word-by-word letter ─────────────────────────────────────────

async function _revealLetter() {
  if (_isDestroyed) return;

  const paper = qs('.letter-paper', _root);
  const paperInner = qs('.paper-inner', paper);

  // Guarantee the scroll container starts cleanly at the top
  paper.scrollTop = 0;
  gsap.set(paper, { display: 'flex', opacity: 1 });

  // Elegant paper unfold: inner card gently floats up from the envelope
  await new Promise(r =>
    gsap.fromTo(paperInner,
      { y: 80, opacity: 0, scale: 0.94 },
      { y: 0,  opacity: 1, scale: 1, duration: 0.8, ease: 'power3.out', onComplete: r }
    )
  );

  await sleep(300);

  // Fade in the decorative letter GIFs
  const gifL1 = qs('.gif-letter-1', _root);
  const gifL2 = qs('.gif-letter-2', _root);
  if (gifL1) gifL1.classList.add('is-visible');
  if (gifL2) gifL2.classList.add('is-visible');

  // ── Scroll tracking ────────────────────────────────────────────────────────
  let _userInteracted = false;
  let _userScrollTimeout = null;

  const onUserInteraction = () => {
    _userInteracted = true;
    clearTimeout(_userScrollTimeout);
    _userScrollTimeout = setTimeout(() => {
      _userInteracted = false;
    }, 2500);
  };

  paper.addEventListener('wheel',      onUserInteraction, { passive: true });
  paper.addEventListener('touchstart', onUserInteraction, { passive: true });
  paper.addEventListener('touchmove',  onUserInteraction, { passive: true });

  /**
   * Smoothly keeps the newly revealed word in view.
   * Only scrolls downwards when the active word reaches the lower reading threshold (~60% of viewport).
   */
  const keepInView = (targetEl) => {
    if (!targetEl || _userInteracted) return;

    const elRect = targetEl.getBoundingClientRect();
    const cRect  = paper.getBoundingClientRect();

    // Target reading line: keep newly typed text around 60% of the visible container
    const readingThreshold = cRect.top + cRect.height * 0.60;

    if (elRect.bottom > readingThreshold) {
      const delta = elRect.bottom - readingThreshold;
      const targetScroll = paper.scrollTop + delta;

      gsap.to(paper, {
        scrollTop: targetScroll,
        duration: 0.35,
        ease: 'power1.out',
        overwrite: 'auto',
      });
    }
  };

  // ── Word-by-word reveal ────────────────────────────────────────────────────
  const lineEls = Array.from(paper.querySelectorAll('.letter-line'));

  for (const lineEl of lineEls) {
    if (_isDestroyed) return;
    const words = Array.from(lineEl.querySelectorAll('.lword'));

    for (const w of words) {
      if (_isDestroyed) return;

      // Reveal word with gentle blur-in
      gsap.to(w, {
        opacity:  1,
        y:        0,
        filter:   'blur(0px)',
        duration: 0.45,
        ease:     'power2.out',
      });

      // Smoothly pace auto-scroll with the word being typed
      keepInView(w);

      await sleep(110);
    }

    // Settle line comfortably
    keepInView(lineEl);

    // Pause between lines
    await sleep(320);
  }

  // ── Typing complete ────────────────────────────────────────────────────────
  paper.removeEventListener('wheel',      onUserInteraction);
  paper.removeEventListener('touchstart', onUserInteraction);
  paper.removeEventListener('touchmove',  onUserInteraction);
  clearTimeout(_userScrollTimeout);

  await sleep(400);

  // Warm closing ember burst
  Particles.burst({ x: 0.5, y: 0.6, count: 50, spread: 1.2 });

  await sleep(400);

  // Reveal CTA button inside the letter paper
  const btn = qs('#btn-letter-next', _root);
  if (btn) {
    gsap.to(btn, {
      opacity:       1,
      y:             0,
      pointerEvents: 'auto',
      duration:      0.7,
      ease:          'back.out(1.5)',
    });

    // Final smooth scroll to show the CTA button and the warm closing
    const maxScroll = paper.scrollHeight - paper.clientHeight;
    if (maxScroll > paper.scrollTop) {
      gsap.to(paper, {
        scrollTop: maxScroll,
        duration: 0.8,
        ease: 'power2.out',
        overwrite: 'auto',
        onComplete: () => {
          paper.style.scrollBehavior = 'smooth';
        }
      });
    } else {
      paper.style.scrollBehavior = 'smooth';
    }
  } else {
    paper.style.scrollBehavior = 'smooth';
  }
}

// ─── Navigation ────────────────────────────────────────────────────────────

function _handleNextPhase() {
  navigateTo(() => import('./photo_world.js'), { type: 'dissolve', duration: 1500 });
}

// ─── HTML builder ──────────────────────────────────────────────────────────

function _buildHTML() {
  // Wrap each line, and each word in a line, for animation
  const lineHTML = LETTER_LINES.map(line => {
    const words = line.split(' ').map(w =>
      `<span class="lword">${w}</span>`
    ).join(' ');
    return `<span class="letter-line">${words}</span>`;
  }).join('');

  return `
  <!-- ── Envelope (Stage A) ── -->
  <div class="envelope-wrap" role="button" tabindex="0"
       aria-label="Tap to open the letter">
    <div class="envelope-3d">
      <!-- Back of envelope (body) -->
      <div class="env-body">
        <!-- V-fold lines on body -->
        <div class="env-fold-left"></div>
        <div class="env-fold-right"></div>
        <div class="env-fold-bottom"></div>
        <!-- Wax seal -->
        <div class="env-seal">💌</div>
      </div>
      <!-- Flap (rotates open) -->
      <div class="env-flap"></div>
    </div>
    <!-- Tap hint -->
    <p class="env-hint" aria-hidden="true">tap to open ✨</p>
  </div>

  <!-- ── Letter paper (Stage B, hidden initially) ── -->
  <div class="letter-paper" style="display:none" aria-live="polite">
    <div class="paper-inner">
      <div class="letter-body">
        ${lineHTML}
      </div>
      <div class="letter-footer">
        <button id="btn-letter-next" class="btn-letter-next"
                style="opacity:0; pointer-events:none; transform:translateY(16px)">
          One More Surprise 🎁
        </button>
      </div>
    </div>
  </div>

  <!-- Decorative GIFs shown while letter is being read -->
  <img class="gif-overlay gif-letter-1"
       src="gif/letter reading time 1.gif"
       alt=""
       aria-hidden="true" />
  <img class="gif-overlay gif-letter-2"
       src="gif/letter reading time 2.gif"
       alt=""
       aria-hidden="true" />
  `;
}

// ─── Styles ────────────────────────────────────────────────────────────────

function _injectStyles() {
  if (document.getElementById('letter-styles')) return;
  const s = document.createElement('style');
  s.id = 'letter-styles';
  s.textContent = `
  /* ── Scene shell ── */
  .scene-letter {
    background: var(--scene-bg-default);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-8);
    overflow: hidden;
    padding: var(--space-8) var(--space-4);
  }

  /* ── Envelope wrapper ── */
  .envelope-wrap {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    cursor: pointer;
    user-select: none;
    z-index: 2;
  }
  .envelope-wrap:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 8px;
    border-radius: 4px;
  }

  /* 3D perspective container */
  .envelope-3d {
    position: relative;
    width: clamp(220px, 40vw, 320px);
    height: clamp(150px, 27vw, 218px);
    perspective: 900px;
    perspective-origin: 50% 0%;
  }

  /* ── Envelope body ── */
  .env-body {
    position: absolute;
    inset: 0;
    background: linear-gradient(160deg, #fdf6ef 0%, #f5e8de 100%);
    border-radius: 4px 4px 10px 10px;
    box-shadow:
      0 18px 48px rgba(0,0,0,0.55),
      0  4px 12px rgba(0,0,0,0.25),
      inset 0 0 0 1px rgba(255,255,255,0.35);
    overflow: hidden;
  }

  /* V-fold decoration lines */
  .env-fold-left,
  .env-fold-right,
  .env-fold-bottom {
    position: absolute;
    border: 1px solid rgba(232,99,122,0.18);
  }
  .env-fold-left {
    top: 0; left: 0; right: 50%; bottom: 0;
    clip-path: polygon(0 0, 100% 50%, 0 100%);
    background: rgba(232,99,122,0.06);
    border: none;
  }
  .env-fold-right {
    top: 0; right: 0; left: 50%; bottom: 0;
    clip-path: polygon(100% 0, 0 50%, 100% 100%);
    background: rgba(232,99,122,0.06);
    border: none;
  }
  .env-fold-bottom {
    bottom: 0; left: 0; right: 0;
    height: 55%;
    clip-path: polygon(0 100%, 50% 0%, 100% 100%);
    background: rgba(248,220,220,0.22);
    border: none;
  }

  /* Wax seal */
  .env-seal {
    position: absolute;
    bottom: 12%;
    left: 50%;
    transform: translateX(-50%);
    font-size: clamp(1.8rem, 5vw, 2.6rem);
    filter: drop-shadow(0 2px 6px rgba(232,99,122,0.6));
    line-height: 1;
  }

  /* ── Flap ── */
  .env-flap {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    /* Height = diagonal of the V fold (approx 55% of envelope height) */
    height: 55%;
    transform-origin: top center;
    transform-style: preserve-3d;
    background: linear-gradient(170deg, #fdf6ef 0%, #f0d6cc 100%);
    clip-path: polygon(0 0, 50% 100%, 100% 0);
    box-shadow: 0 4px 10px rgba(0,0,0,0.2);
    /* Start closed (0deg) */
    transform: rotateX(0deg);
    z-index: 3;
    border-radius: 4px 4px 0 0;
  }

  /* ── Tap hint ── */
  .env-hint {
    font-size: var(--text-sm);
    color: var(--text-subtle);
    letter-spacing: 0.06em;
    opacity: 0;
    max-width: none;
    animation: gentleFade 2s ease-in-out infinite alternate;
    animation-play-state: running;
  }

  /* ── Letter paper ── */
  .letter-paper {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: var(--space-12) var(--space-4) 80px;
    pointer-events: auto;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .paper-inner {
    width: 100%;
    max-width: 620px;
    margin: 0 auto;
    background: rgba(10,6,18,0.72);
    backdrop-filter: blur(20px) saturate(140%);
    -webkit-backdrop-filter: blur(20px) saturate(140%);
    border: 1px solid rgba(242,160,174,0.22);
    border-radius: 20px;
    padding: clamp(var(--space-8), 5vw, var(--space-14)) clamp(var(--space-6), 5vw, var(--space-10));
    box-shadow: 0 16px 50px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(255,255,255,0.06);
    flex-shrink: 0;
  }

  /* ── Letter footer / CTA wrapper ── */
  .letter-footer {
    display: flex;
    justify-content: center;
    margin-top: var(--space-8);
    padding-bottom: var(--space-2);
  }

  /* ── Letter body text ── */
  .letter-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    text-align: center;
  }

  .letter-line {
    display: block;
    font-family: var(--font-display);
    font-size: clamp(var(--text-lg), 2.8vw, var(--text-2xl));
    font-weight: 300;
    color: var(--text-primary);
    line-height: 1.6;
    letter-spacing: 0.01em;
  }

  /* ── Word spans (GSAP controlled) ── */
  .lword {
    display: inline-block;
    opacity: 0;
    filter: blur(5px);
    transform: translateY(6px);
  }

  /* ── CTA ── */
  .btn-letter-next {
    position: relative;
    z-index: 15;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--accent);
    color: var(--bg-base);
    font-family: var(--font-body);
    font-size: var(--text-base);
    font-weight: 500;
    padding: 0.9rem 2.4rem;
    border: none;
    border-radius: 40px;
    cursor: pointer;
    box-shadow: 0 4px 22px rgba(232,99,122,0.48);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .btn-letter-next:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(232,99,122,0.65);
  }
  .btn-letter-next:active { transform: scale(0.96); }
  .btn-letter-next:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }

  /* Gentle fade for hint text */
  @keyframes gentleFade {
    from { opacity: 0.35; }
    to   { opacity: 0.85; }
  }
  `;
  document.head.appendChild(s);
}
