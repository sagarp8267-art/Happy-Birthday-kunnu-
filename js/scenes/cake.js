/**
 * scenes/cake.js — Phase 4: Three.js 3D Cake World
 *
 * A dedicated 3D environment (one of two in the experience).
 * FPP-style interactive camera. 3 lightable candles. Wish moment.
 * Knife cut animation. Sealed letter reveal → navigate to letter scene.
 *
 * State machine: candlesReady → candlesLit → wishMoment → cuttingReady → cakeCut → done
 *
 * Dependencies: Three.js r168 (Phase 1 import map), GSAP, Companion, Particles
 */

import * as THREE  from 'three';
import gsap        from 'gsap';
import { navigateTo }          from '../app.js';
import { Companion }           from '../companion.js';
import { Particles }           from '../utils/particles.js';
import { getState, setNestedState } from '../state.js';
import { sleep }               from '../utils/dom.js';

// ─── Constants ─────────────────────────────────────────────────────────────

const CANDLE_COUNT = 3;

/** World positions for the three candles on top of the cake */
const CANDLE_POSITIONS = [
  new THREE.Vector3(-0.55, 1.52, 0.10),
  new THREE.Vector3( 0.55, 1.52, 0.10),
  new THREE.Vector3( 0.00, 1.52, -0.42),
];

// ─── Module state ──────────────────────────────────────────────────────────

let _container  = null;
let _root       = null;
let _canvas     = null;
let _hud        = null;           // HTML overlay on top of canvas

// Three.js core
let _renderer   = null;
let _scene      = null;
let _camera     = null;
let _rafId      = null;

// Scene objects
let _cake       = null;           // Group: whole cake
let _cakeMain   = null;           // Group: remaining cake
let _cakeSlice  = null;           // Group: separated slice
let _candles    = [];             // Array of { mesh, light, flameMesh, lit }
let _knife      = null;           // knife Group
let _letter     = null;           // sealed letter mesh

// Drag orbit state
let _drag       = { active: false, lastX: 0, lastY: 0 };
let _camAngle   = { azimuth: 0, elevation: 0.18 }; // radians
const CAM_RADIUS = 5.5;

// Internal phase
let _phase      = 'candlesReady';
let _litCount   = 0;
let _isDestroyed = false;

// Raycaster for click detection
const _raycaster = new THREE.Raycaster();
const _mouse     = new THREE.Vector2();

// ─── Public API ────────────────────────────────────────────────────────────

export async function init(container) {
  _container   = container;
  _isDestroyed = false;
  _phase       = 'candlesReady';
  _litCount    = 0;

  // Outer scene section
  _root = document.createElement('section');
  _root.className  = 'scene scene-cake';
  _root.setAttribute('aria-label', 'Interactive 3D Birthday Cake');

  // Three.js canvas
  _canvas = document.createElement('canvas');
  _canvas.className = 'cake-canvas';
  _root.appendChild(_canvas);

  // HTML HUD overlay
  _hud = document.createElement('div');
  _hud.className   = 'cake-hud';
  _hud.innerHTML   = _buildHUD();
  _root.appendChild(_hud);

  _injectStyles();
  _initThree();
  _buildScene();
  _wireEvents();

  setNestedState('cake', { phase: 'candlesReady', candlesLit: 0, totalCandles: CANDLE_COUNT });
  _container.appendChild(_root);
}

export async function enter() {
  _root.classList.add('is-active');
  _startRenderLoop();

  Companion.show();

  // Fade in the ambient cake GIF decoration
  await sleep(600);
  const gifAmbient = _hud.querySelector('.gif-cake-ambient');
  if (gifAmbient) gifAmbient.classList.add('is-visible');

  await sleep(200);
  _setPrompt('Tap the candles to light them 🕯️');

  Companion.react('eating', 'Ooh a cake! 🎂 Light the candles!', 4000);
}

export async function exit() {
  _stopRenderLoop();
  Particles.stop();
  gsap.killTweensOf('*');
  _root.classList.remove('is-active');
  await new Promise(r => gsap.to(_root, { opacity: 0, duration: 0.6, ease: 'power2.in', onComplete: r }));
}

export function destroy() {
  _stopRenderLoop();
  _disposeThree();
  _root?.remove();
  _root = null;
  _container = null;
  _isDestroyed = true;
}

