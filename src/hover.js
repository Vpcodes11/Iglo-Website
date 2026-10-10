import * as THREE from 'three';

// Pick the assembled footprint so lifting a brick cannot repeatedly lose its hover.
export function createBrickPicker(parts) {
  const shell = new THREE.Group();
  shell.matrixAutoUpdate = false;
  const material = new THREE.MeshBasicMaterial();
  for (const part of parts) {
    const proxy = new THREE.Mesh(part.geometry, material);
    proxy.position.copy(part.userData.center);
    // Bridge the carved bevels and mortar seams without changing rendered geometry.
    proxy.scale.setScalar(1.10);
    proxy.userData.part = part;
    shell.add(proxy);
  }
  const raycaster = new THREE.Raycaster();
  const previousPointer = new THREE.Vector2(Infinity, Infinity);
  const previousCamera = new THREE.Matrix4();
  const previousProjection = new THREE.Matrix4();
  const previousShelter = new THREE.Matrix4();
  let previousHit = null;
  return {
    pick(pointer, camera, shelterMatrix) {
      // The pick surface never animates: reuse a resting cursor's result.
      if (previousPointer.x === pointer.x && previousPointer.y === pointer.y
        && previousCamera.equals(camera.matrixWorld)
        && previousProjection.equals(camera.projectionMatrix)
        && previousShelter.equals(shelterMatrix)) return previousHit;
      previousPointer.set(pointer.x, pointer.y);
      previousCamera.copy(camera.matrixWorld);
      previousProjection.copy(camera.projectionMatrix);
      previousShelter.copy(shelterMatrix);
      shell.matrix.copy(shelterMatrix);
      shell.updateMatrixWorld(true);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(shell.children, false)[0];
      previousHit = hit ? { part: hit.object.userData.part, point: shell.worldToLocal(hit.point.clone()) } : null;
      return previousHit;
    }
  };
}

export function brickInfluence(part, hovered) {
  if (!hovered) return 0;
  // A continuous surface point avoids a step when crossing from one brick to another.
  const distance = part.userData.center.distanceTo(hovered.point);
  // Spread a visible response over several adjacent bricks, tapering to zero.
  const radius = 2.25;
  if (distance >= radius) return 0;
  const t = distance / radius;
  const falloff = 1 - t * t * (3 - 2 * t);
  return falloff;
}

// Critically damped spring: continuous velocity, no idle motion, stable at any frame rate.
export function stepHover(state, target, delta, frequency) {
  const offset = state.opening - target;
  const velocity = state.hoverVelocity || 0;
  const decay = Math.exp(-frequency * delta);
  const impulse = velocity + frequency * offset;
  const next = target + (offset + impulse * delta) * decay;
  state.hoverVelocity = (velocity - frequency * impulse * delta) * decay;
  state.opening = THREE.MathUtils.clamp(next, 0, 1);
  if (next !== state.opening) state.hoverVelocity = 0;
  if (Math.abs(state.opening - target) < .0001 && Math.abs(state.hoverVelocity) < .001) {
    state.opening = target;
    state.hoverVelocity = 0;
  }
  return state.opening;
}

// Apply the same spring to the complete displacement, including cursor direction.
export function stepDisplacement(position, velocity, target, delta, frequency) {
  const decay = Math.exp(-frequency * delta);
  for (const axis of ['x', 'y', 'z']) {
    const offset = position[axis] - target[axis];
    const impulse = velocity[axis] + frequency * offset;
    position[axis] = target[axis] + (offset + impulse * delta) * decay;
    velocity[axis] = (velocity[axis] - frequency * impulse * delta) * decay;
  }
  if (position.distanceToSquared(target) < .00000001 && velocity.lengthSq() < .000001) {
    position.copy(target);
    velocity.set(0, 0, 0);
  }
}
