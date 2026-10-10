import * as THREE from 'three';
import { hash } from './scene.js';

function blockContour(geometry) {
  const positions = geometry.attributes.position;
  const coordinates = geometry.attributes.blockCoord;
  const lines = [];
  const border = .5 - 1 / (innerWidth < 700 ? 7 : 10);
  // Follow the outer face borders; triangle edges would add noise inside the arch.
  for (let axis = 0; axis < 3; axis++) {
    const across = (axis + 1) % 3, along = (axis + 2) % 3;
    for (const face of [-1, 1]) {
      for (const [fixed, variable] of [[across, along], [along, across]]) {
        for (const edge of [-1, 1]) {
          const points = new Map();
          for (let index = 0; index < positions.count; index++) {
            const coord = [coordinates.getX(index), coordinates.getY(index), coordinates.getZ(index)];
            if (coord[axis] * face < .46 || Math.abs(coord[fixed] - edge * border) > .001
              || Math.abs(coord[variable]) > border + .001) continue;
            const key = coord[variable].toFixed(3);
            points.set(key, { order: coord[variable], point: [positions.getX(index), positions.getY(index), positions.getZ(index)] });
          }
          const ordered = [...points.values()].sort((a, b) => a.order - b.order);
          for (let index = 1; index < ordered.length; index++) lines.push(...ordered[index - 1].point, ...ordered[index].point);
        }
      }
    }
  }
  const contour = new THREE.BufferGeometry();
  contour.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  return contour;
}

