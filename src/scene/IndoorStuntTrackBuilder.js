import * as THREE from 'three';

const DEFAULT_CONTROL_POINTS = [
  [ 0.48, 0.018, 0.28 ],
  [ 0.50, 0.020, 0.07 ],
  [ 0.42, 0.045, -0.05 ],
  [ 0.28, 0.105, -0.10 ],
  [ 0.10, 0.155, -0.12 ],
  [-0.08, 0.168, -0.10 ],
  [-0.24, 0.135, -0.03 ],
  [-0.40, 0.060,  0.02 ],
  [-0.48, 0.028,  0.14 ],
  [-0.40, 0.018,  0.25 ],
  [-0.20, 0.022,  0.30 ],
  [ 0.04, 0.024,  0.30 ],
  [ 0.28, 0.023,  0.30 ],
  [ 0.45, 0.021,  0.30 ],
];

function sampleClosedSpline(controlPoints, sampleCount = 720, options = {}) {
  const controls = controlPoints.map((p) => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(controls, true, 'catmullrom', 0.5);
  const points = curve.getPoints(sampleCount - 1);
  const samples = [];
  let totalLength = 0.0;

  for (let i = 0; i < sampleCount; i++) {
    const p = points[i];
    const prev = points[(i - 1 + sampleCount) % sampleCount];
    const next = points[(i + 1) % sampleCount];

    const tangent = next.clone().sub(prev).normalize();
    const normal = new THREE.Vector3(0, 1, 0);
    const right = tangent.clone().cross(normal).normalize();

    if (right.lengthSq() < 1e-8) {
      right.set(1, 0, 0);
    }

    if (i > 0) {
      totalLength += p.distanceTo(points[i - 1]);
    }

    const progress = i / sampleCount;
    const surface = typeof options.surfaceByProgress === 'function'
      ? options.surfaceByProgress(progress)
      : (progress > 0.36 && progress < 0.56 ? 'bed-fabric' : 'plastic');
    const jumpLaunch = typeof options.jumpByProgress === 'function'
      ? THREE.MathUtils.clamp(Number(options.jumpByProgress(progress)) || 0, 0, 1)
      : 0;

    samples.push({
      index: i,
      t: progress,
      sector: Math.min(6, Math.floor(progress * 6) + 1),
      position: [p.x, p.y, p.z],
      tangent: [tangent.x, tangent.y, tangent.z],
      right: [right.x, right.y, right.z],
      normal: [normal.x, normal.y, normal.z],
      bank_deg: 0,
      arc_length_m: totalLength,
      surface,
      jump_zone: jumpLaunch > 0 ? 1 : 0,
      jump_launch: jumpLaunch,
    });
  }

  // Close the arc length table by using the average spacing at the seam.
  const seamLength = points[0].distanceTo(points[sampleCount - 1]);
  const adjustedTotalLength = totalLength + seamLength;
  for (const sample of samples) {
    sample.arc_length_m *= adjustedTotalLength / Math.max(1e-6, totalLength);
  }

  return {
    name: options.name || 'Indoor Beach Buggy Stunt Circuit',
    is_closed_periodic_loop: true,
    track_width_m: 0.024,
    curb_width_m: 0.0022,
    rail_height_m: 0.0025,
    total_length_m: adjustedTotalLength,
    scale_equivalent_length_m: adjustedTotalLength * 87,
    num_control_points: controlPoints.length,
    num_samples: sampleCount,
    sectors: options.sectors || [
      { id: 1, name: 'Launch' },
      { id: 2, name: 'Climb' },
      { id: 3, name: 'Drop' },
      { id: 4, name: 'Sweep' },
      { id: 5, name: 'Stunt Run' },
      { id: 6, name: 'Start / Finish' },
    ],
    control_points: controlPoints.map((p, i) => [...p, 0, Math.min(6, Math.floor(i * 6 / controlPoints.length) + 1)]),
    samples,
  };
}

function makePlasticMaterial(color, roughness = 0.48, metalness = 0.05) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
}

function buildRibbonGeometry(splineData) {
  const samples = splineData.samples;
  const halfWidth = splineData.track_width_m * 0.5;
  const positions = new Float32Array(samples.length * 2 * 3);
  const normals = new Float32Array(samples.length * 2 * 3);
  const uvs = new Float32Array(samples.length * 2 * 2);
  const indices = [];

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const base = i * 2;
    for (let side = 0; side < 2; side++) {
      const offset = side === 0 ? -halfWidth : halfWidth;
      const px = s.position[0] + s.right[0] * offset;
      const py = s.position[1] + s.right[1] * offset + 0.0008;
      const pz = s.position[2] + s.right[2] * offset;
      const vi = (base + side) * 3;
      positions[vi] = px;
      positions[vi + 1] = py;
      positions[vi + 2] = pz;
      normals[vi] = s.normal[0];
      normals[vi + 1] = s.normal[1];
      normals[vi + 2] = s.normal[2];

      const ui = (base + side) * 2;
      uvs[ui] = side;
      uvs[ui + 1] = s.arc_length_m / 0.12;
    }

    const next = ((i + 1) % samples.length) * 2;
    indices.push(base, next, base + 1);
    indices.push(base + 1, next, next + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function addRail(group, splineData, side = -1) {
  const samples = splineData.samples;
  const points = samples.map((s) =>
    new THREE.Vector3(
      s.position[0] + s.right[0] * side * (splineData.track_width_m * 0.54),
      s.position[1] + 0.0032,
      s.position[2] + s.right[2] * side * (splineData.track_width_m * 0.54)
    )
  );
  points.push(points[0].clone());
  const curve = new THREE.CatmullRomCurve3(points, false);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, samples.length, 0.00055, 8, false),
    makePlasticMaterial(side < 0 ? 0xff684d : 0x4bb7ff, 0.42, 0.08)
  );
  tube.castShadow = true;
  tube.receiveShadow = true;
  group.add(tube);
}

