/**
 * scenes/future.js — Phase 12: Future Together
 *
 * An interactive, gradient-shifting scene where the user
 * selects 4 future locations, each revealing romantic text
 * and changing the environmental lighting (CSS gradients).
 */
import { navigateTo } from '../app.js';
import { Companion }  from '../companion.js';
import { qs, qsa, el, sleep, waitForTransition } from '../utils/dom.js';

let _container = null;
let _root = null;

// Track visited locations to unlock the final button
const _visited = new Set();

const LOCATIONS = [
  {
    id: 'beach',
    label: 'A Quiet Beach',
    background: 'linear-gradient(to bottom, #d38d7b 0%, #e0baa6 50%, var(--c-dusk) 100%)',
    text: "I want to walk with you by the water until the sun disappears, talking about everything and nothing.",
    companionState: 'idle',
    companionTalk: "Sand everywhere. So much sand."
  },
  {
    id: 'mountains',
    label: 'A Cabin in the Mountains',
    background: 'linear-gradient(to bottom, #4a6670 0%, #7d969c 50%, var(--c-dusk) 100%)',
    text: "Just the two of us, a fireplace, and nowhere we need to be.",
    companionState: 'romantic',
    companionTalk: "As long as there's wifi, I'm in."
  },
  {
    id: 'city',
    label: 'The City at Night',
    background: 'radial-gradient(circle at center, #6b2d5c 0%, var(--c-dusk) 60%, var(--c-void) 100%)',
    text: "Lost in a crowd, holding your hand, feeling like we're the only two people that exist.",
    companionState: 'surprised',
    companionTalk: "I hear the pizza here is amazing."
  },
  {
    id: 'stars',
    label: 'Under the Stars',
    background: 'radial-gradient(circle at top right, #1f2e4a 0%, var(--c-void) 100%)',
    text: "Laying back, looking up at the universe, knowing I already found my entire world.",
    companionState: 'romantic',
    companionTalk: "Okay, that was extremely smooth. 💖"
  }
];

export async function init(container) {
  _container = container;
  _visited.clear();

  _root = el('section', {
    cls: 'scene scene-future',
    attrs: { 'aria-label': 'Our Future Together' }
  });

  // Build the selector interface
  const buttonsHtml = LOCATIONS.map(loc => `
    <button class="loc-btn" data-id="${loc.id}">
      ${loc.label}
    </button>
  `).join('');

  _root.innerHTML = `
    <!-- Dynamic background layer -->
    <div class="future-bg" id="future-bg"></div>
    <div class="stars-bg" id="stars-bg"></div>

    <div class="future-layout">
      <!-- Title -->
      <h2 class="display future-title anim-fade-down" style="--delay: 400ms;">
        Where are we going next?
      </h2>

      <!-- Navigation Grid -->
      <div class="future-nav anim-fade-up" style="--delay: 800ms;">
        ${buttonsHtml}
      </div>

      <!-- Text Reveal Area -->
      <div class="future-text-container" id="future-text-container">
        <!-- Text injected dynamically -->
      </div>

      <button id="btn-future-next" class="btn-primary" style="opacity: 0; pointer-events: none; margin-top: auto; z-index: 10;">
        But right now...
      </button>
    </div>
  `;

  if (!document.getElementById('future-styles')) {
    const style = document.createElement('style');
    style.id = 'future-styles';
    style.textContent = `
      .scene-future {
        background: var(--c-void);
        color: var(--text-primary);
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .future-bg {
        position: absolute;
        inset: 0;
        z-index: 0;
        background: var(--c-void);
        opacity: 0;
        transition: opacity 1.5s ease, background 1.5s ease;
      }
      .stars-bg {
        position: absolute;
        inset: 0;
        z-index: 1;
        opacity: 0;
        transition: opacity 1.5s ease;
        pointer-events: none;
      }
      .future-layout {
        position: relative;
        z-index: 10;
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        max-width: 800px;
        height: 100%;
        padding: 4rem 1.5rem 3rem 1.5rem;
      }
      .future-title {
        font-size: var(--text-3xl);
        text-align: center;
        margin-bottom: 3rem;
        color: var(--text-primary);
        text-shadow: 0 4px 10px rgba(0,0,0,0.5);
      }
      .future-nav {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        justify-content: center;
        margin-bottom: 3rem;
      }
      .loc-btn {
        background: rgba(255,255,255,0.05);
        border: 1px solid var(--border-subtle);
        color: var(--text-primary);
        font-family: var(--font-body);
        font-size: var(--text-sm);
        padding: 0.8rem 1.5rem;
        border-radius: 20px;
        cursor: pointer;
        backdrop-filter: blur(4px);
        transition: all 0.3s ease;
      }
      .loc-btn:hover, .loc-btn.is-active {
        background: rgba(255,255,255,0.15);
        border-color: var(--accent-warm);
        transform: translateY(-2px);
      }
      .loc-btn.is-visited {
        opacity: 0.6;
      }
      .loc-btn.is-active {
        opacity: 1;
        box-shadow: 0 0 15px rgba(240, 201, 110, 0.2);
      }

      .future-text-container {
        flex-grow: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        min-height: 150px;
      }
      .future-text {
        font-family: var(--font-display);
        font-size: var(--text-2xl);
        line-height: 1.4;
        text-shadow: 0 4px 15px rgba(0,0,0,0.8);
      }
    `;
    document.head.appendChild(style);
  }

  // Bind Location buttons
  qsa('.loc-btn', _root).forEach(btn => {
    btn.addEventListener('click', (e) => _handleLocationClick(e.currentTarget));
  });

  // Bind Next Button
  qs('#btn-future-next', _root).addEventListener('click', _handleNextPhase);

  // Generate CSS Stars (only visible when in 'stars' location)
  _buildStars();

  _container.appendChild(_root);
}

