import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ============== JOSHWAY: COURAGE TO RISE ==============
// A 3D web platformer adventure set in Joshway's vibrant playground realm.
// Collect Courage Stars, use your cape to RISE high with limited courage energy.
// Inspired by the beautiful illustrations of Maggie Isamoyer for "Joshway and the Courage to Rise".
// Made with Three.js + WebGPU support. Procedural world + GLTF ready for models.

const canvas = document.getElementById('game-canvas');

// Use modern WebGPU when available (the 2026 successor to WebGL), with WebGL fallback.
// This is one of the "other things" worth considering beyond basic Three.js + WebGL.
let renderer;

async function initRenderer() {
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  
  if (navigator.gpu) {
    try {
      // Dynamic import for WebGPU renderer (three/webgpu in recent Three.js)
      const { WebGPURenderer } = await import('three/webgpu');
      renderer = new WebGPURenderer({ 
        canvas, 
        antialias: true,
        alpha: false 
      });
      await renderer.init();
      console.log('%c[PlayStalgiaX] Using WebGPU renderer (modern path)', 'color:#4ade80');
    } catch (e) {
      console.log('%c[PlayStalgiaX] WebGPU init failed, falling back to WebGL', 'color:#f59e0b');
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    }
  } else {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  }
  
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

// Camera
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 200);

// Scene
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0a1229, 40, 95); // vast scale for multi-world exploration

// ============== CONSTANTS & STATE ==============
const ROOM = { w: 48, d: 42, h: 32 }; // MUCH bigger room with very high ceilings for epic rising across worlds
const COIN_COUNT = 12; // per level for manageability
let coinsCollected = 0;
let gameState = 'start'; // start | playing | win | paused
let startTime = 0;
let gameTime = 0;
let score = 0;
let levelStartTime = 0;
let powerups = []; // energy refills for real gameplay strategy
let hazard = null; // simple moving toy hazard for challenge / real game feel

let currentLevel = 0;
let selectedLevel = 0; // for level select UI
const LEVELS = [
  { name: "Cozy Living Room", music: "cozy", gravity: -22, sky: 0x87ceeb, ground: 0x8b7355 },
  { name: "Backyard", music: "playful", gravity: -26, sky: 0x98fb98, ground: 0x228b22 },
  { name: "Playground Realm", music: "upbeat", gravity: -26, sky: 0x87ceeb, ground: 0x32cd32 },
  { name: "City Lights", music: "energetic", gravity: -26, sky: 0xb0c4de, ground: 0x696969 },
  { name: "The Moon", music: "dreamy", gravity: -6, sky: 0x191970, ground: 0xc0c0c0 },
  { name: "Open Starfield", music: "dreamy", gravity: 0, sky: 0x000011, ground: 0x000000 }, // no gravity open space between Moon and Mars
  { name: "Red Mars", music: "adventurous", gravity: -18, sky: 0xcd5c5c, ground: 0xb22222 },
  { name: "Volcanic Io", music: "mysterious", gravity: -10, sky: 0x2f4f4f, ground: 0xffd700 }
];

let npcs = []; // funny CPU characters that interfere playfully
let currentGravity = -26;
let levelCoinsNeeded = COIN_COUNT;
let beatenLevels = JSON.parse(localStorage.getItem('joshway_beaten') || '[]');
let levelObjects = []; // track level-specific meshes for clean removal on switch (fixes prop accumulation bug)
let activePowerupEffects = {}; // for temp powerups like magnet
let bonusCoinsCollected = 0; // extra secrets for score

const CHARACTERS = [
  { id: 0, name: "Joshway", suit: 0x3b82f6, cape: 0xf97316, skin: 0x8b5e3c, glasses: 0xf59e0b, desc: "The brave hero with the orange cape" },
  { id: 1, name: "Toy Nova", suit: 0xeeeeee, cape: 0x7c3aed, skin: 0xf5d0c5, glasses: 0x111827, desc: "Classic retro astronaut toy" },
  { id: 2, name: "Cacie", suit: 0x10b981, cape: 0xf472b6, skin: 0x8b5e3c, glasses: 0x111827, desc: "Josh's skatepark friend" },
  { id: 3, name: "Super Star", suit: 0xfde047, cape: 0x3b82f6, skin: 0x8b5e3c, glasses: 0xf59e0b, desc: "Glowing courage mode" }
];
let selectedCharacter = 0; // default Joshway

// Helper to build the hero model (reusable for main game + previews)
function createHeroGroup(preset) {
  const group = new THREE.Group();
  
  const blueSuit = preset.suit;
  const orangeCape = preset.cape;
  const skin = preset.skin;
  const glasses = preset.glasses;
  const dark = 0x1f2937;
  
  // LEGS (suit color)
  const legMat = new THREE.MeshLambertMaterial({ color: blueSuit });
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.75, 0.32), legMat);
  leftLeg.position.set(-0.22, 0.65, 0);
  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.22;
  group.add(leftLeg, rightLeg);
  
  // SHOES
  const shoeMat = new THREE.MeshLambertMaterial({ color: dark });
  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.25, 0.42), shoeMat);
  leftShoe.position.set(-0.22, 0.28, 0.02);
  const rightShoe = leftShoe.clone(); rightShoe.position.x = 0.22;
  group.add(leftShoe, rightShoe);
  
  // TORSO
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.5), new THREE.MeshLambertMaterial({ color: blueSuit }));
  torso.position.set(0, 1.3, 0);
  group.add(torso);
  
  // Chest emblem
  const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), new THREE.MeshLambertMaterial({ color: orangeCape }));
  emblem.position.set(0, 1.45, 0.27);
  emblem.rotation.y = 0;
  group.add(emblem);
  
  // Chest stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.52), new THREE.MeshLambertMaterial({ color: 0x1e40af }));
  stripe.position.set(0, 1.35, 0.02);
  group.add(stripe);
  
  // ARMS
  const armMat = new THREE.MeshLambertMaterial({ color: skin });
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), armMat);
  leftArm.position.set(-0.5, 1.3, 0);
  leftArm.rotation.z = 0.3;
  const rightArm = leftArm.clone();
  rightArm.position.x = 0.5;
  rightArm.rotation.z = -0.3;
  group.add(leftArm, rightArm);
  
  // Cape
  const capeMat = new THREE.MeshLambertMaterial({ color: orangeCape, side: THREE.DoubleSide });
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.1), capeMat);
  cape.position.set(0, 1.2, -0.35);
  cape.rotation.x = 0.3;
  group.add(cape);
  const cape2 = cape.clone();
  cape2.position.z = -0.45;
  cape2.rotation.x = 0.5;
  group.add(cape2);
  
  // HEAD
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 18, 16), new THREE.MeshLambertMaterial({ color: skin }));
  head.position.set(0, 1.9, 0);
  group.add(head);
  
  // Glasses / Mask
  const glassesFrame = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.18, 0.42), new THREE.MeshLambertMaterial({ color: glasses }));
  glassesFrame.position.set(0, 1.95, 0.22);
  group.add(glassesFrame);
  
  // Eyes
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  eyeL.position.set(-0.15, 1.95, 0.38);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.15;
  group.add(eyeL, eyeR);
  
  // Smile
  const smile = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.4), new THREE.MeshLambertMaterial({ color: dark }));
  smile.position.set(0, 1.78, 0.35);
  group.add(smile);
  
  // Hair
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), new THREE.MeshLambertMaterial({ color: 0x3f2a1f }));
  hair.position.set(0, 2.05, -0.05);
  hair.scale.set(1, 0.7, 1.1);
  group.add(hair);
  
  // Collar
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.15, 0.55), new THREE.MeshLambertMaterial({ color: orangeCape }));
  collar.position.set(0, 1.65, -0.15);
  group.add(collar);
  
  // Store animation refs (only used in main game)
  group.userData = { leftArm, rightArm, leftLeg, rightLeg, cape, cape2, glassesFrame };
  
  return group;
}

const keys = {};
let mouseX = 0;
let mouseY = 0;
let isPointerLocked = false;

const player = {
  position: new THREE.Vector3(0, 1.8, 18),
  velocity: new THREE.Vector3(0, 0, 0),
  rotationY: 0, // facing negative Z into the room (standard)
  onGround: false,
  canDoubleJump: true,
  jetActive: false,
  energy: 1.0,
  radius: 0.55,
  height: 1.6
};
let prevOnGround = false;

let playerGroup = null;
let jetParticles = [];
let coinParticles = [];

const coins = [];
const colliders = []; // simple AABB boxes for furniture/walls

// ============== AUDIO (Web Audio + chiptune music) ==============
let audioCtx;
let masterGain;
let musicGain;
let sfxGain;
let musicEnabled = true;
let isMusicPlaying = false;
let musicTimer = null;
let musicStartTime = 0;
let lastJetSound = 0;

function initAudio() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.9;
    
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.65;
    
    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = 0.95;
    
    const compressor = audioCtx.createDynamicsCompressor();
    masterGain.connect(compressor);
    compressor.connect(audioCtx.destination);
    
    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);
  } catch (e) {}
}

function resumeAudio() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playTone(freq, duration, type = 'square', volume = 0.2, slide = 0, dest = null) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  
  osc.type = type;
  osc.frequency.value = freq;
  
  filter.type = 'lowpass';
  filter.frequency.value = (type === 'sine') ? 2400 : 1600;
  
  gain.gain.value = volume;
  
  const now = audioCtx.currentTime;
  osc.start(now);
  
  if (slide) {
    osc.frequency.linearRampToValueAtTime(freq + slide, now + duration);
  }
  
  gain.gain.linearRampToValueAtTime(0.0001, now + duration);
  
  const target = dest || sfxGain;
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(target);
  
  setTimeout(() => {
    try { osc.stop(); } catch(e){}
  }, duration * 1000 + 80);
}

// --- SFX ---
function sfxCoin() {
  playTone(920, 0.09, 'sine', 0.42, 260);
  setTimeout(() => playTone(1380, 0.14, 'sine', 0.28, 120), 55);
  setTimeout(() => playTone(1760, 0.22, 'sine', 0.16, 40), 105);
}

function sfxJump(isDouble) {
  playTone(isDouble ? 520 : 355, 0.16, 'sawtooth', 0.22, -160);
  if (isDouble) {
    setTimeout(() => playTone(680, 0.13, 'square', 0.15, 90), 90);
  }
}

function sfxLand() {
  // soft thud + click
  playTone(85, 0.11, 'square', 0.18);
  setTimeout(() => playTone(120, 0.07, 'sine', 0.09), 40);
}

let jetActiveLast = false;
function sfxJetStart() {
  playTone(160, 0.35, 'sawtooth', 0.13, 40);
  setTimeout(() => playTone(210, 0.22, 'sawtooth', 0.08), 120);
}

function sfxBoost() {
  const t = Date.now();
  if (t - lastJetSound < 90) return;
  lastJetSound = t;
  playTone(175, 0.18, 'sawtooth', 0.11);
  setTimeout(() => playTone(245, 0.14, 'sawtooth', 0.07), 60);
}

function sfxWin() {
  // bigger triumphant jingle
  playTone(660, 0.22, 'sine', 0.35);
  setTimeout(() => playTone(880, 0.18, 'sine', 0.32), 150);
  setTimeout(() => playTone(1100, 0.28, 'sine', 0.28), 290);
  setTimeout(() => playTone(1320, 0.55, 'sine', 0.26, 90), 460);
}

// --- BACKGROUND MUSIC (simple looping chiptune) ---
let MUSIC_TEMPO = 138; // BPM
let BEAT = 60 / MUSIC_TEMPO;

