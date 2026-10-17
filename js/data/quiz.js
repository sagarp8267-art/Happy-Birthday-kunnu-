/**
 * data/quiz.js — Boyfriend Quiz Data
 *
 * Data-driven quiz questions for Phase 8.
 * Update answers and reactions here without touching scene logic.
 *
 * @type {QuizQuestion[]}
 */
export const quizQuestions = [
  {
    id: 1,
    question: "What's my favourite thing we do together?",
    options: [
      'Watch terrible movies and judge them',
      'Steal each other\'s food',
      'Get lost because neither of us checks the map',
      'All of the above, obviously',
    ],
    correct: 3,
    reactionRight: "CORRECT! You know me so well 💖",
    reactionWrong: "Really?? We've only done this a hundred times 😅",
  },
  // Add more questions per phase
];

/**
 * @typedef {object} QuizQuestion
 * @property {number}   id
 * @property {string}   question
 * @property {string[]} options
 * @property {number}   correct       - 0-based index of correct option
 * @property {string}   reactionRight - Companion says on correct answer
 * @property {string}   reactionWrong - Companion says on wrong answer
 */