// ─── Three.js init ─────────────────────────────────────────────────────────

function _initThree() {
  _renderer = new THREE.WebGLRenderer({
    canvas:     _canvas,
    antialias:  true,
    alpha:      false,
  });
  _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  _renderer.setSize(window.innerWidth, window.innerHeight);
  _renderer.shadowMap.enabled = true;
  _renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  _renderer.toneMapping       = THREE.ACESFilmicToneMapping;
  _renderer.toneMappingExposure = 0.9;

  _scene  = new THREE.Scene();
  _scene.background = new THREE.Color(0x06030e);
  _scene.fog = new THREE.FogExp2(0x06030e, 0.12);

  _camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 60);
  _updateCamera();
}

/**
 * Builds a solid 3D cylindrical wedge (sector) with fully closed top, bottom,
 * perimeter and radial cut faces using ExtrudeGeometry.
 */
function _createWedgeGeometry(radius, height, startAngle, angleLength, segments = 32) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  for (let i = 0; i <= segments; i++) {
    const a = startAngle + (i / segments) * angleLength;
    // Map polar coordinates into 2D shape plane
    shape.lineTo(radius * Math.sin(a), -radius * Math.cos(a));
  }
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: height,
    bevelEnabled: false,
  });

  // Rotate so depth is aligned along vertical Y axis (0 to height)
  geom.rotateX(-Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

function _buildScene() {
  // ── Ambient + hemisphere light ────────────────────────────────────────────
  const ambient = new THREE.AmbientLight(0x1a0a2e, 2.5);
  _scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x2d1040, 0x0a0612, 0.8);
  _scene.add(hemi);

  // ── Soft fill light from above ────────────────────────────────────────────
  const fill = new THREE.DirectionalLight(0xffeedd, 0.4);
  fill.position.set(3, 8, 4);
  fill.castShadow = true;
  fill.shadow.mapSize.set(1024, 1024);
  _scene.add(fill);

  // ── Table / ground plane ──────────────────────────────────────────────────
  const tableGeo  = new THREE.CylinderGeometry(3.2, 3.2, 0.18, 64);
  const tableMat  = new THREE.MeshStandardMaterial({
    color:     0x1a0a28,
    roughness: 0.6,
    metalness: 0.1,
  });
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.position.y = -0.09;
  table.receiveShadow = true;
  _scene.add(table);

  // ── Cake group ────────────────────────────────────────────────────────────
  _cake = new THREE.Group();
  _scene.add(_cake);

  _cakeMain  = new THREE.Group();
  _cakeSlice = new THREE.Group();
  _cake.add(_cakeMain);
  _cake.add(_cakeSlice);

  const spongeMat = new THREE.MeshStandardMaterial({ color: 0xf5d9c2, roughness: 0.85 });
  const icingMat  = new THREE.MeshStandardMaterial({ color: 0xe8637a, roughness: 0.55, metalness: 0.05 });

  // Slice arc: centered in front (+Z)
  const SLICE_ANGLE = 0.72; // ~41.25°
  const SLICE_START = -SLICE_ANGLE / 2;
  const MAIN_START  = SLICE_START + SLICE_ANGLE;
  const MAIN_ANGLE  = Math.PI * 2 - SLICE_ANGLE;

  // Cake dimensions
  const bRadius      = 1.15;
  const bHeight      = 0.76;
  const bIcingHeight = 0.10;
  const bIcingRadius = 1.17;

  const tRadius      = 0.82;
  const tHeight      = 0.56;
  const tIcingHeight = 0.10;
  const tIcingRadius = 0.84;

  const _buildCakeTier = (group, startA, lengthA, segments) => {
    // Bottom tier sponge
    const bSpongeGeo = _createWedgeGeometry(bRadius, bHeight, startA, lengthA, segments);
    const bSpongeMesh = new THREE.Mesh(bSpongeGeo, spongeMat);
    bSpongeMesh.position.y = 0;
    bSpongeMesh.castShadow = true;
    bSpongeMesh.receiveShadow = true;
    group.add(bSpongeMesh);

    // Bottom tier icing
    const bIcingGeo = _createWedgeGeometry(bIcingRadius, bIcingHeight, startA, lengthA, segments);
    const bIcingMesh = new THREE.Mesh(bIcingGeo, icingMat);
    bIcingMesh.position.y = bHeight;
    bIcingMesh.castShadow = true;
    group.add(bIcingMesh);

    // Top tier sponge
    const tSpongeGeo = _createWedgeGeometry(tRadius, tHeight, startA, lengthA, segments);
    const tSpongeMesh = new THREE.Mesh(tSpongeGeo, spongeMat.clone());
    tSpongeMesh.position.y = bHeight + bIcingHeight;
    tSpongeMesh.castShadow = true;
    tSpongeMesh.receiveShadow = true;
    group.add(tSpongeMesh);

    // Top tier icing
    const tIcingGeo = _createWedgeGeometry(tIcingRadius, tIcingHeight, startA, lengthA, segments);
    const tIcingMesh = new THREE.Mesh(tIcingGeo, icingMat.clone());
    tIcingMesh.position.y = bHeight + bIcingHeight + tHeight;
    tIcingMesh.castShadow = true;
    group.add(tIcingMesh);
  };

  // Build main remaining cake
  _buildCakeTier(_cakeMain, MAIN_START, MAIN_ANGLE, 48);

  // Build slice that fits flush until cut
  _buildCakeTier(_cakeSlice, SLICE_START, SLICE_ANGLE, 16);

  // Strawberry rosette on the slice
  const berryGeo = new THREE.SphereGeometry(0.08, 16, 16);
  const berryMat = new THREE.MeshStandardMaterial({ color: 0xd9204c, roughness: 0.35 });
  const berry    = new THREE.Mesh(berryGeo, berryMat);
  berry.position.set(0, bHeight + bIcingHeight + tHeight + tIcingHeight + 0.08, tRadius * 0.55);
  berry.scale.set(1, 1.25, 1);
  _cakeSlice.add(berry);

  // ── Candles ───────────────────────────────────────────────────────────────
  CANDLE_POSITIONS.forEach((pos, i) => {
    const candleGroup = new THREE.Group();
    candleGroup.position.copy(pos);

    // Stick
    const stickGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.32, 16);
    const stickMat = new THREE.MeshStandardMaterial({
      color:     [0xe8637a, 0xb99bc7, 0xf0c96e][i],
      roughness: 0.6,
    });
    const stick = new THREE.Mesh(stickGeo, stickMat);
    stick.position.y = 0.16;
    stick.castShadow = true;
    candleGroup.add(stick);

    // Wick
    const wickGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.08, 6);
    const wickMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const wick    = new THREE.Mesh(wickGeo, wickMat);
    wick.position.y = 0.36;
    candleGroup.add(wick);

    // Flame plane (billboard sprite, initially invisible)
    const flameMat = new THREE.MeshBasicMaterial({
      color:       0xf0c96e,
      transparent: true,
      opacity:     0,
      depthWrite:  false,
    });
    const flameGeo   = new THREE.PlaneGeometry(0.16, 0.22);
    const flameMesh  = new THREE.Mesh(flameGeo, flameMat);
    flameMesh.position.y = 0.46;
    candleGroup.add(flameMesh);

    // Point light (off by default)
    const light = new THREE.PointLight(0xf0c96e, 0, 2.5);
    light.position.copy(pos);
    light.position.y += 0.55;
    light.castShadow = true;
    _scene.add(light);

    // Clickable hitbox (invisible larger cylinder)
    const hitGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hit    = new THREE.Mesh(hitGeo, hitMat);
    hit.position.y = 0.25;
    hit.userData   = { type: 'candle', index: i };
    candleGroup.add(hit);

    _cakeMain.add(candleGroup);
    _candles.push({ group: candleGroup, flameMesh, light, lit: false, hit });
  });

  // ── Knife (hidden until cutting phase) ───────────────────────────────────
  _knife = new THREE.Group();
  _knife.visible = false;

  const bladeGeo = new THREE.BoxGeometry(0.06, 0.55, 0.008);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.15 });
  const blade    = new THREE.Mesh(bladeGeo, bladeMat);
  blade.position.y = -0.22;
  _knife.add(blade);

  const handleGeo = new THREE.BoxGeometry(0.1, 0.25, 0.025);
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x2a1520, roughness: 0.8 });
  const handle    = new THREE.Mesh(handleGeo, handleMat);
  handle.position.y = 0.14;
  _knife.add(handle);

  _knife.position.set(0, 3.2, 1.6);
  _scene.add(_knife);

  // ── Sealed letter (hidden until cake is cut) ──────────────────────────────
  _letter = new THREE.Group();
  _letter.visible = false;

  const envGeo = new THREE.BoxGeometry(0.55, 0.38, 0.04);
  const envMat = new THREE.MeshStandardMaterial({ color: 0xfdf6ef, roughness: 0.9 });
  const env    = new THREE.Mesh(envGeo, envMat);
  _letter.add(env);

  // V-fold flap on top
  const flapShape = new THREE.Shape();
  flapShape.moveTo(-0.275, 0);
  flapShape.lineTo(0, -0.18);
  flapShape.lineTo(0.275, 0);
  const flapGeo = new THREE.ShapeGeometry(flapShape);
  const flapMat = new THREE.MeshStandardMaterial({ color: 0xf2a0ae, side: THREE.DoubleSide, roughness: 0.8 });
  const flap    = new THREE.Mesh(flapGeo, flapMat);
  flap.position.set(0, 0.09, 0.021);
  _letter.add(flap);

  const sealGeo = new THREE.CircleGeometry(0.045, 16);
  const sealMat = new THREE.MeshStandardMaterial({ color: 0xe8637a, roughness: 0.5 });
  const seal    = new THREE.Mesh(sealGeo, sealMat);
  seal.position.set(0, -0.04, 0.022);
  _letter.add(seal);

  _letter.position.set(1.9, 0.22, 0);
  _scene.add(_letter);

  // ── Subtle star particles in background ───────────────────────────────────
  const starGeo  = new THREE.BufferGeometry();
  const starVerts = [];
  for (let i = 0; i < 320; i++) {
    starVerts.push(
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 18 + 3,
      (Math.random() - 0.5) * 30,
    );
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.04, transparent: true, opacity: 0.55 });
  _scene.add(new THREE.Points(starGeo, starMat));
}

