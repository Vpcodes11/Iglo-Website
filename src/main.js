import * as THREE from 'three';
import { buildWorld, updateIce, hash } from './scene.js';
import { createIntro, updateIntro, finishIntro } from './intro.js';
import { createBrickPicker } from './hover.js';
import './style.css';

const sceneHost = document.querySelector('#scene');
const fallback = document.querySelector('#fallback');
const loader = document.querySelector('#loader');
const telemetry = document.querySelector('#telemetry');
const scrollPrompt = document.querySelector('#scroll-prompt');
const soundButton = document.querySelector('#sound-toggle');
const soundState = document.querySelector('#sound-state');
const loadingSignal = document.querySelector('#loading-signal');
const loadingStatus = document.querySelector('#loading-status');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const motionIntensity = reducedMotion ? .45 : 1;
const app = document.querySelector('#app');
app.dataset.version = 'sculpted-frost-16';
app.dataset.motion = reducedMotion ? 'reduced' : 'full';
app.dataset.animation = 'pointer';
app.dataset.stage = 'loading';
const interfaceRegions = [...document.querySelectorAll('.site-header, .site-footer')];
interfaceRegions.forEach(region => { region.inert = true; });
let signalFrame = 0;
const signalTimer = setInterval(() => {
  signalFrame++;
  const symbols = '--==+++==--';
  loadingSignal.textContent = [...symbols].map((_, index) => symbols[(index + signalFrame) % symbols.length]).join('');
}, 90);

const clamp = THREE.MathUtils.clamp;
const smoothstep = (a, b, t) => {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};
// Finish easing at an exact value so a resting pointer leaves a still scene.
const settle = (current, target, speed, delta) => {
  const next = THREE.MathUtils.damp(current, target, speed, delta);
  return Math.abs(next - target) < .0001 ? target : next;
};

function setupTracking(world) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#fff');
  path.setAttribute('stroke-width', '.7');
  svg.appendChild(path);
  telemetry.replaceChildren(svg);
  const locations = [[4, -1.1, 2.78, 1.0], [2, -2.1, 1.58, 1.3], [3, -1.1, 2.17, 1.7], [1, -1.8, .99, 1.5], [1, -.5, 1.08, 2.0]];
  const labels = ['37', '42', '40', '21', '38'];
  const selected = new Set();
  world.tracking = locations.map(([row, x, y, z], index) => {
    const target = new THREE.Vector3(x, y, z);
    const part = world.parts.filter(mesh => mesh.userData.row === row && !mesh.userData.door && !selected.has(mesh))
      .sort((a, b) => a.userData.center.distanceToSquared(target) - b.userData.center.distanceToSquared(target))[0];
    selected.add(part);
    const group = document.createElementNS(ns, 'g');
    const cross = document.createElementNS(ns, 'path');
    cross.setAttribute('d', 'M-3 0H3M0-3V3');
    cross.setAttribute('stroke', '#fff');
    cross.setAttribute('stroke-width', '.65');
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', '-13');
    text.setAttribute('y', '-10');
    text.textContent = labels[index];
    group.append(cross, text);
    svg.appendChild(group);
    const anchor = target.clone().sub(part.userData.center);
    return { part, group, text, anchor, index, reading: -1, point: new THREE.Vector3() };
  });
  world.trackingPath = path;
}

let renderer;
let world;
let intro;
let targetProgress = 0;
let visualProgress = 0;
let pointerX = 0;
let pointerY = 0;
const visualPointer = { x: 0, y: 0 };
let pointerInside = false;
let brickPicker;
let lastTime = 0;
let motionClock = 0;
let motionPaused = false;
let soundContext, windSource, hum, masterGain;
let soundOn = false;

function revealInterface() {
  app.classList.add('is-ready');
  app.dataset.stage = 'ready';
  loader.classList.add('is-hidden');
  loader.setAttribute('aria-hidden', 'true');
  loadingStatus.textContent = 'Experience ready.';
  interfaceRegions.forEach(region => { region.inert = false; });
  clearInterval(signalTimer);
  // A brief signal decode mirrors the visual language of the opening scan.
  if (reducedMotion) return;
  const nodes = [...document.querySelectorAll('.copyright, .brand-note, .manifesto p, #scroll-prompt')]
    .flatMap(element => [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE));
  const originals = nodes.map(node => node.textContent);
  const started = performance.now();
  const symbols = '+=/-';
  function decode(now) {
    const amount = Math.min(1, (now - started) / 850);
    nodes.forEach((node, index) => {
      const text = originals[index];
      node.textContent = [...text].map((character, position) => {
        if (/\s/.test(character) || position < text.length * amount) return character;
        return symbols[Math.floor(hash(position, Math.floor(now / 65), index) * symbols.length)];
      }).join('');
    });
    if (amount < 1) requestAnimationFrame(decode);
  }
  requestAnimationFrame(decode);
}

