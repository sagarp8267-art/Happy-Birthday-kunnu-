/**
 * transitions.js — Central Scene Transition Manager
 *
 * All scene changes route through here to guarantee:
 *   1. The current scene exits cleanly.
 *   2. A transition overlay plays.
 *   3. The new scene enters.
 *
 * Scene contract: every scene module must export { init, enter, exit, destroy }.
 */

import { getState, setState } from './state.js';

/** @type {HTMLElement} */
const overlay = document.getElementById('transition-overlay');

/** Default transition duration in ms */
const DEFAULT_DURATION = 600;

/**
 * Transition from the current active scene to a new one.
 *
 * @param {SceneModule}  nextScene    - The scene module to activate.
 * @param {HTMLElement}  container    - The scene container element.
 * @param {SceneModule|null} currentSceneModule - Currently active scene (or null).
 * @param {TransitionOptions} [opts]  - Optional overrides.
 * @returns {Promise<void>}
 */
export async function transitionTo(nextScene, container, currentSceneModule, opts = {}) {
  const state = getState();

  if (state.isTransitioning) {
    console.warn('[transitions] Transition already in progress — ignoring.');
    return;
  }

  setState({ isTransitioning: true });

  const duration = opts.duration ?? DEFAULT_DURATION;
  const type     = opts.type     ?? 'fade';       // 'fade' | 'dissolve' | 'instant'

  try {
    // ── 1. Fade overlay IN ──────────────────────────────────
    await _overlayIn(duration / 2, type);

    // ── 2. Exit current scene ───────────────────────────────
    if (currentSceneModule?.exit) {
      await currentSceneModule.exit();
    }

    // ── 3. Detach old scene DOM if using full destroy ───────
    if (opts.destroyCurrent && currentSceneModule?.destroy) {
      currentSceneModule.destroy();
    }

    // ── 4. Mount the next scene ─────────────────────────────
    if (nextScene.init) {
      await nextScene.init(container);
    }

    // ── 5. Fade overlay OUT ─────────────────────────────────
    await _overlayOut(duration / 2);

    // ── 6. Enter the next scene ─────────────────────────────
    if (nextScene.enter) {
      await nextScene.enter();
    }

  } catch (err) {
    console.error('[transitions] Error during transition:', err);
    // Ensure overlay is always cleaned up
    overlay.style.opacity = '0';
    overlay.classList.remove('is-active');
  } finally {
    setState({ isTransitioning: false });
  }
}

/**
 * Quick crossfade between two DOM elements (for in-scene transitions).
 *
 * @param {HTMLElement} outEl - Element to fade out.
 * @param {HTMLElement} inEl  - Element to fade in.
 * @param {number} [ms=400]   - Duration in ms.
 */
export function crossfade(outEl, inEl, ms = 400) {
  return new Promise(resolve => {
    outEl.style.transition = `opacity ${ms}ms ease`;
    inEl.style.transition  = `opacity ${ms}ms ease`;
    inEl.style.opacity = '0';
    inEl.style.display = '';

    outEl.style.opacity = '0';

    setTimeout(() => {
      outEl.style.display = 'none';
      inEl.style.opacity  = '1';
      setTimeout(resolve, ms);
    }, ms);
  });
}

/**
 * Animate a value from start to end over `duration` ms.
 * Useful for smooth numeric transitions outside CSS.
 *
 * @param {number}   from
 * @param {number}   to
 * @param {number}   duration
 * @param {Function} onUpdate - Called with current value each frame.
 * @returns {Promise<void>}
 */
export function animateValue(from, to, duration, onUpdate) {
  return new Promise(resolve => {
    const start = performance.now();
    const range = to - from;

    function tick(now) {
      const elapsed  = Math.min(now - start, duration);
      const progress = elapsed / duration;
      // Ease out cubic
      const eased    = 1 - Math.pow(1 - progress, 3);
      onUpdate(from + range * eased);

      if (elapsed < duration) {
        requestAnimationFrame(tick);
      } else {
        onUpdate(to);
        resolve();
      }
    }

    requestAnimationFrame(tick);
  });
}

/* ── Private helpers ────────────────────────────────────────── */

function _overlayIn(ms, type) {
  return new Promise(resolve => {
    if (type === 'instant') { overlay.style.opacity = '1'; return resolve(); }
    overlay.classList.add('is-active');
    overlay.style.transition = `opacity ${ms}ms ease`;
    // Force reflow
    void overlay.offsetHeight;
    overlay.style.opacity = '1';
    setTimeout(resolve, ms);
  });
}

function _overlayOut(ms) {
  return new Promise(resolve => {
    overlay.style.transition = `opacity ${ms}ms ease`;
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.classList.remove('is-active');
      resolve();
    }, ms);
  });
}

/**
 * @typedef {object} TransitionOptions
 * @property {number}  [duration]       - Total transition duration in ms.
 * @property {string}  [type]           - 'fade' | 'dissolve' | 'instant'.
 * @property {boolean} [destroyCurrent] - Call destroy() on the outgoing scene.
 *
 * @typedef {object} SceneModule
 * @property {Function} [init]    - (container: HTMLElement) => Promise<void>
 * @property {Function} [enter]   - () => Promise<void>
 * @property {Function} [exit]    - () => Promise<void>
 * @property {Function} [destroy] - () => void
 */
