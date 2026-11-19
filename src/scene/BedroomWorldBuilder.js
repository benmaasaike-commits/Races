import * as THREE from 'three';

function makeMat(color, roughness = 0.7, metalness = 0.0, emissive = null, emissiveIntensity = 0.0) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive: emissive || 0x000000,
    emissiveIntensity,
  });
}

function addBox(group, {
  size,
  position,
  color,
  roughness = 0.7,
  metalness = 0,
  radius = 0,
  castShadow = true,
  receiveShadow = true,
  name,
}) {
  const geo = radius > 0
    ? new THREE.ShapeGeometry(
        new THREE.Shape()
      )
    : new THREE.BoxGeometry(size[0], size[1], size[2]);

  const mesh = new THREE.Mesh(geo, makeMat(color, roughness, metalness));
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  if (name) mesh.name = name;
  group.add(mesh);
  return mesh;
}

function addRoundedBox(group, size, position, color, radius = 0.01, roughness = 0.7) {
  // Capsule-like visual approximation built from a box plus soft corner spheres.
  const root = new THREE.Group();
  root.position.set(...position);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    makeMat(color, roughness)
  );
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  const sphereGeo = new THREE.SphereGeometry(radius, 12, 8);
  const sphereMat = makeMat(color, roughness);
  const sx = Math.max(0, size[0] * 0.5 - radius);
  const sz = Math.max(0, size[2] * 0.5 - radius);
  for (const x of [-sx, sx]) {
    for (const z of [-sz, sz]) {
      const s = new THREE.Mesh(sphereGeo, sphereMat);
      s.position.set(x, 0, z);
      s.scale.y = Math.min(1, size[1] / Math.max(0.001, radius * 2));
      s.castShadow = true;
      s.receiveShadow = true;
      root.add(s);
    }
  }

  group.add(root);
  return root;
}

function addCylinder(group, radius, height, position, color, radialSegments = 20, rotation = null) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, radialSegments),
    makeMat(color, 0.75)
  );
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addToyBlock(group, position, size, color, rotationY = 0) {
  const block = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    makeMat(color, 0.58)
  );
  block.position.set(...position);
  block.rotation.y = rotationY;
  block.castShadow = true;
  block.receiveShadow = true;
  group.add(block);
  return block;
}