function noteToFreq(note) {
  // note like 'C4', 'D#5', 'G3'
  const notes = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const match = note.match(/^([A-G][#b]?)(-?\d)$/);
  if (!match) return 440;
  const [, n, oct] = match;
  const semitones = notes[n] + (parseInt(oct) - 4) * 12;
  return 440 * Math.pow(2, semitones / 12);
}

let musicNotes = [];
let musicLoopLength = 0;

function buildMusicSequence() {
  // Nostalgic chiptune loop (about 8 seconds)
  // Format: [startBeat, noteName, durationBeats, wave, vol]
  musicNotes = [
    // Bass
    [0, 'C2', 1.0, 'square', 0.65],
    [1, 'G2', 1.0, 'square', 0.55],
    [2, 'A2', 1.0, 'square', 0.6],
    [3, 'E2', 1.0, 'square', 0.58],
    [4, 'C2', 1.0, 'square', 0.65],
    [5, 'G2', 1.0, 'square', 0.55],
    [6, 'F2', 1.0, 'square', 0.6],
    [7, 'G2', 1.0, 'square', 0.58],
    // Lead melody
    [0.0, 'E4', 0.5, 'square', 0.5],
    [0.5, 'G4', 0.5, 'square', 0.48],
    [1.0, 'C5', 0.75, 'square', 0.52],
    [2.0, 'B4', 0.5, 'square', 0.47],
    [2.5, 'A4', 0.5, 'square', 0.5],
    [3.0, 'G4', 0.75, 'square', 0.48],
    [4.0, 'E4', 0.5, 'square', 0.5],
    [4.5, 'G4', 0.5, 'square', 0.48],
    [5.0, 'A4', 0.5, 'square', 0.52],
    [5.5, 'C5', 0.5, 'square', 0.5],
    [6.0, 'D5', 0.75, 'square', 0.48],
    [7.0, 'C5', 1.0, 'square', 0.52],
    // High sparkle arp
    [0.25, 'C6', 0.25, 'sine', 0.22],
    [1.25, 'E6', 0.25, 'sine', 0.2],
    [2.25, 'G6', 0.3, 'sine', 0.25],
    [4.25, 'C6', 0.25, 'sine', 0.22],
    [5.25, 'A6', 0.25, 'sine', 0.2],
    [6.75, 'G6', 0.35, 'sine', 0.23],
    // Perc (short noise-ish using square low)
    [0, 'C1', 0.1, 'square', 0.35],
    [1, 'C1', 0.1, 'square', 0.32],
    [2, 'C1', 0.1, 'square', 0.35],
    [3, 'C1', 0.1, 'square', 0.3],
    [4, 'C1', 0.1, 'square', 0.35],
    [5, 'C1', 0.1, 'square', 0.32],
    [6, 'C1', 0.1, 'square', 0.35],
    [7, 'C1', 0.1, 'square', 0.3],
  ];
  musicLoopLength = 8; // beats
}

function playMusicNote(startTime, noteName, durBeats, wave, vol) {
  if (!audioCtx || !musicGain || !musicEnabled) return;
  const freq = noteToFreq(noteName);
  const duration = durBeats * BEAT;
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  
  osc.type = wave;
  osc.frequency.value = freq;
  
  filter.type = (wave === 'sine') ? 'lowpass' : 'lowpass';
  filter.frequency.value = (wave === 'sine') ? 2800 : 1100;
  
  const now = startTime;
  osc.start(now);
  
  gain.gain.value = vol * 0.7;
  gain.gain.linearRampToValueAtTime(0.0001, now + duration * 0.92);
  
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(musicGain);
  
  setTimeout(() => { try { osc.stop(); } catch(e){} }, (duration * 1000) + 120);
}

function startBackgroundMusic() {
  // legacy, now use startLevelMusic
  startLevelMusic(currentLevel);
}

function startLevelMusic(level) {
  if (!audioCtx || !musicEnabled) return;
  resumeAudio();
  stopBackgroundMusic();

  const lvl = LEVELS[level] || LEVELS[0];
  let sequence;
  let tempo = 138;
  let volMult = 0.65;

  if (lvl.music === 'cozy') {
    tempo = 90;
    sequence = [[0,'C3',1.5,'sine',0.5],[1.5,'E3',1,'sine',0.4],[3,'G3',2,'square',0.45]]; // warm cozy
  } else if (lvl.music === 'playful') {
    tempo = 150;
    sequence = [[0,'C4',0.5,'square',0.5],[0.5,'E4',0.5,'square',0.5],[1,'G4',0.5,'sine',0.5],[2,'C5',1,'square',0.45]];
  } else if (lvl.music === 'upbeat') {
    tempo = 138;
    sequence = musicNotes; // reuse base fun one
  } else if (lvl.music === 'energetic') {
    tempo = 160;
    sequence = [[0,'G3',0.4,'sawtooth',0.55],[0.4,'B3',0.4,'sawtooth',0.5],[1.2,'D4',0.8,'square',0.5]];
  } else if (lvl.music === 'dreamy') {
    tempo = 70;
    volMult = 0.5;
    sequence = [[0,'C4',2,'sine',0.6],[2,'E4',2.5,'sine',0.55],[4,'G4',3,'sine',0.5]]; // ethereal dream state
  } else if (lvl.music === 'adventurous') {
    tempo = 125;
    sequence = [[0,'D3',0.6,'square',0.55],[1,'F3',0.6,'square',0.5],[2,'A3',1,'sawtooth',0.5]];
  } else if (lvl.music === 'mysterious') {
    tempo = 85;
    sequence = [[0,'F#3',1.5,'sine',0.45],[1.5,'A3',1.5,'sine',0.4],[3,'C#4',2,'triangle',0.5]]; // alien Io
  } else {
    sequence = musicNotes;
  }

  if (musicNotes.length === 0) buildMusicSequence();
  isMusicPlaying = true;
  musicStartTime = audioCtx.currentTime;
  BEAT = 60 / tempo; // dynamic tempo

  function scheduleLoop() {
    if (!isMusicPlaying || !musicEnabled) return;
    const loopStart = audioCtx.currentTime;
    const beats = 8;
    for (let i = 0; i < sequence.length; i++) {
      const [beatOffset, note, dur, wave, vol] = sequence[i];
      playMusicNote(loopStart + beatOffset * BEAT, note, dur, wave, vol * volMult);
    }
    musicTimer = setTimeout(scheduleLoop, beats * BEAT * 1000 - 30);
  }
  scheduleLoop();
}

function stopBackgroundMusic() {
  isMusicPlaying = false;
  if (musicTimer) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
  // Fade music gain quickly
  if (musicGain) {
    const now = audioCtx ? audioCtx.currentTime : 0;
    musicGain.gain.linearRampToValueAtTime(0.0001, now + 0.25);
    setTimeout(() => {
      if (musicGain && isMusicPlaying === false) musicGain.gain.value = 0.65;
    }, 280);
  }
}

function toggleMusic() {
  musicEnabled = !musicEnabled;
  const btn = document.getElementById('music-toggle');
  
  if (musicEnabled) {
    if (btn) {
      btn.textContent = '♪ MUSIC ON';
      btn.classList.remove('off');
    }
    if (gameState === 'playing') {
      startBackgroundMusic();
    }
  } else {
    if (btn) {
      btn.textContent = '♪ MUSIC OFF';
      btn.classList.add('off');
    }
    stopBackgroundMusic();
  }
}

let isPaused = false;

function togglePause() {
  if (gameState !== 'playing' && gameState !== 'paused') return;
  
  isPaused = !isPaused;
  gameState = isPaused ? 'paused' : 'playing';
  
  const pauseScreen = document.getElementById('pause-screen');
  const hud = document.getElementById('hud');
  const instr = document.getElementById('instructions');
  
  if (isPaused) {
    if (pauseScreen) pauseScreen.style.display = 'block';
    if (hud) hud.style.display = 'none';
    if (instr) instr.style.display = 'none';
    if (isPointerLocked) document.exitPointerLock();
    // pause music? optional, keep playing or not
  } else {
    if (pauseScreen) pauseScreen.style.display = 'none';
    if (hud) hud.style.display = 'flex';
    if (instr) instr.style.display = 'block';
    // resume
  }
}

// Keyboard shortcut for music
document.addEventListener('keydown', (e) => {
  if ((e.key.toLowerCase() === 'm') && (gameState === 'playing' || gameState === 'start')) {
    e.preventDefault();
    toggleMusic();
  }
});

// ============== UTILITIES ==============
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }

function createStarTexture(color1 = '#0b2a6e', color2 = '#f5d742') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d', { alpha: true });
  
  ctx.fillStyle = color1;
  ctx.fillRect(0, 0, 256, 256);
  
  ctx.fillStyle = color2;
  const stars = 42;
  for (let i = 0; i < stars; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const s = Math.random() * 4.5 + 2.2;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.random() * Math.PI);
    ctx.fillRect(-s/2, -s/2, s, s);
    // extra glow points
    if (Math.random() > 0.6) {
      ctx.fillRect(-s/6, -s * 1.1, s/3, s * 2.2);
      ctx.fillRect(-s * 1.1, -s/6, s * 2.2, s/3);
    }
    ctx.restore();
  }
  return new THREE.CanvasTexture(c);
}

function createWoodTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  
  ctx.fillStyle = '#4a3728';
  ctx.fillRect(0, 0, 512, 256);
  
  ctx.strokeStyle = '#3a2a1f';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 28; i++) {
    ctx.beginPath();
    const y = (i + Math.random()) * 9.2;
    ctx.moveTo(0, y);
    for (let x = 20; x < 512; x += 18) {
      ctx.lineTo(x, y + Math.sin(x / 27) * 3.5 + (Math.random() - 0.5) * 1.4);
    }
    ctx.stroke();
  }
  // highlight grain
  ctx.strokeStyle = 'rgba(230, 200, 150, 0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * 18 + 6);
    ctx.lineTo(512, i * 18 + 22);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}

function makeAABB(x, y, z, w, h, d) {
  return {
    min: new THREE.Vector3(x - w/2, y, z - d/2),
    max: new THREE.Vector3(x + w/2, y + h, z + d/2),
    center: new THREE.Vector3(x, y + h/2, z)
  };
}

function pointInAABB(p, aabb) {
  return (p.x > aabb.min.x && p.x < aabb.max.x &&
          p.y > aabb.min.y && p.y < aabb.max.y &&
          p.z > aabb.min.z && p.z < aabb.max.z);
}

// Clear all level-specific objects, colliders, particles to prevent accumulation across worlds (bug fix)
function clearLevel() {
  // Remove tracked level objects (furniture, themed props, starfields, etc)
  levelObjects.forEach(obj => {
    if (obj && obj.parent) scene.remove(obj);
    // also remove lights attached if any
    if (obj && obj.userData && obj.userData.light) {
      try { scene.remove(obj.userData.light); } catch(e){}
    }
  });
  levelObjects.length = 0;

  // Clear dynamic
  [...coins, ...powerups, ...npcs].forEach(obj => {
    if (obj && obj.parent) scene.remove(obj);
  });
  coins.length = 0;
  powerups.length = 0;
  npcs.length = 0;

  if (hazard) { scene.remove(hazard); hazard = null; }
  if (risePortal) {
    scene.remove(risePortal);
    if (risePortal.userData && risePortal.userData.light) scene.remove(risePortal.userData.light);
    risePortal = null;
  }

  // Clear starfields / special
  scene.children.filter(c => c.userData && (c.userData.isStarfield || c.userData.isLevelProp)).forEach(c => scene.remove(c));

  // Reset colliders for fresh per-level geometry
  colliders.length = 0;

  // Reset temp effects
  activePowerupEffects = {};
  bonusCoinsCollected = 0;
  jetParticles.forEach(p => scene.remove(p));
  jetParticles.length = 0;
  coinParticles.forEach(p => scene.remove(p));
  coinParticles.length = 0;
}

function resolvePlayerCollision() {
  // Improved AABB vs player collision - better bed / platform handling (fixes clipping issues)
  const p = player.position;
  const r = player.radius;
  let collided = false;
  
  for (const box of colliders) {
    // closest point
    const closest = new THREE.Vector3(
      clamp(p.x, box.min.x, box.max.x),
      clamp(p.y, box.min.y, box.max.y),
      clamp(p.z, box.min.z, box.max.z)
    );
    
    const diff = p.clone().sub(closest);
    const dist2 = diff.x*diff.x + diff.z*diff.z;
    
    // Side push (improved tolerance)
    const yOverlap = (p.y + player.height * 0.65 > box.min.y) && (p.y < box.max.y + 0.15);
    if (dist2 < r*r && yOverlap) {
      const dist = Math.sqrt(dist2) || 0.0001;
      const push = (r - dist) * 1.08;
      p.x += (diff.x / dist) * push;
      p.z += (diff.z / dist) * push;
      player.velocity.x *= 0.55;
      player.velocity.z *= 0.55;
      collided = true;
    }
    
    // Platform top landing / floor
    const onTopXZ = (p.x > box.min.x - 0.1 && p.x < box.max.x + 0.1 && p.z > box.min.z - 0.1 && p.z < box.max.z + 0.1);
    if (onTopXZ) {
      // standing on top (good for beds/dressers/desks)
      if (player.velocity.y <= 0.05 && p.y + 0.08 >= box.max.y - 0.03 && p.y < box.max.y + 1.6) {
        p.y = box.max.y + 0.015;
        player.velocity.y = Math.max(player.velocity.y, 0);
        player.onGround = true;
        player.canDoubleJump = true;
        collided = true;
      }
      // head bump ceiling
      if (player.velocity.y > 0 && p.y + player.height > box.min.y && p.y + player.height < box.max.y + 0.35) {
        player.velocity.y = -0.25;
        collided = true;
      }
    }
  }
  return collided;
}

// ============== CREATE LEVEL WORLD (per-level full builds for polish) ==============
// Replaces old buildWorld + buildLevelProps. Fully themed environments, proper clear, better visuals
function addLevelProp(obj) {
  scene.add(obj);
  levelObjects.push(obj);
  if (obj.castShadow !== undefined) obj.castShadow = true;
  if (obj.receiveShadow !== undefined) obj.receiveShadow = true;
  obj.userData = obj.userData || {};
  obj.userData.isLevelProp = true;
}