// ─── Render loop ───────────────────────────────────────────────────────────

function _startRenderLoop() {
  let t = 0;
  const tick = () => {
    if (_isDestroyed) return;
    _rafId = requestAnimationFrame(tick);
    t += 0.016;

    // Flame flicker
    _candles.forEach(c => {
      if (!c.lit) return;
      const flicker = 0.85 + Math.sin(t * 18 + Math.random()) * 0.12;
      c.flameMesh.material.opacity = flicker;
      c.flameMesh.rotation.y += 0.06;
      c.light.intensity = flicker * 2.2;
    });

    // Knife bob during cutting phase
    if (_knife.visible && _phase === 'cuttingReady') {
      _knife.position.y = 3.2 + Math.sin(t * 2.2) * 0.12;
    }

    // Letter float after reveal
    if (_letter.visible) {
      _letter.position.y = 0.22 + Math.sin(t * 1.4) * 0.06;
      _letter.rotation.y = Math.sin(t * 0.7) * 0.12;
    }

    _renderer.render(_scene, _camera);
  };
  _rafId = requestAnimationFrame(tick);
}

function _stopRenderLoop() {
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
}

// ─── Camera control (drag orbit) ──────────────────────────────────────────

function _updateCamera() {
  const { azimuth, elevation } = _camAngle;
  _camera.position.set(
    CAM_RADIUS * Math.sin(azimuth) * Math.cos(elevation),
    CAM_RADIUS * Math.sin(elevation) + 1.0,
    CAM_RADIUS * Math.cos(azimuth) * Math.cos(elevation),
  );
  _camera.lookAt(0, 1.0, 0);
}

