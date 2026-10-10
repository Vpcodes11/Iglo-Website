# Asset sources

## Created for NIVAL

- Igloo: original procedural carved blocks fitted into six staggered courses of a rounded dome, a smaller crown block, and an angled barrel entrance with straight jambs and five roof wedges sharing one continuous arch.
- Terrain: original noise functions and mountain/foothill height fields, fine snow crust, eroded slopes, rounded rocky outcrops, exposed slate patches, and ground-conforming contact shadows.
- Ice and snow color and normal textures, plus ice roughness: generated with Canvas, including frost patches, fine crystals, directional scratches, shallow striations, and branching fractures with surface relief. Block UV offsets and seeded shader detail avoid identical patterns across the masonry.
- Glow, sky, snowfall, tracking lines, animation, and wind audio: generated locally.
- Ice reflections: a locally generated overcast panorama, filtered for faint reflections on rough, frosted ice.
- Opening: original animated symbol loader, model contour scan, triangular survey grid, moving signal field, camera transition, and text decoding. The wireframe uses our own generated block geometry.
- NIVAL brand, writing, interface, and SVG fallback: authored for this project.

Igloo Inc. was a visual reference. No models, textures, audio, or scripts from its website are included or requested at runtime.

## Third-party components

- Three.js and its bundled geometry/postprocessing helpers: MIT license, see `node_modules/three/LICENSE`.
- Vite: MIT license, used as the development/build tool.
- IBM Plex Mono Medium: SIL Open Font License, see `public/fonts/OFL.txt`. Obtained from Google Fonts.

These libraries and the font were not generated for this project.