export async function enter() {
  _root.classList.add('is-active');

  await sleep(1000);
  Companion.show();
  Companion.setState('idle');
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

async function _handleLocationClick(btn) {
  const id = btn.dataset.id;
  const data = LOCATIONS.find(l => l.id === id);
  if (!data) return;

  // Update button states
  qsa('.loc-btn', _root).forEach(b => b.classList.remove('is-active'));
  btn.classList.add('is-active');
  btn.classList.add('is-visited');

  _visited.add(id);

  // 1. Shift Background Env
  const bg = qs('#future-bg', _root);
  bg.style.opacity = '0';
  await sleep(400); // Wait for dissolve
  bg.style.background = data.background;
  bg.style.opacity = '1';

  // Toggle Stars
  const starsBg = qs('#stars-bg', _root);
  starsBg.style.opacity = id === 'stars' ? '1' : '0';

  // 2. Animate Text In
  const container = qs('#future-text-container', _root);
  // hide old text
  const oldText = qs('.future-text', container);
  if (oldText) {
    oldText.classList.remove('anim-fade-up');
    oldText.style.opacity = '0';
    await sleep(300);
    container.innerHTML = '';
  }

  const newText = el('p', { cls: 'future-text anim-fade-up', text: data.text });
  container.appendChild(newText);

  // 3. Trigger Companion
  Companion.react(data.companionState, data.companionTalk, 4000);

  // 4. Check completion
  if (_visited.size === LOCATIONS.length) {
    const nextBtn = qs('#btn-future-next', _root);
    nextBtn.style.opacity = '1';
    nextBtn.style.pointerEvents = 'auto';
    nextBtn.style.transition = 'opacity 1s ease 2s'; // delay appearance slightly
  }
}

function _buildStars() {
  const starsEl = qs('#stars-bg', _root);

  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 40; i++) {
    const star = document.createElement('span');
    const size = Math.random() * 2 + 1;
    Object.assign(star.style, {
      position: 'absolute',
      left:     `${Math.random() * 100}%`,
      top:      `${Math.random() * 100}%`,
      width:    `${size}px`,
      height:   `${size}px`,
      borderRadius: '50%',
      background: `rgba(255,255,255,${0.3 + Math.random() * 0.7})`,
      animation: `twinkle ${2 + Math.random() * 2}s ease ${Math.random() * 3}s infinite`,
    });
    fragment.appendChild(star);
  }
  starsEl.appendChild(fragment);
}

function _handleNextPhase() {
  navigateTo(() => import('./final_surprise.js'), { type: 'dissolve', duration: 1500 });
}