function buildLevelWorld(level) {
  const lvl = LEVELS[level] || LEVELS[0];
  const groundColor = lvl.ground || 0x4ade80;
  const skyColor = lvl.sky || 0x87ceeb;

  // Core floor - themed per world
  let floorMat;
  if (level === 0) { // Living Room wood
    const floorTex = createWoodTexture();
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(6, 5);
    floorMat = new THREE.MeshLambertMaterial({ map: floorTex, color: 0x8b7355 });
  } else if (level === 1) { // Backyard grass
    floorMat = new THREE.MeshLambertMaterial({ color: groundColor, emissive: 0x0a3d0a });
  } else if (level === 5) { // Starfield - no solid floor, use dark void
    floorMat = new THREE.MeshLambertMaterial({ color: 0x000005 });
  } else if (level === 7) { // Io volcanic
    floorMat = new THREE.MeshLambertMaterial({ color: 0x8b4513, emissive: 0x331100 });
  } else {
    floorMat = new THREE.MeshLambertMaterial({ color: groundColor });
  }

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  addLevelProp(floor);
  floor.receiveShadow = true;

  // Walls / boundaries - color per theme, softer for kid adventure
  let wallColor = (level === 0) ? 0xf3e8d8 : (level === 1 ? 0x6b8e23 : skyColor * 1.1 | 0); // approx
  if (level === 4 || level === 5) wallColor = 0x112244;
  if (level === 6) wallColor = 0x662222;
  if (level === 7) wallColor = 0x3a2f1f;

  const wallMat = new THREE.MeshLambertMaterial({ color: wallColor });

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.h), wallMat);
  backWall.position.set(0, ROOM.h / 2, -ROOM.d / 2);
  addLevelProp(backWall);

  const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.h), wallMat);
  frontWall.position.set(0, ROOM.h / 2, ROOM.d / 2);
  frontWall.rotation.y = Math.PI;
  addLevelProp(frontWall);

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.d, ROOM.h), wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-ROOM.w / 2, ROOM.h / 2, 0);
  addLevelProp(leftWall);

  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.d, ROOM.h), wallMat);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(ROOM.w / 2, ROOM.h / 2, 0);
  addLevelProp(rightWall);

  // Ceiling tint
  const ceilCol = (level === 5) ? 0x000022 : (level === 7 ? 0x4a3a2a : 0xbae6fd);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), new THREE.MeshLambertMaterial({ color: ceilCol }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = ROOM.h;
  addLevelProp(ceil);

  // Colliders - always fresh walls + floor
  const inset = 0.35;
  colliders.push(makeAABB(0, 0, -ROOM.d/2 + inset, ROOM.w - 1, ROOM.h, 0.7));
  colliders.push(makeAABB(0, 0, ROOM.d/2 - inset, ROOM.w - 1, ROOM.h, 0.7));
  colliders.push(makeAABB(-ROOM.w/2 + inset, 0, 0, 0.7, ROOM.h, ROOM.d - 1));
  colliders.push(makeAABB(ROOM.w/2 - inset, 0, 0, 0.7, ROOM.h, ROOM.d - 1));
  colliders.push(makeAABB(0, -0.3, 0, ROOM.w + 3, 0.6, ROOM.d + 3));

  // === THEMED PROPS + LIGHTING + PARTICLES per level (warm empowering kid adventure style) ===
  // Add level ambient lighting variety
  const hemiLvl = new THREE.HemisphereLight(level === 6 ? 0xffaa66 : 0xffffff, level === 7 ? 0x331100 : 0x334455, level === 5 ? 0.6 : 0.9);
  scene.add(hemiLvl);
  levelObjects.push(hemiLvl);

  const mainLight = new THREE.DirectionalLight(level === 6 ? 0xffcc88 : 0xfff4d9, level === 5 ? 0.5 : 0.9);
  mainLight.position.set(8, 22, level === 5 ? -10 : 6);
  mainLight.castShadow = true;
  scene.add(mainLight);
  levelObjects.push(mainLight);

  if (level === 0) {
    // COZY LIVING ROOM - furniture, warm lamp, rug, bed detail
    const floorTex = createWoodTexture();
    floor.material.map = floorTex; // override already
    // Rug
    const rug = new THREE.Mesh(new THREE.CircleGeometry(6, 5), new THREE.MeshLambertMaterial({color: 0x1e3a8a}));
    rug.rotation.x = -Math.PI/2; rug.position.set(-4, 0.03, 7);
    addLevelProp(rug);

    // Pink desk
    const desk = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.35, 2.5), new THREE.MeshLambertMaterial({color: 0xc0267a}));
    desk.position.set(11, 2.15, -8); addLevelProp(desk);
    colliders.push(makeAABB(11, 0, -8, 5.2, 2.2, 2.5));

    // Chair, dresser, bed (fix bed collision better by adding top platform)
    const bed = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.7, 7.2), new THREE.MeshLambertMaterial({color: 0x1e3a8a}));
    bed.position.set(-5.5, 1.65, 7.5); addLevelProp(bed);
    colliders.push(makeAABB(-5.5, 1.3, 7.5, 4.8, 0.7, 7.2));

    const headboard = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.5, 0.45), new THREE.MeshLambertMaterial({color: 0x854d0e}));
    headboard.position.set(-5.5, 2.5, 10.8); addLevelProp(headboard);
    colliders.push(makeAABB(-5.5, 1.3, 10.8, 4.8, 2.5, 0.45));

    // Posts
    [[-8,1,11],[-3,1,11],[-8,1,4],[-3,1,4]].forEach((p,i) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,3.2,8), new THREE.MeshLambertMaterial({color: [0xc0267a,0x7c3aed,0x0ea5e9,0xf59e0b][i]}));
      post.position.set(p[0],p[1],p[2]); addLevelProp(post);
    });

    // Pillow
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(2.6,0.35,1.5), new THREE.MeshLambertMaterial({color:0xf1e7d9}));
    pillow.position.set(-5.5,2.05,8.8); addLevelProp(pillow);

    // Lamp with nice point light
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.4,0.1,12), new THREE.MeshLambertMaterial({color:0x431407}));
    lamp.position.set(9,0.1,5); addLevelProp(lamp);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,2.2,8), new THREE.MeshLambertMaterial({color:0x1f2937}));
    pole.position.set(9,1.1,5); addLevelProp(pole);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.9,1.3,16,1,true), new THREE.MeshLambertMaterial({color:0x9f1239, side:THREE.DoubleSide}));
    shade.position.set(9,2.6,5); shade.rotation.x = Math.PI; addLevelProp(shade);
    const lampL = new THREE.PointLight(0xffe0a0, 1.6, 18);
    lampL.position.set(9,2.2,5); scene.add(lampL); levelObjects.push(lampL);

    // Window + outside peek + courage sun landmark
    const win = new THREE.Mesh(new THREE.BoxGeometry(3,2.3,0.3), new THREE.MeshLambertMaterial({color:0xe2e8f0}));
    win.position.set(-12,3.8,1); addLevelProp(win);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.5,1.7), new THREE.MeshLambertMaterial({color:0xbae6fd, transparent:true, opacity:0.55}));
    glass.position.set(-12.1,3.8,1.2); glass.rotation.y = Math.PI/2; addLevelProp(glass);

    const courageSun = new THREE.Mesh(new THREE.SphereGeometry(1.1,18,14), new THREE.MeshBasicMaterial({color:0xfde047}));
    courageSun.position.set(1,9,-9); addLevelProp(courageSun);
    const sunL = new THREE.PointLight(0xfacc15, 1.9, 26); sunL.position.copy(courageSun.position); scene.add(sunL); levelObjects.push(sunL);

    // Hazard toy
    hazard = new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.65,0.65,8), new THREE.MeshLambertMaterial({color:0xef4444}));
    hazard.position.set(2.5,0.38,1.5); addLevelProp(hazard);

  } else if (level === 1) {
    // BACKYARD - grass, trees, fence, wind hints
    const grassPatch = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w*0.9, ROOM.d*0.9), new THREE.MeshLambertMaterial({color:0x22aa33}));
    grassPatch.rotation.x=-Math.PI/2; grassPatch.position.y=0.02; addLevelProp(grassPatch);

    // Trees
    for(let i=0; i<5; i++) {
      const tx = -14 + i*7; const tz = -8 + (i%2)*4;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.9,5.5,7), new THREE.MeshLambertMaterial({color:0x5c4033}));
      trunk.position.set(tx, 2.7, tz); addLevelProp(trunk);
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(3.2,7,6), new THREE.MeshLambertMaterial({color:0x228b22}));
      leaves.position.set(tx, 6.5, tz); addLevelProp(leaves);
    }
    const fence = new THREE.Mesh(new THREE.BoxGeometry(38,1.4,0.35), new THREE.MeshLambertMaterial({color:0x8b5a2b}));
    fence.position.set(0,0.75,-17.5); addLevelProp(fence);

    // Swing set for playground feel
    const swingPostL = new THREE.Mesh(new THREE.BoxGeometry(0.25,6,0.25), new THREE.MeshLambertMaterial({color:0x555}));
    swingPostL.position.set(-5,3,-2); addLevelProp(swingPostL);
    const swingPostR = swingPostL.clone(); swingPostR.position.x=5; addLevelProp(swingPostR);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(11,0.2,0.2), new THREE.MeshLambertMaterial({color:0x333}));
    bar.position.set(0,6,-2); addLevelProp(bar);

    // Courage star high
    const starHigh = new THREE.Mesh(new THREE.SphereGeometry(0.9,12,10), new THREE.MeshBasicMaterial({color:0xfde047}));
    starHigh.position.set(0,14,-11); addLevelProp(starHigh);

  } else if (level === 2) {
    // PLAYGROUND REALM - slides, platforms, bright
    const slide = new THREE.Mesh(new THREE.BoxGeometry(1.8,0.3,7), new THREE.MeshLambertMaterial({color:0xff6b6b}));
    slide.position.set(8,2.5,-6); slide.rotation.z = -0.6; addLevelProp(slide);
    const platform = new THREE.Mesh(new THREE.BoxGeometry(6,0.4,4), new THREE.MeshLambertMaterial({color:0x3b82f6}));
    platform.position.set(-9,5,3); addLevelProp(platform);
    colliders.push(makeAABB(-9,4.9,3,6,0.5,4));
    // Monkey bars
    for(let i=-3;i<=3;i++){
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,6,6), new THREE.MeshLambertMaterial({color:0x333}));
      bar.rotation.z = Math.PI/2; bar.position.set(i*1.8 +1 ,7.5,-8); addLevelProp(bar);
    }
    const bigBall = new THREE.Mesh(new THREE.SphereGeometry(2,12,10), new THREE.MeshLambertMaterial({color:0xf59e0b}));
    bigBall.position.set(0,1.8,12); addLevelProp(bigBall);

  } else if (level === 3) {
    // CITY LIGHTS - buildings, neon, streets
    for(let i=-2; i<=2; i++) {
      const bH = 6 + Math.random()*8;
      const bld = new THREE.Mesh(new THREE.BoxGeometry(3.5, bH, 4), new THREE.MeshLambertMaterial({color: i%2?0x334455:0x222233}));
      bld.position.set(i*8.5, bH/2, -14); addLevelProp(bld);
      // windows glow
      const winL = new THREE.PointLight(0xffee99, 0.6, 12);
      winL.position.set(i*8.5, 4, -13); scene.add(winL); levelObjects.push(winL);
    }
    const street = new THREE.Mesh(new THREE.PlaneGeometry(14, ROOM.d), new THREE.MeshLambertMaterial({color:0x444444}));
    street.rotation.x = -Math.PI/2; street.position.set(0,0.01,4); addLevelProp(street);

  } else if (level === 4) {
    // THE MOON - craters, low rocks, flag, dreamy
    for(let i=0; i<6; i++) {
      const cr = new THREE.Mesh(new THREE.CylinderGeometry(1.8+Math.random(),1.9+Math.random(),0.6,16), new THREE.MeshLambertMaterial({color:0x666677}));
      cr.position.set(-12 + i*5, 0.25, -10 + (i%3)*8); addLevelProp(cr);
    }
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,3.5,6), new THREE.MeshLambertMaterial({color:0x888}));
    flagPole.position.set(-7,1.8,9); addLevelProp(flagPole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6,1), new THREE.MeshLambertMaterial({color:0xffffff, side:THREE.DoubleSide}));
    flag.position.set(-5.8,3.5,9); flag.rotation.y = -1.2; addLevelProp(flag);

    // Soft moon light
    const moonL = new THREE.PointLight(0xeeeeff, 1.1, 60);
    moonL.position.set(2,28,-5); scene.add(moonL); levelObjects.push(moonL);

  } else if (level === 5) {
    // OPEN STARFIELD - zero g, lots of stars/debris/ nebulae
    addStarfieldEnhanced(); // special particles

    // Floating asteroids / debris for secrets and visual
    for(let i=0;i<9;i++) {
      const ast = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 + Math.random()*1.2), new THREE.MeshLambertMaterial({color:0x555566}));
      ast.position.set(-18 + i*4.5 , 4 + Math.random()*18, -18 + (i%5)*7); 
      addLevelProp(ast);
    }
    // Glowing courage nebula cloud visual
    const nebula = new THREE.Mesh(new THREE.SphereGeometry(8,12,8), new THREE.MeshBasicMaterial({color:0x4a3a8f, transparent:true, opacity:0.12}));
    nebula.position.set(2,12, -3); addLevelProp(nebula);

  } else if (level === 6) {
    // RED MARS - dunes, rocks, canyons
    for(let i=0;i<7;i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.8 + Math.random()), new THREE.MeshLambertMaterial({color:0x992222}));
      rock.position.set(-13 + i*5 , 1.1 , -12 + Math.sin(i)*6); addLevelProp(rock);
    }
    // Big dune platform
    const dune = new THREE.Mesh(new THREE.SphereGeometry(9,10,6), new THREE.MeshLambertMaterial({color:0xb23322}));
    dune.position.set(4, -2, 5); dune.scale.set(1,0.4,1.4); addLevelProp(dune);

    const marsLight = new THREE.PointLight(0xff7744, 0.8, 40);
    marsLight.position.set(-5,18,0); scene.add(marsLight); levelObjects.push(marsLight);

  } else if (level === 7) {
    // VOLCANIC IO - geysers, lava flows, slippery rocks, mysterious
    for(let i=0;i<5;i++) {
      const volc = new THREE.Mesh(new THREE.ConeGeometry(2.4, 4.5, 7), new THREE.MeshLambertMaterial({color:0x661100}));
      volc.position.set(-10 + i*5.5, 2.2, -12 + (i%2)*3); addLevelProp(volc);
    }
    // Lava glow areas (use emissive plane)
    const lava = new THREE.Mesh(new THREE.PlaneGeometry(12,3), new THREE.MeshLambertMaterial({color:0xff5500, emissive:0x441100}));
    lava.rotation.x = -Math.PI/2; lava.position.set(3,0.08, -2); addLevelProp(lava);

    const lavaLight = new THREE.PointLight(0xff6600, 1.3, 25);
    lavaLight.position.set(3,3,-2); scene.add(lavaLight); levelObjects.push(lavaLight);

    // Geyser hint (animated in update)
    const geyser = new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.8,1.5,6), new THREE.MeshLambertMaterial({color:0xffaa33}));
    geyser.position.set(-6,1.5,8); addLevelProp(geyser);
  }

  // Common courage landmark for all + particles
  if (level !== 0 && level !== 5) {
    const courageOrb = new THREE.Mesh(new THREE.SphereGeometry(0.85,14,10), new THREE.MeshBasicMaterial({color:0xfde047}));
    courageOrb.position.set(0, 11 + (level>4?4:0), -7);
    addLevelProp(courageOrb);
    const oL = new THREE.PointLight(0xffdd44, 1.2, 22); oL.position.copy(courageOrb.position); scene.add(oL); levelObjects.push(oL);
  }

  // Add some floating particles for juice on all levels
  addLevelAmbientParticles(level);
}

