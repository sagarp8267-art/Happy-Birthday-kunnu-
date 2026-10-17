/**
 * scenes/_template.js — Scene Module Template
 *
 * Copy this file when creating a new scene.
 * Every scene must implement all four lifecycle methods.
 *
 * Scene contract (from architecture.md):
 *   init(container)  — Mount DOM, set up listeners. Called once before enter().
 *   enter()          — Animate in, start timers, play audio.
 *   exit()           — Animate out. Resolve when safe to transition away.
 *   destroy()        — Remove DOM, cancel timers, clean up listeners.
 */

// import { getState, setState } from '../state.js';
// import { Companion }          from '../companion.js';
// import { AudioManager }       from '../audio.js';

/** @type {HTMLElement|null} */
let _container = null;

/** @type {HTMLElement|null} */
let _root = null;

/** Scene name for debugging */
const SCENE_NAME = 'Template';

/**
 * Mount the scene into the container.
 * @param {HTMLElement} container
 */
export async function init(container) {
  _container = container;

  _root = document.createElement('section');
  _root.className = 'scene';
  _root.setAttribute('aria-label', `${SCENE_NAME} scene`);
  _root.innerHTML = `
    <!-- Scene content goes here -->
    <p class="display" style="font-size: var(--text-2xl); color: var(--accent);">
      ${SCENE_NAME}
    </p>
  `;

  _container.appendChild(_root);
}

/**
 * Animate the scene in.
 * Resolves when the enter animation is complete.
 */
export async function enter() {
  // Small tick to allow paint before animating
  await _nextFrame();

  _root.classList.add('is-active');

  // Example: companion reacts
  // Companion.show();
  // Companion.setState('idle');

  // Example: play music
  // AudioManager.playMusic('assets/audio/scene-music.mp3');

  return _waitForTransition(_root);
}

/**
 * Animate the scene out.
 * Resolves when it is safe for the transition overlay to reveal the next scene.
 */
export async function exit() {
  _root.classList.remove('is-active');
  return _waitForTransition(_root);
}

/**
 * Tear down the scene completely.
 * Called only when `destroyCurrent: true` is passed to transitionTo().
 */
export function destroy() {
  _root?.remove();
  _root      = null;
  _container = null;
}

/* ── Private helpers ────────────────────────────────────────── */

function _nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function _waitForTransition(el) {
  return new Promise(resolve => {
    const onEnd = () => {
      el.removeEventListener('transitionend', onEnd);
      resolve();
    };
    el.addEventListener('transitionend', onEnd);
    // Fallback if no transition is set
    setTimeout(resolve, 800);
  });
}
