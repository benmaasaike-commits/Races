import * as THREE from 'three';

function mat(color, roughness = 0.8, metalness = 0.0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(group, size, position, color, roughness = 0.8, rotationY = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat(color, roughness));
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function softBox(group, size, position, color, radius = 0.03, roughness = 0.92) {
  const root = new THREE.Group();
  root.position.set(...position);
  const body = new THREE.Mesh(new THREE.BoxGeometry(...size), mat(color, roughness));
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);
  const r = Math.min(radius, Math.min(size[0], size[1], size[2]) * 0.45);
  const sphereGeo = new THREE.SphereGeometry(r, 12, 8);
  const sphereMat = mat(color, roughness);
  const sx = Math.max(0, size[0] * 0.5 - r);
  const sz = Math.max(0, size[2] * 0.5 - r);
  for (const x of [-sx, sx]) {
    for (const z of [-sz, sz]) {
      const corner = new THREE.Mesh(sphereGeo, sphereMat);
      corner.position.set(x, 0, z);
      corner.scale.y = Math.max(0.55, size[1] / (r * 2));
      corner.castShadow = true;
      corner.receiveShadow = true;
      root.add(corner);
    }
  }
  group.add(root);
  return root;
}

function cylinder(group, radius, height, position, color, segments = 20) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), mat(color, 0.74));
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addRoomShell(root, width, depth, wallColor, floorColor) {
  const floor = box(root, [width, 0.025, depth], [0, -0.0125, 0], floorColor, 0.9);
  floor.receiveShadow = true;
  const wall = mat(wallColor, 0.94);

  const back = new THREE.Mesh(new THREE.BoxGeometry(width, 0.50, 0.025), wall);
  back.position.set(0, 0.25, -depth * 0.5);
  back.receiveShadow = true;
  root.add(back);

  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.50, depth), wall);
    panel.position.set(side * width * 0.5, 0.25, 0);
    panel.receiveShadow = true;
    root.add(panel);
  }

  return floor;
}

function addWarmCoolLights(root, warmPosition, coolPosition) {
  const warm = new THREE.PointLight(0xffc26b, 1.25, 1.9, 2.0);
  warm.position.set(...warmPosition);
  warm.castShadow = true;
  warm.shadow.mapSize.set(512, 512);
  root.add(warm);

  const cool = new THREE.PointLight(0x9fc7ff, 0.42, 2.2, 2.0);
  cool.position.set(...coolPosition);
  root.add(cool);
}

function makePhysicsManifest(width, depth, start, objects) {
  return {
    world_bounds_m: { width, depth, floor_y: 0.0 },
    start_finish_xyz: start,
    desk_objects: objects,
  };
}

