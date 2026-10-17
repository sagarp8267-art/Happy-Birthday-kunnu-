/**
 * data/awards.js — Boyfriend Awards Data
 *
 * Data-driven award definitions for Phase 9.
 *
 * @type {Award[]}
 */
export const awards = [
  {
    id: 'world-best-hug',
    title: 'World\'s Best Hug',
    icon:  '🤗',
    description: 'Certified by me. Non-negotiable.',
  },
  {
    id: 'master-snack-thief',
    title: 'Master Snack Thief',
    icon:  '🍟',
    description: 'Always takes a chip after saying "I don\'t want any."',
  },
  {
    id: 'professional-teaser',
    title: 'Professional Teaser',
    icon:  '😏',
    description: 'Level of expertise: Olympic gold.',
  },
  {
    id: 'best-person',
    title: 'Best Person Ever',
    icon:  '💛',
    description: 'No contest. No runner-up.',
  },
  // Add more awards per phase
];

/**
 * @typedef {object} Award
 * @property {string} id
 * @property {string} title
 * @property {string} icon
 * @property {string} description
 */
