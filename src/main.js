import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.querySelector('#scene');
const panel = document.querySelector('#controlsPanel');
const panelToggle = document.querySelector('#panelToggle');
const modeToggle = document.querySelector('#modeToggle');
const rowsInput = document.querySelector('#rows');
const colsInput = document.querySelector('#cols');
const applyLayoutButton = document.querySelector('#applyLayout');
const resetButton = document.querySelector('#reset');
const instruction = document.querySelector('#instruction');
const statusText = document.querySelector('#status');
const bar = document.querySelector('#bar');
const stepTitle = document.querySelector('#stepTitle');
const stepText = document.querySelector('#stepText');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x151c19);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 80);
camera.position.set(0, 4.2, 7.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.8, 0);
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 3.7;
controls.maxDistance = 24;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();

const state = {
  rows: 1,
  cols: 7,
  mode: 'fill',
  activeIndex: 0,
  bowls: [],
  animating: false,
  audioContext: null,
  pointerStart: null,
};

const room = new THREE.Group();
const bowlsGroup = new THREE.Group();
const helpersGroup = new THREE.Group();
scene.add(room, bowlsGroup, helpersGroup);

const glassMaterial = new THREE.MeshStandardMaterial({
  color: 0xd8f1ff,
  transparent: true,
  opacity: 0.36,
  roughness: 0.08,
  metalness: 0,
  side: THREE.DoubleSide,
});

const rimMaterial = new THREE.MeshStandardMaterial({
  color: 0xf1fbff,
  transparent: true,
  opacity: 0.7,
  roughness: 0.12,
});

const waterMaterial = new THREE.MeshStandardMaterial({
  color: 0x7dcff2,
  transparent: true,
  opacity: 0.72,
  roughness: 0.18,
});

const markerMaterial = new THREE.MeshBasicMaterial({
  color: 0xf6d36f,
  transparent: true,
  opacity: 0.95,
});

const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x8a6542, roughness: 0.72 });
const clothMaterial = new THREE.MeshStandardMaterial({ color: 0xb5372a, roughness: 0.8 });

let tableTop;
let altarCloth;
const tableLegs = [];
let jug;
let bucket;
let cleaningCloth;

function addLights() {
  scene.add(new THREE.HemisphereLight(0xf4f8ff, 0x2b1b12, 2.2));

  const key = new THREE.DirectionalLight(0xfff1c7, 1.8);
  key.position.set(-3, 6, 4);
  scene.add(key);

  const soft = new THREE.DirectionalLight(0x8cc6ff, 0.65);
  soft.position.set(4, 4, -3);
  scene.add(soft);
}

function addRoom() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 18),
    new THREE.MeshStandardMaterial({ color: 0x33271d, roughness: 0.86 }),
  );
  floor.rotation.x = -Math.PI / 2;
  room.add(floor);

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 9),
    new THREE.MeshStandardMaterial({ color: 0x202a25, roughness: 0.9 }),
  );
  wall.position.set(0, 4.5, -5.6);
  room.add(wall);

  tableTop = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), woodMaterial);
  tableTop.position.y = 0.72;
  room.add(tableTop);

  altarCloth = new THREE.Mesh(new THREE.BoxGeometry(1, 0.035, 1), clothMaterial);
  altarCloth.position.y = 0.85;
  room.add(altarCloth);

  for (let index = 0; index < 4; index += 1) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 1.3, 8), woodMaterial);
    leg.position.y = 0.05;
    tableLegs.push(leg);
    room.add(leg);
  }
}

function addHelpers() {
  jug = new THREE.Group();
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xe2c48e, roughness: 0.62 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.5, 16), ceramic);
  jug.add(body);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.24, 16), ceramic);
  neck.position.y = 0.35;
  jug.add(neck);

  const spout = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 12), ceramic);
  spout.rotation.z = -Math.PI / 2;
  spout.position.set(0.27, 0.26, 0);
  jug.add(spout);

  helpersGroup.add(jug);

  bucket = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x59636b, roughness: 0.45, metalness: 0.35 });
  const bucketBody = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.25, 0.42, 18, 1, true), metal);
  bucket.add(bucketBody);
  helpersGroup.add(bucket);

  cleaningCloth = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.035, 0.32),
    new THREE.MeshStandardMaterial({ color: 0xf1e6cb, roughness: 0.96 }),
  );
  helpersGroup.add(cleaningCloth);
}