function livingRoomBuilder() {
  const root = new THREE.Group();
  root.name = 'IndoorLivingRoomWorld';
  addRoomShell(root, 1.55, 1.02, 0x8e8277, 0x765c47);

  const rug = box(root, [0.76, 0.006, 0.48], [0.02, 0.003, 0.15], 0x4d6273, 0.98);
  rug.receiveShadow = true;

  // Sofa
  const sofa = new THREE.Group();
  sofa.position.set(0.03, 0, -0.25);
  box(sofa, [0.76, 0.11, 0.26], [0, 0.055, 0], 0x5c3f34, 0.86);
  softBox(sofa, [0.74, 0.10, 0.24], [0, 0.14, 0.0], 0x9a7764, 0.045);
  box(sofa, [0.77, 0.28, 0.05], [0, 0.24, -0.11], 0x6a4b3f, 0.88);
  for (const x of [-0.23, -0.07, 0.09, 0.25]) {
    softBox(sofa, [0.13, 0.055, 0.12], [x, 0.18, 0.035], 0xc2aa97, 0.025);
  }
  root.add(sofa);

  // Coffee table and toy ramp.
  box(root, [0.52, 0.055, 0.25], [0.02, 0.105, 0.05], 0x6f4d32, 0.78);
  for (const x of [-0.21, 0.21]) {
    for (const z of [-0.08, 0.08]) {
      cylinder(root, 0.018, 0.10, [0.02 + x, 0.055, 0.05 + z], 0x4b3324, 14);
    }
  }

  const throwPillow = softBox(root, [0.16, 0.065, 0.12], [-0.32, 0.04, 0.08], 0xd6b89f, 0.028);
  throwPillow.rotation.z = 0.12;
  const floorToy = box(root, [0.12, 0.035, 0.08], [0.40, 0.017, 0.30], 0x4c91d8, 0.55, -0.18);
  floorToy.castShadow = true;

  // TV console / shelves.
  box(root, [0.66, 0.10, 0.08], [-0.35, 0.05, 0.41], 0x3c3028, 0.78);
  box(root, [0.10, 0.20, 0.06], [-0.60, 0.10, 0.41], 0x2a2420, 0.55);
  box(root, [0.10, 0.20, 0.06], [-0.10, 0.10, 0.41], 0x2a2420, 0.55);
  const tv = box(root, [0.56, 0.30, 0.025], [-0.35, 0.30, 0.40], 0x15181c, 0.34, 0);
  const screenGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.49, 0.23),
    new THREE.MeshBasicMaterial({ color: 0x2d74c8, toneMapped: false })
  );
  screenGlow.position.set(-0.35, 0.31, 0.386);
  root.add(screenGlow);

  // Lamp and side table.
  box(root, [0.13, 0.11, 0.13], [0.55, 0.055, -0.22], 0x5b4436, 0.78);
  cylinder(root, 0.016, 0.11, [0.55, 0.18, -0.22], 0xe8c67a, 16);
  softBox(root, [0.075, 0.035, 0.07], [0.55, 0.245, -0.22], 0xffc76b, 0.015, 0.55);

  addWarmCoolLights(root, [0.55, 0.26, -0.22], [-0.45, 0.40, 0.30]);

  return {
    root,
    physicsManifest: makePhysicsManifest(1.55, 1.02, [0.62, 0.018, 0.34], [
      { id: 'sofa', center_xyz: [0.03, 0, -0.25], dimensions_wdh: [0.80, 0.27, 0.29] },
      { id: 'coffee_table', center_xyz: [0.02, 0, 0.05], dimensions_wdh: [0.52, 0.25, 0.16] },
      { id: 'tv_console', center_xyz: [-0.35, 0, 0.41], dimensions_wdh: [0.66, 0.08, 0.10] },
      { id: 'side_table', center_xyz: [0.55, 0, -0.22], dimensions_wdh: [0.13, 0.13, 0.11] },
    ]),
  };
}

function kitchenBuilder() {
  const root = new THREE.Group();
  root.name = 'IndoorKitchenWorld';
  addRoomShell(root, 1.55, 1.02, 0x8b8d86, 0xa2a19b);

  // Tile grid.
  for (let x = -0.55; x <= 0.55; x += 0.22) {
    for (let z = -0.30; z <= 0.36; z += 0.22) {
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(0.21, 0.001, 0.21),
        mat(((Math.round((x + 0.55) / 0.22) + Math.round((z + 0.30) / 0.22)) % 2) ? 0xd4d5cf : 0xbec0b8, 0.95)
      );
      tile.position.set(x, 0.001, z);
      tile.receiveShadow = true;
      root.add(tile);
    }
  }

  // Counter run and island.
  box(root, [0.24, 0.16, 0.76], [0.56, 0.08, 0.02], 0x62564b, 0.73);
  box(root, [0.24, 0.025, 0.76], [0.56, 0.175, 0.02], 0xe7dfd0, 0.68);
  box(root, [0.52, 0.12, 0.24], [-0.02, 0.06, -0.10], 0x5f5247, 0.72);
  box(root, [0.52, 0.025, 0.24], [-0.02, 0.132, -0.10], 0xe8e0d3, 0.60);

  // Mugs/bowls as oversized track landmarks.
  for (const [x, z, c] of [[-0.18,-0.10,0xd34f42],[0.04,-0.10,0x4b89c7],[0.56,-0.20,0xf0b64a]]) {
    cylinder(root, 0.022, 0.028, [x, 0.15, z], c, 18);
  }

  // Dining table and two chairs.
  box(root, [0.42, 0.055, 0.25], [-0.30, 0.105, 0.29], 0x805a3c, 0.78);
  for (const x of [-0.46, -0.14]) {
    box(root, [0.07, 0.09, 0.07], [x, 0.045, 0.29], 0x523a2b, 0.78);
  }

  // Fridge / cabinet wall.
  box(root, [0.20, 0.38, 0.18], [-0.56, 0.19, -0.30], 0xc5c7c5, 0.28, 0.0);
  box(root, [0.20, 0.04, 0.18], [-0.56, 0.39, -0.30], 0x9ea19f, 0.46);

  addWarmCoolLights(root, [0.35, 0.34, 0.22], [-0.42, 0.38, -0.18]);

  return {
    root,
    physicsManifest: makePhysicsManifest(1.55, 1.02, [0.55, 0.020, 0.35], [
      { id: 'counter_run', center_xyz: [0.56, 0, 0.02], dimensions_wdh: [0.24, 0.76, 0.19] },
      { id: 'kitchen_island', center_xyz: [-0.02, 0, -0.10], dimensions_wdh: [0.52, 0.24, 0.15] },
      { id: 'dining_table', center_xyz: [-0.30, 0, 0.29], dimensions_wdh: [0.42, 0.25, 0.16] },
      { id: 'fridge', center_xyz: [-0.56, 0, -0.30], dimensions_wdh: [0.20, 0.18, 0.38] },
    ]),
  };
}

