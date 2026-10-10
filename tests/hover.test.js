import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBrickPicker, brickInfluence, stepHover, stepDisplacement } from '../src/hover.js';
import { updateIce } from '../src/scene.js';

function brick(x, row = 2) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(.7, .6, .5), new THREE.MeshBasicMaterial());
  mesh.userData = {
    center: new THREE.Vector3(x, 1, 0), row, door: false, opening: 0,
    seed: new THREE.Vector3(.3, .5, .7)
  };
  mesh.position.copy(mesh.userData.center);
  mesh.material.userData.shaderState = { opening: { value: 0 } };
  return mesh;
}

test('hover remains stable as a brick lifts; camera changes invalidate the pick', () => {
  const part = brick(0);
  const picker = createBrickPicker([part]);
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
  camera.position.set(0, 1, 8);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld();
  const identity = new THREE.Matrix4();
  const hit = picker.pick({ x: 0, y: 0 }, camera, identity);
  assert.equal(hit.part, part);
  part.position.y += 1;
  assert.equal(picker.pick({ x: 0, y: 0 }, camera, identity), hit);
  camera.position.x = 10;
  camera.updateMatrixWorld();
  assert.equal(picker.pick({ x: 0, y: 0 }, camera, identity), null);
});

test('effect is continuous across tile boundaries, with a finite local range', () => {
  const part = brick(0);
  const left = brickInfluence(part, { point: new THREE.Vector3(.699, 1, .25) });
  const right = brickInfluence(part, { point: new THREE.Vector3(.701, 1, .25) });
  assert.ok(Math.abs(left - right) < .002);
  const distances = [.3, .9, 1.5, 2, 2.25, 4];
  const strengths = distances.map(x => brickInfluence(part, { point: new THREE.Vector3(x, 1, 0) }));
  assert.ok(strengths[1] > .5);
  assert.ok(strengths[2] > .2);
  strengths.forEach((value, i) => { if (i) assert.ok(value <= strengths[i - 1]); });
  assert.equal(strengths[4], 0);
  assert.equal(strengths[5], 0);
});

test('carved seams keep a continuous hover instead of dropping between bricks', () => {
  const picker = createBrickPicker([brick(-.37), brick(.37)]);
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
  camera.position.set(0, 1, 8);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld();
  const identity = new THREE.Matrix4();
  const points = [-.02, -.01, 0, .01, .02].map(x => picker.pick({ x, y: 0 }, camera, identity));
  points.forEach(hit => assert.ok(hit));
  for (let i = 1; i < points.length; i++) assert.ok(points[i].point.distanceTo(points[i - 1].point) < .03);
});

test('direction reversal preserves velocity and brings the complete pose to rest', () => {
  const offset = new THREE.Vector3(), velocity = new THREE.Vector3();
  const target = new THREE.Vector3(.4, .3, -.2);
  for (let i = 0; i < 12; i++) stepDisplacement(offset, velocity, target, 1 / 60, 11);
  const before = offset.clone();
  target.x = -.4;
  stepDisplacement(offset, velocity, target, 1 / 60, 11);
  assert.ok(offset.distanceTo(before) < .04);
  target.set(0, 0, 0);
  for (let i = 0; i < 300; i++) stepDisplacement(offset, velocity, target, 1 / 60, 11);
  assert.ok(offset.equals(target));
  assert.equal(velocity.lengthSq(), 0);
});

test('spring timing is consistent at 30 and 60 fps and settles exactly', () => {
  const a = { opening: 0 }, b = { opening: 0 };
  for (let i = 0; i < 30; i++) stepHover(a, .8, 1 / 60, 8);
  for (let i = 0; i < 15; i++) stepHover(b, .8, 1 / 30, 8);
  assert.ok(Math.abs(a.opening - b.opening) < 1e-10);
  for (let i = 0; i < 300; i++) stepHover(a, 0, 1 / 60, 8);
  assert.equal(a.opening, 0);
  assert.equal(a.hoverVelocity, 0);
});

test('neighbours move, distant bricks stay still, and leaving restores all poses', () => {
  const parts = [brick(0), brick(.9), brick(4)];
  const world = { parts, innerGlow: { material: {} }, groundGlow: { material: {} } };
  const hovered = { part: parts[0], point: new THREE.Vector3(0, 1, .25) };
  for (let i = 0; i < 300; i++) updateIce(world, hovered, 1 / 60, { x: 0, y: 0 }, 1);
  const distances = parts.map(part => part.position.distanceTo(part.userData.center));
  assert.ok(distances[0] > distances[1]);
  assert.ok(distances[1] > .08);
  assert.equal(distances[2], 0);
  const held = parts.map(part => part.position.clone());
  for (let i = 0; i < 120; i++) updateIce(world, hovered, 1 / 60, { x: 0, y: 0 }, 1);
  parts.forEach((part, i) => assert.ok(part.position.equals(held[i])));
  for (let i = 0; i < 300; i++) updateIce(world, null, 1 / 60, { x: 0, y: 0 }, 1);
  parts.forEach(part => {
    assert.ok(part.position.equals(part.userData.center));
    assert.ok(part.quaternion.equals(new THREE.Quaternion()));
  });
  assert.equal(world.hoverPoint, null);
  updateIce(world, { part: parts[2], point: new THREE.Vector3(4, 1, .25) }, 1 / 60, { x: 0, y: 0 }, 1);
  assert.equal(parts[0].userData.opening, 0);
});
