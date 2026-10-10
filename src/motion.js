// Each brick's separated pose is blended by its local hover influence.
// Distances are in scene units; angles are radians. No clock enters this function.
export function floatingPose({ row, door, crown, portalRoof, seed }, pointer, intensity, out) {
  const phase = seed.z * Math.PI * 2;
  const x = pointer.x * intensity, y = pointer.y * intensity;
  const wave = Math.sin(phase + x * .75 + y * .55);
  const second = Math.sin(seed.y * 9 - x * .65 + y * .8);
  const turn = Math.sin(phase + 1.7 + x * 1.25 - y * .3);
  const roll = Math.sin(seed.x * 11 + x * .8 + y * .65);
  const amplitude = door ? (portalRoof ? .11 : .014) : crown ? .17 : [0, .055, .18, .19, .17, .14][row];
  const lift = door ? (portalRoof ? .07 : .015) : crown ? .43 : [0, .12, .47, .67, .61, .22][row];
  const spread = door ? 0 : crown ? .04 : [0, .02, .085, .09, .08, .06][row];
  const drift = door ? (portalRoof ? .065 : .008) : crown ? .23 : [0, .025, .15, .17, .16, .13][row];
  const rotation = door ? (portalRoof ? .18 : .018) : crown ? .29 : [0, .05, .22, .27, .30, .30][row];
  out.lift = lift + amplitude * (wave + second * .28 + y * .55) * intensity;
  out.spread = spread;
  out.x = drift * (turn + x * .8) * intensity + (crown ? .13 : 0);
  out.z = drift * (.68 * second - y * .55) * intensity;
  out.rx = rotation * (.85 * wave + .22 * second) * intensity;
  out.ry = rotation * turn * intensity;
  out.rz = rotation * .82 * roll * intensity;
  out.roofTilt = (crown ? .99 : row === 5 ? -.28 : row === 4 ? -.20 : row === 3 ? -.07 : 0) * (.72 + seed.x * .56);
  return out;
}
