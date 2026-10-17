/**
 * utils/dom.js — DOM Utility Helpers
 *
 * Small, reusable DOM helpers used across scenes.
 */

/**
 * Query a single element (throws if not found in dev).
 * @param {string}   selector
 * @param {Element}  [scope=document]
 * @returns {HTMLElement}
 */
export function qs(selector, scope = document) {
  const el = scope.querySelector(selector);
  if (!el && import.meta.env?.DEV) {
    console.warn(`[dom] Element not found: "${selector}"`);
  }
  return el;
}

/**
 * Query all matching elements as an Array.
 * @param {string}   selector
 * @param {Element}  [scope=document]
 * @returns {HTMLElement[]}
 */
export function qsa(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

/**
 * Create an element with optional class and attributes.
 * @param {string} tag
 * @param {object} [opts]
 * @returns {HTMLElement}
 */
export function el(tag, { cls, attrs, html, text } = {}) {
  const node = document.createElement(tag);
  if (cls)   node.className = cls;
  if (html)  node.innerHTML = html;
  if (text)  node.textContent = text;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      node.setAttribute(k, v);
    }
  }
  return node;
}

/**
 * Wait for a CSS transition on an element to finish.
 * Resolves immediately if no transition is running.
 * @param {HTMLElement} element
 * @param {number}      [timeout=1000]
 * @returns {Promise<void>}
 */
export function waitForTransition(element, timeout = 1000) {
  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      element.removeEventListener('transitionend', finish);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, timeout);
    element.addEventListener('transitionend', finish);
  });
}

/**
 * Promise that resolves after `ms` milliseconds.
 * @param {number} ms
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for two animation frames (guarantees paint before measuring).
 */
export function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

/**
 * Clamp a number between min and max.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Linear interpolation.
 * @param {number} a
 * @param {number} b
 * @param {number} t  - 0..1
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Map a value from one range to another.
 * @param {number} val
 * @param {number} inMin
 * @param {number} inMax
 * @param {number} outMin
 * @param {number} outMax
 */
export function mapRange(val, inMin, inMax, outMin, outMax) {
  return outMin + ((val - inMin) / (inMax - inMin)) * (outMax - outMin);
}
