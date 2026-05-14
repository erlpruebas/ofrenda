import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.querySelector('#scene');
const modeInput = document.querySelector('#mode');
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
scene.background = new THREE.Color(0x111715);
scene.fog = new THREE.Fog(0x111715, 8, 24);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 5.1, 8.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.65, 0);
controls.maxPolarAngle = Math.PI * 0.47;
controls.minDistance = 4.2;
controls.maxDistance = 16;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();

const state = {
  rows: 1,
  cols: 7,
  mode: 'fill',
  activeIndex: 0,
  step: 0,
  bowls: [],
  animating: false,
};

const fillSteps = [
  'Acerca la jarra al bol seleccionado.',
  'Inclina la jarra y empieza a verter.',
  'El agua sube dentro del bol de cristal.',
  'La jarra vuelve al inicio y pasa al siguiente bol.',
];

const emptySteps = [
  'Toma el bol seleccionado de la mesa.',
  'Vierte el agua suavemente en el cubo.',
  'Seca el bol con el trapo.',
  'Coloca el bol limpio de nuevo en su sitio.',
];

const room = new THREE.Group();
const bowlsGroup = new THREE.Group();
const helpersGroup = new THREE.Group();
scene.add(room, bowlsGroup, helpersGroup);

const glassMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xd9f5ff,
  transparent: true,
  opacity: 0.27,
  transmission: 0.78,
  roughness: 0.04,
  metalness: 0,
  thickness: 0.08,
  ior: 1.45,
  clearcoat: 1,
  clearcoatRoughness: 0.08,
});

const waterMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x85d9ff,
  transparent: true,
  opacity: 0.68,
  roughness: 0.09,
  metalness: 0,
  transmission: 0.28,
});

const activeMaterial = new THREE.MeshStandardMaterial({
  color: 0xf7d77a,
  emissive: 0x7a5213,
  emissiveIntensity: 0.65,
  roughness: 0.22,
});

const woodMaterial = new THREE.MeshStandardMaterial({
  color: 0x725033,
  roughness: 0.55,
  metalness: 0.02,
});

function addLights() {
  const hemi = new THREE.HemisphereLight(0xb8d8ff, 0x24180e, 1.7);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff4dc, 3.6);
  key.position.set(-4, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 9;
  key.shadow.camera.bottom = -9;
  scene.add(key);

  const candle = new THREE.PointLight(0xffb15d, 2.5, 8);
  candle.position.set(3.8, 1.6, 2.6);
  scene.add(candle);
}

function addRoom() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 0.7 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);

  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 12),
    new THREE.MeshStandardMaterial({ color: 0x27302a, roughness: 0.82 }),
  );
  backWall.position.set(0, 6, -6);
  backWall.receiveShadow = true;
  room.add(backWall);

  const sideWall = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshStandardMaterial({ color: 0x1e2723, roughness: 0.86 }),
  );
  sideWall.rotation.y = Math.PI / 2;
  sideWall.position.set(-8, 6, 0);
  sideWall.receiveShadow = true;
  room.add(sideWall);

  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(12, 0.28, 3.6), woodMaterial);
  tableTop.position.y = 0.75;
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  room.add(tableTop);

  for (const x of [-5.5, 5.5]) {
    for (const z of [-1.45, 1.45]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 1.5, 12), woodMaterial);
      leg.position.set(x, 0, z);
      leg.castShadow = true;
      room.add(leg);
    }
  }

  const altarCloth = new THREE.Mesh(
    new THREE.BoxGeometry(11.3, 0.035, 2.9),
    new THREE.MeshStandardMaterial({ color: 0x8d1f16, roughness: 0.62 }),
  );
  altarCloth.position.y = 0.92;
  altarCloth.receiveShadow = true;
  room.add(altarCloth);
}