// A scan of our generated geometry, with an independently generated signal field.
export function createIntro(world, canvas, reducedMotion) {
  const group = new THREE.Group();
  const outlines = new THREE.Group();
  const contourMaterial = new THREE.LineBasicMaterial({
    color: '#edf5ff', transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.NormalBlending, toneMapped: false
  });
  for (const part of world.parts) {
    const contour = new THREE.LineSegments(blockContour(part.geometry), contourMaterial);
    contour.position.copy(part.userData.center);
    contour.userData.row = part.userData.row;
    outlines.add(contour);
  }
  outlines.position.copy(world.beacon.position);
  group.add(outlines);

  const nodes = [];
  const links = [];
  // Open, asymmetric triangles fill the space around the shelter.
  for (let cluster = 0; cluster < 78; cluster++) {
    const center = new THREE.Vector3((hash(cluster, 31) - .5) * 29,
      hash(cluster, 32) * 13 - 2.4, (hash(cluster, 33) - .5) * 28);
    if (Math.hypot(center.x, center.z) < 3.2) center.x += 5;
    const size = .9 + hash(cluster, 34) * 2.8;
    const first = nodes.length;
    for (let vertex = 0; vertex < 3; vertex++) {
      const angle = vertex * Math.PI * 2 / 3 + hash(cluster, 35) * Math.PI;
      nodes.push({
        base: center.clone().add(new THREE.Vector3(Math.cos(angle) * size,
          Math.sin(angle) * size * .7, (hash(cluster, vertex + 36) - .5) * size * 2)),
        point: new THREE.Vector3(), phase: hash(cluster, vertex + 41) * Math.PI * 2,
        reading: 20 + Math.floor(hash(cluster, vertex + 51) * 50), floor: false
      });
    }
    links.push(first, first + 1, first + 1, first + 2);
    if (hash(cluster, 38) > .4) links.push(first + 2, first);
  }
  // A fading triangular survey grid grounds the initial overhead view.
  const floorStart = nodes.length;
  const columns = 23;
  for (let row = 0; row < 23; row++) {
    for (let column = 0; column < columns; column++) {
      const x = (column - 11) * .49 + (row % 2) * .245;
      const z = (row - 11) * .45;
      nodes.push({ base: new THREE.Vector3(x, -.22, z), point: new THREE.Vector3(),
        phase: 0, reading: 0, floor: true });
      const index = floorStart + row * columns + column;
      if (column > 0) links.push(index - 1, index);
      if (row > 0) {
        links.push(index - columns, index);
        if (column > 0) links.push(index - columns - 1, index);
      }
    }
  }
  const positions = new Float32Array(links.length * 3);
  const colors = new Float32Array(positions.length);
  for (let index = 0; index < links.length; index++) {
    const node = nodes[links[index]];
    const brightness = node.floor ? .12 * Math.exp(-Math.pow(Math.hypot(node.base.x, node.base.z) / 3.6, 4))
      : .25 + hash(index, 59) * .65;
    colors.set([brightness, brightness, brightness], index * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const networkMaterial = new THREE.LineBasicMaterial({
    color: '#ffffff', vertexColors: true, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
  });
  group.add(new THREE.LineSegments(geometry, networkMaterial));
  const environment = world.scene.children.filter(object => object !== world.beacon && !object.isLight)
    .map(object => ({ object, visible: object.visible }));
  for (const { object } of environment) object.visible = false;
  for (const part of world.parts) part.visible = false;
  const extraShelter = world.beacon.children.filter(object => object.isMesh && !world.parts.includes(object));
  for (const object of extraShelter) object.visible = false;
  world.innerGlow.visible = false;
  world.scene.add(group);
  const backdrop = world.scene.background;
  world.scene.background = new THREE.Color('#a0a5b1');
  return {
    group, outlines, contourMaterial, networkMaterial, geometry, positions, nodes, links,
    environment, extraShelter, backdrop, canvas, context: canvas.getContext('2d'),
    start: null, finished: false, duration: reducedMotion ? 2.4 : 5.1,
    reducedMotion, projected: new THREE.Vector3()
  };
}

export function updateIntro(intro, world, seconds, delta) {
  if (intro.start === null) intro.start = seconds;
  const elapsed = seconds - intro.start;
  const reveal = THREE.MathUtils.smoothstep(elapsed, intro.duration - 1.75, intro.duration);
  const scan = THREE.MathUtils.smoothstep(elapsed, .05, 1.1);
  const field = scan * (1 - reveal);
  intro.contourMaterial.opacity = scan * (1 - reveal) * .78;
  intro.networkMaterial.opacity = field * .85;
  const solid = elapsed > 1.8 || intro.reducedMotion;
  for (const object of intro.extraShelter) object.visible = solid;
  for (const part of world.parts) {
    part.visible = solid;
    part.position.copy(part.userData.center);
    part.rotation.set(0, 0, 0);
    part.userData.opening = 0;
    const uniforms = part.material.userData.shaderState;
    uniforms.opening.value = (1 - reveal) * .16;
  }
  world.innerGlow.visible = solid;
  world.innerGlow.material.opacity = (1 - reveal) * .08;
  for (const { object, visible } of intro.environment) object.visible = reveal > .02 && visible;
  if (reveal > .02) world.scene.background = intro.backdrop;

  const turn = intro.reducedMotion ? 0 : elapsed * .105;
  const start = new THREE.Vector3(-8.1, 10.7, 12.1);
  start.applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
  const destination = new THREE.Vector3(-9.3, 2.85, 14.8);
  world.camera.position.copy(start.lerp(destination, reveal));
  world.camera.lookAt(new THREE.Vector3(0, 1.1, -.1).lerp(new THREE.Vector3(0, 1.15, 0), reveal));
  world.scene.updateMatrixWorld();
  world.camera.updateMatrixWorld();

  for (const node of intro.nodes) {
    node.point.copy(node.base);
    if (!node.floor && !intro.reducedMotion) {
      node.point.x += Math.sin(elapsed * .38 + node.phase) * .5;
      node.point.y += Math.cos(elapsed * .3 + node.phase) * .3;
    }
  }
  for (let index = 0; index < intro.links.length; index++) {
    intro.nodes[intro.links[index]].point.toArray(intro.positions, index * 3);
  }
  intro.geometry.attributes.position.needsUpdate = true;
  const width = innerWidth, height = innerHeight;
  if (intro.canvas.width !== width || intro.canvas.height !== height) {
    intro.canvas.width = width; intro.canvas.height = height;
  }
  const ctx = intro.context;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = `rgba(255,255,255,${field * .7})`;
  ctx.strokeStyle = `rgba(255,255,255,${field * .45})`;
  ctx.lineWidth = .5;
  ctx.font = '7px "IBM Plex Mono", monospace';
  for (let index = 0; index < 234; index += 5) {
    intro.projected.copy(intro.nodes[index].point).project(world.camera);
    if (intro.projected.z < -1 || intro.projected.z > 1) continue;
    const x = (intro.projected.x * .5 + .5) * width;
    const y = (-intro.projected.y * .5 + .5) * height;
    ctx.fillText(String(intro.nodes[index].reading), x - 8, y - 8);
    ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x + 2, y);
    ctx.moveTo(x, y - 2); ctx.lineTo(x, y + 2); ctx.stroke();
  }
  world.composer.render(delta);
  return elapsed >= intro.duration;
}

export function finishIntro(intro, world) {
  if (intro.finished) return;
  intro.finished = true;
  for (const { object, visible } of intro.environment) object.visible = visible;
  for (const part of world.parts) part.visible = true;
  for (const object of intro.extraShelter) object.visible = true;
  world.innerGlow.visible = true;
  world.scene.background = intro.backdrop;
  world.scene.remove(intro.group);
  for (const line of intro.outlines.children) line.geometry.dispose();
  intro.geometry.dispose();
  intro.contourMaterial.dispose();
  intro.networkMaterial.dispose();
  intro.context.clearRect(0, 0, intro.canvas.width, intro.canvas.height);
}
