/**
 * audio.js — Central Audio Manager
 *
 * Handles background music, sound effects, mute and volume control.
 * Uses the Web Audio API for master volume management, SFX playback,
 * and smooth crossfades between HTML5 background music tracks.
 *
 * Audio Sequence & Tracks:
 *   1. Password Success:  bgm-after password enter.mp3 (once) -> bgm-main.mp3 (loop)
 *   2. Balloons:          sfx-success.mp3 (once), bgm-main.mp3 (continuous), pop.mp3 (per balloon)
 *   3. Cake Cutting:      sfx-success.mp3 (once), bgm-main.mp3 (continuous)
 *   4. Letter Section:    bgm-emotional.mp3 (crossfade, loop through Photo World & Gift)
 *   5. Gift Section:      gift open.mp3 (once), bgm-emotional.mp3 (uninterrupted)
 *   6. Final Section:     bgm-finale.mp3 (crossfade, loop)
 */

import { getState, setState } from './state.js';

/** @type {AudioContext|null} */
let _ctx = null;

/** @type {GainNode|null} — master volume node */
let _masterGain = null;

/** @type {HTMLAudioElement|null} — currently active music element */
let _musicEl = null;

/** @type {MediaElementAudioSourceNode|null} */
let _musicSource = null;

/** @type {GainNode|null} */
let _musicGain = null;

/** @type {string|null} — normalized path of currently playing music */
let _currentMusicSrc = null;

/** @type {Map<string, AudioBuffer>} */
const _sfxCache = new Map();

/** @type {Map<string, number>} — deduplication timestamps */
const _lastSfxTime = new Map();

/** Minimum ms between duplicate triggers of the exact same SFX */
const SFX_DEDUPE_MS = 60;

/** @type {boolean} */
let _initialised = false;

/** Normalize path for safe comparison and alias resolution */
function _normalizePath(src) {
  if (!src) return '';
  let clean = src.replace(/\\/g, '/').trim();
  // Support both "bgm-final.mp3" and "bgm-finale.mp3"
  if (clean.endsWith('bgm-final.mp3')) {
    clean = clean.replace('bgm-final.mp3', 'bgm-finale.mp3');
  }
  return clean;
}

/**
 * Lazily initialise the Web Audio API context.
 */
function _init() {
  if (_initialised) return;
  _initialised = true;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    console.warn('[audio] Web Audio API is not supported in this browser.');
    return;
  }

  _ctx = new AudioCtx();
  _masterGain = _ctx.createGain();
  _masterGain.gain.value = getState().isMuted ? 0 : (getState().volume ?? 0.6);
  _masterGain.connect(_ctx.destination);

  _attachGestureUnlocker();
}

/**
 * Resume AudioContext if suspended (required by browser autoplay policy).
 */
async function _resume() {
  if (_ctx && _ctx.state === 'suspended') {
    try {
      await _ctx.resume();
    } catch (e) {
      // Will resume on next user gesture
    }
  }
}

/**
 * Attach global unlocker for browsers requiring user gesture.
 */