function addStartGate(group, splineData) {
  const s = splineData.samples[0];
  const root = new THREE.Group();
  const tangent = new THREE.Vector3(...s.tangent).normalize();
  const right = new THREE.Vector3(...s.right).normalize();

  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.0035, 0.052, 0.0035),
      makePlasticMaterial(0x20252b, 0.42, 0.15)
    );
    post.position.set(
      s.position[0] + right.x * side * 0.016,
      s.position[1] + 0.028,
      s.position[2] + right.z * side * 0.016
    );
    post.castShadow = true;
    root.add(post);
  }

  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(0.038, 0.0048, 0.0042),
    makePlasticMaterial(0xffb23f, 0.36, 0.12)
  );
  bar.position.set(s.position[0], s.position[1] + 0.053, s.position[2]);
  bar.rotation.y = Math.atan2(tangent.x, tangent.z);
  bar.castShadow = true;
  root.add(bar);

  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(0.012, 0.0028, 0.0022),
    makePlasticMaterial(0xffffff, 0.45, 0.0)
  );
  flag.position.set(s.position[0], s.position[1] + 0.052, s.position[2]);
  flag.rotation.y = bar.rotation.y;
  root.add(flag);

  group.add(root);
}

function addBoostPads(group, splineData) {
  for (const sampleIndex of [48, 355, 610]) {
    const s = splineData.samples[sampleIndex];
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(splineData.track_width_m * 0.72, 0.0009, 0.012),
      new THREE.MeshStandardMaterial({
        color: 0x38d7ff,
        emissive: 0x0c9dff,
        emissiveIntensity: 0.9,
        roughness: 0.4,
        metalness: 0.05,
      })
    );
    pad.position.set(s.position[0], s.position[1] + 0.0014, s.position[2]);
    pad.rotation.y = Math.atan2(s.tangent[0], s.tangent[2]);
    pad.castShadow = false;
    group.add(pad);
  }
}

export function createIndoorStuntSplineData(controlPoints, options = {}) {
  return sampleClosedSpline(controlPoints, options.sampleCount || 720, options);
}

export function createBedroomStuntSplineData() {
  return createIndoorStuntSplineData(DEFAULT_CONTROL_POINTS, {
    name: 'Bedroom Indoor Beach Buggy Stunt Circuit',
    jumpByProgress: (p) => (p > 0.045 && p < 0.095 ? 0.90 : 0),
    surfaceByProgress: (p) => {
      if (p > 0.36 && p < 0.56) return 'bed-fabric';
      if (p > 0.72 && p < 0.88) return 'wood';
      return 'plastic';
    },
  });
}

export function buildIndoorStuntTrack(splineData) {
  const trackGroup = new THREE.Group();
  trackGroup.name = 'BedroomIndoorStuntTrack';

  const roadGeo = buildRibbonGeometry(splineData);
  const road = new THREE.Mesh(
    roadGeo,
    makePlasticMaterial(0xe43f38, 0.38, 0.08)
  );
  road.name = 'BedroomPlasticRoad';
  road.castShadow = true;
  road.receiveShadow = true;
  trackGroup.add(road);

  // Alternating toy curb blocks.
  const curbGroup = new THREE.Group();
  curbGroup.name = 'ToyTrackCurbs';
  const curbMatA = makePlasticMaterial(0xfff3df, 0.42);
  const curbMatB = makePlasticMaterial(0x1d80ff, 0.42);
  for (let i = 0; i < splineData.samples.length; i += 10) {
    const s = splineData.samples[i];
    const tangent = new THREE.Vector3(...s.tangent);
    const right = new THREE.Vector3(...s.right);
    const angle = Math.atan2(tangent.x, tangent.z);
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(
        new THREE.BoxGeometry(0.0036, 0.0016, 0.006),
        (i / 10) % 2 === 0 ? curbMatA : curbMatB
      );
      curb.position.set(
        s.position[0] + right.x * side * 0.0138,
        s.position[1] + 0.0020,
        s.position[2] + right.z * side * 0.0138
      );
      curb.rotation.y = angle;
      curb.castShadow = true;
      curbGroup.add(curb);
    }
  }
  trackGroup.add(curbGroup);

  addRail(trackGroup, splineData, -1);
  addRail(trackGroup, splineData, 1);
  addStartGate(trackGroup, splineData);
  addBoostPads(trackGroup, splineData);

  const stuntMarkers = new THREE.Group();
  stuntMarkers.name = 'StuntTrackMarkers';
  // A visible checkpoint flag near the bedroom rug.
  const flagPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.0018, 0.034, 0.0018),
    makePlasticMaterial(0x252a30, 0.48)
  );
  flagPost.position.set(-0.31, 0.02, 0.17);
  flagPost.castShadow = true;
  stuntMarkers.add(flagPost);

  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.012, 0.006),
    new THREE.MeshBasicMaterial({ color: 0xffce52, side: THREE.DoubleSide })
  );
  flag.position.set(-0.304, 0.035, 0.17);
  flag.rotation.y = Math.PI * 0.12;
  stuntMarkers.add(flag);
  trackGroup.add(stuntMarkers);

  return {
    trackGroup,
    underTrackLedGroup: new THREE.Group(),
    updateUnderTrackLed: () => {},
    setF1StartLights: () => {},
    roadGeo,
    debugGroup: new THREE.Group(),
  };
}
