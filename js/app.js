/**
 * app.js — Application Entry Point
 *
 * Bootstraps the modular architecture:
 *   1. Init core systems (state, audio, companion).
 *   2. Wire UI controls (mute button, volume slider).
 *   3. Load and launch the first scene.
 *   4. Remove the loading screen.
 *
 * Scene routing lives here — import each scene module as needed.
 */

import { getState, setState } from './state.js';
import { AudioManager }       from './audio.js';
import { Companion }           from './companion.js';
// Scene modules imported per-phase as they are built:
// import * as PasswordScene from './scenes/password.js';
// import { transitionTo }   from './transitions.js';

/* ── DOM References ─────────────────────────────────────────── */
const loadingScreen   = document.getElementById('loading-screen');
const sceneContainer  = document.getElementById('scene-container');
const btnMute         = document.getElementById('btn-mute');
const volumeSlider    = document.getElementById('volume-slider');

/** Currently active scene module (@type {SceneModule|null}) */
let _activeScene = null;

/* ── Bootstrap ──────────────────────────────────────────────── */
async function bootstrap() {
  try {
    // 1. Initialise companion
    Companion.init();

    // 2. Wire audio UI
    _wireAudioControls();

    // 3. Sync reduced-motion preference to state
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setState({ prefs: { reducedMotion: mq.matches } }, true);
    mq.addEventListener('change', e => {
      setState({ prefs: { reducedMotion: e.matches } }, true);
    });

    // 4. Launch the first scene (Phase 1 — Password)
    navigateTo(() => import('./scenes/password.js'), { type: 'fade', duration: 1000 });

    // 5. Hide loading screen
    loadingScreen.classList.add('is-hidden');
    setTimeout(() => { loadingScreen.style.display = 'none'; }, 700);

  } catch (err) {
    console.error('[app] Bootstrap error:', err);
  }
}

/* ── Audio UI Wiring ────────────────────────────────────────── */
function _wireAudioControls() {
  const iconOn  = btnMute?.querySelector('.audio-icon--on');
  const iconOff = btnMute?.querySelector('.audio-icon--off');

  btnMute?.addEventListener('click', () => {
    AudioManager.toggleMute();
    const { isMuted } = getState();
    iconOn?.toggleAttribute('hidden', isMuted);
    iconOff?.toggleAttribute('hidden', !isMuted);
    btnMute.setAttribute('aria-label', isMuted ? 'Unmute' : 'Mute');
  });

  volumeSlider?.addEventListener('input', (e) => {
    AudioManager.setVolume(Number(e.target.value));
  });
}

/* ── Placeholder (Phase 0 only) ─────────────────────────────── */
/**
 * Renders a placeholder in the scene container so Phase 0 is
 * visually verifiable. Replaced entirely in Phase 1 by the
 * password scene module.
 */
function _showPlaceholder() {
  sceneContainer.innerHTML = `
    <section class="scene is-active" style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
      padding: 2rem;
    " aria-label="Set up placeholder">
      <div style="
        font-family: var(--font-display);
        font-size: var(--text-3xl);
        font-weight: 300;
        color: var(--accent);
        letter-spacing: -0.01em;
        text-align: center;
        animation: fadeUp 1s ease both;
      ">Birthday Surprise</div>
      <p style="
        font-family: var(--font-body);
        font-size: var(--text-sm);
        color: var(--text-subtle);
        text-align: center;
        animation: fadeUp 1s ease 0.2s both;
        max-width: 42ch;
        letter-spacing: 0.04em;
        text-transform: none;
      ">Phase 0 — Architecture ready.<br>Scenes load here from Phase 1 onward.</p>

      <!-- Particle starfield -->
      <div class="stars" aria-hidden="true"></div>
    </section>
  `;

  _buildStarfield();
}

/** Generate a simple CSS starfield to verify animation pipeline. */
function _buildStarfield() {
  const starsEl = sceneContainer.querySelector('.stars');
  if (!starsEl) return;

  Object.assign(starsEl.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '-1',
  });

  const count = getState().prefs.reducedMotion ? 0 : 60;
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const star = document.createElement('span');
    const size = Math.random() * 2 + 1;
    Object.assign(star.style, {
      position: 'absolute',
      left:     `${Math.random() * 100}%`,
      top:      `${Math.random() * 100}%`,
      width:    `${size}px`,
      height:   `${size}px`,
      borderRadius: '50%',
      background: `rgba(255,255,255,${0.2 + Math.random() * 0.6})`,
      animation: `twinkle ${1.5 + Math.random() * 2}s ease ${Math.random() * 3}s infinite`,
    });
    fragment.appendChild(star);
  }

  starsEl.appendChild(fragment);
}

/* ── Scene Navigation API ───────────────────────────────────── */
/**
 * Navigate to a new scene module.
 * Scenes are lazy-imported — only loaded when needed.
 *
 * @param {() => Promise<SceneModule>} sceneLoader - Dynamic import function.
 * @param {TransitionOptions} [opts]
 */
export async function navigateTo(sceneLoader, opts = {}) {
  const { transitionTo } = await import('./transitions.js');
  const nextScene = await sceneLoader();
  await transitionTo(nextScene, sceneContainer, _activeScene, opts);
  _activeScene = nextScene;
}

/* ── Start ──────────────────────────────────────────────────── */
bootstrap();
