import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { floatingPose } from './motion.js';
import { brickInfluence, stepHover, stepDisplacement } from './hover.js';

// Every scene shape and surface is calculated here. No models or images are loaded.
export function hash(x, z = 0, seed = 0) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
export function noise(x, z, seed = 0) {
  const ix = Math.floor(x), iz = Math.floor(z);
  let fx = x - ix, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
  const low = THREE.MathUtils.lerp(hash(ix, iz, seed), hash(ix + 1, iz, seed), fx);
  const high = THREE.MathUtils.lerp(hash(ix, iz + 1, seed), hash(ix + 1, iz + 1, seed), fx);
  return THREE.MathUtils.lerp(low, high, fz);
}
function fractal(x, z, seed = 0) {
  let value = 0, amplitude = .54;
  for (let octave = 0; octave < 5; octave++) {
    value += noise(x, z, seed + octave * 19) * amplitude;
    x *= 2.07; z *= 2.07; amplitude *= .46;
  }
  return value;
}
const smooth = THREE.MathUtils.smoothstep;

function surfaceTexture(kind) {
  const size = innerWidth < 700 ? 512 : 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(size, size);
  const relief = new Float32Array(size * size);
  const roughnessPixels = kind === 'ice' ? ctx.createImageData(size, size) : null;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cloudy = fractal(x * .034, y * .034, kind === 'ice' ? 29 : 81);
      const fine = hash(x, y, 23);
      const warp = noise(x * .011, y * .011, 109) * 2.7;
      const granule = kind === 'ice' ? noise(x * .064, y * .064, 132)
        : fractal(x * .19, y * .19, 155);
      const ridged = 1 - Math.abs(noise(x * .039 + warp, y * .024 - warp, 92) * 2 - 1);
      const fissure = kind === 'ice' ? Math.pow(noise(x * .035, y * .073, 92), 5)
        : Math.pow(noise(x * .14, y * .14, 112), 7) * .22;
      // Broad frozen patches, fine crystals, and shallow directional cleavage.
      const frost = kind === 'ice' ? smooth(noise(x * .009 + warp * .16, y * .013, 178), .30, .72) : 0;
      const crystal = kind === 'ice' ? noise(x * .31, y * .35, 192) : 0;
      const striation = kind === 'ice' ? noise(x * .024 + warp * .2, y * .0035, 209) : 0;
      const value = kind === 'ice'
        ? 170 + frost * 18 + cloudy * 12 + (crystal - .5) * 12 + (fine - .5) * 10 + (striation - .5) * 42 - fissure * 12
        : 147 + cloudy * 60 + (granule - .5) * 106 + (fine - .5) * 42 - fissure * 48;
      relief[y * size + x] = kind === 'ice' ? cloudy * .035 + crystal * .08 + granule * .04 + striation * .24 - fissure * .045
        : cloudy * .035 + granule * .22 + (fine - .5) * .045 - fissure * .06;
      const index = (y * size + x) * 4;
      pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = value;
      pixels.data[index + 3] = 255;
      if (roughnessPixels) {
        const roughness = 164 + frost * 65 + crystal * 22;
        roughnessPixels.data[index] = roughnessPixels.data[index + 1] = roughnessPixels.data[index + 2] = roughness;
        roughnessPixels.data[index + 3] = 255;
      }
    }
  }
  ctx.putImageData(pixels, 0, 0);
  if (kind === 'ice') {
    // Short directional marks break up the frost without broad cloudy spots.
    for (let i = 0; i < 1800; i++) {
      const x = hash(i, 701) * size, y = hash(i, 702) * size;
      const length = 3 + hash(i, 703) * 24;
      const lean = (hash(i, 704) - .5) * 6;
      ctx.lineWidth = .35 + hash(i, 705) * .65;
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(72,87,111,.12)' : 'rgba(238,246,255,.16)';
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + lean * .3, y + length * .45, x + lean, y + length);
      ctx.stroke();
    }
    for (let i = 0; i < 240; i++) {
      const x = hash(i, 731) * size, y = hash(i, 732) * size;
      const length = 55 + hash(i, 733) * 170;
      const lean = (hash(i, 734) - .5) * 30;
      ctx.lineWidth = .7 + hash(i, 735) * 1.3;
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(66,81,102,.14)' : 'rgba(234,244,255,.16)';
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - lean, y + length * .45, x + lean, y + length);
      ctx.stroke();
    }
    // Fine mineral-like fractures sit beneath the frosted surface.
    ctx.lineWidth = .85;
    for (let i = 0; i < 38; i++) {
      let x = hash(i, 2) * size, y = hash(i, 3) * size;
      ctx.strokeStyle = `rgba(225,237,247,${.13 + hash(i, 8) * .20})`;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let step = 0; step < 6; step++) {
        x += 4 + hash(i, step + 11) * 12;
        y += (hash(i, step + 22) - .5) * 18;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Longer cracks give each face readable fractures beneath the fine crystals.
    for (let i = 0; i < 13; i++) {
      let x = hash(i, 301) * size, y = hash(i, 302) * size;
      ctx.strokeStyle = `rgba(39,51,69,${.19 + hash(i, 303) * .18})`;
      ctx.lineWidth = .8 + hash(i, 304) * .9;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let step = 0; step < 12; step++) {
        x += (hash(i, step + 310) - .35) * 23;
        y += 9 + hash(i, step + 330) * 17;
        ctx.lineTo(x, y);
        if (step === 5 || step === 9) {
          ctx.lineTo(x - 8 - hash(i, step + 350) * 23, y + 12);
          ctx.moveTo(x, y);
        }
      }
      ctx.stroke();
    }
    const fractured = ctx.getImageData(0, 0, size, size).data;
    for (let i = 0; i < relief.length; i++) {
      relief[i] -= Math.max(0, pixels.data[i * 4] - fractured[i * 4]) / 255 * .28;
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.colorSpace = THREE.NoColorSpace;
  if (roughnessPixels) {
    const roughnessCanvas = document.createElement('canvas');
    roughnessCanvas.width = roughnessCanvas.height = size;
    roughnessCanvas.getContext('2d').putImageData(roughnessPixels, 0, 0);
    const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
    roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.anisotropy = 8;
    texture.userData.roughnessMap = roughnessMap;
  }
  // Bake microscopic relief once, instead of evaluating grain for every shaded pixel.
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = normalCanvas.height = size;
  const normalContext = normalCanvas.getContext('2d');
  const normalPixels = normalContext.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const left = relief[y * size + (x + size - 4) % size];
      const right = relief[y * size + (x + 4) % size];
      const up = relief[((y + size - 4) % size) * size + x];
      const down = relief[((y + 4) % size) * size + x];
      const dx = (left - right) * 3.0, dy = (down - up) * 3.0;
      const length = Math.hypot(dx, dy, 1), index = (y * size + x) * 4;
      normalPixels.data[index] = (dx / length * .5 + .5) * 255;
      normalPixels.data[index + 1] = (dy / length * .5 + .5) * 255;
      normalPixels.data[index + 2] = (1 / length * .5 + .5) * 255;
      normalPixels.data[index + 3] = 255;
    }
  }
  normalContext.putImageData(normalPixels, 0, 0);
  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.anisotropy = 8;
  texture.userData.normalMap = normalMap;
  return texture;
}

