import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { initAudio, sfx } from './audio.js';
import { Disparador, blendshape } from './gestos.js';

const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODELO_CARA = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const PARAMS = new URLSearchParams(location.search);
const DEMO = PARAMS.has('demo');
const IMAGEN = PARAMS.get('imagen'); // ?imagen=foto.jpg: prueba con una foto en lugar de la cámara
const N = 468;            // vértices de la malla canónica (sin iris)
const SUAVIZADO = 0.7;    // 1 = sin suavizado

const $ = id => document.getElementById(id);
let fuente = $('video');
const estado = $('estado');

// ---------- three.js: cámara ortográfica en píxeles del video ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('lienzo'), alpha: true, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10000, 10000);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8866aa, 2.4));
const luz = new THREE.DirectionalLight(0xffffff, 1.2);
luz.position.set(0.3, 0.5, 1);
scene.add(luz);
let W = 1, H = 1;

// ---------- malla facial con la textura pintada sobre su UV ----------
const malla = await (await fetch('assets/malla_facial.json')).json();
const cargador = new THREE.TextureLoader();
const cargarTextura = url => cargador.loadAsync(url).then(t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; });
const [texDia, texNoche] = await Promise.all([
  cargarTextura('assets/calavera_cempasuchil.png'),
  cargarTextura('assets/calavera_noche.png'),
]);

const posiciones = new Float32Array(N * 3);
const geometria = new THREE.BufferGeometry();
geometria.setAttribute('position', new THREE.BufferAttribute(posiciones, 3).setUsage(THREE.DynamicDrawUsage));
geometria.setAttribute('uv', new THREE.Float32BufferAttribute(malla.uvs, 2));
geometria.setIndex(malla.indices);
const material = new THREE.MeshStandardMaterial({
  map: texDia,
  transparent: true,      // ojos y boca interior tienen alfa 0
  side: THREE.DoubleSide,
  roughness: 0.65,
  emissive: 0xffffff,
  emissiveIntensity: 0,
});
const mascara = new THREE.Mesh(geometria, material);
mascara.frustumCulled = false;
mascara.visible = false;
scene.add(mascara);

let primerCuadro = true;
// Coloca cada vértice en su landmark (x, y normalizados; z en la misma escala que x).
function ajustarMalla(puntos) {
  const a = primerCuadro ? 1 : SUAVIZADO;
  primerCuadro = false;
  for (let i = 0; i < N; i++) {
    const p = puntos[i];
    posiciones[i * 3] += (p.x * W - posiciones[i * 3]) * a;
    posiciones[i * 3 + 1] += (-p.y * H - posiciones[i * 3 + 1]) * a;
    posiciones[i * 3 + 2] += (-p.z * W - posiciones[i * 3 + 2]) * a;
  }
  geometria.attributes.position.needsUpdate = true;
  geometria.computeVertexNormals();
}

const vertice = i => new THREE.Vector3(posiciones[i * 3], posiciones[i * 3 + 1], posiciones[i * 3 + 2]);
const anchoCara = () => vertice(234).distanceTo(vertice(454));

// ---------- efecto 1: lluvia de pétalos de cempasúchil ----------
const petalos = [];
const geoPetalo = new THREE.CircleGeometry(1, 12).scale(1, 0.55, 1);
function lluviaDePetalos() {
  const s = anchoCara() * 0.06;
  for (let i = 0; i < 90; i++) {
    const p = new THREE.Mesh(geoPetalo, new THREE.MeshBasicMaterial({
      color: [0xff7a00, 0xffb800, 0xff9500][i % 3], side: THREE.DoubleSide, transparent: true,
    }));
    p.scale.setScalar(s * (0.7 + Math.random() * 0.6));
    p.position.set(Math.random() * W, Math.random() * H * 0.3, 500);
    p.userData = { vy: H * (0.22 + Math.random() * 0.15), fase: Math.random() * 6, vida: 4 };
    scene.add(p);
    petalos.push(p);
  }
}

function actualizarPetalos(dt, t) {
  for (let i = petalos.length - 1; i >= 0; i--) {
    const p = petalos[i];
    const u = p.userData;
    p.position.y -= u.vy * dt;
    p.position.x += Math.sin(t * 2 + u.fase) * W * 0.08 * dt;
    p.rotation.z += dt * 2;
    p.scale.x = Math.abs(Math.cos(t * 3 + u.fase)) * p.scale.y + p.scale.y * 0.2; // giro en el aire
    u.vida -= dt;
    p.material.opacity = Math.min(1, u.vida);
    if (u.vida <= 0 || p.position.y < -H * 1.1) {
      scene.remove(p);
      p.material.dispose();
      petalos.splice(i, 1);
    }
  }
}

