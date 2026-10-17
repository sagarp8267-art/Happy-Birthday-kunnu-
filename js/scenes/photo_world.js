/**
/**
 * scenes/photo_world.js — Phase 6: Three.js Galaxy Photo World
 *
 * A dedicated 3D galaxy/space environment (second of two Three.js scenes).
 * 9 photo frames float in a spherical arrangement around the user.
 * Drag to orbit the camera. Tap a photo to zoom it forward — tap again to return.
 * Companion appears on the right side and guides exit to the Gift section.
 *
 * Dependencies: Three.js r168 (Phase 1 import map), GSAP
 */

import * as THREE  from 'three';
import gsap        from 'gsap';
import { navigateTo } from '../app.js';
import { Companion }  from '../companion.js';
import { Particles }  from '../utils/particles.js';
import { sleep }      from '../utils/dom.js';

// ─── Photo detection & texture utilities ───────────────────────────────────

/** Reusable Three.js TextureLoader */
const _textureLoader = new THREE.TextureLoader();

/** Active photos dynamically discovered from assets/images/ */
let _activePhotos = [];

/**
 * Adjust texture UV repeat and offset so the image covers the plane
 * without distortion or stretching (equivalent to CSS object-fit: cover).
 */
function _fitTextureToPlane(texture, planeWidth, planeHeight) {
  const img = texture.image;
  if (!img || !img.width || !img.height) return;

  const imgAspect   = img.width / img.height;
  const planeAspect = planeWidth / planeHeight;

  if (imgAspect > planeAspect) {
    // Image is wider than plane -> crop left and right
    const s = planeAspect / imgAspect;
    texture.repeat.set(s, 1);
    texture.offset.set((1 - s) / 2, 0);
  } else {
    // Image is taller than plane -> crop top and bottom
    const s = imgAspect / planeAspect;
    texture.repeat.set(1, s);
    texture.offset.set(0, (1 - s) / 2);
  }
  texture.needsUpdate = true;
}