// Screen derivatives recover the surface gradient without a second bitmap lookup.
const reliefNormal = `
  vec3 carvedNormal(vec3 surface, vec3 baseNormal, float height, float faceSign) {
    vec3 dx = dFdx(surface), dy = dFdy(surface);
    vec3 acrossX = cross(dy, baseNormal), acrossY = cross(baseNormal, dx);
    float determinant = dot(dx, acrossX) * faceSign;
    vec3 gradient = sign(determinant) * (dFdx(height) * acrossX + dFdy(height) * acrossY);
    return normalize(max(abs(determinant), 0.0000001) * baseNormal - gradient);
  }
`;

function createIceReflections(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, '#e7f0ff');
  sky.addColorStop(.40, '#aebed5');
  sky.addColorStop(.56, '#51637d');
  sky.addColorStop(1, '#18202e');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 512, 256);
  // Broad overcast reflections stay continuous across the panorama seam.
  for (const x of [-72, 440]) {
    const cloud = ctx.createRadialGradient(x, 74, 0, x, 74, 105);
    cloud.addColorStop(0, 'rgba(255,255,255,1)');
    cloud.addColorStop(.35, 'rgba(246,251,255,.8)');
    cloud.addColorStop(1, 'rgba(246,251,255,0)');
    ctx.fillStyle = cloud; ctx.fillRect(0, 0, 512, 256);
  }
  const panorama = new THREE.CanvasTexture(canvas);
  panorama.colorSpace = THREE.SRGBColorSpace;
  panorama.mapping = THREE.EquirectangularReflectionMapping;
  const generator = new THREE.PMREMGenerator(renderer);
  const reflection = generator.fromEquirectangular(panorama);
  panorama.dispose(); generator.dispose();
  return reflection;
}

