/**
 * scenes/quiz.js — Phase 8: Boyfriend Quiz
 *
 * Interactive quiz using data from data/quiz.js
 * Validates answers, applies CSS feedback, and triggers the Companion.
 */
import { navigateTo } from '../app.js';
import { Companion }  from '../companion.js';
import { quizQuestions } from '../data/quiz.js';
import { qs, qsa, el, sleep, waitForTransition } from '../utils/dom.js';

let _container = null;
let _root = null;
let _currentQIndex = 0;
let _isAnimating = false;

export async function init(container) {
  _container = container;
  _currentQIndex = 0;

  _root = el('section', {
    cls: 'scene scene-quiz',
    attrs: { 'aria-label': 'Boyfriend Quiz' }
  });

  _root.innerHTML = `
    <!-- Quiz Container -->
    <div class="quiz-wrapper anim-fade-up" style="--delay: 300ms;">

      <div id="quiz-content">
        <h3 class="display quiz-header">Question <span id="q-counter">1</span></h3>
        <p id="q-text" class="quiz-question"></p>

        <div id="q-options" class="quiz-options">
          <!-- Buttons injected here -->
        </div>
      </div>

      <!-- Finale Certificate -->
      <div id="quiz-finale" style="display: none; flex-direction: column; align-items: center;">
        <div class="certified-stamp">
          Boyfriend<br>Certified<br>❤️
        </div>
        <button id="btn-quiz-next" class="btn-primary mt-4" style="opacity: 0; pointer-events: none;">
          Claim Awards
        </button>
      </div>

    </div>

    <!-- Playful hammer bonk reaction GIF on wrong answer -->
    <img id="gif-quiz-wrong"
         class="gif-overlay gif-quiz-wrong"
         src="gif/hammer-bully.gif"
         alt="Bonk!"
         aria-hidden="true" />
  `;

  if (!document.getElementById('quiz-styles')) {
    const style = document.createElement('style');
    style.id = 'quiz-styles';
    style.textContent = `
      .scene-quiz {
        background: var(--bg-layer);
      }
      .quiz-wrapper {
        width: 100%;
        max-width: 600px;
        padding: 2rem;
      }
      #quiz-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        transition: opacity 0.5s ease;
      }
      .quiz-header {
        font-size: var(--text-2xl);
        color: var(--accent-warm);
        margin-bottom: 0.5rem;
      }
      .quiz-question {
        font-size: var(--text-xl);
        color: var(--text-primary);
        text-align: center;
        margin-bottom: 3rem;
        line-height: 1.4;
      }
      .quiz-options {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1rem;
        width: 100%;
      }
      @media (min-width: 600px) {
        .quiz-options {
          grid-template-columns: 1fr 1fr;
        }
      }

      .btn-option {
        background: var(--bg-base);
        border: 2px solid var(--border-subtle);
        color: var(--text-primary);
        font-family: var(--font-body);
        font-size: var(--text-base);
        padding: 1.25rem 1rem;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.25s var(--ease-out);
        text-align: center;
      }
      .btn-option:hover:not(:disabled) {
        border-color: var(--accent-soft);
        transform: translateY(-2px);
      }
      .btn-option:disabled {
        cursor: default;
        opacity: 0.7;
      }

      /* Answer states */
      .btn-option.is-correct {
        background: rgba(46, 204, 113, 0.1);
        border-color: #2ecc71;
        color: #2ecc71;
        transform: scale(1.05);
      }
      .btn-option.is-wrong {
        background: rgba(231, 76, 60, 0.1);
        border-color: #e74c3c;
        animation: shakeError 0.4s cubic-bezier(.36,.07,.19,.97) both;
      }

      /* Finale Stamp */
      .certified-stamp {
        font-family: var(--font-display);
        font-size: var(--text-3xl);
        color: var(--accent);
        border: 6px solid var(--accent);
        padding: 2rem;
        border-radius: 20px;
        text-transform: uppercase;
        text-align: center;
        line-height: 1.2;
        transform: rotate(-10deg) scale(0);
        opacity: 0;
        animation: stampIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }
      @keyframes stampIn {
        to { transform: rotate(-10deg) scale(1); opacity: 1; }
      }
      .mt-4 { margin-top: 3rem; }
    `;
    document.head.appendChild(style);
  }

  _renderQuestion();

  qs('#btn-quiz-next', _root).addEventListener('click', () => {
    navigateTo(() => import('./awards.js'), { type: 'dissolve', duration: 1000 });
  });

  _container.appendChild(_root);
}

export async function enter() {
  _root.classList.add('is-active');

  await sleep(1000);
  Companion.show();
  Companion.react('idle', "Test time! Let's see what you remember.", 4000);
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

function _renderQuestion() {
  _isAnimating = false;
  const qData = quizQuestions[_currentQIndex];

  if (!qData) {
    _triggerFinale();
    return;
  }

  qs('#q-counter', _root).textContent = `${_currentQIndex + 1}/${quizQuestions.length}`;
  qs('#q-text', _root).textContent = qData.question;

  const optionsContainer = qs('#q-options', _root);
  optionsContainer.innerHTML = ''; // clear old

  qData.options.forEach((optText, index) => {
    const btn = el('button', {
      cls: 'btn-option',
      text: optText
    });
    btn.dataset.index = index;
    btn.addEventListener('click', (e) => _handleAnswer(e.currentTarget, parseInt(btn.dataset.index), qData));
    optionsContainer.appendChild(btn);
  });

  // Fade in options
  const qWrapper = qs('#quiz-content', _root);
  qWrapper.style.opacity = '1';
}

async function _handleAnswer(btnElement, selectedIndex, qData) {
  if (_isAnimating) return;
  _isAnimating = true;

  const isCorrect = selectedIndex === qData.correct;

  if (isCorrect) {
    import('../audio.js').then(({ AudioManager }) => {
      AudioManager.playSFX('assets/audio/sfx-success.mp3', 0.6);
    });

    // 1. Visual success feedback
    btnElement.classList.add('is-correct');

    // Disable all buttons
    qsa('.btn-option', _root).forEach(b => b.disabled = true);

    // 2. Trigger Companion Success
    Companion.react('celebrating', qData.reactionRight, 3500);

    // 3. Wait, then crossfade to next question
    await sleep(2000);
    const qWrapper = qs('#quiz-content', _root);
    qWrapper.style.opacity = '0';
    await sleep(500);

    _currentQIndex++;
    _renderQuestion();

  } else {
    // Wrong answer behavior
    btnElement.classList.add('is-wrong');
    btnElement.disabled = true; // They can't click the wrong one again

    Companion.react('surprised', qData.reactionWrong, 3000);

    const gifWrong = qs('#gif-quiz-wrong', _root);
    if (gifWrong) {
      gifWrong.classList.add('is-visible');
      setTimeout(() => gifWrong.classList.remove('is-visible'), 2800);
    }

    await sleep(600);
    _isAnimating = false;
  }
}

async function _triggerFinale() {
  const content = qs('#quiz-content', _root);
  const finale = qs('#quiz-finale', _root);
  const btn = qs('#btn-quiz-next', _root);

  content.style.display = 'none';
  finale.style.display = 'flex';

  await sleep(1500);
  btn.style.opacity = '1';
  btn.style.pointerEvents = 'auto';
  btn.style.transition = 'opacity 1s ease';

  Companion.react('celebrating', "You passed! I mean... of course you did.", 4000);
}
