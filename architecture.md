# Architecture

## Stack
HTML5 + CSS3 + Vanilla JavaScript ES Modules only. No frontend framework.

## Principles
Modular, reusable, data-driven, responsive and performance-conscious.

## Suggested Structure
```text
index.html
css/
  main.css
  animations.css
js/
  app.js
  state.js
  transitions.js
  audio.js
  companion.js
  scenes/
components/
assets/
  images/
  audio/
  models/
data/
utils/
```

## Scene Contract
Major scenes should expose: init(), enter(), exit(), destroy().

## Transition Manager
Use one central transition system for consistent scene transitions.

## Companion
Use reusable states/events such as idle, dancing, gaming, sleeping, eating, celebrating, romantic, surprised, cakeReaction and finale.

## Cake State
cakeIntro → candlesReady → candlesLit → wishMoment → cuttingReady → cutting → cakeCut → celebration → exit.

User interaction controls the important steps.

## Data / Performance
Keep photos, messages, quiz questions and awards data-driven where practical. Prefer transform/opacity animation, lazy-load large assets and avoid unnecessary continuous calculations on mobile.

## Audio
Use a central audio manager for music, effects, mute and volume.
