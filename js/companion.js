/**
 * companion.js — Recurring Companion System
 *
 * The companion is a non-blocking, context-aware character that
 * appears throughout the experience with funny and romantic reactions.
 *
 * States: idle | dancing | gaming | sleeping | eating |
 *         celebrating | romantic | surprised | cakeReaction | finale
 *
 * Usage:
 *   import { Companion } from './companion.js';
 *   Companion.init();
 *   Companion.show();
 *   Companion.setState('celebrating');
 *   Companion.say('Happy Birthday! 🎂', 3000);
 *   Companion.hide();
 */

import { setState as setAppState, onStateChange } from './state.js';

/** @type {HTMLElement} */
let _el = null;

/** @type {HTMLElement} */
let _body = null;

/** @type {HTMLElement} */
let _bubble = null;

/** @type {ReturnType<typeof setTimeout>|null} */
let _bubbleTimer = null;

/** @type {string} */
let _currentState = 'idle';

/**
 * Companion visual definitions per state.
 * In production, these will reference sprite frames / SVG characters.
 * For Phase 0, they use emoji placeholders that communicate intent clearly.
 *
 * @type {Record<string, { emoji: string; animClass: string; label: string }>}
 */
const STATES = {
  idle:          { emoji: '🐾', animClass: 'anim-companion-idle',      label: 'Your companion is here'    },
  dancing:       { emoji: '💃', animClass: 'anim-companion-celebrate', label: 'Companion is dancing'       },
  gaming:        { emoji: '🎮', animClass: 'anim-companion-idle',      label: 'Companion is gaming'        },
  sleeping:      { emoji: '😴', animClass: 'anim-drift',               label: 'Companion is sleeping'      },
  eating:        { emoji: '🍰', animClass: 'anim-companion-idle',      label: 'Companion is eating'        },
  celebrating:   { emoji: '🎉', animClass: 'anim-companion-celebrate', label: 'Companion is celebrating'   },
  romantic:      { emoji: '💖', animClass: 'anim-float',               label: 'Companion is being romantic'},
  surprised:     { emoji: '😲', animClass: 'anim-companion-surprised', label: 'Companion is surprised'     },
  cakeReaction:  { emoji: '🎂', animClass: 'anim-companion-celebrate', label: 'Companion reacts to cake'   },
  finale:        { emoji: '🌟', animClass: 'anim-companion-celebrate', label: 'Companion finale'           },
};

export const Companion = {

  /**
   * Mount the companion into the DOM.
   * Call once during app initialisation.
   */
  init() {
    _el = document.getElementById('companion');
    if (!_el) return;

    // Build internal DOM
    _el.innerHTML = `
      <div class="companion__bubble" role="status" aria-live="polite" aria-atomic="true"></div>
      <div class="companion__body" aria-hidden="true"></div>
    `;

    _bubble = _el.querySelector('.companion__bubble');
    _body   = _el.querySelector('.companion__body');

    this.setState('idle');

    // Hide companion initially; scenes will show it when needed
    _el.setAttribute('aria-hidden', 'true');
    _el.classList.add('companion--hidden');

    // React to global app state changes
    onStateChange('companionState', (newState) => {
      this.setState(newState);
    });
  },

  /** Show the companion (non-blocking). */
  show() {
    if (!_el) return;
    _el.setAttribute('aria-hidden', 'false');
    _el.classList.remove('companion--hidden');
    _el.classList.add('companion--visible');
  },

  /** Hide the companion. */
  hide() {
    if (!_el) return;
    _el.setAttribute('aria-hidden', 'true');
    _el.classList.remove('companion--visible');
    _el.classList.add('companion--hidden');
  },

  /**
   * Switch the companion to a named state.
   * @param {keyof typeof STATES} stateName
   */
  setState(stateName) {
    const def = STATES[stateName] ?? STATES.idle;
    _currentState = stateName;

    if (!_body) return;

    // Clear previous animation classes
    for (const { animClass } of Object.values(STATES)) {
      _body.classList.remove(animClass);
    }

    _body.textContent    = def.emoji;
    _body.classList.add(def.animClass);
    _el.setAttribute('aria-label', def.label);

    setAppState({ companionState: stateName }, /* silent */ true);
  },

  /**
   * Show a speech bubble with a message for `duration` ms.
   * @param {string} message
   * @param {number} [duration=3000]
   */
  say(message, duration = 3000) {
    if (!_bubble) return;

    // Clear any existing bubble timer
    if (_bubbleTimer) clearTimeout(_bubbleTimer);

    _bubble.textContent = message;
    _bubble.classList.add('companion__bubble--visible');

    _bubbleTimer = setTimeout(() => {
      _bubble.classList.remove('companion__bubble--visible');
    }, duration);
  },

  /** Get current state name. */
  get state() {
    return _currentState;
  },

  /**
   * Trigger a quick contextual reaction.
   * Temporarily switches state, says something, then returns to idle.
   *
   * @param {keyof typeof STATES} stateName
   * @param {string} message
   * @param {number} [duration=3500]
   */
  react(stateName, message, duration = 3500) {
    this.setState(stateName);
    this.say(message, duration);
    setTimeout(() => this.setState('idle'), duration + 300);
  },
};