// ---------- efecto 2: veladoras alrededor del rostro ----------
const ANCLAS_VELAS = [54, 284, 234, 454, 172, 397]; // laterales del óvalo facial
const velas = ANCLAS_VELAS.map(() => crearVela());
let vidaVelas = 0;

function crearVela() {
  const g = new THREE.Group();
  const cera = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 1, 16), new THREE.MeshStandardMaterial({ color: 0xfff3d6 }));
  const vaso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.28, 0.7, 16), new THREE.MeshStandardMaterial({ color: 0xe6007e, transparent: true, opacity: 0.85 }));
  vaso.position.y = -0.2;
  const flama = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8).scale(1, 2, 1), new THREE.MeshBasicMaterial({ color: 0xffb800 }));
  flama.position.y = 0.75;
  const halo = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20), new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.3, depthWrite: false }));
  halo.position.set(0, 0.75, -0.1);
  g.add(cera, vaso, flama, halo);
  g.userData.flama = flama;
  g.visible = false;
  scene.add(g);
  return g;
}

// Las veladoras de Sketchfab (las mismas del altar) sustituyen a los cilindros
// en cuanto cargan; el halo sigue titilando detrás de cada una.
new GLTFLoader().load('assets/veladora.glb', gltf => {
  const caja = new THREE.Box3().setFromObject(gltf.scene);
  const k = 1.1 / caja.getSize(new THREE.Vector3()).y;
  gltf.scene.scale.setScalar(k);
  gltf.scene.position.set(-(caja.min.x + caja.max.x) / 2 * k, -0.55 - caja.min.y * k, -(caja.min.z + caja.max.z) / 2 * k);
  for (const v of velas) {
    const [cera, vaso, flama, halo] = v.children;
    cera.visible = vaso.visible = flama.visible = false;
    v.add(gltf.scene.clone());
    v.userData.flama = halo;
  }
});

function actualizarVelas(dt, t) {
  vidaVelas = Math.max(0, vidaVelas - dt);
  const aparece = Math.min(1, vidaVelas, (5 - vidaVelas) * 3); // entra rápido, se apaga suave
  const centro = vertice(1);
  const tam = anchoCara() * 0.22;
  velas.forEach((v, k) => {
    v.visible = vidaVelas > 0 && mascara.visible;
    if (!v.visible) return;
    // un poco hacia afuera del óvalo, en el plano de la cara
    const a = vertice(ANCLAS_VELAS[k]);
    a.sub(centro).multiplyScalar(1.35).add(centro);
    v.position.set(a.x, a.y, centro.z + 50);
    v.scale.setScalar(tam * aparece);
    v.userData.flama.scale.set(1, 1 + Math.sin(t * 25 + k) * 0.15, 1); // titileo
  });
}

// ---------- efecto 3: cambio de colores (día ↔ noche) ----------
let destello = 0;
function cambiarColores() {
  material.map = material.map === texDia ? texNoche : texDia;
  destello = 1;
}

// ---------- gestos ----------
const disparadores = {
  boca: new Disparador(0.5, 0.3, 1000),
  cejas: new Disparador(0.55, 0.3, 1500),
  ojos: new Disparador(0.6, 0.3, 1200),
};
const REACCIONES = {
  boca() { lluviaDePetalos(); sfx('petalos'); },
  cejas() { vidaVelas = 5; sfx('velas'); },
  ojos() { cambiarColores(); sfx('cambio'); },
};

function disparar(nombre) {
  REACCIONES[nombre]();
  const chip = document.querySelector(`[data-gesto="${nombre}"]`);
  chip.classList.add('activo');
  setTimeout(() => chip.classList.remove('activo'), 600);
}

function revisarGestos(categorias, ahora) {
  const valores = {
    boca: blendshape(categorias, 'jawOpen'),
    cejas: blendshape(categorias, 'browInnerUp'),
    ojos: Math.min(blendshape(categorias, 'eyeBlinkLeft'), blendshape(categorias, 'eyeBlinkRight')),
  };
  for (const [nombre, d] of Object.entries(disparadores)) {
    if (d.actualizar(valores[nombre], ahora)) disparar(nombre);
  }
}

