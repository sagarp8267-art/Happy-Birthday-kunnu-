/**
 * state.js — Central Application State
 *
 * Single source of truth for the app.
 * No direct mutations outside this module — use setState().
 */

/** @type {AppState} */
const _state = {
  /** Name of the currently active scene */
  currentScene: null,

  /** Name of the previous scene (for reverse transitions) */
  previousScene: null,

  /** Whether the user has unlocked the experience */
  isUnlocked: false,

  /** Whether audio is globally muted */
  isMuted: false,

  /** Master volume (0–1) */
  volume: 0.7,

  /** Whether a scene transition is in progress */
  isTransitioning: false,

  /** Companion's current emotional state */
  companionState: 'idle',

  /** Quiz progress */
  quiz: {
    currentQuestion: 0,
    score: 0,
    answers: [],
  },

  /** Cake interaction state machine */
  cake: {
    /** One of: intro | candlesReady | candlesLit | wishMoment | cuttingReady | cutting | cakeCut | celebration | exit */
    phase: 'intro',
    candlesLit: 0,
    totalCandles: 0,
    isCut: false,
  },

  /** User preferences */
  prefs: {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  },
};

/**
 * Listeners registered via onStateChange().
 * @type {Map<string, Array<Function>>}
 */
const _listeners = new Map();

/**
 * Read the current state (returns a shallow copy for safety).
 * @returns {Readonly<AppState>}
 */
export function getState() {
  return Object.freeze({ ..._state });
}

/**
 * Update state and notify listeners.
 *
 * @param {Partial<AppState>} patch - Object of state keys to update.
 * @param {boolean} [silent=false]  - If true, skip listener notification.
 */
export function setState(patch, silent = false) {
  const changed = [];

  for (const [key, value] of Object.entries(patch)) {
    if (_state[key] !== value) {
      _state[key] = value;
      changed.push(key);
    }
  }

  if (!silent && changed.length > 0) {
    changed.forEach(key => _notifyListeners(key, _state[key]));
    _notifyListeners('*', _state); // wildcard listener
  }
}

/**
 * Update a nested sub-object in state (one level deep).
 *
 * @param {string} key      - Top-level state key (e.g. 'cake').
 * @param {object} patch    - Partial update for that nested object.
 */
export function setNestedState(key, patch) {
  if (typeof _state[key] !== 'object' || _state[key] === null) {
    console.warn(`[state] "${key}" is not an object.`);
    return;
  }
  _state[key] = { ..._state[key], ...patch };
  _notifyListeners(key, _state[key]);
  _notifyListeners('*', _state);
}

/**
 * Register a listener for a specific state key or '*' for any change.
 *
 * @param {string}   key      - State key or '*'.
 * @param {Function} callback - Called with (newValue, key).
 * @returns {Function}        - Unsubscribe function.
 */
export function onStateChange(key, callback) {
  if (!_listeners.has(key)) _listeners.set(key, []);
  _listeners.get(key).push(callback);

  // Return an unsubscribe function
  return () => {
    const arr = _listeners.get(key);
    if (arr) {
      const idx = arr.indexOf(callback);
      if (idx !== -1) arr.splice(idx, 1);
    }
  };
}

/** @private */
function _notifyListeners(key, value) {
  const arr = _listeners.get(key);
  if (!arr) return;
  arr.forEach(fn => {
    try { fn(value, key); }
    catch (err) { console.error(`[state] Listener error for "${key}":`, err); }
  });
}