export function buildBedroomWorld({ scene, settings = {} } = {}) {
  const root = new THREE.Group();
  root.name = 'IndoorBedroomWorld';

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(1.22, 0.025, 0.82),
    makeMat(0x765844, 0.82)
  );
  floor.position.set(-0.04, -0.0125, 0.04);
  floor.receiveShadow = true;
  root.add(floor);

  // Back wall and two side boundaries keep the bedroom visibly enclosed.
  const wallMat = makeMat(0x9a8576, 0.92);
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.46, 0.025), wallMat);
  backWall.position.set(-0.04, 0.22, -0.37);
  backWall.receiveShadow = true;
  root.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.46, 0.76), wallMat);
  leftWall.position.set(-0.635, 0.22, 0.01);
  leftWall.receiveShadow = true;
  root.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.46, 0.76), wallMat);
  rightWall.position.set(0.555, 0.22, 0.01);
  rightWall.receiveShadow = true;
  root.add(rightWall);

  // Soft rug: a distinct lower-grip visual zone we will later map into surface physics.
  const rug = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.006, 0.36),
    makeMat(0x3d5366, 0.96)
  );
  rug.position.set(0.05, 0.003, 0.17);
  rug.receiveShadow = true;
  root.add(rug);

  // Bed, raised enough to read as a major landmark without blocking the first track.
  const bed = new THREE.Group();
  bed.name = 'BedroomBed';
  bed.position.set(0.12, 0, -0.235);

  const bedBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.075, 0.31),
    makeMat(0x4d3a2f, 0.84)
  );
  bedBase.position.y = 0.0375;
  bedBase.castShadow = true;
  bedBase.receiveShadow = true;
  bed.add(bedBase);

  const mattress = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.075, 0.28),
    makeMat(0xd8d1c8, 0.92)
  );
  mattress.position.set(0, 0.087, 0);
  mattress.castShadow = true;
  mattress.receiveShadow = true;
  bed.add(mattress);

  const blanket = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.018, 0.15),
    makeMat(0x3b7ea8, 0.88)
  );
  blanket.position.set(0, 0.126, 0.04);
  blanket.castShadow = true;
  bed.add(blanket);

  const pillowMat = makeMat(0xf4eee6, 0.95);
  for (const x of [-0.125, 0.125]) {
    const pillow = addRoundedBox(bed, [0.16, 0.055, 0.105], [x, 0.126, -0.082], 0xf4eee6, 0.024, 0.95);
    pillow.scale.set(1, 1, 0.92);
  }

  const headboard = new THREE.Mesh(
    new THREE.BoxGeometry(0.49, 0.20, 0.035),
    makeMat(0x5b4437, 0.84)
  );
  headboard.position.set(0, 0.15, -0.14);
  headboard.castShadow = true;
  bed.add(headboard);
  root.add(bed);

  // Nightstand + lamp.
  const nightstand = new THREE.Group();
  nightstand.position.set(-0.30, 0, -0.24);
  const nsBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.14, 0.13),
    makeMat(0x634b3c, 0.78)
  );
  nsBody.position.y = 0.07;
  nsBody.castShadow = true;
  nightstand.add(nsBody);
  addCylinder(nightstand, 0.018, 0.10, [0, 0.17, 0], 0xe8c67a, 16);
  addRoundedBox(nightstand, [0.07, 0.028, 0.06], [0, 0.235, 0], 0xffc76b, 0.012, 0.55);
  root.add(nightstand);

  // Bookshelf / toy storage.
  const shelf = new THREE.Group();
  shelf.position.set(0.43, 0, -0.20);
  const shelfMat = makeMat(0x382b24, 0.75);
  const posts = [
    [-0.07, 0.14, 0], [0.07, 0.14, 0],
    [-0.07, 0.14, 0.20], [0.07, 0.14, 0.20],
  ];
  for (const p of posts) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.28, 0.018), shelfMat);
    post.position.set(...p);
    post.castShadow = true;
    shelf.add(post);
  }
  for (const y of [0.02, 0.10, 0.18, 0.26]) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.016, 0.24), shelfMat);
    plank.position.set(0, y, 0.10);
    plank.castShadow = true;
    shelf.add(plank);
  }
  // Colorful toy books / boxes.
  const toyColors = [0xd94f4f, 0xf0b84f, 0x4d8bd8, 0x53b37a];
  for (let i = 0; i < 8; i++) {
    const row = i % 4;
    const layer = Math.floor(i / 4);
    addToyBlock(
      shelf,
      [-0.045 + row * 0.03, 0.037 + layer * 0.08, 0.10],
      [0.022, 0.055, 0.045],
      toyColors[i % toyColors.length],
      (i % 2 ? 0.08 : -0.05)
    );
  }
  root.add(shelf);

  // Pillow pile / soft obstacle area.
  const pillowPile = new THREE.Group();
  pillowPile.position.set(-0.42, 0.0, 0.12);
  const pileColors = [0xe3d9cf, 0xc6d4db, 0xd6bbab];
  for (let i = 0; i < 3; i++) {
    const p = addRoundedBox(
      pillowPile,
      [0.14 - i * 0.012, 0.07, 0.105],
      [i * 0.025, 0.036 + i * 0.035, i * 0.015],
      pileColors[i],
      0.026,
      0.92
    );
    p.rotation.z = (i - 1) * 0.08;
  }
  root.add(pillowPile);

  // Indoor stunt pieces: low ramp, book wedge and cardboard tunnel.
  const rampMat = makeMat(0xe44b3d, 0.55);
  const rampGeo = new THREE.BufferGeometry();
  rampGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([
      -0.07, 0.00, -0.14,
       0.07, 0.00, -0.14,
       0.07, 0.07,  0.14,
      -0.07, 0.07,  0.14,
      -0.07, 0.00, -0.14,
       0.07, 0.00, -0.14,
    ], 3)
  );
  rampGeo.computeVertexNormals();
  const ramp = new THREE.Mesh(rampGeo, rampMat);
  ramp.position.set(-0.12, 0.003, 0.235);
  ramp.rotation.y = -0.20;
  ramp.castShadow = true;
  ramp.receiveShadow = true;
  root.add(ramp);

  const cardboardTunnel = new THREE.Mesh(
    new THREE.TorusGeometry(0.07, 0.025, 10, 20, Math.PI),
    makeMat(0xb67a43, 0.88)
  );
  cardboardTunnel.rotation.z = Math.PI / 2;
  cardboardTunnel.rotation.y = Math.PI / 2;
  cardboardTunnel.scale.y = 1.35;
  cardboardTunnel.position.set(0.17, 0.068, 0.02);
  cardboardTunnel.castShadow = true;
  root.add(cardboardTunnel);

  // A tiny "toy room" clutter field.
  const clutter = new THREE.Group();
  clutter.name = 'BedroomToyClutter';
  const clutterData = [
    [[-0.54, 0.012, -0.08], [0.08, 0.024, 0.12], 0x7d4f36, 0.12],
    [[0.43, 0.012, 0.13], [0.11, 0.024, 0.07], 0x4f73a7, -0.08],
    [[-0.21, 0.012, 0.24], [0.07, 0.024, 0.07], 0xcf874e, 0.20],
    [[0.30, 0.012, 0.25], [0.12, 0.024, 0.06], 0x59a86a, -0.10],
  ];
  for (const [pos, size, color, rot] of clutterData) {
    addToyBlock(clutter, pos, size, color, rot);
  }
  root.add(clutter);

  // Warm bedside light + cool room fill for a toy-photography look.
  const key = new THREE.PointLight(0xffc26b, 1.15, 1.4, 2.0);
  key.position.set(-0.30, 0.23, -0.20);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  root.add(key);

  const fill = new THREE.PointLight(0x9fc7ff, 0.45, 1.6, 2.0);
  fill.position.set(0.35, 0.28, 0.26);
  root.add(fill);

  // Soft ceiling practical.
  const ceilingGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 16, 10),
    new THREE.MeshBasicMaterial({
      color: 0xffe6b0,
      toneMapped: false,
    })
  );
  ceilingGlow.position.set(-0.10, 0.42, -0.03);
  root.add(ceilingGlow);

  // Give the room builder a future surface metadata map.
  root.userData.surfaceZones = [
    { id: 'wood', center: [0, 0.001, 0.04], size: [1.18, 0.78], grip: 0.84, speed: 1.0 },
    { id: 'carpet', center: [0.05, 0.005, 0.17], size: [0.62, 0.36], grip: 1.08, speed: 0.72 },
    { id: 'bed-fabric', center: [0.12, 0.13, -0.235], size: [0.45, 0.28], grip: 0.96, speed: 0.62 },
  ];

  if (settings && settings.indoorBedroom) {
    root.userData.indoorBedroom = true;
  }

  return {
    root,
    surfaceZones: root.userData.surfaceZones,
  };
}