function makeIceMaterial(texture, id, door, innerSide = 0) {
  const shaderState = { opening: { value: 0 } };
  const shade = .36 + hash(id, 4) * .115;
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(shade * .84, shade * .91, shade),
    map: texture, normalMap: texture.userData.normalMap, normalScale: new THREE.Vector2(.62, .62),
    roughnessMap: texture.userData.roughnessMap, roughness: .86, metalness: 0,
    ior: 1.31, specularIntensity: .4,
    clearcoat: .10, clearcoatRoughness: .58,
    clearcoatNormalMap: texture.userData.normalMap,
    clearcoatNormalScale: new THREE.Vector2(.45, .45),
    envMap: texture.userData.reflectionMap, envMapIntensity: .07,
    emissive: '#c1dcff', emissiveIntensity: .025
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.uIceOpening = shaderState.opening;
    shader.uniforms.uIceSeed = { value: new THREE.Vector3(hash(id, 811) * 43, hash(id, 812) * 43, hash(id, 813) * 43) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 blockCoord; varying vec3 vBlock; varying vec3 vCarved;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBlock = blockCoord; vCarved = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      uniform float uIceOpening;
      uniform vec3 uIceSeed;
      varying vec3 vBlock, vCarved;
      ${reliefNormal}
      float iceHash(vec3 p) {
        p = fract(p * .1031); p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }
      float iceNoise(vec3 p) {
        vec3 b = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(iceHash(b), iceHash(b+vec3(1,0,0)), f.x),
                       mix(iceHash(b+vec3(0,1,0)), iceHash(b+vec3(1,1,0)), f.x), f.y),
                   mix(mix(iceHash(b+vec3(0,0,1)), iceHash(b+vec3(1,0,1)), f.x),
                       mix(iceHash(b+vec3(0,1,1)), iceHash(b+vec3(1,1,1)), f.x), f.y), f.z);
      }
    `).replace('#include <color_fragment>', `
      #include <color_fragment>
      vec3 grainPoint = vCarved + uIceSeed;
      float frost = iceNoise(grainPoint * vec3(12.0, 2.5, 16.0)) * .60
        + iceNoise(grainPoint * vec3(39.0, 9.0, 45.0)) * .25 + iceNoise(grainPoint * 153.0) * .15;
      float rimNoise = iceNoise(vCarved * 39.0);
      float rind = smoothstep(.443 + rimNoise * .025, .497, max(abs(vBlock.x), abs(vBlock.y)));
      float cleavage = 1.0 - smoothstep(.013, .041, abs(iceNoise(vCarved * vec3(39.0, 14.0, 71.0)) - .53));
      diffuseColor.rgb *= .60 + frost * .75 + cleavage * .035;
      float cutFace = smoothstep(.43, .495, max(abs(vBlock.x), abs(vBlock.y))) * (1.0 - smoothstep(.30, .49, abs(vBlock.z)));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.61, .68, .77) * (.82 + frost * .22), cutFace * .65 + rind * .16);
      ${door ? `float recessedFace = ${innerSide === 0 ? '1.0 - smoothstep(-.48, -.35, vBlock.y)' : innerSide > 0 ? '1.0 - smoothstep(-.48, -.35, vBlock.x)' : 'smoothstep(.35, .48, vBlock.x)'};
      diffuseColor.rgb *= mix(1.0, .17, recessedFace);` : ''}
    `).replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      normal = carvedNormal(-vViewPosition, normal, frost * .0045, 1.0);
    `).replace('#include <emissivemap_fragment>', `
      #include <emissivemap_fragment>
      vec3 sides = abs(vBlock);
      float bevel = max(max(min(sides.x, sides.y), min(sides.y, sides.z)), min(sides.x, sides.z));
      float edge = smoothstep(.42, .49, bevel);
      float faceRim = smoothstep(.455, .497, max(sides.x, sides.y)) * smoothstep(.20, .44, vBlock.z);
      float backCut = 1.0 - smoothstep(-.40, -.24, vBlock.z);
      float bottomCut = 1.0 - smoothstep(-.46, -.32, vBlock.y);
      float sideCut = smoothstep(.40, .49, sides.x) * (1.0 - smoothstep(.15, .46, vBlock.z));
      float scattering = .62 + iceNoise(vCarved * 37.0) * .28;
      float inside = ${door ? '(backCut * .035 + bottomCut * .025 + sideCut * .06)' : '(backCut * .80 + bottomCut * .72 + sideCut * .42)'} * scattering;
      totalEmissiveRadiance += vec3(.69, .81, 1.0) *
        (edge * (.035 + uIceOpening * .55) + faceRim * (.025 + uIceOpening * .32)
          + inside * (.12 + uIceOpening * 2.6) + cutFace * uIceOpening * 1.1);
    `);
  };
  material.customProgramCacheKey = () => `nival-directional-frost-v9-${door}-${innerSide}`;
  material.userData.shaderState = shaderState;
  return material;
}

const IGLOO = { radius: 2.42, shoulder: 1.65, roofHeight: 2.13, wall: .55, centerZ: -.38, portalAngle: .05 };

