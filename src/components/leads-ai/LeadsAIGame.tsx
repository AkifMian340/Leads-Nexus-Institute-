import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gameAudio } from './audioSynth';

type GamePhase = 'title' | 'playing' | 'paused' | 'gameover' | 'victory';

interface EntityItem {
  kind: 'packet' | 'shield' | 'hazard';
  lane: number;
  z: number;
  active: boolean;
  group: THREE.Group;
}

const LANE_X = [-2.4, 0, 2.4];
const VICTORY_SCORE = 2500;
const _tmpVec = new THREE.Vector3();

function createTrackGridTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#070b14';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle circuit grid
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Three cyber lanes
  [128, 256, 384].forEach((cx) => {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.32)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, 512);
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 14);
  tex.anisotropy = maxAniso;
  return tex;
}

export function LeadsAIGame() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [phase, setPhase] = useState<GamePhase>('title');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [integrity, setIntegrity] = useState(3);
  const [wave, setWave] = useState(1);
  const [combo, setCombo] = useState(1);
  const [muted, setMuted] = useState(false);

  const gameRef = useRef({
    phase: 'title' as GamePhase,
    targetLane: 1,
    shuttleX: 0,
    shuttleY: 0.45,
    velY: 0,
    isJumping: false,
    score: 0,
    highScore: 0,
    integrity: 3,
    wave: 1,
    combo: 1,
    speed: 14,
    spawnTimer: 0,
    invulnTimer: 0,
    resetRequested: false,
    endlessMode: false,
  });

  const shiftLane = (delta: number) => {
    if (gameRef.current.phase !== 'playing') return;
    const next = Math.max(0, Math.min(2, gameRef.current.targetLane + delta));
    if (next !== gameRef.current.targetLane) {
      gameRef.current.targetLane = next;
      gameAudio.playLaneShift();
    }
  };

  const triggerJump = () => {
    const g = gameRef.current;
    if (g.phase !== 'playing' || g.isJumping) return;
    g.velY = 9.4;
    g.isJumping = true;
    gameAudio.playJump();
  };

  const startNewGame = () => {
    const g = gameRef.current;
    g.targetLane = 1;
    g.shuttleX = 0;
    g.shuttleY = 0.45;
    g.velY = 0;
    g.isJumping = false;
    g.score = 0;
    g.integrity = 3;
    g.wave = 1;
    g.combo = 1;
    g.speed = 14;
    g.spawnTimer = 0.5;
    g.invulnTimer = 0;
    g.endlessMode = false;
    g.resetRequested = true;
    g.phase = 'playing';
    setScore(0);
    setIntegrity(3);
    setWave(1);
    setCombo(1);
    setPhase('playing');
    gameAudio.playLaneShift();
  };

  const continueEndless = () => {
    gameRef.current.endlessMode = true;
    gameRef.current.phase = 'playing';
    setPhase('playing');
  };

  const togglePause = () => {
    const g = gameRef.current;
    if (g.phase === 'playing') {
      g.phase = 'paused';
      setPhase('paused');
    } else if (g.phase === 'paused') {
      g.phase = 'playing';
      setPhase('playing');
    }
  };

  useEffect(() => {
    gameAudio.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        e.preventDefault();
        shiftLane(-1);
      } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        e.preventDefault();
        shiftLane(1);
      } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        if (gameRef.current.phase === 'playing') {
          e.preventDefault();
          triggerJump();
        }
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        togglePause();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;

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
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const skyHex = 0x090f1d;
    scene.background = new THREE.Color(skyHex);
    scene.fog = new THREE.FogExp2(skyHex, 0.026);

    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 140);
    camera.position.set(0, 4.4, 7.2);
    camera.lookAt(0, 1.0, -10);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    // Warm/cool studio rig
    scene.add(new THREE.HemisphereLight(0xc7dfff, 0x1e293b, 0.75));
    const keyLight = new THREE.DirectionalLight(0xfff1dc, 1.8);
    keyLight.position.set(6, 12, 8);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 36;
    keyLight.shadow.camera.left = -8;
    keyLight.shadow.camera.right = 8;
    keyLight.shadow.camera.top = 12;
    keyLight.shadow.camera.bottom = -12;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const trackTex = createTrackGridTexture(maxAniso);
    const disposables: Array<{ dispose: () => void }> = [envTex, trackTex];

    // Scrolling Runways
    const runwayGeo = new THREE.PlaneGeometry(10.5, 130);
    const runwayMat = new THREE.MeshStandardMaterial({
      map: trackTex,
      roughness: 0.72,
      metalness: 0.25,
    });
    const runwayMesh = new THREE.Mesh(runwayGeo, runwayMat);
    runwayMesh.rotation.x = -Math.PI / 2;
    runwayMesh.position.z = -54;
    runwayMesh.receiveShadow = true;
    scene.add(runwayMesh);
    disposables.push(runwayGeo, runwayMat);

    // Track side guard rails
    const railGeo = new THREE.BoxGeometry(0.18, 0.28, 130);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.45,
      metalness: 0.7,
      roughness: 0.3,
    });
    [-4.3, 4.3].forEach((rx) => {
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(rx, 0.14, -54);
      scene.add(rail);
    });
    disposables.push(railGeo, railMat);

    // === Composite 7-Part Player Cyber-Shuttle ===
    const shuttleGroup = new THREE.Group();
    const hullMat = new THREE.MeshPhysicalMaterial({
      color: 0x2563eb,
      metalness: 0.86,
      roughness: 0.2,
      clearcoat: 0.8,
    });
    const canopyMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.15,
      roughness: 0.1,
      clearcoat: 1,
    });
    const thrusterMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xf97316,
      emissiveIntensity: 1.4,
      roughness: 0.45,
      metalness: 0.1,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.4,
      roughness: 0.65,
    });

    // Part 1: Beveled fuselage
    const hullShape = new THREE.Shape();
    hullShape.moveTo(0, 0.85);
    hullShape.lineTo(0.42, -0.55);
    hullShape.lineTo(0, -0.72);
    hullShape.lineTo(-0.42, -0.55);
    hullShape.closePath();
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 2,
    });
    hullGeo.rotateX(Math.PI / 2);
    const hullMesh = new THREE.Mesh(hullGeo, hullMat);
    hullMesh.position.y = 0.18;
    hullMesh.castShadow = true;
    shuttleGroup.add(hullMesh);

    // Part 2: Cockpit Canopy
    const canopyGeo = new THREE.BoxGeometry(0.32, 0.22, 0.58);
    const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
    canopyMesh.position.set(0, 0.28, -0.04);
    shuttleGroup.add(canopyMesh);

    // Part 3 & 4: Swept Wing Fins
    const wingGeo = new THREE.BoxGeometry(0.62, 0.07, 0.48);
    const leftWing = new THREE.Mesh(wingGeo, trimMat);
    leftWing.position.set(-0.58, 0.1, 0.22);
    leftWing.rotation.z = -0.14;
    leftWing.castShadow = true;
    shuttleGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, trimMat);
    rightWing.position.set(0.58, 0.1, 0.22);
    rightWing.rotation.z = 0.14;
    rightWing.castShadow = true;
    shuttleGroup.add(rightWing);

    // Part 5 & 6: Twin Rear Thruster Cones
    const thrGeo = new THREE.ConeGeometry(0.11, 0.34, 12);
    thrGeo.rotateX(Math.PI / 2);
    [-0.2, 0.2].forEach((tx) => {
      const thr = new THREE.Mesh(thrGeo, thrusterMat);
      thr.position.set(tx, 0.11, 0.72);
      shuttleGroup.add(thr);
    });

    // Part 7: Energy Shield Halo
    const shieldHaloGeo = new THREE.TorusGeometry(0.86, 0.025, 10, 36);
    const shieldHaloMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
    });
    const shieldHalo = new THREE.Mesh(shieldHaloGeo, shieldHaloMat);
    shieldHalo.rotation.x = Math.PI / 2;
    shuttleGroup.add(shieldHalo);

    shuttleGroup.position.set(0, 0.45, 0);
    scene.add(shuttleGroup);

    disposables.push(
      hullMat,
      canopyMat,
      thrusterMat,
      trimMat,
      hullGeo,
      canopyGeo,
      wingGeo,
      thrGeo,
      shieldHaloGeo,
      shieldHaloMat
    );

    // Shared geometries/materials for dynamic entities
    const packetCoreGeo = new THREE.OctahedronGeometry(0.38, 0);
    const packetRingGeo = new THREE.TorusGeometry(0.54, 0.04, 10, 28);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.75,
      metalness: 0.85,
      roughness: 0.2,
    });
    const emeraldMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.9,
      metalness: 0.5,
      roughness: 0.25,
    });
    const hazardBaseGeo = new THREE.BoxGeometry(1.38, 0.24, 0.58);
    const hazardBodyGeo = new THREE.BoxGeometry(1.18, 0.95, 0.42);
    const hazardCapGeo = new THREE.BoxGeometry(1.34, 0.16, 0.5);
    const hazardDarkMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.4,
      roughness: 0.65,
    });
    const hazardRedMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.85,
      metalness: 0.35,
      roughness: 0.32,
    });
    disposables.push(
      packetCoreGeo,
      packetRingGeo,
      goldMat,
      emeraldMat,
      hazardBaseGeo,
      hazardBodyGeo,
      hazardCapGeo,
      hazardDarkMat,
      hazardRedMat
    );

    const entities: EntityItem[] = [];

    function spawnRow() {
      const hazardCount = gameRef.current.wave >= 2 && Math.random() < 0.45 ? 2 : 1;
      const lanes = [0, 1, 2];
      // Shuffle lanes cleanly
      for (let i = lanes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
      }

      for (let idx = 0; idx < hazardCount; idx++) {
        const lane = lanes[idx];
        const grp = new THREE.Group();
        const b = new THREE.Mesh(hazardBaseGeo, hazardDarkMat);
        b.position.y = 0.12;
        const m = new THREE.Mesh(hazardBodyGeo, hazardRedMat);
        m.position.y = 0.68;
        m.castShadow = true;
        const c = new THREE.Mesh(hazardCapGeo, hazardDarkMat);
        c.position.y = 1.22;
        grp.add(b, m, c);
        grp.position.set(LANE_X[lane], 0, -68);
        scene.add(grp);
        entities.push({ kind: 'hazard', lane, z: -68, active: true, group: grp });
      }

      // Spawn a collectible packet or shield in an open lane
      const openLane = lanes[hazardCount];
      const isShield = gameRef.current.integrity < 3 && Math.random() < 0.18;
      const grp = new THREE.Group();
      const mat = isShield ? emeraldMat : goldMat;
      const core = new THREE.Mesh(packetCoreGeo, mat);
      core.position.y = 0.85;
      core.castShadow = true;
      const ring = new THREE.Mesh(packetRingGeo, mat);
      ring.position.y = 0.85;
      grp.add(core, ring);
      grp.position.set(LANE_X[openLane], 0, -68);
      scene.add(grp);
      entities.push({
        kind: isShield ? 'shield' : 'packet',
        lane: openLane,
        z: -68,
        active: true,
        group: grp,
      });
    }

    function clearEntities() {
      for (const ent of entities) {
        scene.remove(ent.group);
      }
      entities.length = 0;
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let frameId = 0;
    let disposed = false;
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

    function tick() {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();
      const g = gameRef.current;

      if (g.resetRequested) {
        g.resetRequested = false;
        clearEntities();
      }

      if (g.phase === 'title') {
        trackTex.offset.y -= dt * 0.4;
        shuttleGroup.position.set(0, 0.55 + Math.sin(elapsed * 2.4) * 0.12, 0);
        shuttleGroup.rotation.z = Math.sin(elapsed * 1.4) * 0.1;
      } else if (g.phase === 'playing') {
        // Scroll grid road
        trackTex.offset.y -= dt * (g.speed * 0.075);

        // Smooth lane X & tilt banking
        const destX = LANE_X[g.targetLane];
        const prevX = g.shuttleX;
        g.shuttleX = THREE.MathUtils.damp(g.shuttleX, destX, 14, dt);
        const lateralVel = (g.shuttleX - prevX) / Math.max(dt, 0.001);
        shuttleGroup.rotation.z = THREE.MathUtils.damp(
          shuttleGroup.rotation.z,
          THREE.MathUtils.clamp(-lateralVel * 0.035, -0.42, 0.42),
          12,
          dt
        );

        // Jump physics
        if (g.isJumping) {
          g.velY -= 24 * dt;
          g.shuttleY += g.velY * dt;
          if (g.shuttleY <= 0.45) {
            g.shuttleY = 0.45;
            g.velY = 0;
            g.isJumping = false;
          }
        } else {
          g.shuttleY = 0.45 + Math.sin(elapsed * 7) * 0.04;
        }
        shuttleGroup.position.set(g.shuttleX, g.shuttleY, 0);

        // Shield blink if invulnerable after impact
        if (g.invulnTimer > 0) {
          g.invulnTimer = Math.max(0, g.invulnTimer - dt);
          shuttleGroup.visible = Math.floor(g.invulnTimer * 18) % 2 === 0;
        } else {
          shuttleGroup.visible = true;
        }
        shieldHaloMat.opacity = g.integrity > 1 ? 0.42 : 0.18;

        // Dynamic speed & wave scaling
        const nextWave = g.score >= 1500 ? 3 : g.score >= 600 ? 2 : 1;
        if (nextWave > g.wave) {
          g.wave = nextWave;
          setWave(nextWave);
          gameAudio.playLevelUp();
        }
        g.speed = 14 + (g.wave - 1) * 4 + Math.min(g.score / 500, 6);

        // Spawn waves
        g.spawnTimer -= dt;
        if (g.spawnTimer <= 0) {
          spawnRow();
          g.spawnTimer = Math.max(0.55, 1.18 - g.wave * 0.16);
        }

        // Advance & collide entities (zero allocations)
        for (let i = entities.length - 1; i >= 0; i--) {
          const ent = entities[i];
          ent.z += g.speed * dt;
          ent.group.position.z = ent.z;
          if (ent.kind !== 'hazard') {
            ent.group.rotation.y += dt * 2.5;
          }

          if (ent.active && Math.abs(ent.z) < 0.95) {
            const dx = Math.abs(_tmpVec.set(LANE_X[ent.lane], 0, 0).x - g.shuttleX);
            if (dx < 1.05) {
              if (ent.kind === 'packet') {
                ent.active = false;
                ent.group.visible = false;
                g.score += 100 * g.combo;
                g.combo = Math.min(4, g.combo + 1);
                setScore(g.score);
                setCombo(g.combo);
                if (g.score > g.highScore) {
                  g.highScore = g.score;
                  setHighScore(g.score);
                }
                gameAudio.playPickupChime(g.combo);

                if (!g.endlessMode && g.score >= VICTORY_SCORE) {
                  g.phase = 'victory';
                  setPhase('victory');
                  gameAudio.playVictoryFanfare();
                }
              } else if (ent.kind === 'shield') {
                ent.active = false;
                ent.group.visible = false;
                g.integrity = Math.min(3, g.integrity + 1);
                g.score += 50;
                setIntegrity(g.integrity);
                setScore(g.score);
                gameAudio.playShieldChime();
              } else if (ent.kind === 'hazard' && g.shuttleY < 1.35 && g.invulnTimer <= 0) {
                ent.active = false;
                g.integrity -= 1;
                g.combo = 1;
                g.invulnTimer = 1.25;
                setIntegrity(g.integrity);
                setCombo(1);
                gameAudio.playCollisionHit();
                if (g.integrity <= 0) {
                  g.phase = 'gameover';
                  shuttleGroup.visible = true;
                  setPhase('gameover');
                }
              }
            }
          }

          if (ent.z > 9) {
            scene.remove(ent.group);
            entities.splice(i, 1);
          }
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    const handleResize = () => {
      if (!mountEl || disposed) return;
      const w = Math.max(mountEl.clientWidth, 320);
      const h = Math.max(mountEl.clientHeight, 360);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      clearEntities();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === mountEl) {
        mountEl.removeChild(renderer.domElement);
      }
    };
  }, []);

  const toggleFullscreen = () => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div
      ref={rootRef}
      className="relative h-[620px] w-full overflow-hidden rounded-xl border border-slate-800 bg-[#090f1d] select-none"
    >
      {/* Isolated Three.js Canvas Container (>= 85% unobstructed playfield) */}
      <div ref={mountRef} className="h-full w-full" />

      {/* Minimal Floating Top HUD Strip (zero backdrop-filter) */}
      <div className="pointer-events-none absolute inset-x-4 top-4 flex items-center justify-between gap-3">
        <div
          className="pointer-events-auto flex flex-wrap items-center gap-4 rounded-lg border border-slate-700/90 px-4 py-2 text-xs text-white"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)' }}
        >
          <div>
            <span className="text-slate-400">SCORE </span>
            <span className="font-mono text-sm font-bold tabular-nums text-amber-400">
              {score.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-slate-400">WAVE </span>
            <span className="font-mono font-bold tabular-nums text-sky-400">{wave}</span>
          </div>
          <div>
            <span className="text-slate-400">COMBO </span>
            <span className="font-mono font-bold tabular-nums text-emerald-400">x{combo}</span>
          </div>
          <div className="flex items-center gap-1">
            <Shield className="h-3.5 w-3.5 text-sky-400" />
            {[0, 1, 2].map((idx) => (
              <span
                key={idx}
                className={`inline-block h-2.5 w-4 rounded-sm ${
                  idx < integrity ? 'bg-sky-400' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            title={muted ? 'Unmute audio' : 'Mute audio'}
            className="rounded-lg border border-slate-700 p-2 text-slate-200 hover:text-white"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)' }}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {(phase === 'playing' || phase === 'paused') && (
            <button
              type="button"
              onClick={togglePause}
              title="Pause / Resume (Esc)"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-white"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)' }}
            >
              {phase === 'paused' ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              <span>{phase === 'paused' ? 'Resume' : 'Pause'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            title="Fullscreen"
            className="rounded-lg border border-slate-700 p-2 text-slate-200 hover:text-white"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)' }}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Touch / Mouse Controls at Bottom (compact) */}
      {phase === 'playing' && (
        <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 md:opacity-75">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftLane(-1)}
              aria-label="Steer Left"
              className="flex h-11 w-14 items-center justify-center rounded-lg border border-slate-700 text-white active:scale-95"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.88)' }}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => shiftLane(1)}
              aria-label="Steer Right"
              className="flex h-11 w-14 items-center justify-center rounded-lg border border-slate-700 text-white active:scale-95"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.88)' }}
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
          <button
            type="button"
            onClick={triggerJump}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-sky-500/60 px-4 text-xs font-bold text-sky-300 active:scale-95"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.88)' }}
          >
            <ArrowUp className="h-4 w-4" />
            <span>Boost Jump (Space)</span>
          </button>
        </div>
      )}

      {/* Title Screen Overlay */}
      {phase === 'title' && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div
            className="w-full max-w-md rounded-2xl border border-slate-700 p-7 text-center text-white"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.92)' }}
          >
            <div className="text-xs font-mono uppercase tracking-widest text-sky-400">
              Leads AI Arcade · Three.js 3D
            </div>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Nexus Data Surge</h2>
            <p className="mt-2 text-sm text-slate-300">
              Pilot the Leads Cyber-Shuttle across 3 data lanes. Collect golden diploma packets
              to reach <span className="font-mono font-bold text-amber-400">2,500</span> pts while
              dodging or jumping over crimson firewall hazards.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-slate-900/90 p-3 text-xs text-slate-300 text-left">
              <div>
                <span className="font-mono font-bold text-white">A / D</span> or{' '}
                <span className="font-mono font-bold text-white">← / →</span> Steer
              </div>
              <div>
                <span className="font-mono font-bold text-white">Space / W</span> Jump
              </div>
              <div>
                <span className="font-mono font-bold text-white">Esc / P</span> Pause
              </div>
              <div>
                <span className="font-mono font-bold text-amber-400">Best:</span>{' '}
                <span className="font-mono">{highScore.toLocaleString()}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={startNewGame}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-500"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Launch Mission</span>
            </button>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {phase === 'paused' && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-700 p-6 text-center text-white"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.94)' }}
          >
            <h3 className="text-xl font-bold">Simulation Paused</h3>
            <p className="mt-1 text-xs text-slate-400">
              Current Score: <span className="font-mono text-amber-400">{score.toLocaleString()}</span>
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={togglePause}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-500"
              >
                Resume Mission
              </button>
              <button
                type="button"
                onClick={startNewGame}
                className="w-full rounded-lg border border-slate-700 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Restart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory Modal */}
      {phase === 'victory' && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div
            className="w-full max-w-md rounded-2xl border border-emerald-500/60 p-7 text-center text-white"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)' }}
          >
            <Trophy className="mx-auto h-10 w-10 text-amber-400" />
            <h3 className="mt-3 text-2xl font-extrabold">Diploma Track Cleared!</h3>
            <p className="mt-1.5 text-sm text-slate-300">
              You synchronized <span className="font-mono font-bold text-amber-400">{score.toLocaleString()}</span>{' '}
              data points across the Nexus grid.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={continueEndless}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500"
              >
                Endless Surge
              </button>
              <button
                type="button"
                onClick={startNewGame}
                className="flex-1 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Play Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {phase === 'gameover' && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div
            className="w-full max-w-md rounded-2xl border border-rose-500/60 p-7 text-center text-white"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)' }}
          >
            <div className="text-xs font-mono uppercase tracking-widest text-rose-400">
              Shield Integrity Depleted
            </div>
            <h3 className="mt-2 text-2xl font-extrabold">Run Terminated</h3>
            <div className="mt-4 flex justify-center gap-8 border-y border-slate-800 py-3 font-mono">
              <div>
                <div className="text-[11px] text-slate-400">FINAL SCORE</div>
                <div className="text-xl font-bold text-amber-400">{score.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">HIGH SCORE</div>
                <div className="text-xl font-bold text-sky-400">{highScore.toLocaleString()}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={startNewGame}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-500"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Retry Mission</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