function updateTableSize() {
  const spacing = bowlSpacing();
  const width = Math.max(3.2, (state.cols - 1) * spacing + 1.4);
  const depth = Math.max(2.2, (state.rows - 1) * spacing + 1.3);

  tableTop.scale.set(width, 1, depth);
  altarCloth.scale.set(width - 0.42, 1, depth - 0.36);

  const legInsetX = width / 2 - 0.28;
  const legInsetZ = depth / 2 - 0.25;
  const positions = [
    [-legInsetX, -legInsetZ],
    [legInsetX, -legInsetZ],
    [-legInsetX, legInsetZ],
    [legInsetX, legInsetZ],
  ];

  tableLegs.forEach((leg, index) => {
    leg.position.x = positions[index][0];
    leg.position.z = positions[index][1];
  });

  jug.position.set(-width / 2 - 0.45, 1.28, depth / 2 - 0.2);
  jug.rotation.set(0, -0.22, -0.2);
  bucket.position.set(width / 2 + 0.5, 1.05, depth / 2 - 0.15);
  cleaningCloth.position.set(bucket.position.x, bucket.position.y + 0.28, bucket.position.z);
  cleaningCloth.rotation.set(0.18, -0.2, 0.12);
}

function bowlSpacing() {
  return 0.74;
}

function makeBowl(index, position) {
  const group = new THREE.Group();
  group.position.copy(position);

  const bowlShape = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.12, 0),
      new THREE.Vector2(0.2, 0.035),
      new THREE.Vector2(0.25, 0.14),
      new THREE.Vector2(0.3, 0.29),
      new THREE.Vector2(0.33, 0.39),
    ],
    24,
  );
  const bowl = new THREE.Mesh(bowlShape, glassMaterial);
  group.add(bowl);

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.018, 24, 1, true), rimMaterial);
  rim.position.y = 0.39;
  group.add(rim);

  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.055, 18), rimMaterial);
  foot.position.y = 0.02;
  group.add(foot);

  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.02, 24), waterMaterial);
  water.position.y = 0.1;
  water.visible = false;
  group.add(water);

  const marker = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.43, 32), markerMaterial);
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.015;
  marker.visible = false;
  group.add(marker);

  group.userData = {
    index,
    fill: 0,
    marker,
    water,
    originalPosition: position.clone(),
  };

  return group;
}

function rebuildBowls() {
  bowlsGroup.clear();
  state.bowls = [];
  state.activeIndex = 0;
  state.rows = clamp(Number(rowsInput.value), 1, 10);
  state.cols = clamp(Number(colsInput.value), 1, 20);
  rowsInput.value = state.rows;
  colsInput.value = state.cols;

  const spacing = bowlSpacing();
  const totalWidth = (state.cols - 1) * spacing;
  const totalDepth = (state.rows - 1) * spacing;
  let index = 0;

  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const x = col * spacing - totalWidth / 2;
      const z = row * spacing - totalDepth / 2;
      const bowl = makeBowl(index, new THREE.Vector3(x, 0.88, z));
      bowlsGroup.add(bowl);
      state.bowls.push(bowl);
      index += 1;
    }
  }

  updateTableSize();
  nextBowlForMode();
  updateUi();
  frameCamera();
}