function carveBlock(mapPoint, id, door = false) {
  const subdivisions = innerWidth < 700 ? 7 : 10;
  const geometry = new THREE.BoxGeometry(1, 1, 1, subdivisions, subdivisions, subdivisions).toNonIndexed();
  const position = geometry.attributes.position;
  const blockCoordinates = new Float32Array(position.count * 3);
  const point = new THREE.Vector3();
  const core = new THREE.Vector3();
  const bevelNormal = new THREE.Vector3();
  const bevelRadius = door ? .034 + hash(id, 25) * .006 : .046 + hash(id, 25) * .014;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    core.set(clampBevel(x), clampBevel(y), clampBevel(z));
    bevelNormal.set(x, y, z).sub(core).normalize();
    const edge = smooth(Math.max(Math.min(Math.abs(x), Math.abs(y)), Math.min(Math.abs(y), Math.abs(z)), Math.min(Math.abs(x), Math.abs(z))), .34, .49);
    const chip = (noise(x * 5 + id * 3, y * 6 + z * 4, 22) - .5) * .023
      + (noise(x * 19 + id * 3, y * 20 + z * 11, 22) - .5) * .010
      - edge * smooth(noise(x * 13 + id * 5, y * 17 + z * 11, 184), .55, .82) * .029;
    point.copy(core).addScaledVector(bevelNormal, bevelRadius + chip * (door ? .35 : .70));
    blockCoordinates.set([point.x, point.y, point.z], i * 3);
    mapPoint(point.x, point.y, point.z, point);
    position.setXYZ(i, point.x, point.y, point.z);
  }
  function clampBevel(value) { return THREE.MathUtils.clamp(value, -.5 + bevelRadius, .5 - bevelRadius); }
  geometry.setAttribute('blockCoord', new THREE.BufferAttribute(blockCoordinates, 3));
  // Every block samples a different region of the shared frost and crack maps.
  const uv = geometry.attributes.uv;
  const uvX = hash(id, 721) * 9, uvY = hash(id, 722) * 9;
  const uvScale = .72 + hash(id, 723) * .42;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale + uvX, uv.getY(i) * uvScale + uvY);
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.computeVertexNormals();
  // Average coincident normals across UV seams after carving and dome warping.
  const normals = geometry.attributes.normal;
  const normalSums = new Map();
  const keys = [];
  for (let i = 0; i < position.count; i++) {
    const key = `${Math.round(position.getX(i) * 10000)},${Math.round(position.getY(i) * 10000)},${Math.round(position.getZ(i) * 10000)}`;
    keys.push(key);
    if (!normalSums.has(key)) normalSums.set(key, new THREE.Vector3());
    normalSums.get(key).add(new THREE.Vector3().fromBufferAttribute(normals, i));
  }
  for (const normal of normalSums.values()) normal.normalize();
  for (let i = 0; i < position.count; i++) {
    const normal = normalSums.get(keys[i]);
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  return { geometry, center };
}