function setProgress(value) {
  targetProgress = clamp(value, 0, 1);
}

function updateInterface() {
  telemetry.style.opacity = String(.8 * (1 - smoothstep(.08, .75, visualProgress)));
  scrollPrompt.style.opacity = String(1 - smoothstep(.03, .45, visualProgress));
}

function resize() {
  if (!renderer || !world) return;
  const width = innerWidth, height = innerHeight;
  world.camera.aspect = width / height;
  world.camera.fov = 32;
  world.camera.zoom = Math.min(1, width / height * 1.25);
  world.camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, width < 700 ? 1.25 : 1.7));
  renderer.setSize(width, height);
  world.composer?.setPixelRatio(renderer.getPixelRatio());
  world.composer?.setSize(width, height);
  world.sky.material.uniforms.resolution.value.set(width * renderer.getPixelRatio(), height * renderer.getPixelRatio());
}

function animate(time) {
  requestAnimationFrame(animate);
  if (!world) return;
  const elapsed = (time - lastTime) / 1000 || .016;
  const delta = Math.min(.1, elapsed);
  lastTime = time;
  if (!motionPaused) motionClock += Math.min(.5, elapsed);
  if (intro && !intro.finished) {
    if (updateIntro(intro, world, motionClock, delta)) {
      finishIntro(intro, world);
      revealInterface();
    }
    return;
  }
  visualProgress = settle(visualProgress, targetProgress, reducedMotion ? 18 : 5.5, delta);
  if (!motionPaused) {
    visualPointer.x = settle(visualPointer.x, pointerX, 9, delta);
    visualPointer.y = settle(visualPointer.y, pointerY, 9, delta);
  }
  const p = visualProgress;
  const mobile = innerWidth < 700;
  const mix = smoothstep(0, 1, p);
  const cameraPosition = new THREE.Vector3(-9.3, 2.85, 14.8)
    .lerp(new THREE.Vector3(-7.4, 3.05, 17.3), mix);
  if (mobile) {
    cameraPosition.y += .5;
  }
  world.camera.position.copy(cameraPosition);
  const look = new THREE.Vector3(0, 1.15, 0).lerp(new THREE.Vector3(0, 1.17, 0), mix);
  world.camera.lookAt(look);
  world.beacon.rotation.y = mix * .13;
  world.camera.updateMatrixWorld();
  world.beacon.updateMatrixWorld(true);
  const hovered = pointerInside && !motionPaused
    ? brickPicker.pick({ x: pointerX, y: pointerY }, world.camera, world.beacon.matrixWorld)
    : null;
  updateIce(world, hovered, delta, visualPointer, motionIntensity);
  world.scene.updateMatrixWorld();
  world.camera.updateMatrixWorld();
  const trackerPositions = world.tracking.map(tracker => {
    const reading = Math.floor((visualPointer.x + 1) * 5 + (visualPointer.y + 1) * 3 + tracker.index * .37);
    if (reading !== tracker.reading) {
      tracker.reading = reading;
      tracker.text.textContent = String(20 + Math.floor(hash(reading, tracker.index, 94) * 30));
    }
    tracker.point.copy(tracker.anchor);
    tracker.part.localToWorld(tracker.point);
    tracker.point.project(world.camera);
    const x = (tracker.point.x * .5 + .5) * innerWidth;
    const y = (-tracker.point.y * .5 + .5) * innerHeight;
    tracker.group.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  if (world.trackingPath) world.trackingPath.setAttribute('d', `M${trackerPositions[0]}L${trackerPositions[2]}M${trackerPositions[1]}L${trackerPositions[2]}M${trackerPositions[1]}L${trackerPositions[3]}L${trackerPositions[4]}`);
  const positions = world.snowPositions;
  if (!motionPaused) {
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] += delta * (.32 + (i % 7) * .035) * motionIntensity;
      positions[i + 1] -= delta * (.49 + (i % 5) * .065) * motionIntensity;
      if (positions[i + 1] < -2) positions[i + 1] = 21;
      if (positions[i] > 45) positions[i] = -45;
    }
    world.snow.geometry.attributes.position.needsUpdate = true;
  }
  updateInterface();
  if (world.composer) world.composer.render();
  else renderer.render(world.scene, world.camera);
}