/** Render a shimmering romantic placeholder while the high-res photo loads */
function _makePlaceholderTexture(label, emoji = '📸') {
  const size = 512;
  const c    = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  // Romantic deep gradient
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#261033');
  grad.addColorStop(0.5, '#170824');
  grad.addColorStop(1, '#0c0314');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle border glow
  ctx.strokeStyle = 'rgba(242, 160, 174, 0.28)';
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 16, size - 32, size - 32);

  // Shimmering icon
  ctx.font         = `${size * 0.26}px serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2 - 25);

  // Label text
  ctx.font      = `300 ${size * 0.065}px 'DM Sans', sans-serif`;
  ctx.fillStyle = 'rgba(253,246,239,0.85)';
  ctx.fillText(label || 'Loading…', size / 2, size * 0.78);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Automatically discovers all available images from assets/images/
 * Tries server directory listing first, then probes candidate files.
 */
async function _detectImages() {
  const detected = [];
  const seenNorms = new Set();

  function addIfValid(src, defaultLabel = '') {
    const norm = src.toLowerCase().replace(/%20|\s/g, '');
    if (!seenNorms.has(norm)) {
      seenNorms.add(norm);
      detected.push({ src, label: defaultLabel });
    }
  }

  // 1. Try server directory listing (supported when hosted via local dev servers)
  try {
    const res = await fetch('assets/images/');
    if (res.ok) {
      const html = await res.text();
      const regex = /href=["']([^"']+\.(?:jpg|jpeg|png|webp|gif))["']/gi;
      let match;
      while ((match = regex.exec(html)) !== null) {
        let filename = match[1].split('/').pop().split('?')[0];
        if (filename && !filename.startsWith('.')) {
          addIfValid(`assets/images/${decodeURIComponent(filename)}`);
        }
      }
    }
  } catch (_) {
    // Directory listing not available; fall back to candidate probe
  }

  // 2. Candidate probe list (known files + common naming patterns)
  const candidateNames = [
    'photo1.jpg', 'photo 1.jpg',
    'photo2.jpg', 'photo 2.jpg',
    'photo3.jpg', 'photo 3.jpg',
    'photo4.jpg', 'photo 4.jpg',
    'photo5.jpg', 'photo 5.jpg',
    'photo6.jpg', 'photo 6.jpg',
    'photo7.jpg', 'photo 7.jpg',
    'photo8.jpg', 'photo 8.jpg',
    'photo9.jpg', 'photo 9.jpg',
    'photo10.jpg', 'photo 10.jpg',
    'photo11.jpg', 'photo12.jpg',
    'img1.jpg', 'img2.jpg', 'img3.jpg',
    'image1.jpg', 'image2.jpg', 'image3.jpg',
  ];

  const toProbe = candidateNames.filter(name => {
    const norm = `assets/images/${name}`.toLowerCase().replace(/%20|\s/g, '');
    return !seenNorms.has(norm);
  });

  if (toProbe.length > 0) {
    const probeResults = await Promise.all(
      toProbe.map(name => {
        const path = `assets/images/${name}`;
        return new Promise(resolve => {
          const img = new Image();
          img.onload = () => resolve({ path, ok: true });
          img.onerror = () => resolve({ path, ok: false });
          img.src = encodeURI(path);
        });
      })
    );

    for (const r of probeResults) {
      if (r.ok) {
        addIfValid(r.path);
      }
    }
  }

  // 3. Fallback to confirmed known files if probing found nothing
  if (detected.length === 0) {
    const fallbackFiles = [
      'assets/images/photo1.jpg',
      'assets/images/photo2.jpg',
      'assets/images/photo3.jpg',
      'assets/images/photo4.jpg',
      'assets/images/photo5.jpg',
      'assets/images/photo6.jpg',
      'assets/images/photo8.jpg',
      'assets/images/photo9.jpg',
    ];
    fallbackFiles.forEach(src => addIfValid(src));
  }

  // 4. Romantic captions
  const captions = [
    'The beginning ✨',
    'Coffee mornings ☕',
    'Adventures together 🌍',
    'Silly moments 😂',
    'Late nights 🌙',
    'Pure joy 🎉',
    'Our favourite spot 🌸',
    'You & me 💕',
    'Always & forever 🌟',
    'Unforgettable smiles ✨',
    'Treasured days 💫',
    'My favorite human 🥰',
  ];

  return detected.map((item, idx) => ({
    src: item.src,
    label: item.label || captions[idx % captions.length],
    emoji: '📸',
  }));
}

// ─── Module state ──────────────────────────────────────────────────────────

let _container   = null;
let _root        = null;
let _canvas      = null;
let _hud         = null;

// Three.js
let _renderer    = null;
let _scene       = null;
let _camera      = null;
let _rafId       = null;

// Photo objects
let _photoMeshes = [];        // { mesh, originalPos, originalQuat, label, zoomed }
let _zoomedPhoto = null;      // currently zoomed photo object

// Drag orbit state
let _drag = { active: false, lastX: 0, lastY: 0, moved: false };
let _camSpherical = { theta: 0, phi: Math.PI / 2 };  // spherical angles
const CAM_RADIUS  = 0.01;   // camera stays near origin; photos orbit around it

// Auto-rotate
let _autoRotate   = true;
let _autoRotSpeed = 0.0008;

// Raycaster
const _raycaster  = new THREE.Raycaster();
const _mouse      = new THREE.Vector2();

let _isDestroyed  = false;

// ─── Public API ────────────────────────────────────────────────────────────

export async function init(container) {
  _container   = container;
  _isDestroyed = false;
  _zoomedPhoto = null;
  _photoMeshes = [];

  _root = document.createElement('section');
  _root.className = 'scene scene-photo-world';
  _root.setAttribute('aria-label', '3D Photo Galaxy');

  _canvas = document.createElement('canvas');
  _canvas.className = 'photo-canvas';
  _root.appendChild(_canvas);

  _hud = document.createElement('div');
  _hud.className = 'photo-hud';
  _hud.innerHTML = _buildHUD();
  _root.appendChild(_hud);

  _injectStyles();
  _initThree();

  // Detect and load all available images from assets/images/
  _activePhotos = await _detectImages();

  _buildGalaxy();
  _wireEvents();

  _container.appendChild(_root);
}

export async function enter() {
  _root.classList.add('is-active');
  _startRenderLoop();

  // Keep bgm-emotional.mp3 looping continuously without interruption
  import('../audio.js').then(({ AudioManager }) => {
    AudioManager.playMusic('assets/audio/bgm-emotional.mp3', true, 0.55);
  }).catch(() => {});

  // Companion: stays on the RIGHT side (using the Phase 1 position token)
  const companionEl = document.getElementById('companion');
  if (companionEl) {
    companionEl.style.setProperty('--companion-bottom', '50%');
    companionEl.style.setProperty('--companion-right',  'var(--space-6)');
  }

  Companion.show();
  await sleep(1200);
  Companion.react('romantic', 'Look around… explore the memories 📸', 5000);

  // Fade in HUD
  const title = _hud.querySelector('.photo-title');
  gsap.to(title, { opacity: 1, y: 0, duration: 1.2, delay: 0.6, ease: 'power3.out' });

  // Fade in decorative GIFs with a small delay
  setTimeout(() => {
    const gifP1 = _hud.querySelector('.gif-photo-1');
    const gifP2 = _hud.querySelector('.gif-photo-2');
    if (gifP1) gifP1.classList.add('is-visible');
    if (gifP2) gifP2.classList.add('is-visible');
  }, 2000);

  await sleep(6000);
  Companion.react('idle', 'Tap a photo to see it closer 💕', 4000);

  await sleep(5000);
  Companion.say('When you\'re ready, tap me to continue 🎁', 4000);

  // Make companion clickable → navigate to gifts
  const companionBtn = document.getElementById('companion');
  if (companionBtn) {
    companionBtn.style.pointerEvents = 'auto';
    companionBtn.style.cursor = 'pointer';
    companionBtn.addEventListener('click', _handleNextPhase, { once: true });
  }

  // Also show the HUD "next" button after a while
  await sleep(3000);
  const btn = _hud.querySelector('#btn-photo-next');
  gsap.to(btn, { opacity: 1, y: 0, pointerEvents: 'auto', duration: 0.7, ease: 'back.out(1.4)' });
}

export async function exit() {
  _stopRenderLoop();
  Particles.stop();
  gsap.killTweensOf('*');

  // Restore companion position
  const companionEl = document.getElementById('companion');
  if (companionEl) {
    companionEl.style.setProperty('--companion-bottom', 'var(--space-6)');
    companionEl.style.setProperty('--companion-right',  'var(--space-6)');
    companionEl.style.pointerEvents = 'none';
    companionEl.style.cursor = '';
  }
  Companion.hide();

  _root.classList.remove('is-active');
  await new Promise(r =>
    gsap.to(_root, { opacity: 0, duration: 0.6, ease: 'power2.in', onComplete: r })
  );
}

export function destroy() {
  _stopRenderLoop();
  _disposeThree();
  _activePhotos = [];
  _root?.remove();
  _root = null;
  _container = null;
  _isDestroyed = true;
}

// ─── Three.js setup ────────────────────────────────────────────────────────

function _initThree() {
  _renderer = new THREE.WebGLRenderer({
    canvas:    _canvas,
    antialias: true,
    alpha:     false,
  });
  _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  _renderer.setSize(window.innerWidth, window.innerHeight);
  // NoToneMapping ensures MeshBasicMaterial photos render at their exact
  // original colours — ACESFilmic was crushing photo brightness.
  _renderer.toneMapping        = THREE.NoToneMapping;
  _renderer.toneMappingExposure = 1.0;

  _scene = new THREE.Scene();
  _scene.background = new THREE.Color(0x03010a);
  _scene.fog = new THREE.FogExp2(0x03010a, 0.04);

  _camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 80);
  _camera.position.set(0, 0, 0.01);
  _camera.lookAt(0, 0, 0);
}

function _buildGalaxy() {
  // ── Ambient light ─────────────────────────────────────────────────────────
  _scene.add(new THREE.AmbientLight(0x1a0628, 6));

  const hemi = new THREE.HemisphereLight(0x3d1060, 0x0a0612, 1.2);
  _scene.add(hemi);

  // Soft pink rim fill
  const fill = new THREE.PointLight(0xf2a0ae, 1.4, 30);
  fill.position.set(-8, 4, -8);
  _scene.add(fill);

  // Gold accent
  const accent = new THREE.PointLight(0xf0c96e, 0.8, 25);
  accent.position.set(8, -3, 6);
  _scene.add(accent);

  // ── Galaxy particle field ─────────────────────────────────────────────────
  _buildStarField();
  _buildNebula();

  // ── Photo frames ──────────────────────────────────────────────────────────
  // Arrange photos evenly on a sphere of radius ~7.2
  const RADIUS = 7.2;
  const count = _activePhotos.length;
  _activePhotos.forEach((cfg, i) => {
    // Golden-angle spherical distribution for even spread
    const phi   = Math.acos(1 - 2 * (i + 0.5) / count);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;

    const x = RADIUS * Math.sin(phi) * Math.cos(theta);
    const y = RADIUS * Math.cos(phi) * 0.72;   // compress Y slightly
    const z = RADIUS * Math.sin(phi) * Math.sin(theta);

    const pos = new THREE.Vector3(x, y, z);
    _buildPhotoFrame(cfg, pos, i);
  });
}

function _buildStarField() {
  // Two layers: tiny white stars + slightly larger coloured ones
  const positions = [];
  const colors    = [];
  const col       = new THREE.Color();

  for (let i = 0; i < 1800; i++) {
    // Random point on a large sphere
    const r     = 25 + Math.random() * 20;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    positions.push(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
    );

    // Slight colour tint: white → blush → gold
    const t = Math.random();
    if (t < 0.7)      col.set(0xffffff);
    else if (t < 0.85) col.set(0xf2a0ae);
    else               col.set(0xf0c96e);
    colors.push(col.r, col.g, col.b);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size:         0.12,
    vertexColors: true,
    transparent:  true,
    opacity:      0.75,
    sizeAttenuation: true,
  });
  _scene.add(new THREE.Points(geo, mat));
}

function _buildNebula() {
  // Large translucent glowing cloud spheres for ambience
  const nebulaData = [
    { pos: [-6,  2, -10], col: 0x3d0060, r: 7, op: 0.18 },
    { pos: [ 9, -3,  -8], col: 0x600030, r: 6, op: 0.14 },
    { pos: [-4, -5,   8], col: 0x002060, r: 5, op: 0.12 },
  ];

  nebulaData.forEach(n => {
    const geo = new THREE.SphereGeometry(n.r, 16, 16);
    const mat = new THREE.MeshBasicMaterial({
      color:       n.col,
      transparent: true,
      opacity:     n.op,
      side:        THREE.BackSide,
      depthWrite:  false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...n.pos);
    _scene.add(mesh);
  });
}

/** Build a single framed photo plane at `pos` */
function _buildPhotoFrame(cfg, pos, index) {
  const group = new THREE.Group();
  group.position.copy(pos);
  // Face the camera (origin) initially
  group.lookAt(0, 0, 0);

  // 1. Outer gallery frame (soft ivory with warm ambient glow)
  const frameGeo = new THREE.BoxGeometry(2.0, 2.45, 0.08);
  const frameMat = new THREE.MeshStandardMaterial({
    color:     0xfdf6ef,
    roughness: 0.35,
    metalness: 0.12,
    emissive:  0x1a0d18,
    emissiveIntensity: 0.25,
  });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.castShadow = true;
  group.add(frame);

  // 2. Inner passe-partout / photo mount inset
  const mountGeo = new THREE.PlaneGeometry(1.82, 2.22);
  const mountMat = new THREE.MeshStandardMaterial({
    color:     0xf7f0e8,
    roughness: 0.75,
  });
  const mount = new THREE.Mesh(mountGeo, mountMat);
  mount.position.set(0, 0, 0.042);
  group.add(mount);

  // 3. Photo surface — MeshBasicMaterial ignores scene lighting entirely,
  //    rendering the texture at 100% original brightness with no tinting.
  const photoW = 1.72;
  const photoH = 1.88;
  const photoGeo = new THREE.PlaneGeometry(photoW, photoH);

  // Initial placeholder texture (shown while the real image loads)
  const initialTex = _makePlaceholderTexture(cfg.label, cfg.emoji || '📸');

  // ✅ MeshBasicMaterial = unlit, no colour influence from scene lights
  const photoMat = new THREE.MeshBasicMaterial({
    map:  initialTex,
    side: THREE.FrontSide,
  });
  const photo = new THREE.Mesh(photoGeo, photoMat);
  photo.position.set(0, 0.10, 0.046);
  group.add(photo);

  // Load the real image texture at full fidelity
  if (cfg.src) {
    _textureLoader.load(
      encodeURI(cfg.src),
      (tex) => {
        // Correct colour space so colours match the original photo
        tex.colorSpace    = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter     = THREE.LinearMipmapLinearFilter;
        tex.magFilter     = THREE.LinearFilter;
        tex.anisotropy    = _renderer ? Math.min(_renderer.capabilities.getMaxAnisotropy(), 16) : 4;
        _fitTextureToPlane(tex, photoW, photoH);
        photoMat.map = tex;
        photoMat.needsUpdate = true;
      },
      undefined,
      (err) => {
        console.warn(`[photo_world] Texture load warning for ${cfg.src}:`, err);
        // Fallback: show a styled emoji placeholder instead
        const fallback = _makeEmojiTexture(cfg.emoji || '📸', cfg.label);
        photoMat.map = fallback;
        photoMat.needsUpdate = true;
      }
    );
  }

  // 4. Subtle romantic halo glow behind frame
  const glowGeo = new THREE.PlaneGeometry(2.5, 3.0);
  const glowMat = new THREE.MeshBasicMaterial({
    color:       0xf2a0ae,
    transparent: true,
    opacity:     0.07,
    depthWrite:  false,
    side:        THREE.BackSide,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.z = -0.08;
  group.add(glow);

  // 5. Invisible hit-plane for responsive clicking and touch taps
  const hitGeo = new THREE.PlaneGeometry(2.3, 2.75);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  const hit    = new THREE.Mesh(hitGeo, hitMat);
  hit.position.z = 0.06;
  hit.userData   = { type: 'photo', index };
  group.add(hit);

  _scene.add(group);

  _photoMeshes.push({
    group,
    frame,
    glow,
    originalPos:  pos.clone(),
    originalQuat: new THREE.Quaternion().copy(group.quaternion),
    label:        cfg.label,
    zoomed:       false,
    index,
  });
}

/** Render emoji + label to a canvas and return a Three.js texture */
function _makeEmojiTexture(emoji, label) {
  const size = 512;
  const c    = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#1a0a28');
  grad.addColorStop(1, '#0a0612');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Emoji
  ctx.font        = `${size * 0.35}px serif`;
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2 - 30);

  // Label
  ctx.font        = `300 ${size * 0.07}px 'DM Sans', sans-serif`;
  ctx.fillStyle   = 'rgba(253,246,239,0.75)';
  ctx.fillText(label, size / 2, size * 0.78);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ─── Render loop ───────────────────────────────────────────────────────────

function _startRenderLoop() {
  let t = 0;
  const tick = () => {
    if (_isDestroyed) return;
    _rafId = requestAnimationFrame(tick);
    t += 0.012;

    // Auto-rotate: slowly spin the whole scene group (photos orbit camera)
    if (_autoRotate && !_drag.active) {
      _camSpherical.theta += _autoRotSpeed;
    }

    // Apply spherical camera orientation (camera stays at ~origin, looks outward)
    const { theta, phi } = _camSpherical;
    _camera.rotation.order = 'YXZ';
    _camera.rotation.y = -theta;
    _camera.rotation.x = -(phi - Math.PI / 2);

    // Gentle photo float: each frame bobs slightly
    _photoMeshes.forEach((p, i) => {
      if (!p.zoomed) {
        p.group.position.y = p.originalPos.y + Math.sin(t + i * 0.7) * 0.08;
      }
    });

    _renderer.render(_scene, _camera);
  };
  _rafId = requestAnimationFrame(tick);
}

function _stopRenderLoop() {
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
}

// ─── Drag orbit ────────────────────────────────────────────────────────────

function _onPointerDown(e) {
  const pt = e.touches?.[0] ?? e;
  _drag.active = true;
  _drag.moved  = false;
  _drag.lastX  = pt.clientX;
  _drag.lastY  = pt.clientY;
  _autoRotate  = false;
}

function _onPointerMove(e) {
  if (!_drag.active) return;
  const pt = e.touches?.[0] ?? e;
  const dx = pt.clientX - _drag.lastX;
  const dy = pt.clientY - _drag.lastY;
  _drag.lastX = pt.clientX;
  _drag.lastY = pt.clientY;

  if (Math.abs(dx) + Math.abs(dy) > 2) _drag.moved = true;

  _camSpherical.theta -= dx * 0.006;
  _camSpherical.phi    = Math.max(0.3, Math.min(Math.PI - 0.3,
                           _camSpherical.phi + dy * 0.005));
}

function _onPointerUp(e) {
  if (!_drag.active) return;
  _drag.active = false;
  // Resume auto-rotate after a pause
  setTimeout(() => { _autoRotate = true; }, 3000);
}

// ─── Click / tap ───────────────────────────────────────────────────────────

function _onCanvasClick(e) {
  if (_isDestroyed || _drag.moved) return;

  const rect = _canvas.getBoundingClientRect();
  const pt   = e.changedTouches?.[0] ?? e;
  _mouse.x   =  ((pt.clientX - rect.left) / rect.width)  * 2 - 1;
  _mouse.y   = -((pt.clientY - rect.top)  / rect.height) * 2 + 1;

  _raycaster.setFromCamera(_mouse, _camera);

  const hitMeshes = _photoMeshes.map(p => p.group.children.find(c => c.userData.type === 'photo')).filter(Boolean);
  const hits      = _raycaster.intersectObjects(hitMeshes, false);

  if (hits.length > 0) {
    const hit   = hits[0].object;
    const index = hit.userData.index;
    const photo = _photoMeshes[index];
    if (photo) _toggleZoom(photo);
  }
}

function _toggleZoom(photo) {
  if (photo.zoomed) {
    _unzoomPhoto(photo);
  } else {
    // Un-zoom any currently zoomed photo first
    if (_zoomedPhoto && _zoomedPhoto !== photo) _unzoomPhoto(_zoomedPhoto);
    _zoomPhoto(photo);
  }
}

function _zoomPhoto(photo) {
  photo.zoomed = true;
  _zoomedPhoto = photo;
  _autoRotate  = false;

  // Responsive zoom distance and scale for mobile vs desktop
  const isMobile = window.innerWidth < 768;
  const dist     = isMobile ? -4.2 : -3.5;
  const scale    = isMobile ? 1.22 : 1.45;

  // Move in front of camera
  // Camera looks toward -Z in its local space; place photo directly in front
  const forward = new THREE.Vector3(0, 0, dist);
  forward.applyQuaternion(_camera.quaternion);

  const targetPos = new THREE.Vector3().copy(_camera.position).add(forward);

  // GSAP animate position
  gsap.to(photo.group.position, {
    x:        targetPos.x,
    y:        targetPos.y,
    z:        targetPos.z,
    duration: 0.65,
    ease:     'power3.out',
  });

  // Scale up
  gsap.to(photo.group.scale, { x: scale, y: scale, z: scale, duration: 0.55, ease: 'back.out(1.5)' });

  // Glow up
  gsap.to(photo.glow.material, { opacity: 0.28, duration: 0.4 });

  // Show caption
  const caption = _hud.querySelector('.photo-caption');
  if (caption) {
    caption.textContent = photo.label;
    gsap.to(caption, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
  }

  Companion.say('Tap again to send it back 👆', 2500);
}

function _unzoomPhoto(photo) {
  photo.zoomed = false;
  if (_zoomedPhoto === photo) _zoomedPhoto = null;

  // Restore original position
  gsap.to(photo.group.position, {
    x:        photo.originalPos.x,
    y:        photo.originalPos.y,
    z:        photo.originalPos.z,
    duration: 0.6,
    ease:     'power3.inOut',
  });
  gsap.to(photo.group.scale, { x: 1, y: 1, z: 1, duration: 0.45, ease: 'power2.out' });
  gsap.to(photo.glow.material, { opacity: 0.07, duration: 0.3 });

  // Hide caption
  const caption = _hud.querySelector('.photo-caption');
  if (caption) gsap.to(caption, { opacity: 0, y: 8, duration: 0.3 });

  // Resume auto-rotate after a moment
  setTimeout(() => { _autoRotate = true; }, 2000);
}

// ─── Navigation ────────────────────────────────────────────────────────────

function _handleNextPhase() {
  navigateTo(() => import('./final_surprise.js'), { type: 'dissolve', duration: 1500 });
}

// ─── Events ────────────────────────────────────────────────────────────────

function _wireEvents() {
  _canvas.addEventListener('mousedown',   _onPointerDown, { passive: true });
  _canvas.addEventListener('touchstart',  e => _onPointerDown(e), { passive: true });
  window.addEventListener('mousemove',    _onPointerMove, { passive: true });
  window.addEventListener('touchmove',    e => _onPointerMove(e), { passive: true });
  window.addEventListener('mouseup',      _onPointerUp,   { passive: true });
  window.addEventListener('touchend',     _onPointerUp,   { passive: true });

  _canvas.addEventListener('click',    _onCanvasClick);
  _canvas.addEventListener('touchend', e => {
    e.preventDefault();
    _onPointerUp(e);
    _onCanvasClick(e);
  }, { passive: false });

  window.addEventListener('resize', _onResize, { passive: true });

  _hud.querySelector('#btn-photo-next')
    ?.addEventListener('click', _handleNextPhase);
}

function _onResize() {
  if (!_renderer || _isDestroyed) return;
  _renderer.setSize(window.innerWidth, window.innerHeight);
  _camera.aspect = window.innerWidth / window.innerHeight;
  _camera.updateProjectionMatrix();
}

// ─── HUD ───────────────────────────────────────────────────────────────────

function _buildHUD() {
  return `
    <h2 class="photo-title display">A million little moments…</h2>
    <p  class="photo-caption"></p>
    <div class="photo-hud-bottom">
      <p class="photo-drag-hint">Drag to explore · Tap a photo to enlarge 👆</p>
      <button id="btn-photo-next" class="btn-photo-next"
              style="opacity:0; pointer-events:none; transform:translateY(14px)">
        Gifts await 🎁
      </button>
    </div>
    <!-- Decorative GIFs (pointer-events:none via CSS) -->
    <img class="gif-overlay gif-photo-1"
         src="gif/photo world section 1.gif"
         alt=""
         aria-hidden="true" />
    <img class="gif-overlay gif-photo-2"
         src="gif/photo world section 2.gif"
         alt=""
         aria-hidden="true" />
  `;
}

// ─── Dispose ───────────────────────────────────────────────────────────────

function _disposeThree() {
  _scene?.traverse(obj => {
    if (obj.isMesh) {
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => { m.map?.dispose(); m.dispose(); });
    }
  });
  _renderer?.dispose();
  _renderer = null;
  _scene    = null;
  _camera   = null;
  _photoMeshes = [];
  _zoomedPhoto = null;

  window.removeEventListener('mousemove',  _onPointerMove);
  window.removeEventListener('touchmove',  _onPointerMove);
  window.removeEventListener('mouseup',    _onPointerUp);
  window.removeEventListener('touchend',   _onPointerUp);
  window.removeEventListener('resize',     _onResize);
}

// ─── Styles ────────────────────────────────────────────────────────────────

function _injectStyles() {
  if (document.getElementById('photo-world-styles')) return;
  const s = document.createElement('style');
  s.id = 'photo-world-styles';
  s.textContent = `
  .scene-photo-world {
    background: #03010a;
    overflow: hidden;
    display: block;
    padding: 0;
    user-select: none;
  }

  .photo-canvas {
    position: absolute;
    inset: 0;
    width: 100% !important;
    height: 100% !important;
    display: block;
    cursor: grab;
    touch-action: none;
  }
  .photo-canvas:active { cursor: grabbing; }

  /* ── HUD ── */
  .photo-hud {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-12) var(--space-6) var(--space-12);
    pointer-events: none;
  }

  .photo-title {
    font-size: clamp(var(--text-xl), 4vw, var(--text-3xl));
    color: var(--text-primary);
    text-shadow: 0 2px 20px rgba(0,0,0,0.9);
    opacity: 0;
    transform: translateY(-10px);
    text-align: center;
  }

  /* ── Photo caption (shows when zoomed) ── */
  .photo-caption {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, calc(-50% + 115px)) translateY(8px);
    font-family: var(--font-display);
    font-size: clamp(var(--text-base), 2.5vw, var(--text-lg));
    color: var(--text-primary);
    text-shadow: 0 2px 14px rgba(0,0,0,0.95);
    white-space: nowrap;
    opacity: 0;
    max-width: 90vw;
    text-align: center;
    pointer-events: none;
    letter-spacing: 0.02em;
  }

  @media (max-width: 768px) {
    .photo-hud {
      padding: var(--space-8) var(--space-4) var(--space-8);
    }
    .photo-caption {
      transform: translate(-50%, calc(-50% + 135px)) translateY(8px);
      white-space: normal;
    }
  }

  /* ── Bottom controls ── */
  .photo-hud-bottom {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    pointer-events: none;
  }

  .photo-drag-hint {
    font-size: var(--text-xs);
    color: rgba(253,246,239,0.28);
    letter-spacing: 0.08em;
    max-width: none;
    white-space: nowrap;
    animation: gentleFade 3s ease-in-out 1s infinite alternate;
  }

  .btn-photo-next {
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--accent);
    color: var(--bg-base);
    font-family: var(--font-body);
    font-size: var(--text-base);
    font-weight: 500;
    padding: 0.85rem 2.2rem;
    border: none;
    border-radius: 40px;
    cursor: pointer;
    box-shadow: 0 4px 22px rgba(232,99,122,0.48);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .btn-photo-next:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(232,99,122,0.65);
  }
  .btn-photo-next:active { transform: scale(0.96); }
  .btn-photo-next:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }

  @keyframes gentleFade {
    from { opacity: 0.15; }
    to   { opacity: 0.40; }
  }
  `;
  document.head.appendChild(s);
}