function createIgloo(world, texture) {
  // Six narrower masonry courses keep the dome size while reducing individual faces.
  const rows = [
    [0, .61, 12], [.61, 1.25, 12], [1.25, 1.91, 14],
    [1.91, 2.53, 12], [2.53, 3.13, 10], [3.13, 3.68, 6]
  ];
  const seamHeight = (row, angle) => row === 0 || row === 6 ? 0
    : Math.sin(angle * 3 + row * 1.9) * .040 + Math.sin(angle * 7 - row) * .018;
  function addPiece(mapPoint, row, door = false, pose = {}) {
    const id = world.parts.length;
    const { geometry, center } = carveBlock(mapPoint, id, door);
    const material = makeIceMaterial(texture, id, door, pose.portalSide || 0);
    if (pose.crown) {
      material.color.multiplyScalar(1.40);
      material.emissiveIntensity = .075;
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(center);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
      id, center, row, door, opening: 0, ...pose,
      seed: new THREE.Vector3(hash(id, 11), hash(id, 12), hash(id, 13))
    };
    world.beacon.add(mesh);
    world.parts.push(mesh);
  }
  rows.forEach(([bottom, top, count], row) => {
    const doorway = row < 3;
    const gap = doorway ? .25 : 0;
    const circumference = Math.PI * 2 - gap * 2;
    const sector = circumference / count;
    const offset = doorway ? IGLOO.portalAngle + gap : -.10 + (row % 2) * sector * .5;
    const boundaries = [offset];
    if (doorway) {
      const phase = [.65, .45, -.45][row] + (.25 - IGLOO.portalAngle) / sector;
      const stagger = ((phase % 1) + 1) % 1;
      for (let index = 0; index <= count; index++) {
        const boundary = offset + sector * (index + stagger + (hash(row, index, 417) - .5) * .13);
        if (boundary > offset + .001 && boundary < offset + circumference - .001) boundaries.push(boundary);
      }
      boundaries.push(offset + circumference);
    } else {
      for (let index = 1; index <= count; index++) boundaries.push(offset + sector * (index + (index === count ? 0 : (hash(row, index, 417) - .5) * .13)));
    }
    for (let piece = 0; piece < boundaries.length - 1; piece++) {
      const start = boundaries[piece], end = boundaries[piece + 1];
      const mid = (start + end) / 2;
      const width = end - start - .015;
      const shift = (hash(row, piece) - .5) * .012;
      addPiece((x, y, z, out) => {
        const angle = mid + x * width;
        const height = THREE.MathUtils.lerp(bottom + seamHeight(row, angle) + .009,
          top + seamHeight(row + 1, angle) - .009, y + .5) + shift;
        const shell = IGLOO.radius - IGLOO.wall / 2 + z * IGLOO.wall;
        const latitude = Math.asin(THREE.MathUtils.clamp((height - IGLOO.shoulder) / IGLOO.roofHeight, 0, .999));
        const radius = shell * Math.cos(latitude);
        const tangent = radius * (.38 * Math.sin(x * width) + .62 * x * 2 * Math.sin(width / 2));
        const radial = radius * (.38 * Math.cos(x * width) + .62 * Math.cos(width / 2));
        const vertical = height <= IGLOO.shoulder ? height
          : IGLOO.shoulder + IGLOO.roofHeight * shell / IGLOO.radius * Math.sin(latitude);
        out.set(Math.sin(mid) * radial + Math.cos(mid) * tangent, vertical,
          Math.cos(mid) * radial - Math.sin(mid) * tangent + IGLOO.centerZ);
      }, row, false, {
        floatAxis: new THREE.Vector3(Math.cos(mid), 0, -Math.sin(mid))
      });
    }
  });
  addPiece((x, y, z, out) => {
    const dx = x * 1.08, dz = z * .98;
    const top = IGLOO.shoulder + IGLOO.roofHeight * Math.sqrt(1 - (dx * dx + dz * dz) / IGLOO.radius ** 2) + .017;
    const capYaw = -.55;
    out.set(Math.cos(capYaw) * dx + Math.sin(capYaw) * dz,
      top - (.5 - y) * .43,
      Math.cos(capYaw) * dz - Math.sin(capYaw) * dx + IGLOO.centerZ);
  }, 6, false, { crown: true, floatAxis: new THREE.Vector3(.81, 0, .59) });

  // Shared circular boundaries keep all roof wedges on one continuous arch.
  const spring = 1.20, inner = .64, outer = 1.04, portalZ = 2.60, portalDepth = 1.12;
  const meanRadius = (inner + outer) / 2, thickness = outer - inner;
  const portalCos = Math.cos(IGLOO.portalAngle), portalSin = Math.sin(IGLOO.portalAngle);
  function portalPoint(x, y, depth, out) {
    out.set(portalCos * x + portalSin * depth, y,
      portalCos * depth - portalSin * x + IGLOO.centerZ);
  }
  for (let i = 0; i < 5; i++) {
    const angle = (i + .5) * Math.PI / 5;
    addPiece((x, y, z, out) => {
      // Reverse the angular coordinate to keep the carved box's front winding outward.
      const theta = angle - x * (Math.PI / 5 - .006);
      const radius = meanRadius + y * thickness;
      portalPoint(Math.cos(theta) * radius, spring + Math.sin(theta) * radius,
        portalZ + z * portalDepth, out);
    }, 1, true, { portalRoof: true });
  }
  for (const side of [-1, 1]) {
    for (let row = 0; row < 2; row++) {
      addPiece((x, y, z, out) => {
        portalPoint(side * meanRadius + x * thickness,
          (row + .5) * spring / 2 + y * (spring / 2 - .018), portalZ + z * portalDepth, out);
      }, row, true, { portalSide: side });
    }
  }
  const doorway = new THREE.Shape();
  doorway.moveTo(-inner, 0); doorway.lineTo(inner, 0); doorway.lineTo(inner, spring);
  doorway.absarc(0, spring, inner, 0, Math.PI, false);
  doorway.lineTo(-inner, 0);
  const innerDoor = new THREE.Mesh(new THREE.ShapeGeometry(doorway), new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 wallPoint; void main(){wallPoint=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `
      varying vec2 wallPoint;
      void main(){
        float course = abs(fract(wallPoint.y / .59) - .5);
        float joint = smoothstep(.477, .499, course);
        float grain = fract(sin(dot(floor(wallPoint * 240.0),vec2(12.9898,78.233))) * 43758.5453);
        float depthShade = smoothstep(-.58,.58,wallPoint.x) * .015;
        vec3 color = vec3(.035,.045,.064) + depthShade + grain * .012 + joint * .020;
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  }));
  portalPoint(0, 0, 2.28, innerDoor.position);
  innerDoor.rotation.y = IGLOO.portalAngle;
  world.beacon.add(innerDoor);
}

const mountainPeaks = [
  [12.4, -39, 10.2, 15, 16], [48, -40, 12.8, 18, 15],
  [35, -80, 18, 24, 17], [-18, -25, 5, 18, 17], [40, -8, 3.8, 16, 15]
];
function hill(x, z, cx, cz, height, widthX, widthZ) {
  return height * Math.exp(-(((x - cx) / widthX) ** 2 + ((z - cz) / widthZ) ** 2));
}
export function terrainHeight(x, z) {
  const radius = Math.hypot(x, z + .3);
  const away = smooth(radius, 2.9, 6.3);
  let peaks = 0;
  for (const [cx, cz, height, widthX, widthZ] of mountainPeaks) {
    const distance = Math.hypot((x - cx) / widthX, (z - cz) / widthZ);
    peaks += height * Math.exp(-Math.pow(distance, 1.85) * 1.3);
  }
  const ridge = .88 + .26 * (noise(x * .10, z * .10, 60) * .6
    + noise(x * .22, z * .22, 79) * .3 + noise(x * .45, z * .45, 98) * .1);
  const nearHills = hill(x, z, -6.8, 4.7, 1.1, 2.9, 2.5)
    + hill(x, z, 5.5, -1.8, 1.75, 3, 3.8)
    + hill(x, z, -7.8, -3.3, 1.55, 3.7, 2.6)
    + hill(x, z, 7.2, 8, 1.15, 4, 3);
  const rough = (fractal(x * .42, z * .42, 12) - .48) * .76;
  const warp = noise(x * .45, z * .45, 37) * .6;
  const grooves = (fractal(x * 2.8 + warp, z * 2.6, 16) - .48) * .10;
  const crust = (fractal(x * 5.0, z * 5.0, 104) - .47) * .09;
  const brokenRidge = 1 - Math.abs(noise(x * 2.7 + warp, z * 1.7, 88) * 2 - 1);
  const alpine = smooth(peaks, 2, 8);
  const gullies = fractal(x * 1.1 + warp, z * .85, 17);
  const erosion = gullies * (.03 + alpine * .26);
  const closeDetail = 1 - smooth(radius, 18, 36);
  const rockRidge = 1 - Math.abs(noise(x * .95 + warp, z * .80, 219) * 2 - 1);
  const outcrops = smooth(rockRidge, .15, .85) * (.04 + nearHills * .11) * closeDetail;
  return -.11 + away * (peaks * ridge + nearHills + rough
    + outcrops + Math.pow(brokenRidge, 4) * (.08 + alpine * .13) * closeDetail - erosion)
    + (grooves + crust) * closeDetail;
}

function createTerrain(world, texture) {
  const low = new THREE.Color('#59657a'), high = new THREE.Color('#d7dce4');
  const material = new THREE.MeshStandardMaterial({
    map: texture, normalMap: texture.userData.normalMap, normalScale: new THREE.Vector2(.78, .78), vertexColors: true,
    roughness: 1, metalness: 0
  });
  // Fine wind-carved relief is shaded in world space, independent of mesh density.
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSnowPosition; varying float vSnowElevation; varying float vSnowSlope;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSnowPosition = position.xz; vSnowElevation = position.y; vSnowSlope = 1.0 - abs(normal.y);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      varying vec2 vSnowPosition;
      varying float vSnowElevation;
      varying float vSnowSlope;
      ${reliefNormal}
      float snowHash(vec2 p) {
        vec3 a = fract(vec3(p.xyx) * .1031);
        a += dot(a, a.yzx + 33.33); return fract((a.x + a.y) * a.z);
      }
      float snowNoise(vec2 p) {
        vec2 a = floor(p), b = fract(p); b = b*b*(3.0-2.0*b);
        return mix(mix(snowHash(a), snowHash(a+vec2(1,0)), b.x),
                   mix(snowHash(a+vec2(0,1)), snowHash(a+vec2(1,1)), b.x), b.y);
      }
    `).replace('#include <color_fragment>', `
      #include <color_fragment>
      float strata = snowNoise(vSnowPosition * 3.8) * .6 + snowNoise(vSnowPosition * 13.0) * .4;
      diffuseColor.rgb *= .75 + strata * .36;
      float alpine = smoothstep(1.6, 5.0, vSnowElevation);
      float rock = snowNoise(vSnowPosition * 1.7) * .45
        + snowNoise(vSnowPosition * 5.3) * .35
        + snowNoise(vSnowPosition * 18.0) * .20;
      diffuseColor.rgb *= mix(1.0, .76 + rock * .45, alpine);
      float exposed = smoothstep(.53, .70, snowNoise(vSnowPosition * .65) * .65
        + snowNoise(vSnowPosition * 1.7) * .35) * smoothstep(.15, .70, vSnowElevation);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.19, .23, .30) * (.70 + rock * .5), exposed * .40);
    `);
  };
  material.customProgramCacheKey = () => 'nival-rock-and-crust-v7';
  texture.repeat.set(13, 13);
  texture.userData.normalMap.repeat.copy(texture.repeat);
  // One continuous adaptive grid keeps foreground and distant snow seamless.
  const mobile = innerWidth < 700;
  const innerSegments = mobile ? 128 : 210, outerSegments = mobile ? 48 : 100;
  const coordinates = [];
  for (let i = outerSegments; i > 0; i--) coordinates.push(-18 - 162 * (i / outerSegments) ** 1.7);
  for (let i = 0; i <= innerSegments; i++) coordinates.push(-18 + i / innerSegments * 36);
  for (let i = 1; i <= outerSegments; i++) coordinates.push(18 + 162 * (i / outerSegments) ** 1.7);
  const side = coordinates.length;
  const positions = new Float32Array(side * side * 3);
  const colors = new Float32Array(side * side * 3);
  const uvs = new Float32Array(side * side * 2);
  for (let row = 0; row < side; row++) {
    for (let column = 0; column < side; column++) {
      const index = row * side + column;
      const x = coordinates[column], z = coordinates[row], y = terrainHeight(x, z);
      positions.set([x, y, z], index * 3);
      uvs.set([x / 56, z / 56], index * 2);
      const shade = THREE.MathUtils.clamp(.05 + fractal(x * 2.1, z * 2.1, 73) * 1.19 + y * .007, 0, 1);
      const color = low.clone().lerp(high, shade);
      colors.set([color.r, color.g, color.b], index * 3);
    }
  }
  const indices = new Uint32Array((side - 1) ** 2 * 6);
  let cursor = 0;
  for (let row = 0; row < side - 1; row++) {
    for (let column = 0; column < side - 1; column++) {
      const a = row * side + column, b = a + 1, c = a + side, d = c + 1;
      indices.set([a, c, b, b, c, d], cursor); cursor += 6;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  world.scene.add(mesh);
}

function createGlow(world) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const radial = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  radial.addColorStop(0, 'rgba(255,255,255,1)');
  radial.addColorStop(.32, 'rgba(228,242,255,.62)');
  radial.addColorStop(1, 'rgba(220,240,255,0)');
  ctx.fillStyle = radial; ctx.fillRect(0, 0, 128, 128);
  const innerGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas), color: new THREE.Color(1.8, 2, 2.4),
    transparent: true, opacity: .48, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  innerGlow.position.set(0, 1.85, -.35);
  innerGlow.scale.set(3.85, 3.85, 1);
  world.beacon.add(innerGlow);
  world.innerGlow = innerGlow;
  const light = new THREE.PointLight('#d4e8ff', 13, 8, 1.8);
  light.position.set(0, 1.75, -.4);
  world.beacon.add(light);
  const spillGeometry = new THREE.PlaneGeometry(7.6, 7.6, 36, 36);
  const spillVertices = spillGeometry.attributes.position;
  for (let i = 0; i < spillVertices.count; i++) {
    const x = spillVertices.getX(i) + .45, z = 1.0 - spillVertices.getY(i);
    spillVertices.setXYZ(i, x, terrainHeight(x, z) + .018, z);
  }
  const spill = new THREE.Mesh(spillGeometry, new THREE.MeshBasicMaterial({
    map: innerGlow.material.map, color: '#dceaff', transparent: true, opacity: .22,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  world.scene.add(spill);
  world.groundGlow = spill;
}

function createContactShadow(world) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(24,31,46,.22)');
  gradient.addColorStop(.72, 'rgba(24,31,46,.30)');
  gradient.addColorStop(1, 'rgba(24,31,46,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  const material = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, toneMapped: false
  });
  for (const [x, z, width, depth] of [[0, -.38, 6, 6], [0, 2.7, 2.7, 2.2]]) {
    const geometry = new THREE.PlaneGeometry(width, depth, 32, 32);
    geometry.rotateX(-Math.PI / 2);
    const vertices = geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const px = x + vertices.getX(i), pz = z + vertices.getZ(i);
      vertices.setXYZ(i, px, terrainHeight(px, pz) + .009, pz);
    }
    const shadow = new THREE.Mesh(geometry, material);
    world.scene.add(shadow);
  }
}