// Simple 2D text as sprite
function createTextSprite(text, color = '#fde047', scale = 1) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, 256, 64);
  ctx.font = 'bold 32px "Press Start 2P", monospace';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(1.6 * scale, 0.42 * scale, 1);
  return spr;
}

// GLTF / real 3D model support
// This addresses using actual 3D models (as originally requested) instead of only procedural shapes.
// Place .glb/.gltf files in public/models/ and load them like this.
const gltfLoader = new GLTFLoader();

function loadModel(path) {
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      path,
      (gltf) => resolve(gltf.scene),
      undefined,
      (err) => {
        console.warn('Could not load model', path, err);
        reject(err);
      }
    );
  });
}

// Example usage (uncomment + add a model file to try):
// async function replaceCaptainWithModel() {
//   try {
//     const model = await loadModel('/models/captain-nova.glb');
//     // scale, position, etc.
//     playerGroup.add(model);
//   } catch(e) { /* fallback to procedural */ }
// }

// ============== PLAYER (Captain Nova) ==============
function createPlayer() {
  const preset = CHARACTERS[selectedCharacter] || CHARACTERS[0];
  playerGroup = createHeroGroup(preset);
  scene.add(playerGroup);
}

// ============== COINS ==============
function createCoinMesh() {
  const group = new THREE.Group();
  
  // Courage Star (glowing orb/star from Joshway's light)
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.08, 5),
    new THREE.MeshLambertMaterial({ color: 0xfde047, emissive: 0xf59e0b, emissiveIntensity: 0.5 })
  );
  coin.rotation.x = Math.PI / 2;
  group.add(coin);
  
  // Star emblem
  const star = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 0.15, 5),
    new THREE.MeshLambertMaterial({ color: 0x854d0e })
  );
  star.rotation.x = Math.PI / 2;
  group.add(star);
  
  // Extra rim
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.07, 22),
    new THREE.MeshLambertMaterial({ color: 0xb45309 })
  );
  rim.rotation.x = Math.PI / 2;
  group.add(rim);
  
  // Small point light for sparkle
  const light = new THREE.PointLight(0xfde047, 0.7, 5);
  group.add(light);
  
  group.userData = { coin, angle: Math.random() * Math.PI * 2, baseY: 0, bobSpeed: 1.6 + Math.random() * 0.7 };
  return group;
}

function createPowerupMesh(type = 'energy') {
  const group = new THREE.Group();
  let col = 0x4ade80;
  let ringCol = 0x86efac;
  if (type === 'magnet') { col = 0xa78bfa; ringCol = 0xc4b5fd; }
  else if (type === 'surge') { col = 0xfacc15; ringCol = 0xfef08c; }

  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 13, 11),
    new THREE.MeshLambertMaterial({ color: col, emissive: 0x166534, emissiveIntensity: 0.45 })
  );
  group.add(orb);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.05, 6, 12),
    new THREE.MeshLambertMaterial({ color: ringCol })
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  group.userData = { baseY: 0, angle: Math.random()*Math.PI*2, type };
  if (type !== 'energy') {
    // extra ring for distinction
    const ring2 = ring.clone(); ring2.scale.set(1.35,1.35,1.35); group.add(ring2);
  }
  return group;
}

// Old spawnCoins fully replaced by spawnLevelCoins + per-level powerups. Removed.

function updateCoins(dt) {
  const isSpace = currentLevel === 5;
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    const ud = c.userData;
    
    ud.angle += dt * 2.8;
    c.rotation.y = ud.angle;
    
    // Bob
    c.position.y = ud.baseY + Math.sin(ud.angle * ud.bobSpeed) * 0.22;
    
    if (isSpace) {
      // Drifting in open space for challenge
      c.position.x += Math.sin(ud.angle * 0.5) * 0.5 * dt;
      c.position.z += Math.cos(ud.angle * 0.3) * 0.4 * dt;
    }
    
    // Collect check
    const dist = c.position.distanceTo(player.position);
    if (dist < 1.25) {
      collectCoin(i, c);
    }
  }
}

function collectCoin(index, coinObj) {
  coins.splice(index, 1);
  scene.remove(coinObj);
  
  coinsCollected++;
  sfxCoin();
  const isSecret = coinObj.userData && coinObj.userData.isSecret;
  if (isSecret) {
    bonusCoinsCollected = (bonusCoinsCollected || 0) + 1;
    score += 280;
  } else {
    score += 100;
  }
  
  // Update HUD
  updateHUD();
  
  // Collect particle burst
  createCoinBurst(coinObj.position.clone());
  
  // Floating +score popup
  spawnCollectText(coinObj.position, isSecret ? 'SECRET STAR!' : '★');
  
  if (coinsCollected >= COIN_COUNT) {
    spawnRisePortal();
  }
}

function updatePowerups(dt) {
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    const ud = p.userData;
    ud.angle = (ud.angle || 0) + dt * 3;
    p.rotation.y = ud.angle * 0.5;
    p.position.y = ud.baseY + Math.sin(ud.angle) * 0.16;
    const dist = p.position.distanceTo(player.position);
    if (dist < 1.0) {
      const typ = ud.type || 'energy';
      if (typ === 'magnet') {
        activePowerupEffects.magnet = performance.now() + 9500;
        spawnCollectText(p.position, 'MAGNET!');
        playTone(480,0.2,'sine',0.3);
      } else if (typ === 'surge') {
        player.energy = 1.0;
        activePowerupEffects.surge = performance.now() + 6500;
        score += 80;
        spawnCollectText(p.position, 'COURAGE SURGE!');
        playTone(880,0.18,'sine',0.35);
      } else {
        player.energy = Math.min(1, player.energy + 0.52);
        playTone(620, 0.1, 'sine', 0.25, 80);
      }
      createCoinBurst(p.position.clone());
      scene.remove(p);
      powerups.splice(i, 1);
    }
  }

  // Apply ongoing powerup fun effects
  if (activePowerupEffects.magnet && performance.now() < activePowerupEffects.magnet) {
    // Pull nearby coins toward player (fun auto-collect)
    coins.forEach(c => {
      const d = c.position.distanceTo(player.position);
      if (d < 9 && d > 1.2) {
        const dir = player.position.clone().sub(c.position).normalize();
        c.position.addScaledVector(dir, 14 * dt);
      }
    });
  }
  if (activePowerupEffects.surge && performance.now() < activePowerupEffects.surge) {
    // Small extra lift during surge
    if (player.jetActive) player.velocity.y += 4 * dt;
  }
}

function updateHazard(dt) {
  if (!hazard || gameState !== 'playing') return;
  const t = Date.now() / 1400;
  const cx = 1.5;
  const cz = 1;
  const radius = 4.5;
  hazard.position.x = cx + Math.cos(t) * radius;
  hazard.position.z = cz + Math.sin(t * 1.1) * (radius * 0.7);
  hazard.rotation.y = t * 2.5;

  // Bump player if too close (simple hazard for challenge)
  const dx = player.position.x - hazard.position.x;
  const dz = player.position.z - hazard.position.z;
  const dist = Math.sqrt(dx*dx + dz*dz);
  if (dist > 0.1 && dist < 1.4) {
    const push = (1.4 - dist) * 0.8;
    player.position.x += (dx / dist) * push;
    player.position.z += (dz / dist) * push;
    player.velocity.x += (dx / dist) * 3;
    player.velocity.z += (dz / dist) * 3;
    if (player.onGround) player.velocity.y = Math.max(player.velocity.y, 1.5);
  }
}

function switchLevel(newLevel) {
  if (newLevel >= LEVELS.length) {
    // Win the whole game
    endGame();
    return;
  }
  currentLevel = newLevel;
  const lvl = LEVELS[currentLevel];
  currentGravity = lvl.gravity;

  // PROPER CLEAR to fix accumulation bugs (old furniture/colliders in wrong levels)
  clearLevel();
  bonusCoinsCollected = 0;

  // Reposition player
  const startY = (currentLevel === 5) ? 8 : 2.5; // higher start in open space
  player.position.set(0, startY, 15);
  player.velocity.set(0, 0, 0);
  player.onGround = false;

  // Change sky/fog tint for the realm
  scene.fog = new THREE.Fog(lvl.sky, 35, 90);

  // Build FULL themed world for level (walls/floor/props/lighting) -- replaces old shared buildWorld
  buildLevelWorld(currentLevel);

  // Spawn coins and powerups for this level
  spawnLevelCoins(currentLevel);
  spawnLevelPowerups(currentLevel);

  // Spawn funny NPCs for this level
  spawnNPCs(currentLevel);

  // Start unique music for the level
  stopBackgroundMusic();
  startLevelMusic(currentLevel);

  // Level intro from Joshway theme
  setTimeout(() => {
    if (gameState === 'playing') {
      const intros = [
        "Welcome to the Cozy Living Room! Collect stars to rise!",
        "Backyard time! Watch for the wind and pals.",
        "The Playground Realm - courage starts here!",
        "City Lights - navigate the hustle!",
        "The Moon... low gravity, high dreams!",
        "Open Starfield - no gravity, pure momentum! Collect in the void to reach Mars.",
        "Red Mars - stay steady, rise strong!",
        "Volcanic Io - the final rise awaits!"
      ];
      spawnCollectText({x:0,y:10,z:0}, intros[currentLevel] || "Rise!");
    }
  }, 500);

  // Update HUD
  updateHUD();
  document.getElementById('coin-total').textContent = `/ ${COIN_COUNT}`;
  const lvlNameEl = document.getElementById('level-name');
  if (lvlNameEl) lvlNameEl.textContent = (LEVELS[currentLevel] ? LEVELS[currentLevel].name.toUpperCase() : '');

  coinsCollected = 0;
  bonusCoinsCollected = 0;
  levelStartTime = performance.now();
  score = 0;
  updateHUD();

  // Special for dream/space levels
  if (lvl.music === 'dreamy' || lvl.music === 'mysterious') {
    // Dream state particles or slight fog change
    scene.fog = new THREE.Fog(lvl.sky, 25, 70);
  }

  // Dreamy rise chime when advancing (unique transition music feel)
  if (newLevel > 0) {
    playTone(523, 0.4, 'sine', 0.4, 200);
    setTimeout(() => playTone(659, 0.6, 'sine', 0.35, 150), 300);
    setTimeout(() => playTone(784, 1.0, 'sine', 0.3, 100), 600);
  }
}

// Old buildLevelProps fully superseded by buildLevelWorld + helpers above. Removed for clean per-level.

function addStarfieldEnhanced() {
  // Dense beautiful starfield for zero-g level
  const starsGeometry = new THREE.BufferGeometry();
  const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.65, transparent: true, opacity: 0.95 });
  const starsVertices = [];
  for (let i = 0; i < 14000; i++) {
    const x = (Math.random() - 0.5) * 210;
    const y = (Math.random() - 0.5) * 210;
    const z = (Math.random() - 0.5) * 210;
    starsVertices.push(x, y, z);
  }
  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
  const starField = new THREE.Points(starsGeometry, starsMaterial);
  starField.userData.isStarfield = true;
  scene.add(starField);
  levelObjects.push(starField);
}

function addLevelAmbientParticles(level) {
  // Kid-friendly sparkles / floating elements per theme
  const pCount = (level === 5) ? 42 : (level === 4 || level === 7) ? 28 : 16;
  for (let i=0; i < pCount; i++) {
    let col = (level === 7) ? 0xffaa33 : (level === 5 ? 0xaabbff : 0xfde047);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.06,5,4), new THREE.MeshBasicMaterial({color: col, transparent:true, opacity:0.7}));
    const spread = (level === 5) ? 45 : 22;
    p.position.set(Math.random()*spread - spread/2, 2 + Math.random()* (level===5?26:14), Math.random()*spread - spread/2);
    p.userData = { life: 99, vel: new THREE.Vector3((Math.random()-0.5)*0.6, 0.3+Math.random()*0.6, (Math.random()-0.5)*0.6), type: 'ambient' };
    if (level === 1) p.userData.vel.y = 0.1; // leaves gentle
    scene.add(p);
    coinParticles.push(p); // reuse system
    levelObjects.push(p); // mark for cleanup
  }
}