/**
 * Adds a toy-scale beach-buggy visual kit to the existing micro vehicle.
 * The existing physics/controls remain unchanged for the prototype.
 */
export function applyBeachBuggyStyle(microKart) {
  if (!microKart || !microKart.kartRoot || microKart.kartRoot.userData.beachBuggyStyled) {
    return microKart;
  }

  const body = microKart.chassisGroup || microKart.kartRoot;
  const root = new THREE.Group();
  root.name = 'BeachBuggyStyleKit';
  root.userData.prototype = true;

  const cageMat = makeMat(0x161a1e, 0.42, 0.45);
  const trimMat = makeMat(0xffc34d, 0.38, 0.18);
  const bumperMat = makeMat(0x252a2f, 0.6, 0.35);

  // Wide front bumper.
  const bumper = new THREE.Mesh(
    new THREE.BoxGeometry(0.0105, 0.0013, 0.0012),
    bumperMat
  );
  bumper.position.set(0, 0.0020, 0.0090);
  bumper.castShadow = true;
  root.add(bumper);

  // Skid plate.
  const skid = new THREE.Mesh(
    new THREE.BoxGeometry(0.0078, 0.00055, 0.0085),
    makeMat(0x34393e, 0.5, 0.55)
  );
  skid.position.set(0, 0.0010, 0.0012);
  root.add(skid);

  // Roll cage from two side hoops + roof bar.
  const createTube = (points, radius) => {
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, 16, radius, 8, false);
    const mesh = new THREE.Mesh(geo, cageMat);
    mesh.castShadow = true;
    return mesh;
  };

  root.add(createTube([
    new THREE.Vector3(-0.0048, 0.0041, -0.0044),
    new THREE.Vector3(-0.0047, 0.0081, -0.0015),
    new THREE.Vector3(-0.0046, 0.0065, 0.0042),
  ], 0.00034));

  root.add(createTube([
    new THREE.Vector3(0.0048, 0.0041, -0.0044),
    new THREE.Vector3(0.0047, 0.0081, -0.0015),
    new THREE.Vector3(0.0046, 0.0065, 0.0042),
  ], 0.00034));

  const roofBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.00034, 0.00034, 0.0094, 8),
    cageMat
  );
  roofBar.rotation.z = Math.PI / 2;
  roofBar.position.set(0, 0.0080, -0.0015);
  root.add(roofBar);

  // Toy-style front light bar.
  const lightBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.0078, 0.0007, 0.00055),
    trimMat
  );
  lightBar.position.set(0, 0.0077, 0.0044);
  root.add(lightBar);

  for (const x of [-0.0026, 0, 0.0026]) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.00042, 10, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffe9af,
        toneMapped: false,
      })
    );
    lamp.position.set(x, 0.0080, 0.0046);
    root.add(lamp);
  }

  // Chunky tire-effect rings around the existing wheel locations.
  for (const [x, z, scale] of [
    [-0.0057, 0.0054, 1.08],
    [0.0057, 0.0054, 1.08],
    [-0.0060, -0.0054, 1.16],
    [0.0060, -0.0054, 1.16],
  ]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.0020 * scale, 0.00030 * scale, 8, 16),
      bumperMat
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.set(x, 0.0020, z);
    ring.scale.z = 1.15;
    root.add(ring);
  }

  // Small rear engine grille.
  for (let i = -2; i <= 2; i++) {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.00045, 0.0014, 0.0028),
      cageMat
    );
    fin.position.set(i * 0.0010, 0.0050, -0.0062);
    root.add(fin);
  }

  body.add(root);
  microKart.kartRoot.userData.beachBuggyStyled = true;
  microKart.kartRoot.userData.beachBuggyStyleRoot = root;

  return microKart;
}