function createSnow(world) {
  const count = innerWidth < 700 ? 220 : 420;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (hash(i, 71) - .5) * 65;
    positions[i * 3 + 1] = hash(i, 72) * 18 - 1;
    positions[i * 3 + 2] = (hash(i, 73) - .5) * 65;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const streak = ctx.createLinearGradient(12, 4, 20, 28);
  streak.addColorStop(0, 'rgba(255,255,255,0)');
  streak.addColorStop(.5, 'rgba(255,255,255,1)');
  streak.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = streak; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(12, 4); ctx.lineTo(20, 28); ctx.stroke();
  const snow = new THREE.Points(geometry, new THREE.PointsMaterial({
    map: new THREE.CanvasTexture(canvas), color: '#e1e6f0', size: .09, opacity: .55, transparent: true, depthWrite: false
  }));
  world.scene.add(snow);
  world.snow = snow;
  world.snowPositions = positions;
}

export function buildWorld(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#a9b1c1');
  scene.fog = new THREE.FogExp2('#a9b1c1', .0145);
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 500);
  camera.position.set(-12.5, 3.1, 13.4);
  const beacon = new THREE.Group();
  beacon.position.y = -.17;
  scene.add(beacon);
  const world = { scene, camera, beacon, parts: [], tracking: [], animatedMaterials: [] };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, toneMapped: false,
    uniforms: { resolution: { value: new THREE.Vector2(innerWidth, innerHeight) } },
    vertexShader: 'varying vec3 skyDirection; void main(){skyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `
      varying vec3 skyDirection;
      uniform vec2 resolution;
      void main() {
        float elevation = smoothstep(-.08, .45, normalize(skyDirection).y);
        float horizon = smoothstep(0.0, 1.0, gl_FragCoord.x / resolution.x);
        vec3 color = mix(vec3(.25,.28,.34), vec3(.46,.50,.58), horizon);
        color *= 1.0 - elevation * .08;
        gl_FragColor=vec4(color,1.0);
      }
    `
  }));
  scene.add(sky); world.sky = sky;
  scene.add(new THREE.HemisphereLight('#e5eaff', '#384152', .28));
  const sun = new THREE.DirectionalLight('#f9fbff', 2.85);
  sun.position.set(10, 9, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(innerWidth < 700 ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: .5, far: 50 });
  sun.shadow.normalBias = .030;
  sun.shadow.bias = -.00035;
  sun.shadow.radius = innerWidth < 700 ? 3 : 5;
  sun.shadow.intensity = .82;
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#c5d3eb', .26);
  fill.position.set(-7, 4, 8); scene.add(fill);
  const ice = surfaceTexture('ice');
  world.iceReflections = createIceReflections(renderer);
  ice.userData.reflectionMap = world.iceReflections.texture;
  const snow = surfaceTexture('snow');
  createIgloo(world, ice);
  createTerrain(world, snow);
  createContactShadow(world);
  createGlow(world);
  createSnow(world);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .46, .30, .88));
  composer.addPass(new OutputPass());
  world.composer = composer;
  return world;
}

const floatRotation = new THREE.Quaternion();
const floatPose = {};
const targetDisplacement = new THREE.Vector3();
const targetAngles = new THREE.Vector3();

export function updateIce(world, hovered, delta, pointer, motionIntensity) {
  let influence = null;
  if (hovered) {
    world.hoverPoint ??= hovered.point.clone();
    world.hoverPoint.lerp(hovered.point, 1 - Math.exp(-20 * delta));
    if (world.hoverPoint.distanceToSquared(hovered.point) < .00000001) world.hoverPoint.copy(hovered.point);
    influence = { point: world.hoverPoint };
  } else {
    // Re-enter at the new brick, rather than sweeping across the last hover point.
    world.hoverPoint = null;
  }
  let strongest = 0;
  for (const part of world.parts) {
    const { center, row, door, floatAxis } = part.userData;
    const target = brickInfluence(part, influence);
    const seed = part.userData.seed;
    const frequency = (8.5 + seed.y * 4.5) * (motionIntensity < 1 ? 1.4 : 1);
    const amount = stepHover(part.userData, target, delta, frequency);
    const easedTilt = THREE.MathUtils.damp(part.userData.hoverTilt || 0, amount, 9 + seed.x * 1.5, delta);
    const tilt = Math.abs(easedTilt - amount) < .0001 ? amount : easedTilt;
    part.userData.hoverTilt = tilt;
    strongest = Math.max(strongest, amount);
    part.userData.opening = amount;
    floatingPose(part.userData, pointer, motionIntensity, floatPose);
    part.userData.hoverOffset ??= new THREE.Vector3();
    part.userData.hoverOffsetVelocity ??= new THREE.Vector3();
    part.userData.hoverAngles ??= new THREE.Vector3();
    part.userData.hoverAngleVelocity ??= new THREE.Vector3();
    const radius = Math.hypot(center.x, center.z + .38) || 1;
    const outward = .16 * (.8 + seed.z * .5) * motionIntensity;
    targetDisplacement.set(
      (center.x * floatPose.spread + floatPose.x + center.x / radius * outward) * target,
      (floatPose.lift * .65 + .10 * motionIntensity) * target,
      ((center.z + .38) * floatPose.spread + floatPose.z + (center.z + .38) / radius * outward) * target
    );
    stepDisplacement(part.userData.hoverOffset, part.userData.hoverOffsetVelocity, targetDisplacement, delta, frequency);
    part.position.copy(center).add(part.userData.hoverOffset);
    targetAngles.set(floatPose.rx * target, floatPose.ry * target, floatPose.rz * target);
    stepDisplacement(part.userData.hoverAngles, part.userData.hoverAngleVelocity, targetAngles, delta, frequency * .85);
    part.rotation.set(part.userData.hoverAngles.x, part.userData.hoverAngles.y, part.userData.hoverAngles.z);
    if (floatAxis && row > 2) {
      floatRotation.setFromAxisAngle(floatAxis, floatPose.roofTilt * tilt);
      part.quaternion.premultiply(floatRotation);
    }
    const state = part.material.userData.shaderState;
    state.opening.value = amount * (door ? .04 : [0, .06, .26, .30, .30, .32, .32][row]);
  }
  world.innerGlow.material.opacity = .16 + strongest * .045;
  world.groundGlow.material.opacity = .25 + strongest * .025;
}