function spawnLevelCoins(level) {
  // Rich unique positions per level + 2-4 SECRET hidden/bonus coins for full polish
  // Each secret gives +250 and special popup. Hidden areas encourage exploration.
  let positions = [];
  let secretIndices = []; // which in list are secrets

  if (level === 0) { // Living Room cozy secrets: behind dresser, high shelf, under bed nook
    positions = [
      [-8,2.1,6],[7,2.3,8],[-3,5.5,-3.5],[10.5,4.2,1.8],[1.8,8.5,7.2],[-6.2,3.3,10.2],[4.5,6.5,-6.5],
      // Secrets
      [-10.5,1.6,-5.5], [2.5,7.8,-12.2], [-4,3.8,11.5]
    ];
    secretIndices = [7,8,9];
  } else if (level === 1) { // Backyard secrets behind trees + high fence
    positions = [
      [-11,3.2,-4],[9,4.5,10],[-1,9,-9],[12,6, -3],[3,2.5,14],[-7,7,1],[8,1.5,-13],
      [-13.5,6.8,-8],[1,14,-16],[11,2.8, -15.5]
    ];
    secretIndices = [7,8,9];
  } else if (level === 2) { // Playground high monkey bars + slide top secrets
    positions = [
      [-10,6,3],[7,3.5,-7],[0,12,-1],[-5,9,-9],[8,8,11],[3,4.5,2],[-1,2.5,13],
      [5,11, -9],[ -9.5,8.5,6 ], [10,5.2, -5]
    ];
    secretIndices = [7,8,9];
  } else if (level === 3) { // City high rooftops
    positions = [
      [-13,9,-13],[9,4,-10],[1,13,5],[-7,6,11],[13,8,-1],[-2,3, -14],[6,10,14],
      [11,14,-12],[ -11,5, -3], [0,17, -7]
    ];
    secretIndices = [7,8,9];
  } else if (level === 4) { // Moon high float + crater secrets
    positions = [
      [-11,5.5,8],[11,13,6],[-2,19,-7],[14,8.5,11],[0,15.5,-1],[-12,11,-6],[9,18,9],
      [-15,7,14],[6,23,-13],[12,4, -15]
    ];
    secretIndices = [7,8,9];
  } else if (level === 5) { // Starfield 3D hidden between debris + far
    positions = [
      [-16,8.5,14],[9,5.5,-11],[0.5,17.5,7],[-8.5,12.5,-4.5],[11,9.5,1],[4.5,21,-9],[-5,6.5,11],[14.5,14.5,6],
      [-18,15,-18],[18,19, -6],[ -1,28,0],[7,-2,18] // more zero-g secrets
    ];
    secretIndices = [8,9,10,11];
  } else if (level === 6) { // Mars dune + canyon secrets
    positions = [
      [-14,5,14],[9,9,-9],[-1,21,4],[-6,10.5,17],[13,15,-2],[-8,6.5,-11],[5,11.5,13],
      [15,3,-14],[ -12,17,9 ],[2,4, -16]
    ];
    secretIndices = [7,8,9];
  } else { // Io volcanic high peaks + geyser hidden
    positions = [
      [-14,5,14],[9,9,-9],[1,21,4],[-5,11,17],[13,15,-2],[-8,7,-11],[5,12,13],
      [-2,25, -3],[16,8,11],[-10,4, -15]
    ];
    secretIndices = [7,8,9];
  }

  const spread = (level >= 4) ? 1.0 : 1.0;
  for (let i = 0; i < COIN_COUNT; i++) {
    const p = positions[i] || [Math.random()*24-12, 2 + Math.random()*12, Math.random()*24-12];
    const c = createCoinMesh();
    c.position.set(p[0] * spread, p[1], p[2] * spread);
    c.userData.baseY = c.position.y;
    const isSec = secretIndices.includes(i);
    c.userData.isSecret = isSec;
    if (isSec) {
      // make secret coins slightly different visually (bigger glow)
      c.scale.set(1.15,1.15,1.15);
      if (c.children[0]) c.children[0].material.emissive = new THREE.Color(0xfacc15);
    }
    scene.add(c);
    coins.push(c);
  }

  // Extra visual secret indicators (sparkle on secret coins occasionally via existing bob)
}

function spawnLevelPowerups(level) {
  // More powerups + variety: energy, magnet (pulls coins), surge (courage boost)
  let puPos = [];
  if (level === 0) puPos = [[-7.5,1.35,-1.5],[8.5,1.4,4],[1,5.9,-5.5],[5.5,3.7,7.5]];
  else if (level === 5) puPos = [[-12,10,-11],[11,15,4],[-3,22,13],[13,8,-14]];
  else puPos = [[-5,4.5,6],[11,5.5,-2],[0,11,7.5],[9,3.5,11]];

  puPos.forEach(([x,y,z], idx) => {
    const types = ['energy','energy','magnet','surge'];
    const typ = types[idx % types.length];
    const p = createPowerupMesh(typ);
    p.position.set(x, y, z);
    p.userData.baseY = y;
    scene.add(p);
    powerups.push(p);
  });
}

function spawnNPCs(level) {
  const count = (level < 4) ? 5 : (level===5 ? 3 : 4);
  for (let i = 0; i < count; i++) {
    let npc, color;
    if (level >= 6) {
      color = 0xffaacc;
      npc = new THREE.Mesh(new THREE.SphereGeometry(0.5 + Math.random()*0.15), new THREE.MeshLambertMaterial({color}));
      npc.userData = { speed: 1.6 + Math.random(), phase: Math.random() * Math.PI*2, type: 'ioalien', bounce: Math.random() };
    } else if (level >= 5) {
      color = 0xaabbff;
      npc = new THREE.Mesh(new THREE.SphereGeometry(0.48 + Math.random()*0.1), new THREE.MeshLambertMaterial({color}));
      npc.userData = { speed: 2.1 + Math.random(), phase: Math.random() * Math.PI*2, type: 'starfloat', bounce: Math.random() };
    } else if (level >= 3) {
      color = i%2 ? 0xffa500 : 0x4169e1;
      npc = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.7), new THREE.MeshLambertMaterial({color}));
      npc.userData = { speed: 1.8, phase: Math.random() * Math.PI*2, type: 'citykid' };
    } else {
      color = i%2 ? 0xf472b6 : 0x10b981;
      npc = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.8), new THREE.MeshLambertMaterial({color}));
      npc.userData = { speed: 1.2 + Math.random(), phase: Math.random() * Math.PI*2, type: 'pal' };
    }
    npc.position.set(-11 + i*4.2 + Math.random()*2.5, 1.55, 2.5 + Math.random()*11);
    scene.add(npc);
    npcs.push(npc);
  }
}

function updateNPCs(dt) {
  for (let npc of npcs) {
    if (!npc.userData) continue;
    const ud = npc.userData;
    ud.phase = (ud.phase || 0) + dt * 2;
    // Wander
    npc.position.x += Math.sin(ud.phase) * (ud.speed || 1.5) * dt * 0.8;
    npc.position.z += Math.cos(ud.phase * 1.3) * (ud.speed || 1.5) * dt * 0.6;

    if (ud.type === 'starfloat' || ud.type === 'ioalien') {
      npc.position.y = 1.8 + Math.sin(ud.phase * 2.1) * (ud.type==='starfloat'?1.6:0.6); 
      npc.rotation.y = ud.phase * 1.5;
    } else if (ud.type === 'alien') {
      npc.position.y = 1.5 + Math.sin(ud.phase * 2) * 0.3;
    }

    // Funny interference (playful, not harmful)
    const dist = npc.position.distanceTo(player.position);
    if (dist < 2.1) {
      const pushX = (player.position.x - npc.position.x) / dist * 1.5;
      const pushZ = (player.position.z - npc.position.z) / dist * 1.5;
      const pushFactor = (ud.type === 'starfloat' || ud.type === 'ioalien') ? 0.35 : (ud.type === 'alien' ? 0.55 : 1);
      player.velocity.x += pushX * pushFactor;
      player.velocity.z += pushZ * pushFactor;
      if (Math.random() < 0.028) {
        const msgs = (ud.type==='starfloat') ? ["Wheeee!", "Space hug!", "Zoom!"] : (ud.type==='ioalien'?["Gloop!", "Hot!", "Friend?"] : ["Hehe!", "Oops!", "Tag!", "Whee!"]);
        spawnCollectText(npc.position, msgs[Math.floor(Math.random()*msgs.length)]);
      }
      if (Math.random() < 0.004 && coins.length > 0) {
        const nearCoin = coins.find(c => c.position.distanceTo(npc.position) < 3.5);
        if (nearCoin) {
          nearCoin.position.add(new THREE.Vector3((Math.random()-0.5)*1.5,0.8,(Math.random()-0.5)*1.5));
          spawnCollectText(npc.position, "Bop!");
        }
      }
    }
    // bounds
    npc.position.x = Math.max(-ROOM.w/2 +2, Math.min(ROOM.w/2 -2, npc.position.x));
    npc.position.z = Math.max(-ROOM.d/2 +2, Math.min(ROOM.d/2 -2, npc.position.z));
    if (npc.position.y < 0.4) npc.position.y = 0.4;
  }
}

let risePortal = null;

function spawnRisePortal() {
  if (risePortal) scene.remove(risePortal);
  const lvl = LEVELS[currentLevel];
  risePortal = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.7 })
  );
  // Place high up in the center - high ceiling allows epic rise
  risePortal.position.set(0, 18, -5);
  scene.add(risePortal);
  const portalLight = new THREE.PointLight(0xffd700, 2, 20);
  portalLight.position.copy(risePortal.position);
  scene.add(portalLight);
  risePortal.userData = { light: portalLight };
  
  spawnCollectText(risePortal.position, 'RISE TO ' + (LEVELS[currentLevel+1] ? LEVELS[currentLevel+1].name : 'VICTORY') + '!');
}

function checkRisePortal() {
  if (!risePortal || gameState !== 'playing') return;
  if (player.position.distanceTo(risePortal.position) < 2.5 && player.position.y > 12) {
    // Player has risen into the portal!
    const next = currentLevel + 1;
    scene.remove(risePortal);
    if (risePortal.userData.light) scene.remove(risePortal.userData.light);
    risePortal = null;
    switchLevel(next);
  }
}

function spawnCollectText(pos, txt) {
  const el = document.createElement('div');
  el.className = 'collect-popup retro-text';
  el.textContent = txt;
  el.style.left = '50%';
  el.style.top = '38%';
  document.body.appendChild(el);
  
  // Convert world pos roughly to screen for fun (simple approx)
  const screenX = 50 + (pos.x * 2.8);
  const screenY = 44 - (pos.y * 1.8);
  el.style.left = `${clamp(screenX, 28, 72)}%`;
  el.style.top = `${clamp(screenY, 22, 58)}%`;
  
  setTimeout(() => el.remove(), 820);
}

function createCoinBurst(pos) {
  const count = 11;
  for (let i = 0; i < count; i++) {
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 5, 4),
      new THREE.MeshBasicMaterial({ color: 0xfde047 })
    );
    p.position.copy(pos);
    p.userData = {
      life: 0.6 + Math.random() * 0.4,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 7 + 2,
        (Math.random() - 0.5) * 6
      )
    };
    scene.add(p);
    coinParticles.push(p);
  }
}

// ============== JETPACK PARTICLES ==============
function createJetParticle(pos, dir) {
  const p = new THREE.Mesh(
    new THREE.SphereGeometry(0.07 + Math.random() * 0.06, 6, 5),
    new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xc084fc : 0xf0abfc, transparent: true, opacity: 0.95 })
  );
  p.position.copy(pos);
  p.userData = {
    life: 0.32 + Math.random() * 0.2,
    vel: new THREE.Vector3(
      dir.x * (1.5 + Math.random()) + (Math.random() - 0.5) * 1.8,
      dir.y * (1.5 + Math.random()) - 2.5,
      dir.z * (1.5 + Math.random()) + (Math.random() - 0.5) * 1.8
    )
  };
  scene.add(p);
  jetParticles.push(p);
}

function updateParticles(dt) {
  // Jet particles
  for (let i = jetParticles.length - 1; i >= 0; i--) {
    const p = jetParticles[i];
    const ud = p.userData;
    ud.life -= dt;
    
    p.position.addScaledVector(ud.vel, dt);
    ud.vel.y -= 14 * dt; // gravity on smoke
    ud.vel.multiplyScalar(0.97);
    
    const a = Math.max(0.05, ud.life / 0.55);
    p.material.opacity = a;
    p.scale.setScalar(0.6 + (0.55 - ud.life) * 1.8);
    
    if (ud.life <= 0) {
      scene.remove(p);
      jetParticles.splice(i, 1);
    }
  }
  
  // Coin collect particles + ambient level sparkles (keep alive for polish)
  for (let i = coinParticles.length - 1; i >= 0; i--) {
    const p = coinParticles[i];
    const ud = p.userData || {};
    if (ud.type === 'ambient') {
      // drift forever (level cleanup removes)
      p.position.addScaledVector(ud.vel, dt * 0.7);
      ud.vel.x *= 0.996; ud.vel.z *= 0.996;
      // gentle bob
      p.position.y += Math.sin(Date.now()/420 + i) * 0.004;
      p.scale.setScalar(0.7 + Math.sin(Date.now()/300 + i)*0.3);
      continue;
    }
    ud.life = (ud.life || 0.6) - dt;
    
    p.position.addScaledVector(ud.vel, dt);
    ud.vel.y -= 16 * dt;
    ud.vel.multiplyScalar(0.94);
    p.scale.setScalar(Math.max(0.2, ud.life / 0.7));
    
    if (ud.life <= 0) {
      scene.remove(p);
      coinParticles.splice(i, 1);
    }
  }
}

// ============== PLAYER UPDATE + PHYSICS ==============
const moveSpeed = 7.5;
const airControl = 0.6;
const jumpVel = 9.2;
const doubleJumpVel = 7.4;
const jetThrust = 30.0; // strong enough to overcome gravity for sustained ascent while holding space + energy remains
const gravity = -26.0;
const maxFall = -26;

