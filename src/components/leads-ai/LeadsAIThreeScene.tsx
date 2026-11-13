import { ChevronDown, ChevronUp, Eye, Layers, Maximize2, Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

type ModelPreset = 'neural_core' | 'workstation' | 'course_orbit';
type CameraPreset = 'hero' | 'top' | 'closeup';
type FinishKey = 'cobalt' | 'gold' | 'titanium';

const FINISH_COLORS: Record<FinishKey, { primary: number; accent: number; label: string }> = {
  cobalt: { primary: 0x2563eb, accent: 0x38bdf8, label: 'Nexus Cobalt' },
  gold: { primary: 0xd97706, accent: 0xfbbf24, label: 'Brushed Gold' },
  titanium: { primary: 0x64748b, accent: 0xe2e8f0, label: 'Titanium Slate' },
};

const CAMERA_PRESETS: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  hero: { pos: [5.4, 3.6, 6.2], target: [0, 1.35, 0] },
  top: { pos: [0.01, 7.6, 2.2], target: [0, 1.1, 0] },
  closeup: { pos: [2.7, 2.0, 3.2], target: [0, 1.5, 0] },
};

const _targetVec = new THREE.Vector3();

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createFloorGridTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
  ctx.lineWidth = 2;
  const step = 64;
  for (let i = 0; i <= 512; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.45)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1, 1, 510, 510);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.anisotropy = maxAniso;
  return tex;
}

function createMonitorScreenTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 288;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, 512, 288);

  // Header bar
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, 512, 34);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('LEADS NEXUS INSTITUTE · AI TUTOR IDE', 16, 22);

  // Sidebar block
  ctx.fillStyle = '#131c2e';
  ctx.fillRect(14, 48, 128, 224);
  const tracks = ['01 Office Mgmt', '02 Graphic Des', '03 Digital Mkt', '04 Web Dev', '05 AI Tutor'];
  tracks.forEach((label, idx) => {
    ctx.fillStyle = idx === 4 ? '#1d4ed8' : '#1e293b';
    ctx.fillRect(22, 62 + idx * 36, 112, 26);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px monospace';
    ctx.fillText(label, 28, 79 + idx * 36);
  });

  // Code / Node visualization panel
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(156, 48, 342, 224);
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(156, 48, 342, 224);

  const lines = [
    'const leadsAI = initNexusCore({',
    '  searchGrounding: true,',
    '  model: "gemini-4-hydrogen",',
    '  audioModel: "gemini-3.5-transcribe",',
    '  renderer: "WebGL2 PBR + RoomEnv"',
    '});',
  ];
  lines.forEach((line, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? '#7dd3fc' : '#a7f3d0';
    ctx.font = '12px monospace';
    ctx.fillText(line, 172, 82 + idx * 24);
  });

  // Bar telemetry graphic at bottom right
  for (let i = 0; i < 8; i++) {
    const h = 18 + ((i * 19) % 44);
    ctx.fillStyle = i % 2 === 0 ? '#2563eb' : '#38bdf8';
    ctx.fillRect(172 + i * 38, 258 - h, 24, h);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

export function LeadsAIThreeScene() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootWrapRef = useRef<HTMLDivElement | null>(null);

  const [modelPreset, setModelPreset] = useState<ModelPreset>('neural_core');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('hero');
  const [finishKey, setFinishKey] = useState<FinishKey>('cobalt');
  const [explodeLevel, setExplodeLevel] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  // Synced refs so React state never tears down the Three.js canvas
  const stateRef = useRef({
    modelPreset: 'neural_core' as ModelPreset,
    finishKey: 'cobalt' as FinishKey,
    targetExplode: 0,
    currentExplode: 0,
    isPlaying: true,
    camAnimating: false,
    camTargetPos: new THREE.Vector3(...CAMERA_PRESETS.hero.pos),
    camTargetLook: new THREE.Vector3(...CAMERA_PRESETS.hero.target),
  });
  const triggerRenderRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    stateRef.current.modelPreset = modelPreset;
    triggerRenderRef.current?.();
  }, [modelPreset]);

  useEffect(() => {
    stateRef.current.finishKey = finishKey;
    triggerRenderRef.current?.();
  }, [finishKey]);

  useEffect(() => {
    stateRef.current.targetExplode = explodeLevel / 100;
    triggerRenderRef.current?.();
  }, [explodeLevel]);

  useEffect(() => {
    stateRef.current.isPlaying = isPlaying;
    triggerRenderRef.current?.();
  }, [isPlaying]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === 'h') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const applyCameraPreset = (preset: CameraPreset) => {
    setCameraPreset(preset);
    const cfg = CAMERA_PRESETS[preset];
    stateRef.current.camTargetPos.set(...cfg.pos);
    stateRef.current.camTargetLook.set(...cfg.target);
    stateRef.current.camAnimating = true;
    triggerRenderRef.current?.();
  };

  useEffect(() => {
    const mountEl = containerRef.current;
    if (!mountEl) return;

    // 1. Software WebGL detection (never user-agent)
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = Math.max(mountEl.clientWidth, 320);
    const height = Math.max(mountEl.clientHeight, 360);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const horizonHex = 0x0b1220;
    scene.background = new THREE.Color(horizonHex);
    scene.fog = new THREE.FogExp2(horizonHex, 0.045);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(...CAMERA_PRESETS.hero.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...CAMERA_PRESETS.hero.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 2.4;
    controls.maxDistance = 14;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.update();

    controls.addEventListener('start', () => {
      stateRef.current.camAnimating = false;
    });

    // 2. Mandatory procedural RoomEnvironment IBL
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    // 3. Balanced Warm/Cool 3-Point Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xcbe2ff, 0x1e293b, 0.75);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 1.85);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 22;
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 6;
    keyLight.shadow.camera.bottom = -6;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.9);
    rimLight.position.set(-5, 4, -5);
    scene.add(rimLight);

    // Track disposable textures/materials/geometries
    const disposables: Array<{ dispose: () => void }> = [envTex];
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    // Floor & Grounding
    const floorTex = createFloorGridTexture(maxAniso);
    const contactShadowTex = createContactShadowTexture();
    const screenTex = createMonitorScreenTexture(maxAniso);
    disposables.push(floorTex, contactShadowTex, screenTex);

    const floorGeo = new THREE.CircleGeometry(14, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.78,
      metalness: 0.15,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);
    disposables.push(floorGeo, floorMat);

    const contactGeo = new THREE.PlaneGeometry(4.4, 4.4);
    const contactMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.52,
    });
    const contactPlane = new THREE.Mesh(contactGeo, contactMat);
    contactPlane.rotation.x = -Math.PI / 2;
    contactPlane.position.y = 0.02;
    scene.add(contactPlane);
    disposables.push(contactGeo, contactMat);

    // Shared Finish-Aware PBR Materials (roughness differs >= 0.25 across adjacent parts)
    const primaryMat = new THREE.MeshPhysicalMaterial({
      color: FINISH_COLORS.cobalt.primary,
      metalness: 0.85,
      roughness: 0.22,
      clearcoat: 0.7,
      clearcoatRoughness: 0.12,
    });
    const matteMetalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.35,
      roughness: 0.68,
    });
    const accentEmissiveMat = new THREE.MeshStandardMaterial({
      color: FINISH_COLORS.cobalt.accent,
      emissive: FINISH_COLORS.cobalt.accent,
      emissiveIntensity: 0.85,
      metalness: 0.2,
      roughness: 0.35,
    });
    const darkRubberMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.08,
      roughness: 0.88,
    });
    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      metalness: 0.05,
      roughness: 0.08,
      transmission: isSoftwareGl ? 0 : 0.86,
      transparent: true,
      opacity: isSoftwareGl ? 0.38 : 1,
      ior: 1.6,
      thickness: 1.2,
      clearcoat: 1,
    });
    disposables.push(primaryMat, matteMetalMat, accentEmissiveMat, darkRubberMat, crystalMat);

    // Helper to register exploded vector offsets on parts
    const explodableParts: Array<{ obj: THREE.Object3D; base: THREE.Vector3; offset: THREE.Vector3 }> = [];
    const registerPart = (obj: THREE.Object3D, offset: [number, number, number]) => {
      explodableParts.push({
        obj,
        base: obj.position.clone(),
        offset: new THREE.Vector3(...offset),
      });
    };

    // === MODEL 1: Leads AI Neural Core (9-part composite Group, grounded at y=0) ===
    const neuralGroup = new THREE.Group();

    // 1. Stepped Lathe Plinth
    const plinthPts = [
      new THREE.Vector2(0.01, 0),
      new THREE.Vector2(1.55, 0),
      new THREE.Vector2(1.55, 0.14),
      new THREE.Vector2(1.28, 0.22),
      new THREE.Vector2(1.22, 0.34),
      new THREE.Vector2(0.01, 0.34),
    ];
    const plinthGeo = new THREE.LatheGeometry(plinthPts, 48);
    const plinthMesh = new THREE.Mesh(plinthGeo, matteMetalMat);
    plinthMesh.castShadow = true;
    plinthMesh.receiveShadow = true;
    neuralGroup.add(plinthMesh);
    registerPart(plinthMesh, [0, -0.3, 0]);
    disposables.push(plinthGeo);

    // 2. Plinth Illuminated Collar Ring
    const collarGeo = new THREE.TorusGeometry(1.18, 0.04, 16, 48);
    const collarMesh = new THREE.Mesh(collarGeo, accentEmissiveMat);
    collarMesh.rotation.x = Math.PI / 2;
    collarMesh.position.y = 0.36;
    neuralGroup.add(collarMesh);
    registerPart(collarMesh, [0, -0.1, 0]);
    disposables.push(collarGeo);

    // 3. 4 Grounded Pillar Supports
    const pillarShape = new THREE.Shape();
    pillarShape.moveTo(-0.08, -0.08);
    pillarShape.lineTo(0.08, -0.08);
    pillarShape.lineTo(0.05, 0.08);
    pillarShape.lineTo(-0.05, 0.08);
    pillarShape.closePath();
    const pillarGeo = new THREE.ExtrudeGeometry(pillarShape, {
      depth: 1.05,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    });
    pillarGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const p = new THREE.Mesh(pillarGeo, primaryMat);
      p.position.set(Math.cos(ang) * 0.92, 0.34, Math.sin(ang) * 0.92);
      p.rotation.y = -ang;
      p.castShadow = true;
      neuralGroup.add(p);
      registerPart(p, [Math.cos(ang) * 0.65, 0.15, Math.sin(ang) * 0.65]);
    }
    disposables.push(pillarGeo);

    // 4-6. 3 Nested Gyroscope Rings
    const outerRingGeo = new THREE.TorusGeometry(1.06, 0.055, 18, 64);
    const outerRing = new THREE.Mesh(outerRingGeo, primaryMat);
    outerRing.position.y = 1.58;
    outerRing.castShadow = true;
    neuralGroup.add(outerRing);
    registerPart(outerRing, [0, 0.45, 0]);

    const midRingGeo = new THREE.TorusGeometry(0.84, 0.045, 16, 56);
    const midRing = new THREE.Mesh(midRingGeo, matteMetalMat);
    midRing.position.y = 1.58;
    midRing.castShadow = true;
    neuralGroup.add(midRing);
    registerPart(midRing, [-0.55, 0.25, 0]);

    const innerRingGeo = new THREE.TorusGeometry(0.64, 0.035, 14, 48);
    const innerRing = new THREE.Mesh(innerRingGeo, accentEmissiveMat);
    innerRing.position.y = 1.58;
    neuralGroup.add(innerRing);
    registerPart(innerRing, [0.55, 0.25, 0]);
    disposables.push(outerRingGeo, midRingGeo, innerRingGeo);

    // 7. Optical Crystal Containment Shell
    const shellGeo = new THREE.IcosahedronGeometry(0.46, 1);
    const shellMesh = new THREE.Mesh(shellGeo, crystalMat);
    shellMesh.position.y = 1.58;
    shellMesh.renderOrder = 2;
    neuralGroup.add(shellMesh);
    registerPart(shellMesh, [0, 0.6, 0]);

    // 8. Inner Quantum Core Emitter
    const coreGeo = new THREE.OctahedronGeometry(0.24, 0);
    const coreMesh = new THREE.Mesh(coreGeo, accentEmissiveMat);
    coreMesh.position.y = 1.58;
    neuralGroup.add(coreMesh);
    registerPart(coreMesh, [0, 0.1, 0]);

    // 9. Crown Emitter Finial
    const crownGeo = new THREE.ConeGeometry(0.18, 0.34, 6);
    const crownMesh = new THREE.Mesh(crownGeo, primaryMat);
    crownMesh.position.y = 2.86;
    crownMesh.castShadow = true;
    neuralGroup.add(crownMesh);
    registerPart(crownMesh, [0, 0.95, 0]);
    disposables.push(shellGeo, coreGeo, crownGeo);

    scene.add(neuralGroup);

    // === MODEL 2: Diploma Workstation Rig (8-part composite Group) ===
    const deskGroup = new THREE.Group();
    deskGroup.visible = false;

    const deskTopGeo = new THREE.BoxGeometry(3.4, 0.12, 1.75);
    const deskTop = new THREE.Mesh(deskTopGeo, matteMetalMat);
    deskTop.position.set(0, 1.0, 0);
    deskTop.castShadow = true;
    deskTop.receiveShadow = true;
    deskGroup.add(deskTop);
    registerPart(deskTop, [0, -0.1, 0]);

    const legGeo = new THREE.BoxGeometry(0.12, 0.96, 1.45);
    const leftLeg = new THREE.Mesh(legGeo, darkRubberMat);
    leftLeg.position.set(-1.45, 0.48, 0);
    leftLeg.castShadow = true;
    deskGroup.add(leftLeg);
    registerPart(leftLeg, [-0.55, -0.25, 0]);

    const rightLeg = new THREE.Mesh(legGeo, darkRubberMat);
    rightLeg.position.set(1.45, 0.48, 0);
    rightLeg.castShadow = true;
    deskGroup.add(rightLeg);
    registerPart(rightLeg, [0.55, -0.25, 0]);

    // Monitor Stand + Housing + Procedural Canvas Screen
    const standStemGeo = new THREE.BoxGeometry(0.16, 0.56, 0.1);
    const standStem = new THREE.Mesh(standStemGeo, primaryMat);
    standStem.position.set(-0.22, 1.34, -0.35);
    standStem.castShadow = true;
    deskGroup.add(standStem);
    registerPart(standStem, [0, 0.25, -0.45]);

    const monitorHousingGeo = new THREE.BoxGeometry(2.15, 1.18, 0.09);
    const monitorHousing = new THREE.Mesh(monitorHousingGeo, darkRubberMat);
    monitorHousing.position.set(-0.22, 1.82, -0.28);
    monitorHousing.castShadow = true;
    deskGroup.add(monitorHousing);
    registerPart(monitorHousing, [0, 0.65, -0.3]);

    const screenGeo = new THREE.PlaneGeometry(2.02, 1.06);
    const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.set(-0.22, 1.82, -0.23);
    deskGroup.add(screenMesh);
    registerPart(screenMesh, [0, 0.65, 0.25]);

    // Mechanical Keyboard + Workstation Tower
    const kbGeo = new THREE.BoxGeometry(1.12, 0.05, 0.42);
    const kbMesh = new THREE.Mesh(kbGeo, primaryMat);
    kbMesh.position.set(-0.24, 1.09, 0.34);
    kbMesh.castShadow = true;
    deskGroup.add(kbMesh);
    registerPart(kbMesh, [0, 0.28, 0.5]);

    const towerGeo = new THREE.BoxGeometry(0.54, 1.05, 1.05);
    const towerMesh = new THREE.Mesh(towerGeo, matteMetalMat);
    towerMesh.position.set(1.22, 1.58, -0.1);
    towerMesh.castShadow = true;
    deskGroup.add(towerMesh);
    registerPart(towerMesh, [0.65, 0.35, 0]);

    const towerFanGeo = new THREE.TorusGeometry(0.15, 0.025, 12, 32);
    const towerFan = new THREE.Mesh(towerFanGeo, accentEmissiveMat);
    towerFan.position.set(1.22, 1.58, 0.435);
    deskGroup.add(towerFan);
    registerPart(towerFan, [0.65, 0.35, 0.45]);

    disposables.push(
      deskTopGeo,
      legGeo,
      standStemGeo,
      monitorHousingGeo,
      screenGeo,
      screenMat,
      kbGeo,
      towerGeo,
      towerFanGeo
    );
    scene.add(deskGroup);

    // === MODEL 3: 5-Track Course Orbit Diorama (8-part composite Group) ===
    const orbitGroup = new THREE.Group();
    orbitGroup.visible = false;

    const hubBaseGeo = new THREE.CylinderGeometry(0.55, 0.85, 0.5, 8);
    const hubBase = new THREE.Mesh(hubBaseGeo, matteMetalMat);
    hubBase.position.y = 0.25;
    hubBase.castShadow = true;
    orbitGroup.add(hubBase);
    registerPart(hubBase, [0, -0.2, 0]);

    const hubBeaconGeo = new THREE.OctahedronGeometry(0.42, 1);
    const hubBeacon = new THREE.Mesh(hubBeaconGeo, accentEmissiveMat);
    hubBeacon.position.y = 1.45;
    orbitGroup.add(hubBeacon);
    registerPart(hubBeacon, [0, 0.45, 0]);

    const orbitTrackGeo = new THREE.TorusGeometry(1.75, 0.025, 12, 72);
    const orbitTrack = new THREE.Mesh(orbitTrackGeo, primaryMat);
    orbitTrack.rotation.x = Math.PI / 2 - 0.18;
    orbitTrack.position.y = 1.45;
    orbitGroup.add(orbitTrack);
    registerPart(orbitTrack, [0, 0.2, 0]);

    const satColors = [0x3b82f6, 0xec4899, 0x10b981, 0xf59e0b, 0x8b5cf6];
    const satellites: THREE.Mesh[] = [];
    const satGeo = new THREE.DodecahedronGeometry(0.24, 0);
    satColors.forEach((hex, idx) => {
      const satMat = new THREE.MeshStandardMaterial({
        color: hex,
        metalness: 0.45,
        roughness: 0.28,
      });
      const sat = new THREE.Mesh(satGeo, satMat);
      const ang = (idx / satColors.length) * Math.PI * 2;
      sat.position.set(Math.cos(ang) * 1.75, 1.45 + Math.sin(ang) * 0.3, Math.sin(ang) * 1.75);
      sat.castShadow = true;
      orbitGroup.add(sat);
      satellites.push(sat);
      registerPart(sat, [Math.cos(ang) * 0.75, 0.35, Math.sin(ang) * 0.75]);
      disposables.push(satMat);
    });
    disposables.push(hubBaseGeo, hubBeaconGeo, orbitTrackGeo, satGeo);
    scene.add(orbitGroup);

    // Pre-warm shaders cleanly on hardware GPUs
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 4. Coalesced render / afterDraw loop scheduler (software-WebGL safe)
    let frameId = 0;
    let disposed = false;
    let renderBusy = false;
    let renderDirty = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function stepScene(dt: number, elapsed: number) {
      const st = stateRef.current;

      // Model visibility
      neuralGroup.visible = st.modelPreset === 'neural_core';
      deskGroup.visible = st.modelPreset === 'workstation';
      orbitGroup.visible = st.modelPreset === 'course_orbit';

      // Finish swatch colors
      const palette = FINISH_COLORS[st.finishKey];
      primaryMat.color.setHex(palette.primary);
      accentEmissiveMat.color.setHex(palette.accent);
      accentEmissiveMat.emissive.setHex(palette.accent);

      // Smooth damped exploded-view separation
      st.currentExplode = THREE.MathUtils.damp(st.currentExplode, st.targetExplode, 7, dt);
      for (const part of explodableParts) {
        _targetVec.copy(part.base).addScaledVector(part.offset, st.currentExplode);
        part.obj.position.copy(_targetVec);
      }

      // Smooth damped camera preset transition
      if (st.camAnimating) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, st.camTargetPos.x, 6, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, st.camTargetPos.y, 6, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, st.camTargetPos.z, 6, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, st.camTargetLook.x, 6, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, st.camTargetLook.y, 6, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, st.camTargetLook.z, 6, dt);
        if (camera.position.distanceTo(st.camTargetPos) < 0.02) {
          st.camAnimating = false;
        }
      }

      // Gentle motion when Play Orbit is enabled
      if (st.isPlaying) {
        if (neuralGroup.visible) {
          outerRing.rotation.y += dt * 0.55;
          outerRing.rotation.x = Math.sin(elapsed * 0.6) * 0.25;
          midRing.rotation.x += dt * 0.72;
          midRing.rotation.z = Math.cos(elapsed * 0.45) * 0.35;
          innerRing.rotation.y -= dt * 0.95;
          coreMesh.rotation.y += dt * 1.1;
          shellMesh.rotation.y -= dt * 0.35;
        }
        if (deskGroup.visible) {
          deskGroup.rotation.y = Math.sin(elapsed * 0.35) * 0.22;
          towerFan.rotation.z += dt * 3.8;
        }
        if (orbitGroup.visible) {
          hubBeacon.rotation.y += dt * 0.85;
          satellites.forEach((sat, idx) => {
            const ang = elapsed * 0.55 + (idx / satellites.length) * Math.PI * 2;
            const r = 1.75 + st.currentExplode * 0.75;
            sat.position.set(
              Math.cos(ang) * r,
              1.45 + Math.sin(ang) * 0.3 + st.currentExplode * 0.35,
              Math.sin(ang) * r
            );
            sat.rotation.y += dt * 0.8;
          });
        }
      }

      controls.update();
    }

    function requestRender() {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;
        const dt = Math.min(clock.getDelta(), 0.05);
        const elapsed = clock.getElapsedTime();
        stepScene(dt, elapsed);
        renderer.render(scene, camera);

        const st = stateRef.current;
        const needsAnotherFrame =
          st.isPlaying ||
          st.camAnimating ||
          Math.abs(st.currentExplode - st.targetExplode) > 0.004 ||
          renderDirty;

        const done = () => {
          renderBusy = false;
          if (!disposed && needsAnotherFrame) {
            requestRender();
          }
        };

        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    triggerRenderRef.current = requestRender;
    controls.addEventListener('change', requestRender);

    const handleResize = () => {
      if (!mountEl || disposed) return;
      const w = Math.max(mountEl.clientWidth, 320);
      const h = Math.max(mountEl.clientHeight, 360);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', handleResize);

    // Initial render
    requestRender();

    return () => {
      disposed = true;
      triggerRenderRef.current = null;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === mountEl) {
        mountEl.removeChild(renderer.domElement);
      }
    };
  }, []);

  const toggleFullscreen = () => {
    const el = rootWrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div
      ref={rootWrapRef}
      className="relative h-[620px] w-full overflow-hidden rounded-xl border border-slate-800 bg-[#0b1220]"
    >
      {/* Isolated WebGL Container (no siblings inside) */}
      <div ref={containerRef} className="h-full w-full" />

      {/* Top-Left Minimal Spec Header (solid/alpha, zero backdrop-filter, zero pulsating dots) */}
      <div
        className="pointer-events-none absolute left-4 top-4 rounded-lg border border-slate-700/80 px-3.5 py-2"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.88)' }}
      >
        <div className="text-xs font-bold tracking-tight text-white">
          Leads AI · Interactive 3D Lab
        </div>
        <div className="mt-0.5 text-[11px] font-mono text-sky-300">
          {modelPreset === 'neural_core' && '9-Part Quantum Neural Core'}
          {modelPreset === 'workstation' && '8-Part Institute Workstation'}
          {modelPreset === 'course_orbit' && '5-Track Diploma Orbital Array'}
        </div>
      </div>

      {/* Top-Right Fullscreen Trigger Only */}
      <button
        type="button"
        onClick={toggleFullscreen}
        title="Toggle Fullscreen"
        className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.88)' }}
      >
        <Maximize2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Fullscreen</span>
      </button>

      {/* Collapsible Unified Bottom Control Dock */}
      <div
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 transition-transform duration-300 ${
          dockCollapsed ? 'translate-y-[calc(100%+24px)]' : 'translate-y-0'
        }`}
        style={{ width: 'min(860px, 94%)' }}
      >
        {/* Collapse Toggle Tab */}
        <div className="mb-1.5 flex justify-center">
          <button
            type="button"
            onClick={() => setDockCollapsed(true)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.92)' }}
          >
            <ChevronDown className="h-3 w-3" />
            <span>Hide Controls (H)</span>
          </button>
        </div>

        <div
          className="rounded-xl border border-slate-700/90 px-4 py-3 text-xs text-slate-200"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.92)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Subject Switcher */}
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'neural_core', label: 'Neural Core' },
                  { id: 'workstation', label: 'Workstation' },
                  { id: 'course_orbit', label: '5 Courses' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModelPreset(m.id)}
                  className={`rounded-md px-2.5 py-1.5 font-semibold transition-colors whitespace-nowrap ${
                    modelPreset === m.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Exploded Assembly Slider */}
            <label className="flex items-center gap-2 font-medium text-slate-300">
              <Layers className="h-3.5 w-3.5 text-sky-400" />
              <span className="whitespace-nowrap">Explode</span>
              <input
                type="range"
                min={0}
                max={100}
                value={explodeLevel}
                onChange={(e) => setExplodeLevel(Number(e.target.value))}
                className="w-24 accent-sky-400"
              />
              <span className="w-8 text-right font-mono tabular-nums text-sky-300">
                {explodeLevel}%
              </span>
            </label>

            {/* Finish Swatches */}
            <div className="flex items-center gap-1.5">
              {(Object.keys(FINISH_COLORS) as FinishKey[]).map((key) => {
                const sw = FINISH_COLORS[key];
                const bg =
                  key === 'cobalt' ? '#2563eb' : key === 'gold' ? '#d97706' : '#64748b';
                return (
                  <button
                    key={key}
                    type="button"
                    title={sw.label}
                    onClick={() => setFinishKey(key)}
                    className={`h-6 w-6 rounded-md border-2 transition-transform ${
                      finishKey === key ? 'border-white scale-110' : 'border-slate-600'
                    }`}
                    style={{ backgroundColor: bg }}
                  />
                );
              })}
            </div>

            {/* Camera Views & Motion */}
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'hero', label: 'Hero' },
                  { id: 'top', label: 'Top' },
                  { id: 'closeup', label: 'Close' },
                ] as const
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => applyCameraPreset(c.id)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 font-medium ${
                    cameraPreset === c.id
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Eye className="h-3 w-3" />
                  <span>{c.label}</span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => setIsPlaying((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1.5 font-semibold text-sky-300 hover:bg-slate-700"
              >
                {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setExplodeLevel(0);
                  applyCameraPreset('hero');
                }}
                title="Reset View"
                className="rounded-md bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expand Controls Pill when Dock Collapsed */}
      {dockCollapsed && (
        <button
          type="button"
          onClick={() => setDockCollapsed(false)}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:text-white"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)' }}
        >
          <ChevronUp className="h-3.5 w-3.5" />
          <span>Show 3D Controls (H)</span>
        </button>
      )}
    </div>
  );
}
