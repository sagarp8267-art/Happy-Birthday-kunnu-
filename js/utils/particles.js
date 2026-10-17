/**
 * utils/particles.js — Shared Particle System
 *
 * Draws confetti / particle effects on the shared #fx-canvas.
 * Used by multiple scenes (balloons, cake, finale).
 *
 * Usage:
 *   import { Particles } from '../utils/particles.js';
 *   Particles.burst({ x: 0.5, y: 0.5, count: 80 });
 *   Particles.stop();
 */

/** @type {HTMLCanvasElement} */
const canvas = document.getElementById('fx-canvas');
/** @type {CanvasRenderingContext2D} */
const ctx    = canvas?.getContext('2d');

/** @type {Particle[]} */
let _particles = [];
/** @type {number|null} */
let _raf = null;
/** @type {boolean} */
let _running = false;

const COLORS = [
  '#e8637a', '#f2a0ae', '#f0c96e',
  '#9b7fe8', '#7ec8e3', '#ffffff',
];

export const Particles = {

  /**
   * Emit a burst of confetti from a normalised position.
   * @param {ParticleBurstOptions} opts
   */
  burst({ x = 0.5, y = 0.5, count = 60, spread = 1 } = {}) {
    _resize();

    const cx = canvas.width  * x;
    const cy = canvas.height * y;

    for (let i = 0; i < count; i++) {
      const angle   = (Math.random() * Math.PI * 2);
      const speed   = (2 + Math.random() * 6) * spread;
      _particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 4 + Math.random() * 6,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 8,
        life: 1,
        decay: 0.008 + Math.random() * 0.012,
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
      });
    }

    if (!_running) this._loop();
  },

  /**
   * Rain particles from the top (balloon-style).
   * @param {number} [count=40]
   */
  rain(count = 40) {
    _resize();
    for (let i = 0; i < count; i++) {
      _particles.push({
        x: Math.random() * canvas.width,
        y: -20,
        vx: (Math.random() - 0.5) * 2,
        vy: 1 + Math.random() * 3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 5 + Math.random() * 8,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 4,
        life: 1,
        decay: 0.004 + Math.random() * 0.006,
        shape: 'rect',
      });
    }
    if (!_running) this._loop();
  },

  /** Stop the particle loop and clear the canvas. */
  stop() {
    _running = false;
    if (_raf) cancelAnimationFrame(_raf);
    _raf = null;
    _particles = [];
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  },

  /** @private */
  _loop() {
    _running = true;
    const tick = () => {
      if (!_running) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      _particles = _particles.filter(p => p.life > 0);

      for (const p of _particles) {
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.15; // gravity
        p.rotation += p.rotSpeed;
        p.life     -= p.decay;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      if (_particles.length > 0) {
        _raf = requestAnimationFrame(tick);
      } else {
        _running = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    _raf = requestAnimationFrame(tick);
  },
};

function _resize() {
  if (!canvas) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', _resize, { passive: true });
_resize();

/**
 * @typedef {object} Particle
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {string} color
 * @property {number} size
 * @property {number} rotation
 * @property {number} rotSpeed
 * @property {number} life
 * @property {number} decay
 * @property {'rect'|'circle'} shape
 *
 * @typedef {object} ParticleBurstOptions
 * @property {number} [x]      - Normalised x position (0–1)
 * @property {number} [y]      - Normalised y position (0–1)
 * @property {number} [count]
 * @property {number} [spread] - Speed multiplier
 */