function updatePlayer(dt) {
  if (gameState !== 'playing') return;
  
  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotationY);
  const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotationY);
  
  // Movement input - W/S forward/back as-is (correct per user). Only swap A/D for correct strafe.
  let mx = 0, mz = 0;
  if (keys['KeyW'] || keys['ArrowUp']) mz -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) mz += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) mx += 1;
  if (keys['KeyD'] || keys['ArrowRight']) mx -= 1;
  
  const moving = (mx !== 0 || mz !== 0);
  const controlFactor = player.onGround ? 1 : airControl;
  
  if (moving) {
    const dir = new THREE.Vector3();
    if (mz !== 0) dir.addScaledVector(forward, mz);
    if (mx !== 0) dir.addScaledVector(right, mx);
    dir.normalize();
    
    const speed = moveSpeed * controlFactor;
    player.velocity.x = lerp(player.velocity.x, dir.x * speed, player.onGround ? 0.22 : 0.09);
    player.velocity.z = lerp(player.velocity.z, dir.z * speed, player.onGround ? 0.22 : 0.09);
  } else {
    // friction
    const fric = player.onGround ? 0.74 : 0.94;
    player.velocity.x *= fric;
    player.velocity.z *= fric;
  }
  
  // Gravity (changes per world)
  player.velocity.y += currentGravity * dt;
  if (player.velocity.y < maxFall) player.velocity.y = maxFall;
  
  // JUMP / JETPACK
  const space = keys['Space'];
  let didJump = false;
  
  if (space && player.onGround) {
    player.velocity.y = jumpVel;
    player.onGround = false;
    player.canDoubleJump = true;
    didJump = true;
    sfxJump(false);
  } else if (space && !player.onGround && player.canDoubleJump) {
    // Double jump + initial jet
    player.velocity.y = Math.max(player.velocity.y * 0.2 + doubleJumpVel, doubleJumpVel);
    player.canDoubleJump = false;
    player.jetActive = true;
    didJump = true;
    sfxJump(true);
  }
  
  // Sustained flight: hold SPACE to thrust upward continuously with jetpack
  // as long as energy/fuel remains. You will keep ascending/climbing high until energy depletes.
  // Thrust tuned strong to beat gravity.
  const wantJet = keys['Space'] && player.energy > 0.01;
  const isJetting = wantJet && !player.onGround;
  player.jetActive = isJetting;
  
  if (wantJet && player.energy > 0) {
    // Special open space dynamics: no gravity, omnidirectional thrust, momentum based
    const isSpace = currentLevel === 5;
    const thrustMult = isSpace ? 1.65 : 1;
    if (isSpace) {
      // Full 3D thrust in look direction + up + slight strafe
      const thrustDir = forward.clone().normalize();
      player.velocity.addScaledVector(thrustDir, jetThrust * dt * thrustMult * 0.9);
      player.velocity.y += jetThrust * dt * 0.65; 
      // momentum feel: slight friction for drift fun
      player.velocity.multiplyScalar(0.995);
    } else {
      // Apply strong upward thrust (overcomes gravity so you go high while fuel lasts)
      player.velocity.y += jetThrust * dt;
    }
    
    // Allow liftoff if on ground
    if (player.onGround) {
      player.onGround = false;
      player.canDoubleJump = false;
      player.velocity.y = Math.max(player.velocity.y, 5);
    }
    
    // Light forward assist for control while flying
    const fwdAssist = forward.clone().multiplyScalar(3.0 * dt);
    player.velocity.x += fwdAssist.x;
    player.velocity.z += fwdAssist.z;
    
    // drain energy while thrusting
    player.energy = Math.max(0, player.energy - dt * 0.75);
    score += 2; // style for sustained rise
    
    // particles when actually off ground
    if (!player.onGround && Math.random() < 0.85) {
      const jetPos = player.position.clone();
      jetPos.y -= 0.15;
      jetPos.x += (Math.random() - 0.5) * 0.35;
      jetPos.z += (Math.random() - 0.5) * 0.35;
      createJetParticle(jetPos, new THREE.Vector3(0, -1, 0));
    }
    if (!player.onGround) sfxBoost();
  } else if (player.onGround) {
    // recharge on ground
    player.energy = Math.min(1, player.energy + dt * 1.6);
  }
  
  // Apply velocity
  player.position.x += player.velocity.x * dt;
  player.position.y += player.velocity.y * dt;
  player.position.z += player.velocity.z * dt;

  // Level specific challenges
  const lvl = LEVELS[currentLevel];
  if (lvl && lvl.name.includes('Moon')) {
    // Low grav float boost
    if (player.jetActive) player.velocity.y *= 1.02;
  } else if (lvl && lvl.name.includes('Mars')) {
    // Sand drag
    player.velocity.x *= 0.98;
    player.velocity.z *= 0.98;
  } else if (lvl && lvl.name.includes('Io')) {
    // Slippery
    if (!player.onGround) {
      player.velocity.x *= 1.01;
      player.velocity.z *= 1.01;
    }
  }
  
  // Floor clamp + ground detection (disabled for zero-grav space levels)
  const isSpaceLevel = currentLevel === 5; // Open Starfield
  if (!isSpaceLevel && player.position.y < 0.9) {
    player.position.y = 0.9;
    if (player.velocity.y < 0) player.velocity.y = 0;
    player.onGround = true;
    player.canDoubleJump = true;
  }
  if (isSpaceLevel) {
    player.onGround = false; // always "flying" in space
  }

  // Sound effects for landing / jet transitions
  if (player.onGround && !prevOnGround && Math.abs(player.velocity.y) > 1.5) {
    sfxLand();
  }
  if (player.jetActive && !jetActiveLast) {
    sfxJetStart();
  }
  jetActiveLast = player.jetActive;
  prevOnGround = player.onGround;
  
  // Room bounds soft clamp (with collider help) - larger for space
  const halfW = ROOM.w / 2 - 0.6;
  const halfD = ROOM.d / 2 - 0.6;
  const boundMult = isSpaceLevel ? 1.5 : 1;
  player.position.x = clamp(player.position.x, -halfW * boundMult, halfW * boundMult);
  player.position.z = clamp(player.position.z, -halfD * boundMult, halfD * boundMult);
  if (player.position.y > ROOM.h - 0.8) {
    player.position.y = ROOM.h - 0.8;
    player.velocity.y = Math.min(player.velocity.y, 0);
  }
  
  // Collisions with furniture
  resolvePlayerCollision();
  
  // Update visual model
  if (playerGroup) {
    playerGroup.position.copy(player.position);
    playerGroup.rotation.y = player.rotationY;
    
    // Simple walk bob / animation
    const ud = playerGroup.userData;
    const walkCycle = moving && player.onGround ? Math.sin(Date.now() / 160) * 0.6 : 0;
    
    if (ud.leftLeg) ud.leftLeg.rotation.x = walkCycle * 0.9;
    if (ud.rightLeg) ud.rightLeg.rotation.x = -walkCycle * 0.9;
    
    if (ud.leftArm) ud.leftArm.rotation.x = walkCycle * 0.4 + (player.jetActive ? -1.0 : 0);
    if (ud.rightArm) ud.rightArm.rotation.x = -walkCycle * 0.4 + (player.jetActive ? -1.0 : 0);
    
    // Cape flowing dramatically when RISING (jetActive)
    if (ud.cape && ud.cape2) {
      const flow = player.jetActive ? (Math.sin(Date.now() / 120) * 0.25 + 0.15) : 0.05;
      ud.cape.rotation.x = 0.3 + flow;
      ud.cape2.rotation.x = 0.5 + flow * 0.8;
      ud.cape.position.z = -0.35 - (player.jetActive ? 0.1 : 0);
    }
  }
}

// ============== CAMERA ==============
let cameraYaw = 0;
let cameraPitch = 0.35;

function updateCamera() {
  if (gameState !== 'playing') return;
  
  // Smooth follow behind player
  const idealYaw = player.rotationY + Math.PI; // behind
  cameraYaw = lerp(cameraYaw, idealYaw, 0.065);
  
  // Mouse look offset
  const yawOffset = mouseX * 0.9;
  const pitchOffset = mouseY * 0.65;
  
  const finalYaw = cameraYaw + yawOffset;
  const finalPitch = clamp(0.15 + pitchOffset, -0.3, 1.25);
  
  const camDist = 12; // much larger space
  const camHeight = 5;
  
  const camX = player.position.x + Math.sin(finalYaw) * camDist;
  const camZ = player.position.z + Math.cos(finalYaw) * camDist;
  const camY = player.position.y + camHeight + Math.sin(finalPitch) * 1.5;
  
  camera.position.x = lerp(camera.position.x, camX, 0.12);
  camera.position.y = lerp(camera.position.y, camY, 0.11);
  camera.position.z = lerp(camera.position.z, camZ, 0.12);
  
  const lookTarget = player.position.clone();
  lookTarget.y += 1.25;
  camera.lookAt(lookTarget);
}

// ============== INPUT ==============
function setupInput() {
  document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    if (e.code === 'Escape') {
      if (isPointerLocked) {
        document.exitPointerLock();
      } else if (gameState === 'playing') {
        togglePause();
      } else if (gameState === 'paused') {
        togglePause();
      }
    }
    
    if ((e.code === 'KeyR' || e.code === 'KeyP') && gameState === 'win') {
      restartGame();
    }
    
    if (e.code === 'KeyE' && gameState === 'playing') {
      // Talk to nearby NPC for funny hint + reward (empowering & fun)
      let nearest = null;
      let minDist = 3.2;
      for (let npc of npcs) {
        const d = npc.position.distanceTo(player.position);
        if (d < minDist) {
          minDist = d;
          nearest = npc;
        }
      }
      if (nearest) {
        const ud = nearest.userData || {};
        const hints = ud.type === 'starfloat' ? ["Zero-g is freedom!", "Drift to the stars!", "Collect in the void!"] :
                      ud.type === 'ioalien' ? ["Lava is warm!", "Rise above!", "Bump me again!"] :
                      ["Keep rising!", "Refuel your courage!", "Secrets are everywhere!", "Your cape is power!", "Friends help you rise!"];
        spawnCollectText(nearest.position, hints[Math.floor(Math.random()*hints.length)]);
        player.energy = Math.min(1, player.energy + 0.18);
        score += 15; // tiny friendship bonus
        updateHUD();
      }
    }
  });
  
  document.addEventListener('keyup', (e) => { keys[e.code] = false; });
  
  // Pointer lock
  canvas.addEventListener('click', () => {
    if (gameState === 'playing' && !isPointerLocked) {
      canvas.requestPointerLock();
    }
  });
  
  document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === canvas;
    const cross = document.getElementById('crosshair');
    cross.style.display = isPointerLocked ? 'block' : 'none';
    
    if (!isPointerLocked && gameState === 'playing') {
      // allow free mouse when unlocked
    }
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isPointerLocked || gameState !== 'playing') return;
    
    const sens = 0.0021;
    player.rotationY -= e.movementX * sens;
    mouseY = clamp(mouseY + e.movementY * sens * 1.15, -0.85, 1.0);
    mouseX = clamp(mouseX + e.movementX * sens * 0.5, -1.2, 1.2);
  });
  
  // Start / replay buttons
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('howto-btn').addEventListener('click', () => {
    const s = document.getElementById('start-screen');
    s.innerHTML = `
      <h1 style="font-size:30px;margin-bottom:12px">HOW TO PLAY</h1>
      <div style="font-size:12px;line-height:1.75;text-align:left;max-width:380px;margin:0 auto;color:#c7d2fe">
        • CLICK to LOCK mouse<br>
        • WASD/ARROWS — Move (A left, D right; W/S forward/back)<br>
        • SPACE (HOLD) — Continuous rise with cape! Different dynamics per world (zero-g in Starfield!)<br>
        • Refuel orbs • MOUSE look • M music • ESC unlock/pause<br>
        <br>
        Collect 12 STAR COINS per world to RISE through portals. 8 worlds incl. Open Starfield!
      </div>
      <button id="back-btn" class="btn" style="margin-top:26px">BACK</button>
    `;
    document.getElementById('back-btn').addEventListener('click', () => location.reload());
  });
  
  document.getElementById('replay-btn').addEventListener('click', restartGame);
  
  // Pause menu buttons
  const resumeBtn = document.getElementById('resume-btn');
  if (resumeBtn) resumeBtn.addEventListener('click', togglePause);
  
  const restartLevelBtn = document.getElementById('restart-level-btn');
  if (restartLevelBtn) restartLevelBtn.addEventListener('click', () => {
    if (gameState === 'paused') togglePause();
    // restart current level
    switchLevel(currentLevel);
    gameState = 'playing';
    const ps = document.getElementById('pause-screen');
    if (ps) ps.style.display = 'none';
    const h = document.getElementById('hud');
    if (h) h.style.display = 'flex';
    const i = document.getElementById('instructions');
    if (i) i.style.display = 'block';
  });
  
  const quitBtn = document.getElementById('quit-btn');
  if (quitBtn) quitBtn.addEventListener('click', () => {
    if (gameState === 'paused') togglePause();
    // quit to menu
    location.reload(); // simple reset
  });

  // Add high scores button to pause for easy access
  const pauseDiv = document.getElementById('pause-screen');
  if (pauseDiv && !document.getElementById('pause-hs-btn')) {
    const hsPause = document.createElement('button');
    hsPause.id = 'pause-hs-btn';
    hsPause.className = 'btn';
    hsPause.style.background = '#334155';
    hsPause.style.fontSize = '11px';
    hsPause.textContent = 'VIEW HIGH SCORES';
    hsPause.onclick = () => { if (gameState==='paused') togglePause(); showHighScoreTable(); };
    pauseDiv.appendChild(document.createElement('br'));
    pauseDiv.appendChild(hsPause);
  }
  
  // Prevent space from scrolling
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && gameState === 'playing') e.preventDefault();
  }, { passive: false });
}

function updateHUD() {
  const coinEl = document.getElementById('coin-count');
  if (coinEl) coinEl.textContent = String(coinsCollected).padStart(2, '0');
  
  const energyEl = document.getElementById('energy-fill');
  if (energyEl) {
    energyEl.style.width = `${Math.floor(player.energy * 100)}%`;
    if (player.energy < 0.25) {
      energyEl.style.background = 'linear-gradient(to right, #f87171, #fb923c)';
    } else {
      energyEl.style.background = 'linear-gradient(to right, #4ade80, #86efac)';
    }
  }
  const lvlNameEl = document.getElementById('level-name');
  if (lvlNameEl && LEVELS[currentLevel]) lvlNameEl.textContent = LEVELS[currentLevel].name.toUpperCase().slice(0,15);

  // Update hero name in HUD
  const heroLabel = document.querySelector('.hud-right .hud-label');
  if (heroLabel) heroLabel.textContent = (CHARACTERS[selectedCharacter] || CHARACTERS[0]).name.toUpperCase();

  const scoreEl = document.getElementById('score');
  if (scoreEl) scoreEl.textContent = String(Math.floor(score)).padStart(4, '0');
}