function makeBowl(index, position) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.userData.index = index;

  const outer = new THREE.Mesh(new THREE.SphereGeometry(0.33, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.55), glassMaterial);
  outer.scale.set(1, 0.68, 1);
  outer.rotation.x = Math.PI;
  outer.position.y = 0.18;
  outer.castShadow = true;
  outer.receiveShadow = true;
  group.add(outer);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.33, 0.018, 12, 64),
    new THREE.MeshPhysicalMaterial({ color: 0xf3fbff, transparent: true, opacity: 0.55, roughness: 0.04 }),
  );
  rim.position.y = 0.18;
  group.add(rim);

  const foot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.21, 0.06, 32),
    new THREE.MeshPhysicalMaterial({ color: 0xcdf4ff, transparent: true, opacity: 0.34, roughness: 0.08 }),
  );
  foot.position.y = 0.01;
  foot.castShadow = true;
  group.add(foot);

  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.2, 0.11, 48), waterMaterial);
  water.position.y = 0.1;
  water.scale.y = 0.02;
  water.visible = false;
  group.add(water);

  const marker = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.012, 8, 64), activeMaterial);
  marker.rotation.x = Math.PI / 2;
  marker.position.y = 0.015;
  marker.visible = false;
  group.add(marker);

  group.userData = {
    index,
    fill: 0,
    water,
    marker,
    originalPosition: position.clone(),
  };

  return group;
}

function makeJug() {
  const jug = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, 0.62, 32),
    new THREE.MeshPhysicalMaterial({ color: 0xd8efff, transparent: true, opacity: 0.45, roughness: 0.06, transmission: 0.45 }),
  );
  body.castShadow = true;
  jug.add(body);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.24, 32), body.material);
  neck.position.y = 0.42;
  jug.add(neck);

  const spout = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 24), body.material);
  spout.rotation.z = -Math.PI / 2;
  spout.position.set(0.27, 0.34, 0);
  jug.add(spout);

  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.018, 12, 32, Math.PI * 1.35),
    new THREE.MeshPhysicalMaterial({ color: 0xe8f7ff, transparent: true, opacity: 0.5, roughness: 0.05 }),
  );
  handle.rotation.z = Math.PI / 2;
  handle.position.set(-0.23, 0.12, 0);
  jug.add(handle);

  jug.position.set(-4.3, 1.45, 1.15);
  helpersGroup.add(jug);
  return jug;
}

function makeBucketAndCloth() {
  const bucket = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.25, 0.5, 40, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x65717b, roughness: 0.28, metalness: 0.55 }),
  );
  body.castShadow = true;
  bucket.add(body);

  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.23, 0.04, 32), waterMaterial);
  water.position.y = 0.23;
  bucket.add(water);
  bucket.position.set(4.4, 1.18, 1.1);
  helpersGroup.add(bucket);

  const cloth = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.035, 0.36),
    new THREE.MeshStandardMaterial({ color: 0xf3ead3, roughness: 0.92 }),
  );
  cloth.position.set(3.55, 1.1, -1.2);
  cloth.rotation.y = -0.45;
  cloth.castShadow = true;
  helpersGroup.add(cloth);

  return { bucket, cloth };
}

const jug = makeJug();
const { bucket, cloth } = makeBucketAndCloth();

function rebuildBowls() {
  bowlsGroup.clear();
  state.bowls = [];
  state.activeIndex = 0;
  state.step = 0;
  state.rows = clamp(Number(rowsInput.value), 1, 10);
  state.cols = clamp(Number(colsInput.value), 1, 20);
  rowsInput.value = state.rows;
  colsInput.value = state.cols;

  const spacing = 0.62;
  const totalWidth = (state.cols - 1) * spacing;
  const totalDepth = (state.rows - 1) * spacing;
  let index = 0;

  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const x = col * spacing - totalWidth / 2;
      const z = row * spacing - totalDepth / 2;
      const bowl = makeBowl(index, new THREE.Vector3(x, 1.02, z));
      bowlsGroup.add(bowl);
      state.bowls.push(bowl);
      index += 1;
    }
  }

  updateActiveBowl();
  updateUi();
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
  const water = bowl.userData.water;
  const fill = bowl.userData.fill;
  water.visible = fill > 0.02;
  water.scale.y = Math.max(0.02, fill);
  water.position.y = 0.06 + fill * 0.105;
}

function currentSteps() {
  return state.mode === 'fill' ? fillSteps : emptySteps;
}

function updateUi() {
  const filled = state.bowls.filter((bowl) => bowl.userData.fill >= 0.99).length;
  const total = state.bowls.length;
  statusText.textContent = `${filled} de ${total} boles llenos`;
  bar.style.width = `${total ? (filled / total) * 100 : 0}%`;

  const steps = currentSteps();
  stepTitle.textContent = `${state.mode === 'fill' ? 'Llenar' : 'Vaciar'}: paso ${state.step + 1} de 4`;
  stepText.textContent = steps[state.step];
  instruction.textContent =
    state.mode === 'fill'
      ? 'Haz clic en la escena para llenar cada bol en cuatro gestos.'
      : 'Haz clic en un bol lleno o sigue el marcado para vaciar, secar y recolocar.';
}

