# NIVAL

An interactive 3D website for an imaginary expedition studio, visually inspired by Igloo Inc. The scene is generated locally from original code: carved ice blocks, an arched entrance, snow, mountain terrain, frost textures, lighting, particles, and animation. No Igloo models, textures, or website scripts are bundled or loaded.

## Open the site

On Windows, double-click `start.bat`. The preview runs at <http://127.0.0.1:5173/>. Keep the terminal open while browsing. Node.js is required.

Alternatively:

```sh
npm install
npm run dev
```

`npm run build` creates the production website in `dist/`, ready for a static host.
`npm run preview` serves that build at <http://127.0.0.1:4174/>.

`npm test` checks stable hover picking, seamless detection across carved gaps, direction reversals, nearby and distant reactions, frame-rate independence, and exact return to rest. The production build is verified with `npm run build`.

## Explore

- The opening starts with an animated symbol loader, then a wireframe scan of the shelter, floating signal connections, and an overhead camera move into the landscape. Corner text decodes as the scene appears. Press **Escape** to skip the scan.
- Scroll or swipe to change the viewpoint around the shelter.
- Use arrow keys, Page Up/Down, Home, and End for keyboard navigation.
- Toggle the generated wind ambience with the sound control.
- Select the **NIVAL** wordmark to return to the opening view.
- The igloo starts fully assembled. Hover over a brick to lift and turn it. Surrounding bricks visibly lift and tilt too, with a smooth decrease in movement farther from the cursor. Distant bricks stay in place. The effect holds while the cursor is over the brick and eases back when it leaves. Press **P** to pause or resume cursor response and snowfall.

## Edit the scene

`src/scene.js` generates the geometry and surfaces. Change the dome rows in `createIgloo`, the hill definitions in `terrainHeight`, and the lighting in `buildWorld`. `src/intro.js` creates the original wireframe scan and surrounding signal field. `src/main.js` controls loading, camera movement, sound, and interaction. Brand content is in `index.html`; presentation is in `src/style.css`.

The igloo has six staggered masonry courses with smaller carved faces, a compact crown, and a barrel entrance with shorter, thinner blocks. Each block rests at its assembled position. Raycasting follows a continuous point on the assembled surface, keeping hover stable as bricks lift and avoiding jumps between tiles. Hover detection bridges the narrow carved seams. Each brick accelerates and settles with springs for its full displacement and rotation, preserving momentum when the cursor reverses direction. Rotation trails the lift slightly. Surrounding bricks receive a smooth distance-based influence across a radius of 2.25 scene units, with exactly zero influence beyond it. Leaving a brick returns it to its original position and rotation. Scrolling changes the camera view without separating bricks. Five tracking markers follow individual blocks and update their readings with the pointer. Frost patches, fine crystals, shallow striations, and hairline fractures give the ice detail, with brighter cut faces and chipped bevels. Color, normal, and ice roughness maps are baked procedurally at startup. The terrain uses a continuous grid with more detail near the camera, carved gullies, shadows, and light spilling from the ice. Mobile devices generate fewer terrain and block subdivisions.

The latest surface pass adds a smoother dome with taller shoulders, irregular shared masonry seams, and five entrance roof wedges fitted to one continuous arch. The entrance has gentler chips and thinner bevels at its joints. Fine directional scratches and branching fractures replace broad cloudy patches; each block samples a different region of the frost maps. Fine snow crust, rounded rocky outcrops, and patches of exposed slate vary the terrain. Contact shadows follow the ground. Stronger directional light contrasts dark faces with bright exposed cut surfaces during hover. Individual bricks have slightly different spring timing so the response passes smoothly through the nearby masonry. The opening scan and resting view use the same updated camera framing.

The bricks have dark, rough frosted faces with soft edge highlights and restrained sky reflections from a locally generated panorama. A faint, rough ice coating avoids sharp glare; the frost and fractures remain visible as the camera and hovered bricks move.

The scene uses Three.js. IBM Plex Mono is bundled under its open font license. A locally authored SVG igloo is shown when WebGL is unavailable. Reduced-motion settings shorten the introduction and reduce cursor movement and snowfall. This is an independent recreation of the reference's visual style, not a pixel-identical copy.