function _onPointerDown(e) {
  _drag.active = true;
  _drag.lastX  = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
  _drag.lastY  = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
}

function _onPointerMove(e) {
  if (!_drag.active) return;
  const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
  const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
  const dx = x - _drag.lastX;
  const dy = y - _drag.lastY;
  _drag.lastX = x;
  _drag.lastY = y;

  _camAngle.azimuth   -= dx * 0.008;
  _camAngle.elevation  = Math.max(-0.05, Math.min(0.55, _camAngle.elevation + dy * 0.005));
  _updateCamera();
}

function _onPointerUp() { _drag.active = false; }

// ─── Click/tap detection ──────────────────────────────────────────────────

function _onCanvasClick(e) {
  if (_isDestroyed) return;

  const rect = _canvas.getBoundingClientRect();
  _mouse.x =  ((e.clientX - rect.left)  / rect.width)  * 2 - 1;
  _mouse.y = -((e.clientY - rect.top)   / rect.height) * 2 + 1;

  _raycaster.setFromCamera(_mouse, _camera);

  if (_phase === 'candlesReady') {
    // Check candle hit meshes
    const hitMeshes = _candles.map(c => c.hit);
    const hits = _raycaster.intersectObjects(hitMeshes, true);
    if (hits.length > 0) {
      const obj  = hits[0].object;
      const data = obj.userData.type === 'candle' ? obj.userData
                 : obj.parent?.userData.type === 'candle' ? obj.parent.userData
                 : null;
      if (data) _lightCandle(data.index);
    }
  }

  if (_phase === 'cuttingReady') {
    _cutCake();
  }
}

