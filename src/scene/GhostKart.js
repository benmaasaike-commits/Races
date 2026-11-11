import * as THREE from 'three';

/**
 * Builds the Semi-Transparent Ghost Kart Opponent.
 * Displays the player's recorded best lap as a translucent, luminous holographic
 * rival kart on subsequent laps.
 */
export function buildGhostKart() {
  const ghostRoot = new THREE.Group();
  ghostRoot.name = 'GhostKartRoot';
  ghostRoot.visible = false;

  const chassisGroup = new THREE.Group();
  chassisGroup.name = 'GhostChassisBody';
  ghostRoot.add(chassisGroup);

  // Holographic semi-transparent cyan materials
  const ghostBodyMat = new THREE.MeshStandardMaterial({
    color: 0x00e8ff,
    emissive: 0x007799,
    emissiveIntensity: 0.6,
    roughness: 0.15,
    metalness: 0.4,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const ghostAccentMat = new THREE.MeshStandardMaterial({
    color: 0xa8f6ff,
    emissive: 0x00e5ff,
    emissiveIntensity: 1.1,
    roughness: 0.1,
    metalness: 0.2,
    transparent: true,
    opacity: 0.60,
    depthWrite: false,
    toneMapped: false,
  });

  const ghostDarkMat = new THREE.MeshStandardMaterial({
    color: 0x00384d,
    emissive: 0x001d29,
    emissiveIntensity: 0.35,
    roughness: 0.4,
    metalness: 0.6,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });

  const ghostWheelMat = new THREE.MeshStandardMaterial({
    color: 0x002838,
    emissive: 0x00d8ff,
    emissiveIntensity: 0.45,
    roughness: 0.3,
    metalness: 0.5,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });

  // Soft cyan holographic aura plane underneath the ghost kart
  const auraCanvas = document.createElement('canvas');
  auraCanvas.width = 128;
  auraCanvas.height = 128;
  const aCtx = auraCanvas.getContext('2d');
  aCtx.clearRect(0, 0, 128, 128);
  const aGrad = aCtx.createRadialGradient(64, 64, 4, 64, 64, 60);
  aGrad.addColorStop(0.0, 'rgba(0, 240, 255, 0.75)');
  aGrad.addColorStop(0.4, 'rgba(0, 210, 255, 0.35)');
  aGrad.addColorStop(0.8, 'rgba(0, 180, 255, 0.10)');
  aGrad.addColorStop(1.0, 'rgba(0, 150, 255, 0.0)');
  aCtx.fillStyle = aGrad;
  aCtx.beginPath();
  aCtx.arc(64, 64, 60, 0, Math.PI * 2);
  aCtx.fill();

  const auraTexture = new THREE.CanvasTexture(auraCanvas);
  const auraPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.022, 0.028),
    new THREE.MeshBasicMaterial({
      map: auraTexture,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
    })
  );
  auraPlane.rotation.x = -Math.PI / 2;
  auraPlane.position.set(0, 0.0006, 0);
  ghostRoot.add(auraPlane);

  // 1. Procedural Ghost Kart Parts (18mm x 12mm HO scale)
  const floorPan = new THREE.Mesh(
    new THREE.BoxGeometry(0.0082, 0.0009, 0.0155),
    ghostDarkMat
  );
  floorPan.position.set(0, 0.0014, 0);
  chassisGroup.add(floorPan);

  const noseCone = new THREE.Mesh(
    new THREE.BoxGeometry(0.0086, 0.0021, 0.0044),
    ghostBodyMat
  );
  noseCone.position.set(0, 0.0023, 0.0068);
  noseCone.rotation.x = 0.22;
  chassisGroup.add(noseCone);

  const numberPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.0048, 0.0004, 0.0028),
    ghostAccentMat
  );
  numberPlate.position.set(0, 0.0033, 0.0066);
  numberPlate.rotation.x = 0.22;
  chassisGroup.add(numberPlate);

  // Side Pods
  for (const sx of [-0.0044, 0.0044]) {
    const sidePod = new THREE.Mesh(
      new THREE.BoxGeometry(0.0024, 0.0024, 0.0076),
      ghostBodyMat
    );
    sidePod.position.set(sx, 0.0024, -0.0004);
    chassisGroup.add(sidePod);
  }

  // Engine block & Rear wing
  const engineBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.0034, 0.0036, 0.0042),
    ghostDarkMat
  );
  engineBlock.position.set(0.0022, 0.0036, -0.0048);
  chassisGroup.add(engineBlock);

  const rearWing = new THREE.Mesh(
    new THREE.BoxGeometry(0.0096, 0.0007, 0.0024),
    ghostAccentMat
  );
  rearWing.position.set(0, 0.0068, -0.0076);
  rearWing.rotation.x = -0.18;
  chassisGroup.add(rearWing);

  // Driver torso & Helmet
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.0036, 0.0038, 0.0028),
    ghostBodyMat
  );
  torso.position.set(0, 0.0048, -0.0008);
  torso.rotation.x = 0.14;
  chassisGroup.add(torso);

  const driverHead = new THREE.Group();
  driverHead.position.set(0, 0.0078, -0.0004);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.0022, 16, 14),
    ghostBodyMat
  );
  helmet.scale.set(0.95, 1.0, 1.08);
  driverHead.add(helmet);

  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.00225, 14, 10, -0.9, 1.8, 1.05, 0.75),
    ghostAccentMat
  );
  visor.rotation.y = Math.PI / 2;
  driverHead.add(visor);
  chassisGroup.add(driverHead);

  // Wheels
  const frontPivots = [];
  const wheelMeshes = [];

  function createGhostWheel(isRear = false) {
    const wRadius = isRear ? 0.00215 : 0.00185;
    const wWidth = isRear ? 0.0022 : 0.0017;
    const wGroup = new THREE.Group();

    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(wRadius, wRadius, wWidth, 16),
      ghostWheelMat
    );
    tire.rotation.z = Math.PI / 2;
    wGroup.add(tire);
    return wGroup;
  }

  for (const sx of [-0.0056, 0.0056]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.00185, 0.0054);
    const wheel = createGhostWheel(false);
    pivot.add(wheel);
    chassisGroup.add(pivot);
    frontPivots.push(pivot);
    wheelMeshes.push(wheel);
  }

  for (const sx of [-0.0059, 0.0059]) {
    const wheel = createGhostWheel(true);
    wheel.position.set(sx, 0.00215, -0.0054);
    chassisGroup.add(wheel);
    wheelMeshes.push(wheel);
  }

  const proceduralParts = [
    floorPan,
    noseCone,
    numberPlate,
    engineBlock,
    rearWing,
    torso,
    driverHead,
    ...frontPivots,
    wheelMeshes[2],
    wheelMeshes[3],
  ];

  let attachedGlbScene = null;

  /**
   * Clones and attaches the GLB kart model with semi-transparent cyan holographic shaders
   */
  function attachGlbKart(glbScene) {
    if (!glbScene) return;
    const clone = glbScene.clone(true);
    attachedGlbScene = clone;
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);

    for (const part of proceduralParts) {
      if (part) part.visible = false;
    }

    const glbFrontWheels = [];
    const glbAllWheels = [];

    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;

        const origMats = Array.isArray(child.material) ? child.material : [child.material];
        const newMats = origMats.map((m) => {
          const name = (m && m.name ? m.name : '').toLowerCase();
          const isAccent = name.includes('white') || name.includes('gold') || name.includes('visor') || name.includes('headlight');
          const isDark = name.includes('suit') || name.includes('tire') || name.includes('rubber');

          return new THREE.MeshStandardMaterial({
            color: isAccent ? 0x90f0ff : isDark ? 0x004058 : 0x00e5ff,
            emissive: isAccent ? 0x00d4ff : 0x004d66,
            emissiveIntensity: isAccent ? 1.0 : 0.5,
            roughness: 0.18,
            metalness: 0.45,
            transparent: true,
            opacity: isAccent ? 0.55 : 0.40,
            depthWrite: false,
            side: THREE.DoubleSide,
            toneMapped: false,
          });
        });

        child.material = Array.isArray(child.material) ? newMats : newMats[0];
      }

      if (child.name === 'Wheel_FL' || child.name === 'Wheel_FR') {
        glbFrontWheels.push(child);
        glbAllWheels.push(child);
      } else if (child.name === 'Wheel_RL' || child.name === 'Wheel_RR') {
        glbAllWheels.push(child);
      }
    });

    chassisGroup.add(clone);

    if (glbAllWheels.length > 0) {
      wheelMeshes.push(...glbAllWheels);
    }
    if (glbFrontWheels.length > 0) {
      frontPivots.push(...glbFrontWheels);
    }
  }

  /**
   * Updates the 3D ghost pose from the interpolated GhostManager frame
   */
  function updatePose(ghostPose, dt) {
    if (!ghostPose || !ghostPose.visible) {
      ghostRoot.visible = false;
      return;
    }

    ghostRoot.visible = true;
    ghostRoot.position.copy(ghostPose.position);
    ghostRoot.quaternion.copy(ghostPose.quaternion);

    // Spin wheels
    const wheelSpinDelta = (ghostPose.speed / 0.002) * dt;
    for (const w of wheelMeshes) {
      w.rotation.x += wheelSpinDelta;
    }

    // Steer front wheels
    const steerRad = THREE.MathUtils.clamp(ghostPose.steerAngle || 0, -0.52, 0.52);
    for (const p of frontPivots) {
      p.rotation.y = THREE.MathUtils.lerp(p.rotation.y, steerRad, Math.min(1, dt * 16));
    }

    // Apply drift angle & subtle holographic shimmer
    chassisGroup.rotation.y = THREE.MathUtils.lerp(
      chassisGroup.rotation.y,
      ghostPose.driftAngle || 0.0,
      Math.min(1, dt * 14)
    );

    // Subtle breathing pulse for holographic presence
    const pulse = 0.40 + 0.08 * Math.sin(performance.now() * 0.005);
    ghostBodyMat.opacity = pulse;
    auraPlane.material.opacity = pulse * 1.1;
  }

  function setScale(s) {
    ghostRoot.scale.setScalar(s);
  }

  return {
    ghostRoot,
    chassisGroup,
    attachGlbKart,
    updatePose,
    setScale,
    setVisible: (v) => {
      ghostRoot.visible = Boolean(v);
    },
  };
}