function nextBowlForMode() {
  const desiredFill = state.mode === 'fill' ? 0.99 : 0.01;
  const index = state.bowls.findIndex((bowl) =>
    state.mode === 'fill' ? bowl.userData.fill < desiredFill : bowl.userData.fill > desiredFill,
  );
  state.activeIndex = index === -1 ? Math.max(0, state.bowls.length - 1) : index;
  updateActiveBowl();
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

function animateFillLevel(bowl, targetFill, duration = 360) {
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

async function handleFillStep(bowl) {
  const bowlPosition = bowl.getWorldPosition(new THREE.Vector3());
  const home = new THREE.Vector3(-4.3, 1.45, 1.15);

  if (state.step === 0) {
    await animateTransform(jug, bowlPosition.clone().add(new THREE.Vector3(-0.42, 0.62, 0.14)), new THREE.Euler(0, 0, 0), 420);
  } else if (state.step === 1) {
    await animateTransform(jug, jug.position.clone(), new THREE.Euler(0.05, 0, -0.8), 300);
  } else if (state.step === 2) {
    await animateFillLevel(bowl, Math.min(1, bowl.userData.fill + 0.34), 440);
  } else {
    await animateTransform(jug, home, new THREE.Euler(0, 0, 0), 520);
    bowl.userData.fill = 1;
    updateWater(bowl);
  }
}

async function handleEmptyStep(bowl) {
  const original = bowl.userData.originalPosition;

  if (state.step === 0) {
    await animateTransform(bowl, bucket.position.clone().add(new THREE.Vector3(-0.32, 0.35, -0.05)), new THREE.Euler(0, 0, 0), 360);
  } else if (state.step === 1) {
    await animateTransform(bowl, bowl.position.clone(), new THREE.Euler(0.2, 0, 1.0), 320);
    await animateFillLevel(bowl, 0, 360);
  } else if (state.step === 2) {
    await animateTransform(cloth, bowl.position.clone().add(new THREE.Vector3(0.18, 0.22, 0)), new THREE.Euler(0.3, 0.2, -0.4), 220);
    await animateTransform(cloth, bowl.position.clone().add(new THREE.Vector3(-0.18, 0.23, 0.04)), new THREE.Euler(0.2, -0.2, 0.45), 220);
    await animateTransform(cloth, new THREE.Vector3(3.55, 1.1, -1.2), new THREE.Euler(0, -0.45, 0), 250);
  } else {
    await animateTransform(bowl, original, new THREE.Euler(0, 0, 0), 430);
  }
}

async function advanceRitual() {
  if (state.animating || state.bowls.length === 0) return;
  const bowl = state.bowls[state.activeIndex];
  if (!bowl) return;

  state.animating = true;
  if (state.mode === 'fill') {
    await handleFillStep(bowl);
  } else {
    await handleEmptyStep(bowl);
  }

  state.step += 1;
  if (state.step > 3) {
    state.step = 0;
    nextBowlForMode();
  }

  state.animating = false;
  updateUi();
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
  state.step = 0;
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

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function render() {
  const time = clock.getElapsedTime();
  state.bowls.forEach((bowl, index) => {
    const water = bowl.userData.water;
    if (water.visible) {
      water.rotation.y = time * 0.6 + index * 0.07;
      water.scale.x = 1 + Math.sin(time * 2.3 + index) * 0.015;
      water.scale.z = 1 + Math.cos(time * 2.1 + index) * 0.015;
    }
  });

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

modeInput.addEventListener('change', () => {
  state.mode = modeInput.value;
  state.step = 0;
  nextBowlForMode();
  updateUi();
});

applyLayoutButton.addEventListener('click', rebuildBowls);
resetButton.addEventListener('click', () => {
  state.bowls.forEach((bowl) => {
    bowl.userData.fill = 0;
    bowl.position.copy(bowl.userData.originalPosition);
    bowl.rotation.set(0, 0, 0);
    updateWater(bowl);
  });
  state.step = 0;
  state.activeIndex = 0;
  updateActiveBowl();
  updateUi();
});

canvas.addEventListener('click', (event) => {
  if (!selectBowlFromPointer(event)) {
    advanceRitual();
    return;
  }
  advanceRitual();
});

window.addEventListener('resize', resize);

addLights();
addRoom();
rebuildBowls();
resize();
render();