// ─── Game logic ────────────────────────────────────────────────────────────

async function _lightCandle(index) {
  const c = _candles[index];
  if (c.lit) return;
  c.lit = true;
  _litCount++;

  // Animate flame in
  gsap.to(c.flameMesh.material, { opacity: 0.9, duration: 0.4, ease: 'power2.out' });
  gsap.to(c.light, { intensity: 2.0, duration: 0.5, ease: 'power2.out' });

  // Small particle burst at candle world position
  const pos3d   = new THREE.Vector3();
  c.group.getWorldPosition(pos3d);
  pos3d.y += 0.5;
  const projected = pos3d.clone().project(_camera);
  Particles.burst({
    x:      (projected.x + 1) / 2,
    y:      (-projected.y + 1) / 2,
    count:  18,
    spread: 0.5,
  });

  setNestedState('cake', { candlesLit: _litCount });

  // Prompt update
  const remaining = CANDLE_COUNT - _litCount;
  if (remaining > 0) {
    _setPrompt(`${remaining} candle${remaining > 1 ? 's' : ''} left… 🕯️`);
    Companion.say(['Beautiful! 🌟', 'Keep going! 💕', 'Almost there! ✨'][_litCount - 1], 2000);
  } else {
    _allCandlesLit();
  }
}

async function _allCandlesLit() {
  _phase = 'wishMoment';
  setNestedState('cake', { phase: 'wishMoment' });

  // Warm up ambient glow — increase all candle lights together
  _candles.forEach(c => gsap.to(c.light, { intensity: 3.5, distance: 5, duration: 1.5 }));

  // Background colour warm shift
  gsap.to(_scene.fog.color, { r: 0.08, g: 0.04, b: 0.06, duration: 2 });
  gsap.to(_scene.background, { r: 0.04, g: 0.02, b: 0.04, duration: 2 });

  await sleep(600);
  _setPrompt('Close your eyes and make a wish ✨');
  Companion.react('romantic', 'Make a wish… 💖', 5000);

  await sleep(4200);

  // Transition to cut phase
  _phase = 'cuttingReady';
  setNestedState('cake', { phase: 'cuttingReady' });

  _setPrompt('Now cut the cake! 🎂');

  // Reveal knife dropping in from above
  _knife.visible = true;
  gsap.from(_knife.position, { y: 5.5, duration: 1.0, ease: 'bounce.out' });

  Companion.react('surprised', 'Cut the cake! 🔪', 3000);
}