function frameCamera() {
  const spacing = bowlSpacing();
  const width = Math.max(3.2, (state.cols - 1) * spacing + 1.4);
  const depth = Math.max(2.2, (state.rows - 1) * spacing + 1.3);
  const portrait = window.innerHeight > window.innerWidth;
  const distance = Math.max(5.4, Math.min(20, width * (portrait ? 0.75 : 0.6) + depth * 0.85 + 3.2));
  const height = Math.max(3.5, depth * 0.58 + (portrait ? 3.2 : 2.5));
  camera.position.set(0, height, distance);
  controls.target.set(0, 0.9, 0);
  controls.update();
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function updateActiveBowl() {
  state.bowls.forEach((bowl, index) => {
    bowl.userData.marker.visible = index === state.activeIndex;
  });
}

function updateWater(bowl) {
  const fill = bowl.userData.fill;
  const water = bowl.userData.water;
  water.visible = fill > 0.02;
  water.scale.y = Math.max(0.01, fill * 7);
  water.position.y = 0.075 + fill * 0.27;
}

function updateUi() {
  const filled = state.bowls.filter((bowl) => bowl.userData.fill >= 0.99).length;
  const total = state.bowls.length;
  const available = state.bowls.some((bowl) => (state.mode === 'fill' ? bowl.userData.fill < 0.99 : bowl.userData.fill > 0.01));
  statusText.textContent = `${filled} de ${total} boles llenos`;
  bar.style.width = `${total ? (filled / total) * 100 : 0}%`;

  const isFill = state.mode === 'fill';
  modeToggle.textContent = `Modo: ${isFill ? 'llenar' : 'vaciar'}`;
  stepTitle.textContent = `Modo ${isFill ? 'llenar' : 'vaciar'}`;

  if (!available) {
    stepText.textContent = isFill ? 'Todos los boles estan llenos.' : 'Todos los boles estan vacios y limpios.';
    instruction.textContent = isFill ? 'Cambia a modo vaciar para continuar.' : 'Cambia a modo llenar para continuar.';
    return;
  }

  stepText.textContent = isFill ? 'Cada toque llena suavemente el siguiente bol.' : 'Cada toque vacia y limpia suavemente el siguiente bol lleno.';
  instruction.textContent = isFill
    ? 'Toca o haz clic en la escena para llenar el siguiente bol.'
    : 'Toca o haz clic en la escena para vaciar y limpiar el siguiente bol.';
}

function nextBowlForMode() {
  const index = state.bowls.findIndex((bowl) =>
    state.mode === 'fill' ? bowl.userData.fill < 0.99 : bowl.userData.fill > 0.01,
  );
  state.activeIndex = index === -1 ? Math.max(0, state.bowls.length - 1) : index;
  updateActiveBowl();
}

function animateFillLevel(bowl, targetFill, duration = 650) {
  const start = bowl.userData.fill;
  const startedAt = performance.now();

  return new Promise((resolve) => {
    function frame(now) {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = t * t * (3 - 2 * t);
      bowl.userData.fill = THREE.MathUtils.lerp(start, targetFill, eased);
      updateWater(bowl);
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

function animateTransform(object, targetPosition, targetRotation, duration = 420) {
  const startPosition = object.position.clone();
  const startRotation = object.rotation.clone();
  const startedAt = performance.now();

  return new Promise((resolve) => {
    function frame(now) {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      object.position.lerpVectors(startPosition, targetPosition, eased);
      object.rotation.set(
        THREE.MathUtils.lerp(startRotation.x, targetRotation.x, eased),
        THREE.MathUtils.lerp(startRotation.y, targetRotation.y, eased),
        THREE.MathUtils.lerp(startRotation.z, targetRotation.z, eased),
      );
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

async function fillBowl(bowl) {
  const pos = bowl.getWorldPosition(new THREE.Vector3());
  const home = jug.position.clone();
  await animateTransform(jug, pos.clone().add(new THREE.Vector3(-0.35, 0.62, 0.05)), new THREE.Euler(0, -0.15, -0.78), 330);
  playWaterSound('fill');
  await animateFillLevel(bowl, 1, 720);
  await animateTransform(jug, home, new THREE.Euler(0, -0.22, -0.2), 360);
}

async function emptyBowl(bowl) {
  const originalPosition = bowl.userData.originalPosition.clone();
  const originalRotation = new THREE.Euler(0, 0, 0);
  const bucketSide = new THREE.Vector3(bucket.position.x - 0.18, 1.25, bucket.position.z - 0.08);
  const clothHome = cleaningCloth.position.clone();

  playWaterSound('empty');
  await animateTransform(bowl, bucketSide, new THREE.Euler(0, 0, 0), 360);
  await animateTransform(bowl, bucketSide, new THREE.Euler(0.18, 0, -0.95), 260);
  await animateFillLevel(bowl, 0, 520);
  await animateTransform(bowl, bucketSide, originalRotation, 220);
  await animateTransform(cleaningCloth, bucketSide.clone().add(new THREE.Vector3(0.08, 0.28, 0.02)), new THREE.Euler(0.1, -0.3, 0.35), 190);
  await animateTransform(cleaningCloth, bucketSide.clone().add(new THREE.Vector3(-0.1, 0.27, -0.03)), new THREE.Euler(0.05, 0.25, -0.25), 190);
  await animateTransform(cleaningCloth, clothHome, new THREE.Euler(0.18, -0.2, 0.12), 220);
  await animateTransform(bowl, originalPosition, originalRotation, 360);
}

async function advanceRitual() {
  if (state.animating || state.bowls.length === 0) return;
  let bowl = state.bowls[state.activeIndex];
  if (!bowl) return;
  if (!canActOnBowl(bowl)) {
    nextBowlForMode();
    bowl = state.bowls[state.activeIndex];
  }
  if (!bowl || !canActOnBowl(bowl)) return;

  playClickSound();
  state.animating = true;
  if (state.mode === 'fill') await fillBowl(bowl);
  else await emptyBowl(bowl);
  state.animating = false;

  nextBowlForMode();
  updateUi();
}

function canActOnBowl(bowl) {
  return state.mode === 'fill' ? bowl.userData.fill < 0.99 : bowl.userData.fill > 0.01;
}

function selectBowlFromPointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const intersections = raycaster.intersectObjects(state.bowls, true);
  const root = intersections[0]?.object;
  const bowl = root ? findBowlRoot(root) : null;
  if (!bowl) return false;

  state.activeIndex = bowl.userData.index;
  updateActiveBowl();
  updateUi();
  return true;
}

function findBowlRoot(object) {
  let current = object;
  while (current) {
    if (current.parent === bowlsGroup) return current;
    current = current.parent;
  }
  return null;
}

function resetWater() {
  state.bowls.forEach((bowl) => {
    bowl.userData.fill = 0;
    updateWater(bowl);
  });
  nextBowlForMode();
  updateUi();
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  frameCamera();
}

function getAudioContext() {
  if (!state.audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    state.audioContext = new AudioContext();
  }
  if (state.audioContext.state === 'suspended') {
    state.audioContext.resume();
  }
  return state.audioContext;
}

function playClickSound() {
  const audio = getAudioContext();
  if (!audio) return;

  const now = audio.currentTime;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(780, now);
  oscillator.frequency.exponentialRampToValueAtTime(340, now + 0.045);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.085);
}

function playWaterSound(kind) {
  const audio = getAudioContext();
  if (!audio) return;

  const now = audio.currentTime;
  const duration = kind === 'fill' ? 0.72 : 0.52;
  const bufferSize = Math.floor(audio.sampleRate * duration);
  const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i += 1) {
    const t = i / bufferSize;
    const envelope = Math.sin(Math.PI * t);
    const burble = Math.sin(i * (kind === 'fill' ? 0.055 : 0.085)) * 0.35;
    data[i] = (Math.random() * 2 - 1 + burble) * envelope * 0.32;
  }

  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(kind === 'fill' ? 880 : 640, now);
  filter.frequency.linearRampToValueAtTime(kind === 'fill' ? 520 : 380, now + duration);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.13, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  source.buffer = buffer;
  source.connect(filter).connect(gain).connect(audio.destination);
  source.start(now);
  source.stop(now + duration);
}

function render() {
  const time = clock.getElapsedTime();
  state.bowls.forEach((bowl, index) => {
    const water = bowl.userData.water;
    if (water.visible) {
      water.rotation.y = time * 0.22 + index * 0.04;
    }
  });

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

modeToggle.addEventListener('click', () => {
  playClickSound();
  state.mode = state.mode === 'fill' ? 'empty' : 'fill';
  nextBowlForMode();
  updateUi();
});

panelToggle.addEventListener('click', () => {
  playClickSound();
  const hidden = panel.classList.toggle('is-hidden');
  panelToggle.textContent = hidden ? 'Mostrar menu' : 'Ocultar menu';
  panelToggle.setAttribute('aria-expanded', String(!hidden));
});

applyLayoutButton.addEventListener('click', () => {
  playClickSound();
  rebuildBowls();
});

resetButton.addEventListener('click', () => {
  playClickSound();
  resetWater();
});

canvas.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  state.pointerStart = {
    x: event.clientX,
    y: event.clientY,
    pointerId: event.pointerId,
  };
});

canvas.addEventListener('pointerup', (event) => {
  if (!state.pointerStart || state.pointerStart.pointerId !== event.pointerId) return;
  const dx = event.clientX - state.pointerStart.x;
  const dy = event.clientY - state.pointerStart.y;
  state.pointerStart = null;
  if (Math.hypot(dx, dy) > 8) return;
  selectBowlFromPointer(event);
  advanceRitual();
});

window.addEventListener('resize', resize);

addLights();
addRoom();
addHelpers();
rebuildBowls();
resize();
render();