// ---------- bucle ----------
const reloj = new THREE.Clock();
function animar() {
  const dt = Math.min(reloj.getDelta(), 0.1);
  const t = reloj.elapsedTime;
  destello = Math.max(0, destello - dt * 2);
  material.emissiveIntensity = destello * 0.8;
  actualizarPetalos(dt, t);
  actualizarVelas(dt, t);
  renderer.render(scene, camera);
}

function ajustarTamano() {
  W = fuente.videoWidth || fuente.naturalWidth || innerWidth;
  H = fuente.videoHeight || fuente.naturalHeight || innerHeight;
  renderer.setSize(W, H, false); // el CSS (object-fit: cover) recorta igual que al video
  Object.assign(camera, { left: 0, right: W, top: 0, bottom: -H });
  camera.updateProjectionMatrix();
}

let landmarker = null;
let ultimoTiempo = -1;

function fuenteNueva() {
  if (!(fuente instanceof HTMLVideoElement)) return true;
  if (fuente.readyState < 2 || fuente.currentTime === ultimoTiempo) return false;
  ultimoTiempo = fuente.currentTime;
  return true;
}

function cuadro() {
  if (landmarker && fuenteNueva()) {
    const ahora = performance.now();
    const r = landmarker.detectForVideo(fuente, ahora);
    if (r.faceLandmarks?.length) {
      ajustarMalla(r.faceLandmarks[0]);
      mascara.visible = true;
      revisarGestos(r.faceBlendshapes[0].categories, ahora);
      estado.textContent = '';
    } else {
      mascara.visible = false;
      primerCuadro = true;
      estado.textContent = 'Muestra tu cara a la cámara';
    }
  }
  animar();
}

async function crearLandmarker() {
  const fileset = await FilesetResolver.forVisionTasks(VISION);
  const opciones = delegate => ({
    baseOptions: { modelAssetPath: MODELO_CARA, delegate },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
  });
  try {
    return await FaceLandmarker.createFromOptions(fileset, opciones('GPU'));
  } catch {
    return await FaceLandmarker.createFromOptions(fileset, opciones('CPU'));
  }
}

async function iniciar() {
  // abre directo al filtro: pide la cámara frontal al cargar
  try {
    if (IMAGEN) {
      const img = new Image();
      img.src = IMAGEN;
      await img.decode();
      img.id = 'video';
      fuente.replaceWith(img);
      fuente = img;
    } else {
      fuente.srcObject = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      await fuente.play();
    }
  } catch (err) {
    estado.innerHTML = 'No se pudo abrir la cámara frontal.<br><small>Da permiso de cámara y abre la página con HTTPS.</small>';
    console.error(err);
    return;
  }
  ajustarTamano();
  fuente.addEventListener('resize', ajustarTamano);
  estado.textContent = 'Cargando detector facial…';
  landmarker = await crearLandmarker();
  estado.textContent = 'Muestra tu cara a la cámara';
  renderer.setAnimationLoop(cuadro);
}

// Modo demo (?demo): sin cámara, la malla canónica gira en pantalla.
// Teclas 1, 2, 3 o window.simular('boca' | 'cejas' | 'ojos').
function iniciarDemo() {
  scene.background = new THREE.Color(0x2a1b3d);
  estado.textContent = '';
  ajustarTamano();
  mascara.visible = true;
  window.simular = disparar;
  addEventListener('keydown', e => {
    const gesto = { 1: 'boca', 2: 'cejas', 3: 'ojos' }[e.key];
    if (gesto) disparar(gesto);
  });
  const base = malla.posiciones;
  const escala = Math.min(W, H) / 30; // ~ 30 cm de ancho de pantalla
  const puntos = Array.from({ length: N }, () => ({ x: 0, y: 0, z: 0 }));
  renderer.setAnimationLoop(() => {
    const ang = Math.sin(performance.now() / 1000 * 0.8) * 0.5;
    const c = Math.cos(ang), s = Math.sin(ang);
    for (let i = 0; i < N; i++) {
      const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
      const xr = x * c + z * s, zr = -x * s + z * c;
      puntos[i].x = 0.5 + (xr * escala) / W;
      puntos[i].y = 0.45 - (y * escala) / H;
      puntos[i].z = -(zr * escala) / W;
    }
    ajustarMalla(puntos);
    animar();
  });
}

// el audio necesita un toque del usuario
addEventListener('pointerdown', async () => {
  await initAudio();
  $('sonido').remove();
}, { once: true });

if (DEMO) iniciarDemo();
else iniciar();