function setupCharacterSelect() {
  const container = document.getElementById('char-select');
  const descEl = document.getElementById('char-desc');
  if (!container) return;

  container.innerHTML = '';
  container.style.display = 'grid';
  container.style.gridTemplateColumns = 'repeat(4, 1fr)';
  container.style.gap = '8px';
  container.style.justifyItems = 'center';

  CHARACTERS.forEach((char, index) => {
    const card = document.createElement('div');
    card.style.cursor = 'pointer';
    card.style.textAlign = 'center';
    card.style.width = '80px';

    // Small canvas for 3D preview
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 80;
    canvas.style.border = '2px solid #fff';
    canvas.style.borderRadius = '4px';
    canvas.style.background = 'rgba(0,0,0,0.3)';
    card.appendChild(canvas);

    const name = document.createElement('div');
    name.textContent = char.name;
    name.style.fontSize = '9px';
    name.style.marginTop = '2px';
    name.style.color = '#fff';
    name.style.textShadow = '1px 1px 0 #000';
    card.appendChild(name);

    // Render the preview
    renderHeroPreview(index, canvas);

    // Selection
    const select = () => {
      selectedCharacter = index;
      // Update borders
      container.querySelectorAll('canvas').forEach(c => {
        c.style.border = '2px solid #fff';
      });
      canvas.style.border = '2px solid #4ade80';
      if (descEl) descEl.textContent = char.desc;

      // Live update the background spinning hero (only on start screen)
      if (gameState === 'start' && playerGroup) {
        scene.remove(playerGroup);
        const newPreset = CHARACTERS[index];
        playerGroup = createHeroGroup(newPreset);
        scene.add(playerGroup);
        // Keep similar positioning as idle
        playerGroup.position.set(0, 1.8, 18);
        playerGroup.rotation.y = 0;
      }
    };

    card.onclick = select;

    // Default selection style
    if (index === selectedCharacter) {
      canvas.style.border = '2px solid #4ade80';
      if (descEl) descEl.textContent = char.desc;
    }

    container.appendChild(card);
  });
}

function renderHeroPreview(charIndex, canvas) {
  const preset = CHARACTERS[charIndex];
  const previewScene = new THREE.Scene();
  const previewCamera = new THREE.PerspectiveCamera(55, canvas.width / canvas.height, 0.5, 10);
  
  const renderer = new THREE.WebGLRenderer({ 
    canvas, 
    alpha: true, 
    antialias: true,
    preserveDrawingBuffer: true 
  });
  renderer.setSize(canvas.width, canvas.height);
  renderer.setPixelRatio(1);

  // Lights similar to main scene
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
  previewScene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.7);
  dir.position.set(2, 3, 2);
  previewScene.add(dir);

  const hero = createHeroGroup(preset);
  // Scale down and position for nice preview framing
  hero.scale.set(0.65, 0.65, 0.65);
  hero.position.set(0, 0.1, 0);
  // Slight 3/4 angle so cape and details show
  hero.rotation.y = -0.4;
  previewScene.add(hero);

  previewCamera.position.set(0, 1.35, 2.1);
  previewCamera.lookAt(0, 1.0, 0);

  renderer.render(previewScene, previewCamera);

  // Clean up (important for multiple previews)
  renderer.dispose();
  // We keep the canvas content via preserveDrawingBuffer
}

function setupLevelSelect() {
  const start = document.getElementById('start-screen');
  if (!start || document.getElementById('level-select')) return;

  const div = document.createElement('div');
  div.id = 'level-select';
  div.style.margin = '8px 0 6px';
  const completed = beatenLevels.length;
  div.innerHTML = `<div style="font-size:9px; color:#c0c0ff; margin-bottom:3px; text-align:center;">WORLDS • ${completed}/8 RISEN</div>`;
  div.style.display = 'grid';
  div.style.gridTemplateColumns = 'repeat(4, 1fr)';
  div.style.gap = '4px';

  LEVELS.forEach((lvl, idx) => {
    const card = document.createElement('div');
    card.style.background = 'rgba(20,20,50,0.7)';
    card.style.border = '2px solid #64748b';
    card.style.padding = '3px';
    card.style.fontSize = '7px';
    card.style.cursor = 'pointer';
    card.style.textAlign = 'center';
    card.style.borderRadius = '2px';

    const unlocked = idx === 0 || beatenLevels.includes(idx - 1);
    const high = JSON.parse(localStorage.getItem(`joshway_high_${idx}`) || '{}');

    // Mini preview canvas (3D snapshot of world theme)
    const prevCanvas = document.createElement('canvas');
    prevCanvas.width = 58; prevCanvas.height = 42;
    prevCanvas.style.border = '1px solid #fff';
    prevCanvas.style.display = 'block';
    prevCanvas.style.margin = '0 auto 1px';
    card.appendChild(prevCanvas);

    const nameDiv = document.createElement('div');
    nameDiv.textContent = lvl.name.toUpperCase().slice(0,13);
    nameDiv.style.color = unlocked ? '#f5d742' : '#64748b';
    nameDiv.style.fontSize = '6px';
    card.appendChild(nameDiv);

    if (unlocked && high.score) {
      const hs = document.createElement('div');
      hs.textContent = `★${high.score} ${high.time||'--'}s`;
      hs.style.fontSize = '6px'; hs.style.color = '#4ade80';
      card.appendChild(hs);
    } else if (!unlocked) {
      nameDiv.textContent += ' 🔒';
    }

    // Render quick themed preview
    renderLevelPreview(idx, prevCanvas);

    card.onclick = () => {
      if (unlocked) {
        currentLevel = idx;
        // highlight
        div.querySelectorAll('div').forEach(c => c.style.border = '2px solid #64748b');
        card.style.border = '2px solid #4ade80';
      } else {
        spawnCollectText({x:0,y:0,z:0}, 'COMPLETE PREVIOUS TO UNLOCK!');
      }
    };
    if (idx === 0) card.style.border = '2px solid #4ade80';

    div.appendChild(card);
  });

  const charDiv = document.getElementById('char-select');
  if (charDiv && charDiv.parentNode) {
    charDiv.parentNode.insertBefore(div, charDiv.nextSibling);
  } else {
    start.appendChild(div);
  }

  // Add high scores button + full table launcher
  addHighScoreButton(start);

  // Production polish: selected world indicator + dedicated PLAY SELECTED button for explicit level start flow
  let selInfo = document.getElementById('selected-world-info');
  if (!selInfo) {
    selInfo = document.createElement('div');
    selInfo.id = 'selected-world-info';
    selInfo.style.fontSize = '9px';
    selInfo.style.color = '#4ade80';
    selInfo.style.margin = '6px 0 2px';
    selInfo.style.textAlign = 'center';
    start.insertBefore(selInfo, div.nextSibling);
  }

  function updateSelectedInfo() {
    const lvl = LEVELS[currentLevel] || LEVELS[0];
    selInfo.textContent = `SELECTED: ${lvl.name.toUpperCase()}`;
    selInfo.style.color = '#f5d742';
  }
  // initial
  updateSelectedInfo();

  // Attach to existing cards to refresh label on pick
  div.querySelectorAll('div').forEach((c, i) => {
    const orig = c.onclick;
    c.onclick = (e) => {
      if (orig) orig(e);
      // refresh label after click handler
      setTimeout(updateSelectedInfo, 10);
    };
  });

  // Dedicated PLAY SELECTED WORLD button (in addition to main BEGIN)
  let playSel = document.getElementById('play-selected-btn');
  if (!playSel) {
    playSel = document.createElement('button');
    playSel.id = 'play-selected-btn';
    playSel.className = 'btn';
    playSel.style.background = '#166534';
    playSel.style.fontSize = '11px';
    playSel.style.padding = '8px 18px';
    playSel.textContent = '▶ PLAY SELECTED WORLD';
    playSel.style.marginTop = '4px';
    playSel.onclick = () => {
      // ensure currentLevel valid
      if (typeof currentLevel !== 'number' || currentLevel < 0) currentLevel = 0;
      startGame();
    };
    start.appendChild(playSel);
  }
}

function renderLevelPreview(lvlIdx, canvas) {
  // Lightweight 3D preview - simple themed geometry per world
  const pScene = new THREE.Scene();
  const pCam = new THREE.PerspectiveCamera(52, canvas.width/canvas.height, 0.5, 60);
  const pRend = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true, preserveDrawingBuffer:true});
  pRend.setSize(canvas.width, canvas.height);

  const hemi = new THREE.HemisphereLight(0xffffff,0x334455,0.9);
  pScene.add(hemi);

  const sky = LEVELS[lvlIdx].sky || 0x87ceeb;
  // Floor themed
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(18,18), new THREE.MeshLambertMaterial({color: LEVELS[lvlIdx].ground || 0x4ade80}));
  fl.rotation.x = -1.57; fl.position.y = -0.5; pScene.add(fl);

  // World specific iconic elements
  if (lvlIdx === 0) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(4,1.5,2), new THREE.MeshLambertMaterial({color:0xc0267a})); d.position.set(1,0.5,-1); pScene.add(d);
    const b = new THREE.Mesh(new THREE.BoxGeometry(3,0.8,4), new THREE.MeshLambertMaterial({color:0x1e3a8a})); b.position.set(-2,0.2,2); pScene.add(b);
  } else if (lvlIdx === 1) {
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.7,1,3,5), new THREE.MeshLambertMaterial({color:0x228b22})); tr.position.set(-2,1,1); pScene.add(tr);
  } else if (lvlIdx === 4) {
    const cr = new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.5,0.3,10), new THREE.MeshLambertMaterial({color:0x666})); cr.position.set(2, -0.2, -1); pScene.add(cr);
  } else if (lvlIdx === 5) {
    pScene.fog = new THREE.Fog(0x000011,1,30);
    const st = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([ -3,2,0, 3,4,-1,0,3,2 ],3)), new THREE.PointsMaterial({color:0xffffff,size:1.5}));
    pScene.add(st);
  } else if (lvlIdx === 7) {
    const v = new THREE.Mesh(new THREE.ConeGeometry(1.8,3,6), new THREE.MeshLambertMaterial({color:0x8b0000})); v.position.set(0,0.5,0); pScene.add(v);
  } else {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.8), new THREE.MeshLambertMaterial({color:0xfde047})); s.position.set(0,2,-2); pScene.add(s);
  }

  pCam.position.set(0, 4.5, 11);
  pCam.lookAt(0,1,0);
  pRend.render(pScene, pCam);
  pRend.dispose();
}