function setupSound() {
  if (soundContext) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  soundContext = new AudioContext();
  masterGain = soundContext.createGain();
  masterGain.gain.value = .055;
  masterGain.connect(soundContext.destination);
  const seconds = 3;
  const buffer = soundContext.createBuffer(1, soundContext.sampleRate * seconds, soundContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  windSource = soundContext.createBufferSource();
  windSource.buffer = buffer;
  windSource.loop = true;
  const filter = soundContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 290;
  windSource.connect(filter).connect(masterGain);
  windSource.start();
  hum = soundContext.createOscillator();
  hum.type = 'sine';
  hum.frequency.value = 73;
  const humGain = soundContext.createGain();
  humGain.gain.value = .08;
  hum.connect(humGain).connect(masterGain);
  hum.start();
  soundContext.suspend();
}

function setupInteractions() {
  addEventListener('wheel', (event) => {
    event.preventDefault();
    if (app.dataset.stage !== 'ready') return;
    setProgress(targetProgress + event.deltaY / 650);
  }, { passive: false });
  let touchY = null;
  addEventListener('touchstart', (event) => { touchY = event.touches[0]?.clientY ?? null; }, { passive: true });
  addEventListener('touchmove', (event) => {
    if (app.dataset.stage !== 'ready') { event.preventDefault(); return; }
    if (touchY === null) return;
    const y = event.touches[0]?.clientY ?? touchY;
    setProgress(targetProgress + (touchY - y) / 250);
    touchY = y;
    event.preventDefault();
  }, { passive: false });
  addEventListener('touchend', () => { touchY = null; });
  addEventListener('pointermove', (event) => {
    if (app.dataset.stage !== 'ready' || event.pointerType === 'touch') return;
    const x = event.clientX / innerWidth * 2 - 1;
    const y = 1 - event.clientY / innerHeight * 2;
    pointerInside = !event.target.closest('a, button, .manifesto');
    pointerX = x;
    pointerY = y;
  }, { passive: true });
  addEventListener('blur', () => { pointerInside = false; });
  document.documentElement.addEventListener('pointerleave', () => { pointerInside = false; });
  addEventListener('keydown', (event) => {
    if (app.dataset.stage !== 'ready') {
      if (event.key === 'Escape' && intro && !intro.finished) {
        finishIntro(intro, world);
        world.camera.position.set(-9.3, 2.85, 14.8);
        revealInterface();
      }
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' '].includes(event.key)) event.preventDefault();
      return;
    }
    if (event.key.toLowerCase() === 'p') {
      motionPaused = !motionPaused;
      app.dataset.animation = motionPaused ? 'paused' : 'pointer';
      return;
    }
    if (event.target.closest('button') && [' ', 'Enter'].includes(event.key)) return;
    if (['ArrowDown', 'PageDown', ' ', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      setProgress(Math.floor(targetProgress + 1));
    } else if (['ArrowUp', 'PageUp', 'ArrowLeft'].includes(event.key)) {
      event.preventDefault();
      setProgress(Math.ceil(targetProgress - 1));
    } else if (event.key === 'Home') setProgress(0);
    else if (event.key === 'End') setProgress(1);
  });
  document.querySelector('#home-link').addEventListener('click', (event) => { event.preventDefault(); setProgress(0); });
  soundButton.addEventListener('click', async () => {
    setupSound();
    if (!soundContext) return;
    soundOn = !soundOn;
    if (soundOn) await soundContext.resume();
    else await soundContext.suspend();
    soundButton.setAttribute('aria-pressed', String(soundOn));
    soundButton.setAttribute('aria-label', `Turn ambient sound ${soundOn ? 'off' : 'on'}`);
    soundState.textContent = soundOn ? 'On' : 'Off';
    soundButton.querySelector('svg').innerHTML = soundOn
      ? '<path d="M3 7h3l4-4v14l-4-4H3zM13 6q5 4 0 8M15 3q8 7 0 14"/>'
      : '<path d="M3 7h3l4-4v14l-4-4H3zM14 7l4 6m0-6-4 6"/>';
  });
  addEventListener('resize', resize);
}

setupInteractions();

async function startExperience() {
try {
  // Paint the symbol loader before doing the geometry and texture preparation.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await document.fonts.load('500 13px "IBM Plex Mono"');
  loadingStatus.textContent = 'Building the shelter and landscape.';
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  sceneHost.appendChild(renderer.domElement);
  world = buildWorld(renderer);
  brickPicker = createBrickPicker(world.parts);
  resize();
  setupTracking(world);
  loadingStatus.textContent = 'Preparing light and surfaces.';
  await renderer.compileAsync(world.scene, world.camera);
  world.composer.render();
  intro = createIntro(world, document.querySelector('#loading-readings'), reducedMotion);
  loader.classList.add('is-probing');
  app.dataset.stage = 'scanning';
  loadingStatus.textContent = 'Scanning the shelter.';
  clearInterval(signalTimer);
  lastTime = performance.now();
  requestAnimationFrame(animate);
} catch (error) {
  console.error('Could not start the 3D scene:', error);
  fallback.hidden = false;
  if (intro && world) finishIntro(intro, world);
  sceneHost.hidden = true;
  revealInterface();
  const animateFallback = () => {
    visualProgress = THREE.MathUtils.lerp(visualProgress, targetProgress, .12);
    updateInterface();
    requestAnimationFrame(animateFallback);
  };
  animateFallback();
}
}

startExperience();
