/**
 * scenes/awards.js — Phase 9: Boyfriend Awards
 *
 * Renders a grid of premium achievement cards loaded from data/awards.js.
 * Hovering/clicking a card triggers a shining animation and a companion reaction.
 */
import { navigateTo } from '../app.js';
import { Companion }  from '../companion.js';
import { awards }     from '../data/awards.js';
import { qs, el, sleep, waitForTransition } from '../utils/dom.js';

let _container = null;
let _root = null;

export async function init(container) {
  _container = container;

  _root = el('section', {
    cls: 'scene scene-awards',
    attrs: { 'aria-label': 'Boyfriend Awards' }
  });

  _root.innerHTML = `
    <!-- Header -->
    <h2 class="display awards-header anim-fade-down" style="--delay: 300ms;">
      The Hall of Fame
    </h2>

    <!-- Scrollable / Grid Container -->
    <div class="awards-grid" id="awards-grid">
      <!-- Cards injected here -->
    </div>

    <!-- Footer CTA -->
    <div class="awards-footer anim-fade-up" style="--delay: 1500ms;">
      <button id="btn-awards-next" class="btn-primary">
        Are you ready for your cake?
      </button>
    </div>

    <!-- Playful reaction GIF for awards -->
    <img id="gif-awards-teaser"
         class="gif-overlay gif-awards-teaser"
         src="gif/hammer-bully.gif"
         alt="Bonk!"
         aria-hidden="true" />
  `;

  // Inject Scene CSS
  if (!document.getElementById('awards-styles')) {
    const style = document.createElement('style');
    style.id = 'awards-styles';
    style.textContent = `
      .scene-awards {
        background: radial-gradient(circle at center, var(--c-dusk) 0%, var(--c-void) 100%);
        padding: 4rem 1rem;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
      }
      .awards-header {
        color: var(--accent-warm);
        font-size: var(--text-3xl);
        text-align: center;
        margin-bottom: 3rem;
        flex-shrink: 0;
      }

      .awards-grid {
        display: flex;
        gap: 1.5rem;
        width: 100%;
        max-width: 1000px;
        overflow-x: auto;
        padding: 1rem 2rem 3rem 2rem;
        /* Hide scrollbar for clean UI */
        scrollbar-width: none;
        -ms-overflow-style: none;
        snap-type: x mandatory;
      }
      .awards-grid::-webkit-scrollbar {
        display: none;
      }

      /* Desktop: wrap them into a grid instead of a row */
      @media (min-width: 800px) {
        .awards-grid {
          flex-wrap: wrap;
          justify-content: center;
          overflow-x: visible;
        }
      }

      /* Premium Card Design */
      .award-card {
        position: relative;
        flex: 0 0 240px;
        height: 340px;
        background: rgba(22, 13, 36, 0.7);
        border: 1px solid var(--accent-warm);
        border-radius: 12px;
        padding: 2rem 1.5rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        cursor: pointer;
        overflow: hidden;
        scroll-snap-align: center;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5), inset 0 0 20px rgba(240, 201, 110, 0.05);
        transition: transform 0.4s var(--ease-spring), box-shadow 0.4s ease;
      }

      /* Metallic Shine Sweep */
      .award-card::before {
        content: '';
        position: absolute;
        top: -100%;
        left: -100%;
        width: 50%;
        height: 300%;
        background: linear-gradient(
          to right,
          rgba(255,255,255,0) 0%,
          rgba(255,255,255,0.15) 50%,
          rgba(255,255,255,0) 100%
        );
        transform: rotate(45deg);
        transition: top 0.6s ease, left 0.6s ease;
        pointer-events: none;
      }

      .award-card:hover {
        transform: translateY(-10px) scale(1.02);
        box-shadow: 0 15px 40px rgba(0,0,0,0.6), 0 0 20px rgba(240, 201, 110, 0.2);
        border-color: #fff;
      }
      .award-card:hover::before {
        top: -50%;
        left: 150%;
      }

      .award-icon {
        font-size: 3.5rem;
        margin-bottom: 1.5rem;
        filter: drop-shadow(0 4px 10px rgba(0,0,0,0.5));
      }
      .award-title {
        font-family: var(--font-display);
        color: var(--c-cream);
        font-size: var(--text-lg);
        line-height: 1.2;
        margin-bottom: 1rem;
      }
      .award-desc {
        font-size: var(--text-sm);
        color: var(--text-subtle);
        line-height: 1.5;
      }

      .awards-footer {
        margin-top: auto;
        padding-top: 2rem;
        display: flex;
        justify-content: center;
        width: 100%;
      }
    `;
    document.head.appendChild(style);
  }

  const grid = qs('#awards-grid', _root);

  // Inject cards dynamically from data
  awards.forEach((award, index) => {
    const card = el('div', {
      cls: 'award-card anim-scale-in',
      html: `
        <div class="award-icon">${award.icon}</div>
        <h3 class="award-title">${award.title}</h3>
        <p class="award-desc">${award.description}</p>
      `
    });

    // Staggered entry animation based on index
    card.style.setProperty('--delay', `${600 + (index * 150)}ms`);

    // Wire up interaction
    card.addEventListener('click', () => _handleAwardClick(award));

    grid.appendChild(card);
  });

  qs('#btn-awards-next', _root).addEventListener('click', _handleNextPhase);

  _container.appendChild(_root);
}

export async function enter() {
  _root.classList.add('is-active');

  await sleep(1500);
  Companion.show();
  Companion.react('celebrating', "Look at all these! You're famous! 🏆", 4000);
}

export async function exit() {
  _root.classList.remove('is-active');
  return waitForTransition(_root);
}

export function destroy() {
  _root?.remove();
  _root = null;
  _container = null;
}

// ── Private ──

function _handleAwardClick(award) {
  // Simple heuristic based on the data to decide Companion reaction
  let state = 'idle';
  let message = '';

  if (award.id.includes('hug') || award.id.includes('best')) {
    state = 'romantic';
    message = "Okay, this one is 100% accurate. 💖";
  } else {
    state = 'surprised';
    message = `The "${award.title}" award? I demand a recount.`;
    if (award.id === 'professional-teaser') {
      const gifTeaser = qs('#gif-awards-teaser', _root);
      if (gifTeaser) {
        gifTeaser.classList.add('is-visible');
        setTimeout(() => gifTeaser.classList.remove('is-visible'), 3500);
      }
    }
  }

  Companion.react(state, message, 3500);
}

function _handleNextPhase() {
  // Route to Interactive Cake
  navigateTo(() => import('./cake.js'), { type: 'fade', duration: 1200 });
}
