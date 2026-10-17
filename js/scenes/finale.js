/**
 * scenes/finale.js — Phase 8: Final Cinematic Letter
 *
 * Split-screen layout:
 *   LEFT  — Final letter text revealed word-by-word.
 *   RIGHT — Two framed photos (emoji placeholders until real images are added).
 *
 * Ends with a "Reply 💌" button that opens a mailto link.
 * Continuous gentle particle celebration in the background.
 *
 * Dependencies: GSAP (Phase 1 import map), Companion, Particles
 */

import gsap          from 'gsap';
import { Companion } from '../companion.js';
import { Particles } from '../utils/particles.js';
import { sleep }     from '../utils/dom.js';

// ─── Config — edit freely ──────────────────────────────────────────────────

/**
 * The final letter sentences.
 * Each string is one line, revealed word-by-word.
 */
const FINAL_LETTER = [
  " My favourite person, you came into my life and made ordinary moments feel magical. ❤️",
"Your smile is one of those little things that can make even my worst days better. 🫶",
"If you could see yourself through my eyes, you'd understand how incredibly special you are to me. 💗",
"I wish your life is always filled with happiness, endless love, and beautiful surprises. 🌙",
"No matter how difficult life gets, I hope you always find a reason to smile. 🤍",
"And I hope we keep making silly memories, sharing laughter, and annoying each other forever. 🥹💕",
"You deserve all the beautiful things this universe has to offer, today and every day. 🌹",
  "Happy Birthday. 🌸",
];

/**
 * Right-side photos. Replace `emoji` with `src: 'assets/images/photo.jpg'`
 * once real images are ready — the HTML builder handles both.
 */
const SIDE_PHOTOS = [
  { src: 'gif/final suprise .gif', caption: 'A favourite moment' },
  { src: 'gif/final suprise.gif',  caption: 'Always & forever'   },
];

/**
 * Reply button — opens mailto with a pre-filled subject.
 * Change the email address below.
 */
const REPLY_EMAIL   = 'her@example.com';
const REPLY_SUBJECT = 'Re: Happy Birthday 💌';

// ─── Module state ──────────────────────────────────────────────────────────

let _container    = null;
let _root         = null;
let _loopInterval = null;
let _isDestroyed  = false;

// ─── Public API ────────────────────────────────────────────────────────────

export async function init(container) {
  _container   = container;
  _isDestroyed = false;

  _root = document.createElement('section');
  _root.className = 'scene scene-finale';
  _root.setAttribute('aria-label', 'Final letter');

  _root.innerHTML = _buildHTML();
  _injectStyles();

  _root.querySelector('#btn-reply')
    ?.addEventListener('click', _handleReply);

  _container.appendChild(_root);
}

export async function enter() {
  _root.classList.add('is-active');

  // Finale music
  import('../audio.js').then(({ AudioManager }) => {
    AudioManager.playMusic('assets/audio/bgm-finale.mp3', true, 0.55);
  }).catch(() => {});

  // Initial celebration burst
  await sleep(400);
  Particles.burst({ count: 80, spread: 2.5 });
  Particles.rain(30);

  // Companion final sign-off — positioned bottom-right default
  Companion.show();
  Companion.setState('romantic');

  // ── Animate the split layout in ────────────────────────────────────────────

  const leftPane  = _root.querySelector('.finale-left');
  const rightPane = _root.querySelector('.finale-right');
  const bg        = _root.querySelector('.finale-bg');

  // Background warm glow pulses in
  gsap.to(bg, { opacity: 1, duration: 2.5, ease: 'power2.out' });

  // Left pane slides in from left
  gsap.fromTo(leftPane,
    { x: -60, opacity: 0 },
    { x:  0,  opacity: 1, duration: 1.0, delay: 0.3, ease: 'power3.out' }
  );

  // Right pane slides in from right
  gsap.fromTo(rightPane,
    { x: 60,  opacity: 0 },
    { x:  0,  opacity: 1, duration: 1.0, delay: 0.5, ease: 'power3.out' }
  );

  await sleep(1200);

  // ── Photo frames spring in ─────────────────────────────────────────────────
  const frames = Array.from(_root.querySelectorAll('.finale-photo-frame'));
  frames.forEach((f, i) => {
    gsap.fromTo(f,
      { scale: 0.6, opacity: 0, y: 30 },
      { scale: 1,   opacity: 1, y:  0,
        duration: 0.75,
        delay:    i * 0.35,
        ease:     'back.out(1.5)',
      }
    );
  });

  await sleep(800);

  // ── Word-by-word letter reveal ─────────────────────────────────────────────
  const lines = Array.from(_root.querySelectorAll('.finale-line'));
  for (const line of lines) {
    if (_isDestroyed) return;
    const words = Array.from(line.querySelectorAll('.fword'));
    for (const w of words) {
      if (_isDestroyed) return;
      gsap.to(w, {
        opacity:  1,
        y:        0,
        filter:   'blur(0px)',
        duration: 0.48,
        ease:     'power2.out',
      });
      await sleep(105);
    }
    await sleep(300);
  }

  await sleep(700);

  // ── Reply button springs in ────────────────────────────────────────────────
  const btn = _root.querySelector('#btn-reply');
  gsap.to(btn, {
    opacity:       1,
    y:             0,
    pointerEvents: 'auto',
    duration:      0.8,
    ease:          'back.out(1.6)',
  });

  // Companion final message
  await sleep(500);
  Companion.say('Thanks for going through this with me. 🌟', 6000);

  // ── Continuous gentle celebration loop ────────────────────────────────────
  _loopInterval = setInterval(() => {
    if (_isDestroyed) return;
    if (Math.random() > 0.45) {
      Particles.burst({
        count:  35,
        spread: 1.8,
        x:      0.15 + Math.random() * 0.7,
        y:      0.85,
      });
    }
  }, 4500);
}