async function _cutCake() {
  if (_phase !== 'cuttingReady') return;
  _phase = 'cakeCut';
  setNestedState('cake', { phase: 'cakeCut', isCut: true });

  _setPrompt('');

  // Knife approaches cake cut seam
  await new Promise(r =>
    gsap.to(_knife.position, { x: 0.18, y: 1.85, z: 0.65, duration: 0.45, ease: 'power2.out', onComplete: r })
  );

  // Knife plunges down through cake
  await new Promise(r =>
    gsap.to(_knife.position, { y: 0.55, duration: 0.38, ease: 'power3.inOut', onComplete: r })
  );

  // Realistic cut: one proper slice separates and moves outward, preserving the whole cake
  if (_cakeSlice) {
    gsap.to(_cakeSlice.position, {
      x: 0.18,
      z: 0.55,
      y: 0.01,
      duration: 1.2,
      ease: 'power2.out',
    });
    gsap.to(_cakeSlice.rotation, {
      y: 0.08,
      duration: 1.2,
      ease: 'power2.out',
    });
  }

  // Slide knife out smoothly
  await sleep(300);
  gsap.to(_knife.position, { x: 1.5, z: 2.0, y: 1.6, duration: 0.65, ease: 'power2.in' });
  gsap.to(_knife.rotation, { z: -0.3, duration: 0.65 });

  // Celebration
  Particles.burst({ count: 120, spread: 2.4 });
  Companion.react('celebrating', 'YAAAAY!! Happy Birthday!! 🎉🎂', 5000);

  import('../audio.js').then(({ AudioManager }) => {
    AudioManager.playSFX('assets/audio/sfx-success.mp3', 0.8);
    // Keep current background music (bgm-main.mp3) playing continuously
  }).catch(() => {});

  // Show the post-cut GIF celebration
  const gifCut = _hud?.querySelector('#gif-cake-cut');
  if (gifCut) {
    gifCut.classList.add('is-visible');
    // Hide it again after 4 seconds so it doesn't cover the letter button
    setTimeout(() => gifCut.classList.remove('is-visible'), 4000);
  }

  // Hide the ambient GIF during the cut celebration
  const gifAmbientHide = _hud?.querySelector('.gif-cake-ambient');
  if (gifAmbientHide) gifAmbientHide.classList.remove('is-visible');

  await sleep(1200);

  // Float the sealed letter in
  _letter.visible = true;
  _letter.scale.setScalar(0.01);
  gsap.to(_letter.scale, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(1.8)' });

  // Romantic ambient glow
  const glow = new THREE.PointLight(0xf2a0ae, 1.8, 4);
  glow.position.set(1.9, 0.8, 0);
  _scene.add(glow);

  await sleep(1800);

  _setPrompt('A sealed letter appeared beside the cake…');

  await sleep(1800);

  // Show "Read my letter" button
  const btn = _hud.querySelector('#btn-cake-next');
  if (btn) {
    gsap.to(btn, { opacity: 1, y: 0, pointerEvents: 'auto', duration: 0.7, ease: 'back.out(1.5)' });
  }
}

// ─── Navigation ────────────────────────────────────────────────────────────

function _handleNextPhase() {
  navigateTo(() => import('./letter.js'), { type: 'dissolve', duration: 1500 });
}

// ─── Events ────────────────────────────────────────────────────────────────

function _wireEvents() {
  // Drag to orbit
  _canvas.addEventListener('mousedown',  _onPointerDown, { passive: true });
  _canvas.addEventListener('touchstart', e => _onPointerDown(e.touches[0] ?? e), { passive: true });
  window.addEventListener('mousemove',   _onPointerMove, { passive: true });
  window.addEventListener('touchmove',   e => _onPointerMove(e.touches[0] ?? e), { passive: true });
  window.addEventListener('mouseup',     _onPointerUp,   { passive: true });
  window.addEventListener('touchend',    _onPointerUp,   { passive: true });

  // Click / tap for candle lighting and cutting
  _canvas.addEventListener('click', _onCanvasClick);
  _canvas.addEventListener('touchend', e => {
    e.preventDefault();
    if (e.changedTouches[0]) {
      _onCanvasClick(e.changedTouches[0]);
    }
  }, { passive: false });

  // Resize
  window.addEventListener('resize', _onResize, { passive: true });

  // CTA button
  _hud.querySelector('#btn-cake-next')?.addEventListener('click', _handleNextPhase);
}

function _onResize() {
  if (!_renderer || _isDestroyed) return;
  _renderer.setSize(window.innerWidth, window.innerHeight);
  _camera.aspect = window.innerWidth / window.innerHeight;
  _camera.updateProjectionMatrix();
}

// ─── HUD helpers ────────────────────────────────────────────────────────────

function _buildHUD() {
  return `
    <p class="cake-prompt" id="cake-prompt"></p>
    <button id="btn-cake-next" class="btn-cake-next"
            style="opacity:0; pointer-events:none; transform:translateY(16px)">
      Read my letter 💌
    </button>
    <p class="cake-drag-hint">Drag to look around 👁️</p>
    <!-- Decorative GIFs (pointer-events:none via CSS) -->
    <img class="gif-overlay gif-cake-ambient"
         src="gif/cake section 1 .gif"
         alt=""
         aria-hidden="true" />
    <img class="gif-overlay gif-cake-cut"
         id="gif-cake-cut"
         src="gif/after cake cuting.gif"
         alt=""
         aria-hidden="true" />
  `;
}

function _setPrompt(text) {
  const el = _hud?.querySelector('#cake-prompt');
  if (!el) return;
  gsap.to(el, {
    opacity: 0, duration: 0.3, onComplete: () => {
      el.textContent = text;
      if (text) gsap.to(el, { opacity: 1, duration: 0.4 });
    }
  });
}

// ─── Dispose ───────────────────────────────────────────────────────────────

function _disposeThree() {
  _stopRenderLoop();
  // Dispose all geometries + materials in the scene
  _scene?.traverse(obj => {
    if (obj.isMesh) {
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material?.dispose();
    }
  });
  _renderer?.dispose();
  _renderer = null;
  _scene    = null;
  _camera   = null;
  _candles  = [];
  _knife    = null;
  _letter   = null;
  _cake     = null;
  _cakeMain = null;
  _cakeSlice = null;

  // Remove event listeners
  window.removeEventListener('mousemove',  _onPointerMove);
  window.removeEventListener('touchmove',  _onPointerMove);
  window.removeEventListener('mouseup',    _onPointerUp);
  window.removeEventListener('touchend',   _onPointerUp);
  window.removeEventListener('resize',     _onResize);
}

// ─── Styles ────────────────────────────────────────────────────────────────

function _injectStyles() {
  if (document.getElementById('cake-styles')) return;
  const s = document.createElement('style');
  s.id = 'cake-styles';
  s.textContent = `
  /* ── Scene shell (full viewport, no overflow) ── */
  .scene-cake {
    background: #06030e;
    overflow: hidden;
    display: block;
    padding: 0;
  }

  /* ── Three.js canvas ── */
  .cake-canvas {
    position: absolute;
    inset: 0;
    width: 100% !important;
    height: 100% !important;
    display: block;
    cursor: grab;
    touch-action: none;
  }
  .cake-canvas:active { cursor: grabbing; }

  /* ── HUD overlay ── */
  .cake-hud {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    padding-bottom: var(--space-12);
    gap: var(--space-6);
    pointer-events: none;
  }

  .cake-prompt {
    position: absolute;
    top: 14vh;
    left: 50%;
    transform: translateX(-50%);
    font-family: var(--font-display);
    font-size: clamp(var(--text-lg), 3.5vw, var(--text-2xl));
    color: var(--text-primary);
    text-shadow: 0 2px 16px rgba(0,0,0,0.9), 0 0 40px rgba(240,201,110,0.3);
    text-align: center;
    white-space: nowrap;
    max-width: none;
    pointer-events: none;
  }

  .cake-drag-hint {
    position: absolute;
    bottom: var(--space-4);
    left: 50%;
    transform: translateX(-50%);
    font-size: var(--text-xs);
    color: rgba(253,246,239,0.30);
    letter-spacing: 0.08em;
    pointer-events: none;
    max-width: none;
    white-space: nowrap;
    animation: gentleFade 3s ease-in-out 2s infinite alternate;
  }

  .btn-cake-next {
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--accent);
    color: var(--bg-base);
    font-family: var(--font-body);
    font-size: var(--text-base);
    font-weight: 500;
    padding: 0.9rem 2.4rem;
    border: none;
    border-radius: 40px;
    cursor: pointer;
    box-shadow: 0 4px 24px rgba(232,99,122,0.5);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .btn-cake-next:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(232,99,122,0.65);
  }
  .btn-cake-next:active  { transform: scale(0.96); }
  .btn-cake-next:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }

  @keyframes gentleFade {
    from { opacity: 0.15; }
    to   { opacity: 0.45; }
  }
  `;
  document.head.appendChild(s);
}