function wholeHouseBuilder() {
  const root = new THREE.Group();
  root.name = 'IndoorWholeHouseWorld';
  addRoomShell(root, 2.20, 1.15, 0x8e8277, 0x765c47);

  // Bedroom wing.
  box(root, [0.58, 0.07, 0.34], [-0.66, 0.035, -0.27], 0x4d3a2f, 0.84);
  box(root, [0.54, 0.07, 0.30], [-0.66, 0.11, -0.27], 0xd8d1c8, 0.92);
  softBox(root, [0.16, 0.05, 0.10], [-0.79, 0.15, -0.34], 0xf4eee6, 0.024, 0.95);
  softBox(root, [0.16, 0.05, 0.10], [-0.56, 0.15, -0.34], 0xf4eee6, 0.024, 0.95);

  // Living wing.
  const sofa = softBox(root, [0.62, 0.20, 0.25], [0.20, 0.10, -0.29], 0x866b59, 0.045, 0.88);
  sofa.castShadow = true;
  box(root, [0.46, 0.055, 0.23], [0.20, 0.09, -0.02], 0x704c33, 0.78);
  box(root, [0.62, 0.12, 0.07], [0.58, 0.06, 0.33], 0x3c3028, 0.80);

  // Kitchen wing.
  box(root, [0.22, 0.16, 0.60], [0.84, 0.08, -0.03], 0x62564b, 0.73);
  box(root, [0.22, 0.025, 0.60], [0.84, 0.175, -0.03], 0xe7dfd0, 0.68);
  box(root, [0.42, 0.12, 0.20], [0.38, 0.07, 0.30], 0x5f5247, 0.72);

  // Room divider and rugs create readable interior zones.
  box(root, [0.04, 0.32, 0.08], [-0.15, 0.16, -0.30], 0x4e4137, 0.80);
  box(root, [0.50, 0.006, 0.30], [-0.65, 0.003, 0.17], 0x3d5366, 0.98);
  box(root, [0.55, 0.006, 0.30], [0.00, 0.003, 0.17], 0x4d6273, 0.98);

  // Toy household clutter.
  for (const [pos, size, color, rot] of [
    [[-0.95, 0.018, 0.28], [0.10,0.036,0.08], 0xd94f4f, 0.16],
    [[-0.30, 0.018, 0.34], [0.08,0.036,0.08], 0xf0b84f, -0.10],
    [[0.52, 0.018, 0.36], [0.10,0.036,0.07], 0x53b37a, 0.14],
  ]) box(root, size, pos, color, 0.58, rot);

  addWarmCoolLights(root, [0.88, 0.34, 0.20], [-0.72, 0.42, 0.28]);

  return {
    root,
    physicsManifest: makePhysicsManifest(2.20, 1.15, [0.92, 0.020, 0.42], [
      { id: 'bed', center_xyz: [-0.66, 0, -0.27], dimensions_wdh: [0.58, 0.34, 0.145] },
      { id: 'sofa', center_xyz: [0.20, 0, -0.29], dimensions_wdh: [0.64, 0.25, 0.20] },
      { id: 'coffee_table', center_xyz: [0.20, 0, -0.02], dimensions_wdh: [0.46, 0.23, 0.15] },
      { id: 'kitchen_counter', center_xyz: [0.84, 0, -0.03], dimensions_wdh: [0.22, 0.60, 0.19] },
      { id: 'kitchen_island', center_xyz: [0.38, 0, 0.30], dimensions_wdh: [0.42, 0.20, 0.15] },
    ]),
  };
}

export function buildLivingRoomWorld({ settings } = {}) {
  return livingRoomBuilder(settings);
}

export function buildKitchenWorld({ settings } = {}) {
  return kitchenBuilder(settings);
}

export function buildWholeHouseWorld({ settings } = {}) {
  return wholeHouseBuilder(settings);
}