function _attachGestureUnlocker() {
  const unlock = async () => {
    if (_ctx && _ctx.state === 'suspended') {
      try {
        await _ctx.resume();
      } catch (e) {}
    }
  };
  window.addEventListener('click', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}

export const AudioManager = {

  /**
   * Start or smoothly crossfade background music.
   * If the requested track is already playing, maintains playback without restarting.
   *
   * @param {string}   src        - Path to audio file.
   * @param {boolean}  [loop=true] - Whether to loop.
   * @param {number}   [volume=0.6] - Target track volume (0–1).
   * @param {Function} [onEnded=null] - Optional callback when non-looped track finishes.
   */
  async playMusic(src, loop = true, volume = 0.6, onEnded = null) {
    const resolved = _normalizePath(src);
    if (!resolved) return;

    try {
      _init();
      await _resume();

      // 1. If the exact same track is already playing, DO NOT RESTART
      if (_currentMusicSrc === resolved && _musicEl && !_musicEl.paused) {
        // Smoothly adjust track volume if changed
        if (_musicGain && _ctx) {
          _musicGain.gain.setTargetAtTime(volume, _ctx.currentTime, 0.3);
        }
        if (onEnded && !loop) {
          _musicEl.addEventListener('ended', onEnded, { once: true });
        }
        return;
      }

      const fadeDuration = 1000; // 1 second smooth crossfade
      const now = _ctx ? _ctx.currentTime : 0;

      // 2. Smoothly fade out the old track if one is currently playing
      if (_musicEl && _musicGain && _ctx) {
        const oldEl     = _musicEl;
        const oldGain   = _musicGain;
        const oldSource = _musicSource;

        try {
          oldGain.gain.cancelScheduledValues(now);
          oldGain.gain.setValueAtTime(oldGain.gain.value, now);
          oldGain.gain.linearRampToValueAtTime(0.0001, now + fadeDuration / 1000);
        } catch (e) {}

        setTimeout(() => {
          try {
            oldEl.pause();
            oldEl.src = '';
            oldEl.load();
            oldGain.disconnect();
            oldSource?.disconnect();
          } catch (e) {}
        }, fadeDuration + 100);
      }

      // 3. Set up and fade in the new track
      _currentMusicSrc = resolved;

      const newEl = new Audio(resolved);
      newEl.loop = loop;
      newEl.crossOrigin = 'anonymous';

      if (onEnded && !loop) {
        newEl.addEventListener('ended', () => {
          if (typeof onEnded === 'function') onEnded();
        }, { once: true });
      }

      let newGain = null;
      let newSource = null;

      if (_ctx && _masterGain) {
        newGain = _ctx.createGain();
        newGain.gain.setValueAtTime(0.0001, now);
        newGain.gain.linearRampToValueAtTime(volume, now + fadeDuration / 1000);

        try {
          newSource = _ctx.createMediaElementSource(newEl);
          newSource.connect(newGain);
          newGain.connect(_masterGain);
        } catch (err) {
          // Fallback if media element source fails
          newEl.volume = volume;
        }
      } else {
        newEl.volume = volume;
      }

      _musicEl     = newEl;
      _musicGain   = newGain;
      _musicSource = newSource;

      // 4. Play with autoplay fallback
      const playPromise = newEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.info('[audio] Autoplay deferred until user gesture:', err.message);
          const resumeOnGesture = async () => {
            window.removeEventListener('click', resumeOnGesture);
            window.removeEventListener('keydown', resumeOnGesture);
            window.removeEventListener('touchstart', resumeOnGesture);
            await _resume();
            if (_musicEl === newEl) {
              newEl.play().catch(() => {});
            }
          };
          window.addEventListener('click', resumeOnGesture, { once: true });
          window.addEventListener('keydown', resumeOnGesture, { once: true });
          window.addEventListener('touchstart', resumeOnGesture, { once: true });
        });
      }

    } catch (err) {
      console.warn('[audio] playMusic error:', err);
    }
  },

  /**
   * Fade music out gracefully and stop.
   * @param {number} [fadeDuration=800]
   */
  stopMusic(fadeDuration = 800) {
    if (!_musicEl) return;

    const el     = _musicEl;
    const gain   = _musicGain;
    const source = _musicSource;

    _currentMusicSrc = null;
    _musicEl         = null;
    _musicGain       = null;
    _musicSource     = null;

    if (_ctx && gain && fadeDuration > 0) {
      try {
        const now = _ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0.0001, now + fadeDuration / 1000);
      } catch (e) {}

      setTimeout(() => {
        try {
          el.pause();
          el.src = '';
          gain.disconnect();
          source?.disconnect();
        } catch (e) {}
      }, fadeDuration + 50);
    } else {
      el.pause();
      el.src = '';
    }
  },

  /**
   * Play a one-shot sound effect.
   * Prevents rapid duplicate overlapping copies of the exact same SFX.
   *
   * @param {string} src   - Path to audio file.
   * @param {number} [vol=1] - Volume (0–1).
   */
  async playSFX(src, vol = 1) {
    const resolved = _normalizePath(src);
    if (!resolved) return;

    // Deduplication check: ignore rapid duplicate triggers of the exact same sound
    const nowMs = Date.now();
    const lastTime = _lastSfxTime.get(resolved) || 0;
    if (nowMs - lastTime < SFX_DEDUPE_MS) {
      return;
    }
    _lastSfxTime.set(resolved, nowMs);

    try {
      _init();
      await _resume();

      if (!_ctx || !_masterGain) return;

      let buffer = _sfxCache.get(resolved);

      if (!buffer) {
        const response = await fetch(resolved);
        if (!response.ok) {
          console.warn(`[audio] SFX not found: ${resolved} (${response.status})`);
          return;
        }
        const arrayBuffer = await response.arrayBuffer();
        buffer = await _ctx.decodeAudioData(arrayBuffer);
        _sfxCache.set(resolved, buffer);
      }

      const source = _ctx.createBufferSource();
      const gain   = _ctx.createGain();
      gain.gain.value = vol;

      source.buffer = buffer;
      source.connect(gain);
      gain.connect(_masterGain);
      source.start();
    } catch (err) {
      console.warn('[audio] playSFX error:', err);
    }
  },

  /**
   * Set master volume (0–1).
   * @param {number} v
   */
  setVolume(v) {
    const clamped = Math.max(0, Math.min(1, v));
    setState({ volume: clamped });
    if (_masterGain && _ctx) {
      _masterGain.gain.setTargetAtTime(getState().isMuted ? 0 : clamped, _ctx.currentTime, 0.05);
    }
  },

  /** Mute all audio without losing volume setting. */
  mute() {
    setState({ isMuted: true });
    if (_masterGain && _ctx) {
      _masterGain.gain.setTargetAtTime(0, _ctx.currentTime, 0.05);
    }
  },

  /** Unmute audio, restoring previous volume. */
  unmute() {
    setState({ isMuted: false });
    const vol = getState().volume ?? 0.6;
    if (_masterGain && _ctx) {
      _masterGain.gain.setTargetAtTime(vol, _ctx.currentTime, 0.05);
    }
  },

  /** Toggle mute state. */
  toggleMute() {
    getState().isMuted ? this.unmute() : this.mute();
  },

  /**
   * Preload a list of SFX files into cache for instantaneous playback.
   * @param {string[]} srcs
   */
  async preload(srcs) {
    _init();
    await Promise.allSettled(srcs.map(src => this.playSFX(src, 0)));
  },

  /**
   * Returns the normalized path of the current background music.
   */
  getCurrentMusic() {
    return _currentMusicSrc;
  }
};