export async function exit() {
  if (_loopInterval) { clearInterval(_loopInterval); _loopInterval = null; }
  Particles.stop();
  gsap.killTweensOf('*');
  _root.classList.remove('is-active');
  await new Promise(r =>
    gsap.to(_root, { opacity: 0, duration: 0.6, ease: 'power2.in', onComplete: r })
  );
}

export function destroy() {
  if (_loopInterval) { clearInterval(_loopInterval); _loopInterval = null; }
  Particles.stop();
  gsap.killTweensOf('*');
  _root?.remove();
  _root        = null;
  _container   = null;
  _isDestroyed = true;
}

// ─── Reply handler ─────────────────────────────────────────────────────────

function _handleReply() {
  const subject = encodeURIComponent(REPLY_SUBJECT);
  window.open(`mailto:${REPLY_EMAIL}?subject=${subject}`, '_blank');

  // Little celebration on reply tap
  Particles.burst({ x: 0.5, y: 0.5, count: 60, spread: 1.5 });
  Companion.react('celebrating', 'She clicked Reply! 💌🎉', 4000);
}

// ─── HTML builder ───────────────────────────────────────────────────────────

function _buildHTML() {
  // Wrap each line + each word for GSAP word-by-word
  const letterHTML = FINAL_LETTER.map(line => {
    const words = line.split(' ').map(w =>
      `<span class="fword">${w}</span>`
    ).join(' ');
    return `<span class="finale-line">${words}</span>`;
  }).join('');

  // Photo frames
  const photosHTML = SIDE_PHOTOS.map((p, i) => {
    const inner = p.src
      ? `<img src="${p.src}" alt="${p.caption}" class="finale-photo-img" loading="eager" />`
      : `<div class="finale-photo-placeholder">${p.emoji}</div>`;
    return `
    <div class="finale-photo-frame" style="--tilt:${i === 0 ? '-3deg' : '4deg'}">
      ${inner}
      <p class="finale-photo-caption">${p.caption}</p>
    </div>`;
  }).join('');

  return `
  <!-- ── Background warm glow ── -->
  <div class="finale-bg" aria-hidden="true"></div>

  <!-- ── Split layout ── -->
  <div class="finale-split">

    <!-- LEFT: letter -->
    <div class="finale-left" aria-label="Final letter">
      <div class="finale-letter-card">
        <div class="finale-salutation">Dear Kunnu,</div>
        <div class="finale-letter-body">
          ${letterHTML}
        </div>
        <div class="finale-signature">
          — With everything I have 🌸
        </div>
      </div>

      <!-- Reply CTA -->
      <button id="btn-reply" class="btn-reply"
              style="opacity:0; pointer-events:none; transform:translateY(14px)"
              aria-label="Reply to this letter">
        Reply 💌
      </button>
    </div>

    <!-- RIGHT: two photos -->
    <div class="finale-right" aria-label="Favourite photos">
      ${photosHTML}
    </div>

  </div>
  `;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function _injectStyles() {
  if (document.getElementById('finale-styles')) return;
  const s = document.createElement('style');
  s.id = 'finale-styles';
  s.textContent = `
  /* ── Scene ── */
  .scene-finale {
    background: var(--c-void);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    min-height: 100vh;
    min-height: 100dvh;
    padding: clamp(1rem, 2.5vw, 2rem) 0;
    box-sizing: border-box;
  }

  /* ── Background glow ── */
  .finale-bg {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse at 30% 60%, rgba(99,35,53,0.55) 0%, transparent 60%),
      radial-gradient(ellipse at 75% 40%, rgba(50,20,80,0.40) 0%, transparent 55%);
    opacity: 0;
    z-index: 0;
    pointer-events: none;
  }

  /* ── Split layout ── */
  .finale-split {
    position: relative;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(1.5rem, 3.5vw, 3.5rem);
    width: 100%;
    max-width: 1060px;
    padding: clamp(1rem, 3vw, 2.5rem);
    box-sizing: border-box;
  }

  /* ── LEFT pane ── */
  .finale-left {
    flex: 1 1 0;
    min-width: 0;
    max-width: 580px;
    display: flex;
    flex-direction: column;
    gap: clamp(1rem, 2vw, 1.5rem);
    align-items: flex-start;
    box-sizing: border-box;
  }

  /* Glassmorphism letter card */
  .finale-letter-card {
    background: rgba(12, 7, 22, 0.72);
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    border: 1px solid rgba(242, 160, 174, 0.22);
    border-radius: 20px;
    padding: clamp(1.25rem, 2.8vw, 2.2rem) clamp(1.2rem, 2.5vw, 2rem);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    gap: clamp(0.75rem, 1.4vw, 1.2rem);
    width: 100%;
    box-sizing: border-box;
    overflow: hidden;
  }

  .finale-salutation {
    font-family: var(--font-display);
    font-size: clamp(1.2rem, 2vw, 1.45rem);
    color: var(--accent-soft);
    font-style: italic;
    font-weight: 300;
    line-height: 1.25;
  }

  /* Letter body — stacked lines */
  .finale-letter-body {
    display: flex;
    flex-direction: column;
    gap: clamp(0.25rem, 0.6vw, 0.45rem);
    width: 100%;
    box-sizing: border-box;
  }

  .finale-line {
    display: block;
    font-family: var(--font-display);
    font-size: clamp(0.92rem, 1.35vw, 1.12rem);
    color: var(--text-primary);
    line-height: 1.48;
    font-weight: 300;
    overflow-wrap: break-word;
    word-break: normal;
    letter-spacing: 0.012em;
  }

  /* ── Word spans (GSAP controlled) ── */
  .fword {
    display: inline-block;
    opacity: 0;
    filter: blur(5px);
    transform: translateY(6px);
    white-space: pre-wrap;
  }

  .finale-signature {
    font-family: var(--font-display);
    font-size: clamp(0.9rem, 1.3vw, 1.05rem);
    color: var(--text-subtle);
    font-style: italic;
    margin-top: 0.35rem;
    line-height: 1.3;
  }

  /* ── Reply button ── */
  .btn-reply {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--accent);
    color: var(--bg-base);
    font-family: var(--font-body);
    font-size: var(--text-base);
    font-weight: 500;
    padding: 0.9rem 2.6rem;
    border: none;
    border-radius: 40px;
    cursor: pointer;
    box-shadow: 0 4px 24px rgba(232,99,122,0.5);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    align-self: flex-start;
  }
  .btn-reply:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(232,99,122,0.65);
  }
  .btn-reply:active { transform: scale(0.96); }
  .btn-reply:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }

  /* ── RIGHT pane ── */
  .finale-right {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: clamp(1rem, 2.2vw, 2rem);
    align-items: center;
  }

  /* ── Photo frames ── */
  .finale-photo-frame {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    transform: rotate(var(--tilt, 0deg));
    filter: drop-shadow(0 14px 28px rgba(0,0,0,0.65));
    opacity: 0;
  }

  .finale-photo-placeholder {
    width: clamp(130px, 15vw, 190px);
    height: clamp(150px, 18vw, 225px);
    background: linear-gradient(145deg, #1a0a28, #0a0612);
    border: 5px solid #fdf6ef;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: clamp(2.5rem, 4.5vw, 4rem);
    box-shadow:
      inset 0 0 25px rgba(0,0,0,0.4),
      0 3px 0 #e0d0c0;
  }

  .finale-photo-img {
    width: clamp(130px, 15vw, 190px);
    height: clamp(150px, 18vw, 225px);
    object-fit: cover;
    border: 5px solid #fdf6ef;
    border-radius: 4px;
    display: block;
    box-shadow: 0 3px 0 #e0d0c0;
  }

  .finale-photo-caption {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    color: var(--text-subtle);
    font-style: italic;
    text-align: center;
    max-width: none;
  }

  /* ── Responsive: stack vertically on narrow screens ── */
  @media (max-width: 768px) {
    .scene-finale {
      padding: 1.5rem 0.75rem;
      align-items: flex-start;
    }
    .finale-split {
      flex-direction: column;
      align-items: center;
      gap: 1.75rem;
      padding: 0;
      min-height: auto;
    }
    .finale-left {
      width: 100%;
      max-width: 500px;
      align-items: center;
      gap: 1.25rem;
    }
    .finale-letter-card {
      padding: 1.25rem 1.1rem;
      border-radius: 18px;
    }
    .finale-line {
      font-size: clamp(0.9rem, 3.8vw, 1.05rem);
      line-height: 1.45;
    }
    .finale-right {
      flex-direction: row;
      justify-content: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .finale-photo-placeholder,
    .finale-photo-img {
      width: clamp(110px, 34vw, 140px);
      height: clamp(130px, 40vw, 165px);
      font-size: 2.2rem;
    }
    .btn-reply {
      align-self: center;
    }
  }
  `;
  document.head.appendChild(s);
}