function addHighScoreButton(container) {
  if (document.getElementById('highscores-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'highscores-btn';
  btn.className = 'btn';
  btn.style.fontSize = '10px';
  btn.style.padding = '6px 16px';
  btn.style.marginTop = '4px';
  btn.style.background = '#334155';
  btn.textContent = 'HIGH SCORE TABLE';
  btn.onclick = showHighScoreTable;
  container.appendChild(btn);
}

function showHighScoreTable() {
  // Create or show modal high score table - retro styled, per level + overall
  let modal = document.getElementById('hs-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'hs-modal';
    modal.className = 'panel retro-text';
    modal.style.position = 'absolute';
    modal.style.top = '12%';
    modal.style.left = '50%';
    modal.style.transform = 'translateX(-50%)';
    modal.style.zIndex = '300';
    modal.style.padding = '18px 26px';
    modal.style.maxWidth = '580px';
    modal.style.maxHeight = '70vh';
    modal.style.overflow = 'auto';
    document.body.appendChild(modal);
  }
  let html = `<h2 style="color:#f5d742;font-size:22px;margin-bottom:10px">JOSHWAY HIGH SCORES</h2>`;
  html += `<div style="font-size:10px;margin-bottom:12px;color:#c0c0ff">YOUR COURAGE ACROSS THE WORLDS • INSPIRED BY MAGGIE ISAMOYER</div>`;
  html += `<table style="width:100%;font-size:10px;border-collapse:collapse;color:#fff"><tr style="background:#1e3a8a"><th style="padding:3px;text-align:left">WORLD</th><th>BEST SCORE</th><th>BEST TIME</th><th>STATUS</th></tr>`;
  let totalScore = 0, totalTime = 0, completed = 0;
  LEVELS.forEach((l, i) => {
    const h = JSON.parse(localStorage.getItem(`joshway_high_${i}`) || '{}');
    const beat = beatenLevels.includes(i);
    if (beat) { completed++; totalScore += h.score || 0; totalTime += h.time || 0; }
    const sc = h.score ? String(h.score).padStart(5,'0') : '-----';
    const tm = h.time ? h.time.toFixed(1) + 's' : '--:--';
    const st = beat ? 'RISEN ✓' : 'LOCKED';
    html += `<tr style="border-bottom:1px solid #475569"><td>${l.name}</td><td style="color:#facc15">${sc}</td><td style="color:#4ade80">${tm}</td><td style="font-size:9px;${beat?'color:#4ade80':''}">${st}</td></tr>`;
  });
  html += `</table>`;
  html += `<div style="margin-top:10px;font-size:11px;color:#f5d742">TOTAL BEST: ${totalScore} • ${completed}/8 WORLDS RISEN</div>`;
  html += `<button class="btn" style="margin-top:12px;background:#475569" onclick="document.getElementById('hs-modal').style.display='none'">CLOSE</button>`;
  modal.innerHTML = html;
  modal.style.display = 'block';
}

// ============== GAME FLOW ==============
function startGame() {
  const startScreen = document.getElementById('start-screen');
  const hud = document.getElementById('hud');
  const instr = document.getElementById('instructions');
  
  // Recreate player with chosen character (selection happens before start)
  // currentLevel may have been set via level select UI; default 0 if not
  if (typeof currentLevel === 'undefined' || currentLevel < 0) currentLevel = 0;
  if (playerGroup) {
    scene.remove(playerGroup);
    playerGroup = null;
  }
  createPlayer();
  
  // Place the new character model
  if (playerGroup) {
    playerGroup.position.copy(player.position);
    playerGroup.rotation.y = player.rotationY;
  }
  
  startScreen.style.display = 'none';
  hud.style.display = 'flex';
  instr.style.display = 'block';
  
  resumeAudio();
  
  gameState = 'playing';
  startTime = performance.now();
  levelStartTime = performance.now();
  coinsCollected = 0;
  bonusCoinsCollected = 0;
  score = 0;
  player.energy = 1.0;
  player.position.set(0, 1.8, 18); // start lower in the vast space, adjusted for huge room
  player.velocity.set(0, 0, 0);
  player.rotationY = 0;
  player.onGround = true;
  player.jetActive = false;
  prevOnGround = true;
  jetActiveLast = false;
  mouseX = 0;
  mouseY = 0.1;
  cameraYaw = 0;
  
  // Use switchLevel for clean level load (handles props, spawns, music)
  switchLevel(currentLevel);
  
  // reset collected (switchLevel resets it)
  coinsCollected = 0;
  updateHUD();
  
  // Level intro from Joshway theme
  setTimeout(() => {
    if (gameState === 'playing') {
      const intros = [
        "Welcome to the Cozy Living Room! Collect stars to rise!",
        "Backyard time! Watch for the wind and pals.",
        "The Playground Realm - courage starts here!",
        "City Lights - navigate the hustle!",
        "The Moon... low gravity, high dreams!",
        "Open Starfield - zero gravity open space! Float to collect coins and reach Mars.",
        "Red Mars - stay steady, rise strong!",
        "Volcanic Io - the final rise awaits!"
      ];
      spawnCollectText({x:0,y:10,z:0}, intros[currentLevel] || "Rise!");
    }
  }, 800);
  
  // Start the chiptune music
  if (musicEnabled) {
    setTimeout(() => startBackgroundMusic(), 180);
  }
  
  // Wire music toggle button
  const musicBtn = document.getElementById('music-toggle');
  if (musicBtn) {
    musicBtn.onclick = () => toggleMusic();
    musicBtn.textContent = musicEnabled ? '♪ MUSIC ON' : '♪ MUSIC OFF';
    musicBtn.classList.toggle('off', !musicEnabled);
  }
  
  // Lock pointer automatically for convenience
  setTimeout(() => {
    if (gameState === 'playing') canvas.requestPointerLock();
  }, 380);
}

function endGame() {
  gameState = 'win';
  document.getElementById('hud').style.display = 'none';
  document.getElementById('instructions').style.display = 'none';
  
  const win = document.getElementById('win-screen');
  win.style.display = 'block';
  
  const isLastLevel = currentLevel === LEVELS.length - 1;
  
  document.getElementById('final-coins').textContent = `${COIN_COUNT} / ${COIN_COUNT} ${bonusCoinsCollected ? `(+${bonusCoinsCollected} SECRETS)` : ''}`;
  document.getElementById('win-message').textContent = isLastLevel 
    ? "CONGRATULATIONS! YOU HAVE THE COURAGE TO RISE!" 
    : "YOU GATHERED EVERY COURAGE STAR";
  
  gameTime = ((performance.now() - startTime) / 1000).toFixed(1);
  document.getElementById('final-time').textContent = `${gameTime}s`;
  
  // Calculate final score with time bonus + secret bonus
  const timeBonus = Math.max(0, 420 - Math.floor(gameTime)) * 12;
  const secretBonus = (bonusCoinsCollected || 0) * 120;
  const finalScore = score + timeBonus + secretBonus;
  const scoreEl = document.getElementById('final-score');
  if (scoreEl) scoreEl.textContent = String(finalScore).padStart(4, '0');
  
  // Show high score info
  const highEl = document.getElementById('high-score');
  if (highEl) {
    const key = `joshway_high_${currentLevel}`;
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    highEl.textContent = saved.score ? `BEST: ${saved.score} (${saved.time}s)` : '';
  }
  
  stopBackgroundMusic();
  sfxWin();
  
  // Save high score (also marks beaten)
  saveHighScore(currentLevel, finalScore, parseFloat(gameTime));
  
  // Setup buttons
  const nextBtn = document.getElementById('next-level-btn');
  const replayBtn = document.getElementById('replay-btn');
  const levelSelectBtn = document.getElementById('level-select-btn');
  const endCredits = document.getElementById('end-credits');
  
  if (nextBtn) {
    if (isLastLevel) {
      nextBtn.style.display = 'none';
      if (endCredits) {
        // ENHANCED FULL STORY + CREDITS for production end game
        endCredits.style.display = 'block';
        endCredits.style.fontSize = '8px';
        endCredits.style.opacity = '0.95';
        endCredits.style.lineHeight = '1.45';
        endCredits.style.textAlign = 'left';
        endCredits.style.maxWidth = '460px';
        endCredits.style.margin = '14px auto 0';
        endCredits.innerHTML = `
          <strong style="color:#facc15">THE FULL JOSHWAY STORY</strong><br><br>
          From the cozy Living Room where courage first sparked, Joshway rose through the Backyard winds and Playground dreams.<br>
          Through the City lights, the low-gravity Moon, and the boundless Open Starfield (zero-g flight!), to the red dunes of Mars and the fiery geysers of Io.<br>
          Every secret Star Coin collected proved: with cape, friends, and heart — you can always RISE.<br><br>
          <strong>INSPIRED BY ARTIST MAGGIE ISAMOYER'S</strong><br>
          beautiful illustrations for "Joshway and the Courage to Rise"<br>
          Warm empowering kid-friendly adventures full of friendship & light.<br><br>
          <strong>CREDITS</strong><br>
          Game Design & Code — Joshway Team • Three.js + Vite web magic<br>
          Hero & World Art Direction — Maggie Isamoyer (book illustrations)<br>
          Chiptune Music & SFX — Pure Web Audio nostalgia<br>
          Special Thanks — Every brave kid who holds SPACE to rise<br>
          Play again to collect all secrets & beat your times!<br><br>
          <span style="color:#4ade80">JOSHWAY: COURAGE TO RISE — COMPLETE!</span>
        `;
      }
    } else {
      nextBtn.style.display = 'inline-block';
      nextBtn.onclick = () => {
        win.style.display = 'none';
        switchLevel(currentLevel + 1);
        gameState = 'playing';
        const h = document.getElementById('hud');
        if (h) h.style.display = 'flex';
        const i = document.getElementById('instructions');
        if (i) i.style.display = 'block';
      };
    }
  }
  if (replayBtn) replayBtn.onclick = () => {
    win.style.display = 'none';
    switchLevel(currentLevel);
    gameState = 'playing';
    const h = document.getElementById('hud');
    if (h) h.style.display = 'flex';
    const i = document.getElementById('instructions');
    if (i) i.style.display = 'block';
  };
  if (levelSelectBtn) levelSelectBtn.onclick = () => {
    // Enhanced: show high scores table first for full production end flow
    win.style.display = 'none';
    showHighScoreTable();
    setTimeout(() => { if (confirm('Return to main menu?')) location.reload(); }, 650);
  };
  
  // Unlock pointer
  if (isPointerLocked) document.exitPointerLock();
}

function saveHighScore(level, sc, tm) {
  const key = `joshway_high_${level}`;
  const current = JSON.parse(localStorage.getItem(key) || '{"score":0,"time":999}');
  if (sc > current.score || (sc === current.score && tm < current.time)) {
    localStorage.setItem(key, JSON.stringify({score: sc, time: tm}));
  }
  // Mark level as beaten
  if (!beatenLevels.includes(level)) {
    beatenLevels.push(level);
    localStorage.setItem('joshway_beaten', JSON.stringify(beatenLevels));
  }
}

function restartGame() {
  // Full reset
  document.getElementById('win-screen').style.display = 'none';
  coins.forEach(c => scene.remove(c));
  coins.length = 0;
  
  // Remove lingering particles
  [...jetParticles, ...coinParticles].forEach(p => scene.remove(p));
  jetParticles.length = 0;
  coinParticles.length = 0;
  powerups.forEach(p => scene.remove(p));
  powerups.length = 0;
  
  if (hazard) hazard.position.set(2, 0.4, 2);
  
  switchLevel(0);
  
  // Reset player
  player.position.set(0, 1.8, 18); // start lower in the vast space, adjusted for huge room
  player.velocity.set(0, 0, 0);
  player.rotationY = 0;
  player.onGround = true;
  player.canDoubleJump = true;
  player.energy = 1.0;
  player.jetActive = false;
  prevOnGround = true;
  jetActiveLast = false;
  currentLevel = 0; // restart adventure from beginning for full game feel
  
  coinsCollected = 0;
  mouseX = 0;
  mouseY = 0.2;
  
  updateHUD();
  
  const hud = document.getElementById('hud');
  const instr = document.getElementById('instructions');
  hud.style.display = 'flex';
  instr.style.display = 'block';
  
  resumeAudio();
  
  gameState = 'playing';
  startTime = performance.now();
  
  if (musicEnabled) {
    setTimeout(() => startBackgroundMusic(), 120);
  }
  
  const musicBtn = document.getElementById('music-toggle');
  if (musicBtn) {
    musicBtn.onclick = () => toggleMusic();
    musicBtn.textContent = musicEnabled ? '♪ MUSIC ON' : '♪ MUSIC OFF';
    musicBtn.classList.toggle('off', !musicEnabled);
  }
  
  setTimeout(() => {
    if (gameState === 'playing') canvas.requestPointerLock();
  }, 220);
}

// ============== MAIN LOOP ==============
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);
  
  const now = performance.now();
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.1) dt = 0.1; // clamp big jumps
  
  if (gameState === 'playing' && !isPaused) {
    updatePlayer(dt);
    updateCoins(dt);
    updatePowerups(dt);
    updateHazard(dt);
    updateNPCs(dt);
    checkRisePortal();
    updateParticles(dt);
    updateCamera();
    updateHUD();
  } else if (gameState === 'start') {
    // idle camera spin on title - vast world
    const t = now / 2100;
    camera.position.x = Math.sin(t * 0.6) * 14;
    camera.position.z = Math.cos(t * 0.6) * 16 + 2;
    camera.position.y = 6 + Math.sin(t * 0.4) * 1.5;
    camera.lookAt(0.3, 4, 0);
  }
  
  // Gentle star flicker on some coins if any (already handled)
  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============== INIT ==============
async function init() {
  await initRenderer();
  initAudio();
  
  // Lights
  const hemi = new THREE.HemisphereLight(0xa5b4fc, 0x1e2937, 0.85);
  scene.add(hemi);
  
  const ambient = new THREE.AmbientLight(0x64748b, 0.35);
  scene.add(ambient);
  
  const keyLight = new THREE.DirectionalLight(0xfff4d9, 0.85);
  keyLight.position.set(7, 18, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.camera.near = 2;
  keyLight.shadow.camera.far = 60;
  keyLight.shadow.camera.left = -12;
  keyLight.shadow.camera.right = 12;
  keyLight.shadow.camera.top = 12;
  keyLight.shadow.camera.bottom = -12;
  scene.add(keyLight);
  
  // Purple accent lights
  const purple1 = new THREE.PointLight(0xc0267a, 0.6, 22);
  purple1.position.set(-3, 4, 3);
  scene.add(purple1);
  
  const purple2 = new THREE.PointLight(0x7c3aed, 0.45, 18);
  purple2.position.set(4, 5, -4);
  scene.add(purple2);
  
  // First level - will build full themed world via switch
  switchLevel(0); // start in Living Room, will populate coins/NPCs/music/props via buildLevelWorld
  
  // Character selection UI
  setupCharacterSelect();
  setupLevelSelect();
  
  // Initial camera for menu - huge scale
  camera.position.set(5, 8, 25);
  camera.lookAt(0, 4, 0);
  
  // Create default player for title screen preview (will be replaced on start with chosen character)
  if (!playerGroup) {
    createPlayer();
  }
  if (playerGroup) {
    playerGroup.position.copy(player.position);
    playerGroup.rotation.y = player.rotationY;
  }
  
  // Events
  setupInput();
  window.addEventListener('resize', onResize);
  
  // Kick off
  updateHUD();
  animate();
  
  // Resume audio on any user interaction (required by browsers)
  const resumeOnce = () => {
    resumeAudio();
    // also start subtle title ambience if wanted
  };
  document.addEventListener('click', resumeOnce, { once: true });
  canvas.addEventListener('click', resumeOnce, { once: true });
  
  // Easter egg: press "C" to collect nearest coin in play
  document.addEventListener('keypress', (e) => {
    if (e.key.toLowerCase() === 'c' && gameState === 'playing' && coins.length) {
      let nearest = coins[0];
      let nd = Infinity;
      coins.forEach(co => {
        const d = co.position.distanceTo(player.position);
        if (d < nd) { nd = d; nearest = co; }
      });
      if (nearest) {
        const idx = coins.indexOf(nearest);
        collectCoin(idx, nearest);
      }
    }
  });
  
  // Show a little helper text once in a while
  console.log('%c[Joshway] Ready. Click to BEGIN YOUR RISE. WASD + Hold SPACE to rise. M = music', 'color:#4ade80');
}

// Boot
init().catch(console.error);