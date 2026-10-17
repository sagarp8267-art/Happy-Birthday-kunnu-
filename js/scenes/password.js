import { getState, setState } from '../state.js';
import { Companion }          from '../companion.js';
import { AudioManager }       from '../audio.js';
import { navigateTo }         from '../app.js';
import { qs, el, waitForTransition, sleep } from '../utils/dom.js';

let _container = null;
let _root = null;
let _input = null;

const CORRECT_PASSWORD = '1810';
const SCENE_NAME = 'Password';

export async function init(container) {
  _container = container;

  _root = el('section', {
    cls: 'scene scene-password',
    attrs: { 'aria-label': 'Password unlock screen' }
  });

  _root.innerHTML = `
    <div class="pwd-wrapper">
      <h1 class="display pwd-title anim-fade-down" style="--delay: 100ms">
        A very special day...
      </h1>
      <p class="pwd-subtitle anim-fade-up" style="--delay: 300ms">
        Enter the date to unlock (DDMMYYYY)
      </p>

      <form id="pwd-form" class="pwd-form anim-fade-up" style="--delay: 500ms">
        <input
          type="password"
          id="pwd-input"
          class="pwd-input"
          placeholder="••••••••"
          maxlength="8"
          autocomplete="off"
        />
        <button type="submit" class="pwd-submit visually-hidden">Unlock</button>
      </form>
      <div id="pwd-hint-btn" class="pwd-hint-btn anim-fade-up" style="--delay: 700ms" role="button" tabindex="0">
        Need a hint? 🔨
      </div>
    </div>

    <!-- Playful hammer bonk reaction GIF -->
    <img id="gif-pwd-wrong"
         class="gif-overlay gif-password-wrong"
         src="gif/hammer-bully.gif"
         alt="Bonk!"
         aria-hidden="true" />
  `;

  if (!document.getElementById('password-styles')) {
    const style = document.createElement('style');
    style.id = 'password-styles';
    style.textContent = `
      .scene-password {
        background: radial-gradient(circle at center, var(--c-dusk) 0%, var(--c-void) 100%);
      }
      .pwd-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
      .pwd-title {
        color: var(--accent-soft);
        font-size: var(--text-3xl);
        margin-bottom: var(--space-2);
      }
      .pwd-subtitle {
        color: var(--text-subtle);
        font-size: var(--text-sm);
        margin-bottom: var(--space-8);
        letter-spacing: 0.05em;
      }
      .pwd-form {
        position: relative;
        width: 240px;
      }
      .pwd-input {
        width: 100%;
        background: transparent;
        border: none;
        border-bottom: 2px solid var(--border-subtle);
        color: var(--text-primary);
        font-family: var(--font-body);
        font-size: var(--text-xl);
        text-align: center;
        padding: var(--space-2);
        transition: border-color var(--dur-fast) var(--ease-out);
        letter-spacing: 0.25em;
      }
      .pwd-input:focus {
        outline: none;
        border-bottom-color: var(--accent);
      }
      .pwd-input::placeholder {
        color: var(--border-subtle);
      }

      .shake {
        animation: shakeError 0.5s cubic-bezier(.36,.07,.19,.97) both;
      }
      @keyframes shakeError {
        10%, 90% { transform: translate3d(-2px, 0, 0); }
        20%, 80% { transform: translate3d(4px, 0, 0); border-bottom-color: #ff3333; }
        30%, 50%, 70% { transform: translate3d(-8px, 0, 0); }
        40%, 60% { transform: translate3d(8px, 0, 0); }
      }
    `;
    document.head.appendChild(style);
  }

  _container.appendChild(_root);
  _input = qs('#pwd-input', _root);

  const form = qs('#pwd-form', _root);
  form.addEventListener('submit', _handleSubmit);

  const hintBtn = qs('#pwd-hint-btn', _root);
  hintBtn?.addEventListener('click', () => {
    Companion.show();
    Companion.react('surprised', "Hint: It's 1802! Don't make me bonk you again! 🔨🐼", 4000);
    const gifWrong = qs('#gif-pwd-wrong', _root);
    if (gifWrong) {
      gifWrong.classList.add('is-visible');
      setTimeout(() => gifWrong.classList.remove('is-visible'), 3500);
    }
  });
}

export async function enter() {
  await sleep(50);
  _root.classList.add('is-active');
  await waitForTransition(_root);
  if (_input) _input.focus();
}

export async function exit() {
  if (!_root) return;
  _root.classList.remove('is-active');
  return waitForTransition(_root);
}

export function destroy() {
  _root?.remove();
  _root = null;
  _container = null;
}

// ── Event Handlers ──

async function _handleSubmit(e) {
  e.preventDefault();

  const val = _input.value.trim();
  if (val === CORRECT_PASSWORD) {
    // 1. Play "bgm-after password enter.mp3" ONCE, then automatically switch to "bgm-main.mp3" looping
    AudioManager.playMusic('assets/audio/bgm-after password enter.mp3', false, 0.65, () => {
      AudioManager.playMusic('assets/audio/bgm-main.mp3', true, 0.5);
    });

    setState({ isUnlocked: true });
    _input.blur();

    const wrapper = qs('.pwd-wrapper', _root);
    wrapper.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    wrapper.style.opacity = '0';
    wrapper.style.transform = 'translateY(-20px)';

    await sleep(600);

    navigateTo(() => import('./intro.js'), { type: 'dissolve', duration: 1200 });

  } else {
    // Error handling
    _input.classList.add('shake');

    const responses = [
      "Wait... you forgot our date? 😲",
      "Um, try again sweetheart.",
      "Red alert! Red alert! 🚨",
      "I'll pretend I didn't see that."
    ];
    const msg = responses[Math.floor(Math.random() * responses.length)];

    Companion.show();
    Companion.react('surprised', msg, 3500);

    const gifWrong = qs('#gif-pwd-wrong', _root);
    if (gifWrong) {
      gifWrong.classList.add('is-visible');
      setTimeout(() => gifWrong.classList.remove('is-visible'), 3500);
    }

    setTimeout(() => {
      _input.classList.remove('shake');
      _input.value = '';
      _input.focus();
    }, 600);
  }
}