# Physics and interaction architecture audit

Inspection date: 2026-10-21. Source baseline: `5550a64`.

Scope: read-only inspection of existing HTML, CSS, and JavaScript. This report is the only file added. No implementation, layout, physics, shader, or asset changes were made.

Evidence terminology:

- **Verified:** directly established by source inspection. This does not mean browser-tested.
- **Inferred risk:** a consequence of the implementation that should be reproduced in a browser before changing code.
- **Recommendation:** proposed future work, not existing functionality.
- **Browser verification pending:** rendering, device behavior, interaction feel, performance, external services, and assistive-technology behavior have not been tested during this audit.

Line references refer to the baseline above. Paths are relative to the repository root. All nine tracked JavaScript files passed `node --check`; that check does not validate WebGL shader compilation or browser APIs. The working tree was clean before the report was created.

## 1. Executive summary

The existing artistic interactions are reusable. A visual redesign does not require replacing either main system.

1. **BarryMade is a custom per-card physics simulation rendered with DOM transforms.** Every project anchor becomes a body with position, velocity, rotation, dimensions, and interaction state. There is no third-party physics library and no background canvas behind these cards. The simulation includes collisions, boundary bounces, throwing, settling, hover tilt, proximity lighting, and animated tidying.
2. **The homepage galaxy is raw WebGL.** Its 4,200 or 12,000 point particles use static geometry buffers and GPU shader displacement. The galaxy-like strands come from a procedural material-density mask. Cursor repulsion, lighting, and camera parallax are integral to the effect. Preserve the shaders, geometry, timing, and palette contract during the initial UI work.
3. **Visual card variation is easier than physical variation.** Images, covers, and disc artwork can live inside existing rectangular bodies. Accurate circular or rotated-object collisions would require a substantial extension. Mixed dimensions are measured by the collision code, but Tidy Up uses the first card's dimensions for every slot.
4. **Workbench plus Archive is compatible with the current page.** Keep one bounded physics stage and add a separate normal-flow archive outside it. Use one project identity/content model and the existing routes. Do not put the entire growing archive into the simulation or create multiple independent project catalogs.
5. **Technical Studies can be an isolated module.** Click/tap/keyboard selection should load a single preview player. Optional drag-to-load should be scoped to that module, not grafted onto the Workbench's pointer handlers.
6. **Existing lifecycle weaknesses need explicit regression coverage.** Initial narrow-screen loads stay static after widening; desktop-initialized drag handlers remain attached after narrowing; reduced-motion galaxy mode can enter its animation loop after a visibility change. None of these were changed in this audit.

Recommended direction: keep the present interaction engines and multipage routing; refine typography, spacing, hierarchy, imagery, and controls around their existing contracts. Treat physical shape accuracy, dynamic simulation membership, and lifecycle hardening as separate decisions rather than incidental visual changes. A modern-retro language can come from editorial structure and restrained object metaphors without adding dashboard conventions, pervasive metallic decoration, or glass effects.

## 2. Current architecture and relevant source files

The repository is a static multipage site: 27 tracked HTML files and nine JavaScript files, with no package manifest, bundler, component framework, or shared animation library. `.nojekyll` is present. Most scripts are immediately invoked closures with page-lifetime state, not reusable mounted components.

| System | Entry and source files | Important source locations |
|---|---|---|
| Homepage galaxy | `index.html`, `assets/js/field.js`, `assets/css/hero.css`, `assets/css/main.css` | Canvas at `index.html:42`; script at `:110`; WebGL initialization `field.js:10–36`; shaders `:40–122`; geometry/material `:152–202`; loop `:287–336` |
| BarryMade Workbench | `barrymade/index.html`, `assets/js/barrymade.js`, `assets/css/barrymade.css` | Tidy button `index.html:53`; stage `:63`; actual cards `:67–180`; script `:198`; bodies `barrymade.js:41`; collisions `:89`; loop `:243` |
| Shared page transitions and nav | `assets/js/site.js`, `assets/css/main.css` | Click interception `site.js:12–26`; Back/Forward restore `:29–31`; nav `:34–55`; veil CSS `main.css:304–319` |
| Theme | `assets/js/theme.js`, `assets/css/main.css` | Initial storage read `theme.js:5–12`; `apply()` `:14–25`; controls/storage events `:27–41`; palettes `main.css:7–116` |
| Portfolio and project motion | `assets/js/portfolio.js`, `assets/css/portfolio.css`, `assets/css/barrymade-project.css`, `assets/css/project-media.css` | Scroll update `portfolio.js:14–37`; reveals `:40–58`; plate effects `portfolio.css:95–134`; beats `:192–200` |
| Contact | `contact/index.html`, `assets/js/contact.js`, `assets/css/contact.css` | Copy behavior `contact.js:8–45`; composer `:58–98` |
| Financial Analyst Arcade | `barrymade/financial-analyst-arcade/play/index.html`, `assets/js/financial-analyst-arcade.js`, matching CSS | API/state `js:10–249`; chat `:251–338`; prediction `:450–523`; Canvas chart `:527–778` |
| Parallel Crossy Road | `barrymade/parallel-crossy-road/play/{index.html,core.js,game.js,style.css}` | Independent simulation `core.js:10–132`; Canvas renderer `game.js:17–340`; controls/state/loop `:342–395` |
| Legacy navigation | `404.html`, `portfolio/project-2/index.html`, `portfolio/project-3/index.html` | Inline legacy-path redirects in 404; meta-refresh and canonical destinations in the two old project routes |

### Loading and scope

- Normal site pages load `theme.js` in the head before CSS, then `site.js` near the end of the body. The homepage adds `field.js`; BarryMade's index adds `barrymade.js`; Contact adds `contact.js`.
- Portfolio pages and BarryMade detail pages load `portfolio.js`. Some editorial project pages have few or none of its `.plate`/`.beat` targets; loading the script does not imply all scroll effects are present.
- The Financial Analyst Arcade play page uses the shared theme/nav plus its own app script.
- Parallel Crossy Road is intentionally separate: deferred `core.js` then `game.js`, independent CSS, no shared theme/nav script. Its `CrossingCore` global is the dependency between those two scripts.
- The actual BarryMade stage contains **13 project anchors**. The example `<a class="chip">` inside an HTML comment is not a fourteenth card.
- Project metadata is handwritten in HTML. There is no shared project registry, archive filter, Technical Studies collection, or player module yet. Project detail media and routes already exist and can be reused.
- Google Fonts affect measured card sizes. Local grain SVGs are static textures, not particle simulations. YouTube embeds and the external Market Strategy Lab demo are not local simulation implementations available for inspection here.

## 3. BarryMade physics system breakdown

### 3.1 Simulation and rendering model

**Verified:** `barrymade.js:10–14` obtains one `#stage` and snapshots all descendant `.chip` elements once. `bodies = chips.map(...)` at `:41–54` creates one body per anchor. This is a custom JavaScript simulation with CSS `translate3d`, Z rotation, and X/Y tilt, not Canvas, WebGL, Matter.js, or a general rigid-body engine.

The outer `.chip` is both the physical object and the navigable link. Its inner layers are `.chip__face > .chip__inner`, followed by metadata, title, note, and tools. CSS supplies textures, borders, depth, and lighting; JavaScript owns placement and motion.

| Body property | Meaning |
|---|---|
| `x`, `y`, `vx`, `vy` | Unrotated top-left position and linear velocity |
| `rot`, `vrot`, `rest` | Z angle, angular velocity, eventual resting angle |
| `w`, `h` | Layout size from `offsetWidth`/`offsetHeight` |
| `ox`, `oy`, `tox`, `toy` | Smoothed and target cosmetic proximity offsets |
| `tiltX/Y`, `tTiltX/Y` | Smoothed and target hover tilt |
| `lift`, `tLift`, `lit`, `tLit` | Smoothed and target elevation/light intensity |
| `held`, `focused` | Dragging and keyboard-focus state |
| `home` | Target position assigned by Tidy Up |

Despite the opening comment's reference to mass, there is **no mass, moment of inertia, gravity, friction surface, or torque model**. Free objects share overlap correction equally. Inertia is an approximation produced by persisted velocities and damping.

### 3.2 Position, momentum, and boundaries

`step(now)`, `barrymade.js:243–352`, runs continuously through `requestAnimationFrame`.

- In normal motion, each frame adds `vx/vy` to position and `vrot` to rotation.
- Linear velocities multiply by `0.942`; angular velocity multiplies by `0.915`.
- At stage edges, the offending velocity is reversed with a `0.44` bounce factor. Side-wall collisions also introduce rotation from vertical velocity.
- When linear speed and angular speed are both below `0.05`, velocities become zero and angle eases toward `rest` at `0.06` per frame.
- `clampInside()` at `:69–72` keeps the unrotated rectangle within measured stage bounds. It does not account for visual rotation, hover offsets, tilt, elevation, shadows, or pseudo-elements.
- `measure()` at `:60–67` uses the stage's bounding rectangle and each card's untransformed layout dimensions. It runs at boot, font readiness, and certain window resizes.

**Inferred risks:** timing is frame-based, so damping, settling, and travel differ between refresh rates. Pointer-event-derived velocity is also device/event-frequency-dependent. This is an interaction-feel constraint, not a reason to silently retune it during styling. A future delta-time conversion needs an agreed reference feel and comparison tests.

Do not scale or rotate `#stage` or its coordinate-bearing ancestors: `toStage()` only subtracts its bounding rectangle origin, while card dimensions remain layout pixels. Added stage padding/borders or new positioned card wrappers also need a coordinate review. A card larger than the stage cannot be meaningfully contained by the current clamp logic.

### 3.3 Collision detection

`separate(positionOnly)`, `barrymade.js:89–127`, checks every pair of bodies:

1. Compute center differences and overlap depths `px` and `py` from each rectangle's width and height.
2. Ignore pairs with no overlap on either axis.
3. Separate along the shallower overlap axis.
4. Split correction equally, except a held object receives zero correction and the other object receives the full correction.
5. Outside initialization, average the pair's velocity on the collision axis and reverse each object's deviation around that average using the bounce factor. Horizontal separation also adds angular velocity.

This is **axis-aligned bounding-box overlap resolution**. It does not rotate collision geometry with `rot`, perform swept collision detection, or substep fast movement. Apparent visual intersections or gaps are possible because rendered geometry and collision geometry differ. Two simultaneously held overlapping objects both have zero correction share.

Collision work is O(n²): 13 cards yield 78 pair checks per pass. Scatter runs 90 passes; font readiness runs another 40. That is small at today's collection size, but adding the full archive increases initialization and frame cost. One normal collision pass followed by clamping does not guarantee a collision-free packing in a crowded container.

### 3.4 Initial distribution

`boot()` at `:357–363` calls `measure()` and `scatter()`. Scatter (`:76–85`) chooses random positions within available dimensions, random angles in ±6 degrees, sets the same angles as rest targets, and zeros velocities. It then performs 90 position-only collision passes with boundary clamping.

There is no saved layout or deterministic seed. Reloading changes the arrangement. The font-ready callback (`:368–374`) measures again and performs 40 more relaxation passes. It does not re-scatter or await future image/video size changes.

**Inferred risk:** the comment “so nothing overlaps” describes intent, not a guarantee. If the available stage cannot fit the cards, overlap is unavoidable. Slow-loading new media can invalidate dimensions without triggering another measurement.

### 3.5 Dragging, throwing, and clicking

Pointer handlers are installed per card at `barrymade.js:155–210`.

- Primary-button `pointerdown` prevents the native default, attempts pointer capture, records the grab offset, marks the body held, zeros its velocities, and cancels global homing.
- During held `pointermove`, position follows the pointer minus the grab offset. Travel accumulates as `abs(dx) + abs(dy)`.
- Throw velocity is smoothed from pointer displacement: `v = v * 0.35 + delta * 0.65`. There is no elapsed-time division.
- Horizontal drag adds rotation capped at ±2.5 degrees per event. Positions are clamped after movement.
- `release()` handles both `pointerup` and `pointercancel`: cap speed magnitude at 42, derive angular velocity from horizontal velocity capped at ±9, choose a new ±3.4-degree resting angle, and release capture.
- A subsequent click is prevented if accumulated travel exceeds 6 pixels. Otherwise the anchor can navigate.
- `site.js:15` explicitly respects `event.defaultPrevented`, so a suppressed card click does not trigger the shared page fade/navigation.

**Fragilities to preserve/test:**

- The movement threshold uses cumulative Manhattan distance, not straight-line distance or time. Small jitter can count as a drag.
- `pointercancel` still applies throw behavior; it is not a distinct cancel-and-stop operation.
- There is no `lostpointercapture` handler, primary-pointer ownership check, or `pointerId` filtering inside move/release. Multi-touch and interrupted gestures require device testing.
- Pointer-down prevention may affect native focus, image dragging, selection, and modifier-click behavior. `site.js` respects Ctrl/Meta/Shift clicks, but the card's own pointer code does not explicitly exempt them.
- Travel resets on pointerdown or a suppressed click, not unconditionally on release. Keyboard activation after an unusual canceled gesture merits testing.
- Whole-card anchors must not acquire nested buttons, inputs, links, or native video controls. Those would conflict with both HTML semantics and the outer drag handlers.

### 3.6 Tidy Up

The first document-level `.tidy` button is bound at `barrymade.js:214–232`.

- Reads `cw/ch` from **the first body only**.
- Calculates columns from stage width with a hardcoded 16px gap; rows from total body count.
- Centers the resulting grid where space allows, assigns each body's `home`, and sets resting angle to zero.
- Sets `homingUntil = performance.now() + 900`.
- During homing, position and angle ease toward the targets by `0.14` per frame; velocities are zeroed. Pair collisions are skipped, but boundary clamping still occurs.
- A new drag cancels homing for the entire group. After 900ms, ordinary collision handling resumes.

This is a temporary alignment operation, not a persistent layout mode or reload/reset. It does not reshuffle, restore an original arrangement, or resize the stage. If rows exceed stage height, clamping can compress multiple targets against the boundary; subsequent collisions may disturb the grid. Mixed card sizes can overlap because slot size is not individualized.

### 3.7 Spotlight, hover, and depth

The visual effect has several cooperating layers:

- Stage pointer movement sets `--mx/--my` and `.is-lit` only for a fine, hover-capable pointer (`:136–145`). Pointer leave removes that class and clears pointer position.
- `.stage__lamp` is a dark radial overlay at z-index 40; `.stage__pool` is a bloom underneath at z-index 0. Both have `pointer-events: none` (`barrymade.css:61–88`).
- Per-card light is derived from center-to-pointer distance (`barrymade.js:298–308`): full light for coarse pointers, ambient target 0.5 when a fine pointer leaves, otherwise 0.12–1 using a 60–250px smooth falloff. Held/focused cards target 1.
- Proximity nudges nearby cards away by up to 12px within 310px (`:310–315`). This is a **cosmetic offset**, not a force on physical velocity.
- Hover selection scans bodies in reverse DOM order using unrotated physical boxes (`:260–267`). It does not test the transformed outline or actual visual z-order.
- Hover tilt uses pointer position within the box and a factor of 9; actual centered tilt reaches approximately ±4.5 degrees. Hover lift reaches 26px; held objects add another 34px.
- Cosmetic offsets, tilt, lift, and light ease separately. `step()` writes one composed transform and `--lit` at `:333–349`.
- CSS uses `--lit` for face overlays, border/shadow strength, and inner content opacity (`barrymade.css:110–153`). A face has grain and highlight pseudo-elements; preserve their layering when adding imagery.

**Important ownership rule:** never add a competing transform animation to `.chip`. Apply new decorative transforms to an inner layer. Shadows and disc silhouettes do not alter collisions. Hover hit tests can diverge from what looks visually topmost, especially after large changes to shape or elevation.

### 3.8 Dimensions, richer content, and object shapes

Current CSS uses a 244px outer width, a face minimum height of 11.25rem, two-line title/note clamps, and a single-line tools label (`barrymade.css:92–107,188–216`). This aims for similar footprints; `min-height` is not a guaranteed fixed height for arbitrary content or text zoom.

- **Supported now:** per-body width/height measurement, rectangular pair collisions, static semantic project links, decorative face styling.
- **Small controlled upgrade:** images with reserved dimensions inside the existing footprint; book covers, disc artwork, richer hierarchy, and noninteractive preview layers. Disable native image dragging in a future implementation and keep accessible titles.
- **Requires coordinated changes:** truly mixed outer dimensions, asynchronous size changes, taller previews, and responsive stage sizing. Measurement, packing, Tidy Up, and capacity need to agree.
- **Substantial change:** collision shapes that follow circles, polygons, large rotations, holes, or physical depth. A circular-looking object inside a square body is easy; accurate circle-versus-box dynamics and hit testing are not already implemented.
- **Animated previews:** technically possible, but avoid many simultaneous video decoders/canvases. Reserve geometry, show posters, activate selectively, pause when offscreen, and honor reduced motion. Do not put player controls inside the project anchor.

### 3.9 Failure, motion preferences, resize, and cleanup

| Condition | Verified behavior | Consequence / pending browser check |
|---|---|---|
| JavaScript disabled or gallery script fails before initialization | No `.is-static` default or noscript grid; `.chip` remains absolute at top-left | Cards overlap; static-first progressive enhancement is a future hardening task |
| Initial width below 760px | Adds `.is-static` and returns at `:23–26` | No physics, Tidy handler, or resize listener installed; widening later stays static |
| Initial reduced motion | Same early return | Readable static layout is intended; Tidy button remains visible but unbound |
| Coarse pointer at width ≥760px | Physics still initializes; `fine` controls lighting, not the early return | CSS's “no pointer” fallback comment is broader than actual behavior; test tablet dragging and scrolling |
| Desktop initialization, then narrow resize | After 160ms, adds `.is-static`; frame loop clears transforms/light overrides once | Original drag/click handlers remain active; `touch-action: none` also remains on cards. Grid gestures may still suppress scrolling/clicks |
| Desktop → narrow → wide | Remeasures and scatters on return to wide | Original positions are not retained; original narrow → wide behaves differently |
| Wide resize | Remeasures and clamps only | No general repacking, no recomputed Tidy targets; new overlaps may resolve over subsequent frames |
| Images load / container resizes without window resize | No observer or image-load measurement | Physics geometry may become stale |
| Preference or pointer capabilities change while open | `calm` and `fine` were sampled once | CSS updates may diverge from JavaScript behavior until reload |
| Workbench scrolls offscreen | Continuous frame loop continues | Archive integration increases time spent away from an active simulation |
| Page/module teardown | No destroy API or listener/RAF cancellation | Safe under ordinary page replacement; risky if moved into a client-side router or mounted twice |

## 4. Homepage particle system breakdown

### 4.1 Geometry and the galaxy composition

`field.js:15–22` requests WebGL with alpha, no antialiasing, premultiplied output compositing, and a high-performance preference, falling back to experimental WebGL. If unavailable, it hides the canvas. Shader compilation/link failure also hides it (`:124–147`). The CSS background remains.

`CFG`, `:25–36`, selects **4,200 particles below 760px, otherwise 12,000**, once at initialization. X spread is 17, Y spread 10, depth ranges from -16 to 2.5, camera Z is 9, field of view is 52 degrees, repulsion radius 2.6, force 1.35, and intro duration 2,600ms.

`field.js:156–169` generates positions with a center-biased average of three random samples for X/Y, a power-distributed Z, and independent phase/speed/size seeds. Arrays are uploaded as static attributes through `attrib()` (`:171–180`). There are no CPU-updated particle bodies or pair collisions.

The material pass (`:186–202`) derives projected X/Y from position and camera distance. Sine-modulated bands, narrow strands, a second thread, knots, and distance-based grain lighting generate `aMaterial`. This is central to the current galaxy silhouette. It changes density/pigment, not the position/seed buffers.

### 4.2 GPU animation and rendering

The vertex shader (`:40–94`) applies:

- Slow, independently phased sine/cosine displacement in X, Y, and Z.
- An entrance interpolation from a small normalized core to the drifting field.
- Depth-weighted cursor repulsion in XY; nearer particles react more.
- Perspective projection, depth-dependent point size, cursor glow, and distance fade.

The fragment shader (`:96–122`) discards point-sprite corners for circular grains, softens alpha radially, mixes neutral/mineral-blue/warm pigment colors from fixed seed/material attributes, and lights grains near the cursor. Rendering is one `gl.drawArrays(gl.POINTS, 0, n)` call per draw (`:297–307`), with depth testing disabled and blending enabled.

This is procedural shader motion rather than a gravitational galaxy simulation. That distinction describes implementation only; the galaxy identity should be preserved.

### 4.3 Cursor, touch, and scroll

Window `pointermove` (`:269–276`) converts the pointer relative to the canvas rectangle into approximate world coordinates using the projection. Cursor activation checks vertical bounds only, not horizontal bounds. Window `pointerdown` enables interaction without updating the position; document pointer leave disables it.

`frame()` (`:316–332`) eases cursor XY at 0.08 per frame, activation at 0.05, and camera parallax at 0.04 toward a small negative cursor offset. These listeners are passive and do not deliberately block page scrolling.

There is **no scroll animation listener in the field**. Scrolling changes canvas geometry relative to the viewport, but the cursor target is recalculated only on pointer movement. There is also no fine-pointer gate, pointer-up deactivation, or touch-specific interaction mode. Touch behavior, tapping before moving, and a stationary pointer during scrolling require browser verification. Moving the field to a narrow/non-full-width container would expose the vertical-only hit boundary assumption.

### 4.4 Timing, resize, performance, and lifecycle

- Drift and intro use elapsed wall time; intro applies cubic ease-out. Cursor/camera smoothing remains frame-based.
- The canvas backing size uses client dimensions and DPR capped at 2; `resize()` recalculates projection and viewport (`:248–262`). Particle count does not change when crossing 760px after load.
- A window resize triggers recalculation. There is no container `ResizeObserver`, so a UI change that resizes the hero without a window event can leave the backing buffer/projection stale.
- The animation continues while the homepage is visible even when the hero has scrolled offscreen.
- `visibilitychange` pauses via `running` and resumes with the previous elapsed time (`:287–295`). RAF IDs are not stored/canceled, so rapid visibility transitions warrant a single-loop check.
- Normal-motion context loss sets `running = false`; context restoration reloads the page (`:335–336`). There is no in-place GPU resource reconstruction or explicit disposal API.
- Desktop/mobile share the same shader pipeline. Narrow screens get fewer particles at load; device performance is not otherwise detected. Large hero dimensions, extra blur layers, high-resolution media, and additional preview loops could increase GPU/compositor load.

**Source-confirmed lifecycle defect to reproduce:** the `visibilitychange` listener is installed before the reduced-motion return at `:309–314`. Returning to a visible tab invokes the hoisted `frame()` function even when `calm` is true. `frame()` has no reduced-motion guard and schedules itself. Thus the “one still frame” path can become animated after tab visibility changes. The context-loss/restoration listeners are below the early return and are not installed for an initially reduced-motion page. No fix was made.

### 4.5 Theme and independence from UI

`updatePalette()` (`:208–225`) reads normalized comma-separated RGB triplets from `--field-dim`, `--field-cool`, `--field-lit`, and `--field-pigment`. These are **0–1 shader values**, unlike the 0–255 `--light-rgb` CSS tokens. Do not substitute hex strings or CSS RGB functions without adapting the reader.

Dark mode uses additive color blending; light mode uses alpha blending and opacity 0.76. `hero.css:21` also applies the theme's `--field-blend` (`screen` versus `multiply`). A `themechange` updates palette uniforms without recreating geometry or restarting the intro. In calm mode it explicitly redraws the still frame.

`hero.css:5–41` establishes the containing block and stack: canvas at z-index 0, a noninteractive readability wash at 1, and hero content at 2. `index.html:42` marks the decorative canvas `aria-hidden="true"`.

**Compatibility:** the field can remain unchanged while nav, text, and controls are refined, provided `#field`, its sizing/stack, the palette tokens, and event contract remain intact. A larger title, opaque overlay, changed hero height, or transformed ancestor can change the perceived galaxy or cursor alignment even with identical JavaScript. Use visual comparison as well as source checks. Keep the field implementation untouched in Phase A; investigate its lifecycle issues as a separately reviewed maintenance change.

## 5. Shared interaction and animation inventory

| Interaction | Verified implementation | Dependencies and caveats |
|---|---|---|
| Page entrance | `.veil` CSS animation lifts from opacity 1 to 0 over 0.5s (`main.css:304–313`) | Independent of JS success; pointer events disabled |
| Internal page exit | Document click handler closes veil, waits 260ms, then assigns location (`site.js:12–26`) | Skips canceled events, hash-only links, external hosts, `_blank`, Ctrl/Meta/Shift/non-primary clicks; does not explicitly handle downloads or arbitrary named targets |
| Back/Forward recovery | `pageshow` removes `.is-closing` (`site.js:29–31`) | Must remain even if navigation styling changes; actual bfcache behavior pending verification |
| Navigation | Fixed nav; scroll >40px toggles `.is-stuck` through a queued RAF; underline/color on hover/current page | `.nav`, `.nav__link`, `aria-current`; project pages use additional `[aria-current="true"]` rules in `portfolio.css:78–79` |
| Homepage entrance | `rise` animations stagger name lines, description, entry links, and scroll cue (`hero.css:55–69,124–136`) | Separate from galaxy intro; changing one does not synchronize the other |
| Homepage links/doors | Entry lift/shadow on hover and press; door wash on hover (`hero.css:92–113,165–184`) | Keep native anchors and focus visibility; avoid adding overlays that intercept events |
| Reading progress | `.progress` receives document scroll ratio via `scaleX` (`portfolio.js:14–18`) | Progress still updates under reduced motion; ratio is not explicitly clamped for overscroll |
| Media plate scroll | `--enter` from viewport position drives scale, highlight sweep, and image parallax (`portfolio.js:22–28`; `portfolio.css:103–134`) | Requires those selectors/custom properties; mobile rule disables outer scale but not every inner transform |
| Text reveals | IntersectionObserver adds `.is-in`, then unobserves; 15% threshold and bottom root margin -14%; stagger 0/60/120/180ms | Targets snapshotted once. `.js .beat` stays hidden if the early inline class runs but `portfolio.js` fails |
| Project/media links | Portfolio title shifts on hover/focus; CTA lifts; image links open original media; video iframes use native controls | No custom carousel or local media-player controller found. Keep full-size links and iframe titles |
| Theme | Saved `barry-theme`, root `data-theme`, button pressed state/title, theme-color meta, `themechange`, cross-tab storage synchronization | Defaults to dark, not OS preference. Selects only the first `.theme-toggle`; duplicating controls needs synchronization work |
| Theme transition | Token swap plus existing property-specific CSS transitions | No dedicated theme animation engine or geometry reset; WebGL uniform update is immediate |
| Contact | Clipboard API with scratch-textarea fallback; temporary copy status; mailto composer with empty-message focus and live status | Preserves `.copy[data-copy]`, `.send[data-to]`, field IDs, `.compose__status`; no server submission |
| Global motion reduction | CSS shortens animation/transition durations to .001ms and disables smooth scroll (`main.css:381–388`) | CSS media query reacts live; most JS `matchMedia(...).matches` values are load-time snapshots |
| Texture/ambient wash | Fixed body pseudo-elements and grain SVG (`main.css:140–162`) | Static, noninteractive; not additional particle systems |

### Other local simulations and effects

**Parallel Crossy Road:** `core.js` separates simulation from rendering. `Crossing` builds deterministic seeded lanes, moving hazards and river platforms, a six-second safe/warning/danger curse cycle, 0.16s hops, support checks, boundary loss, and scores. `update(dt)` caps incoming time at 0.1s and subdivides into at most 1/120s steps (`core.js:96–130`); this is more time-aware than the Workbench. Distant lanes are pruned and reproducible from the seed.

`game.js` draws a procedural isometric scene with Canvas 2D: depth-sorted objects, rotating boulders and thorn wheels, boar gait, bobbing giant mushrooms, rippling water marks, hop arcs, glows, and 12 fireflies (`:79–181,225–340`). These are separate from the homepage field. Camera following uses a delta-time exponential blend (`:388–393`). Reduced motion disables decorative spin/bob and hop lift and snaps the camera, while gameplay still moves.

Keyboard arrows/WASD, P/Escape pause, R restart, Enter on canvas, and touch D-pad buttons are implemented (`game.js:363–387`). Visibility loss and blur auto-pause gameplay. Focus returns to canvas on play and to overlay controls on pause/game over; live status and best-score storage exist. The drawing RAF still runs while paused. `ResizeObserver` is assumed available; DPR is capped at 2. Its document-level keyboard bindings would interfere with other interfaces if copied wholesale into a shared page. Preserve the standalone route rather than embedding its scripts directly into the Workbench.

**Financial Analyst Arcade:** this is an API-driven interaction/state system, not a local physics engine. It includes loading/retry states, chat, prediction locking, confidence/direction controls, and a Canvas 2D chart with line/candle modes and pointer session inspection (`financial-analyst-arcade.js:527–778`). The chart redraws on data/view/pointer changes, resize, fonts ready, and `themechange`; there is no permanent chart RAF loop. Each draw resets its backing dimensions and uses uncapped device DPR (`:612–621`), so high-DPR pointer inspection merits profiling. Pointer inspection has no equivalent per-session keyboard handler in the inspected script.

API requests use AbortController timeouts; an epoch protects against obsolete responses. Loading indicators pulse with CSS `faa-pulse` (`financial-analyst-arcade.css:135,441–443`). Prediction reveal scrolls smoothly unless reduced motion is active (`js:503`). Keep its app IDs/data attributes and error/retry states intact. Live API availability was not tested.

### Lifecycle summary

The site currently relies on full-document navigation to end most listeners and loops. There is no shared scheduler, teardown registry, route mounting system, or dynamically observed card membership. Adding an Archive does not require any of those. Introducing client-side routing, moving active DOM nodes between views, or mounting multiple stages would change that assumption and should be treated as architectural work.

## 6. Physics and UI dependency map

| Producer / owner | Contract consumed elsewhere | Safe boundary for future changes |
|---|---|---|
| `theme.js` | Root `data-theme`, `barry-theme`, `themechange` | Keep event name/storage behavior; synchronize any additional toggle explicitly |
| `main.css` | Color, font, spacing, shadow, field, and easing variables | Refine UI tokens carefully; preserve field token format and independently review galaxy palette changes |
| `index.html` / `hero.css` | One correctly sized `#field` and foreground stack | Change surrounding typography/navigation without remounting canvas or covering it |
| `barrymade/index.html` | One `#stage`, 13 anchor bodies, one `.tidy` | Keep stable physical nodes and project URLs; new Archive/player roots belong outside stage |
| `barrymade.css` | Absolute origin, width/height, face structure, perspective, static grid | Decorate within the physical shell; do not compete for its transform |
| `barrymade.js` | Inline `.chip` transform, `--lit`, `.is-held`, `.is-static`, `.is-lit`, `--mx/--my` | These are owned simulation outputs; do not overwrite with filtering/animation utilities |
| Card click handler | Canceled click after drag | Shared document navigation must honor `defaultPrevented` |
| `site.js` | `.veil.is-closing`, `.nav.is-stuck`, current-page ARIA | Preserve selectors/260ms exit contract and pageshow recovery |
| `portfolio.js` | `.progress` transform, `.plate --enter`, `.beat.is-in` | Avoid applying these classes to new physics bodies or player controls |
| Project routes/media | Existing anchor destinations, project-relative `media/`, local `/play/` routes | Workbench, Archive, and Studies should reference the same canonical item identity |
| Standalone game | `CrossingCore`, `#game`, dedicated document keyboard controls | Keep separate document scope; do not import its CSS/global handlers into BarryMade |

Proposed ownership split: a shared content record identifies the project; a Workbench renderer produces a bounded featured subset; an Archive renderer exposes the full collection; a Studies module selects one study for playback. These are coordinated views of one catalog, not separate catalogs with drifting metadata. That catalog/rendering layer does not exist yet.

## 7. Reusable systems and technical limitations

### Reuse with minimal disturbance

- Preserve the galaxy's shaders, static attributes/material pass, palette integration, projection, and cursor behavior as one page-specific unit.
- Preserve the Workbench's interaction feel, body state, pointer/click contract, and transform composition. Keep visual improvements inside existing body shells first.
- Reuse native project anchors, existing detail routes, project media, focus styling, palette tokens, and shared navigation.
- Preserve direct Portfolio previews and individual project pages; no additional selection mechanism is needed there.
- Keep the isolated game simulation/render split and the arcade's request/state handling intact.

### Limits and risk priorities

| Priority | Finding | Verified source / interpretation |
|---|---|---|
| High | Reduced-motion galaxy can animate after tab return | `field.js:290–313,316–332`; source control-flow defect, browser reproduction pending |
| High | No-JS Workbench has overlapping cards | `barrymade.css:92–96`; fallback class is only added by JS |
| High | Responsive fallback depends on initialization history | `barrymade.js:23–26,155–210,377–387`; retained handlers can act in a visually static grid |
| High for richer cards | Tidy assumes one footprint; dimensions can become stale | `barrymade.js:60–67,217–230,368–387`; no image/container observer |
| High for Archive integration | Filtering/removing active `.chip` nodes does not update bodies | One-time capture at `barrymade.js:13,41`; hidden bodies can still collide and detached nodes remain referenced |
| Medium | Unbounded animation work while offscreen | Workbench and field have no intersection-based suspension; Workbench has no app-level visibility suspension |
| Medium | Refresh/event-rate-dependent Workbench feel | Per-frame damping and per-pointer-event velocity; no fixed step or dt |
| Medium | Physical, visual, and hit-test geometry differ | AABB collisions versus rotated/tilted/offset DOM; greater variation increases mismatch |
| Medium | Script-failure reveal trap | `.js` applied before the external reveal script; `.js .beat` hidden without `.is-in` |
| Medium | Accessibility relies on direct navigation rather than physics manipulation | Anchor focus/activation exists; no keyboard rearrangement, motion pause control, or selectable static mode in active Workbench |
| Medium | New media can dominate resource usage | Multiple animated previews compound existing shadows, blending, and frame writes; not measured |
| Lower until modular mounting | No disposal/reinitialization APIs | Current full-page lifecycle masks this; a client-side router or duplicate initialization would expose it |

**Recommended modularization:** introduce project metadata and independently scoped Archive/Studies modules first. If later necessary, expose Workbench `init`, `measure`, `pause/resume`, and `destroy` boundaries without changing its math in the same commit. A gallery membership API is needed only if live addition/removal is required. Keep the galaxy algorithm and standalone game core untouched during UI work. Do not introduce a general physics library, site-wide animation framework, or client-side router solely for this redesign.

## 8. Compatibility assessment for the proposed redesign

| Proposed change / question | Current support | Required work and judgment |
|---|---|---|
| Preserve engine, improve card appearance | Yes, within current body geometry | Low difficulty: inner-face styling, hierarchy, and reserved-size imagery; protect outer transform and hit target |
| Image cards / book-like objects | Decorative versions supported | Low to moderate: common footprint and internal cover/spine treatment. True varied sizes need packing/measurement changes |
| Disc-inspired objects | Disc artwork inside a rectangular body supported | Low for visual metaphor; users may notice rectangular spacing. Accurate circular collision/hit geometry is substantial work |
| Mixed aspect ratios | Individual rectangle dimensions are measured | Not fully supported end to end: Tidy, capacity, resize, and content loading require coordinated changes |
| Archive below Workbench | Compatible with unchanged stage initialization | Moderate new feature, low simulation coupling; separate root/classes, normal document flow, shared project identity |
| Archive alongside Workbench | Possible, but changes stage width/capacity | More responsive risk than below; viewport ≥760px does not guarantee the narrower stage can fit cards |
| Filter Archive only | No existing filter, straightforward isolation | Moderate: accessible controls, count/empty state, persistent item links; leave physics bodies untouched |
| Filter/repopulate active Workbench | Not supported by current one-time snapshot | Significant lifecycle work: membership, measurements, targets, event cleanup, and stable node identity |
| Separate Technical Studies player | No existing module; no physics dependency needed | Moderate: scoped root, one player, direct selection, optional drag adapter; no `.chip`/`#stage` reuse |
| Upgrade homepage UI, retain galaxy | Yes, with DOM/CSS/token contract preserved | Low to moderate; exact appearance depends on hero dimensions, occlusion, and blending |
| Large physically diverse archive simulation | Not a safe extension of current assumptions | Significant changes to collision model, packing, performance, and accessibility; unnecessary for the proposed hybrid |
| Multiple stages / SPA mounting | Not supported as-is | Significant lifecycle/scoping work; avoid unless a separate product requirement appears |

Suggested default decisions: uniform physical shells with visually varied interiors; a curated Workbench plus complete Archive below; one catalog with stable IDs/routes; separate Technical Studies module; explicit selection first and optional drag second. These are recommendations for approval in a later implementation task, not changes made here.

## 9. Do Not Break / Preserve checklist

All tests below are **suggested browser verification**, not completed test results. Record a baseline before editing. Cover Chromium, Firefox, and Safari where available; mouse, touch/tablet, and keyboard; both themes; reduced motion on/off; initial and resized widths around 760px; slow media/fonts; and Back/Forward navigation. Compare 60Hz and high-refresh displays for interaction feel.

| Preserve | Sources / selectors / functions and dependencies | Risk from HTML/CSS changes | Browser verification gate |
|---|---|---|---|
| [ ] Galaxy composition, grain density, drift, depth, intro | `field.js:25–202,297–332`; `#field`; shader attributes/material | Canvas replacement, opacity/blend changes, new overlays, altered hero aspect | Observe full entrance and steady state; compare both themes and mobile/desktop before/after |
| [ ] Galaxy cursor repulsion, glow, parallax | `field.js:269–279,324–328`; canvas rectangle/projection | Scaled containers, moved canvas, changed event surfaces | Move across edges/links; scroll with stationary pointer; tap and drag on touch; verify navigation still works |
| [ ] Galaxy resize and lifecycle | `resize()`, visibility/context handlers; `field.js:248–336` | Container-only resizing, remounting, duplicate listeners | Resize/orient; hide/show tab; Back/Forward; simulate context loss; confirm a single loop and document known reduced-motion defect |
| [ ] Galaxy fallback and reduced-motion texture | `field.js:22,141,147,309–314`; CSS wash | New content depending on WebGL success | Disable WebGL; enable reduced motion before load; switch tabs and themes; keep readable foreground |
| [ ] Per-card scatter, collisions, boundaries, settling | `barrymade.js:41–127,243–295`; `.stage`, `.chip` | Outer dimensions/positioning/transforms, stage padding or reduced capacity | Repeated reloads, throws into neighbors/walls; text zoom, font swap, narrower stage; inspect clipping/overlap |
| [ ] Drag and throw momentum | `toStage()`, pointer handlers, `release()` at `:131–201` | Nested controls, native image drag, overlay capture, scaled ancestor | Slow drag, fast flick, release outside stage, pointer cancel, touch scrolling, multi-touch interruption |
| [ ] Click navigation remains distinct from drag | `barrymade.js:204–206`; `site.js:15–25`; anchor href | New click delegation or stopPropagation, replacing anchors | Click without movement, drag >6px, slight jitter, Ctrl/Meta click, keyboard Enter after a drag; no accidental page exit |
| [ ] Tidy Up and drag-to-interrupt | `.tidy`, `home`, `homingUntil`, `step()`; `:214–232,270–275` | Mixed sizes, extra `.tidy`, increased count, content growth | Tidy repeatedly; interrupt mid-tidy; resize during homing; test smallest active stage and loaded media |
| [ ] Spotlight and card depth | `.stage__lamp`, `.stage__pool`, `--mx/--my`, `--lit`; `:298–349`; CSS `:61–153` | Z-index, pointer-events, opacity, face pseudo-elements, broad transform rules | Enter/leave gallery; hover overlapping cards; focus cards; drag under overlay; compare both themes/coarse pointer |
| [ ] Keyboard access to every project | Anchor bodies; focus/blur at `barrymade.js:208–209`; global focus CSS | Hidden labels, nested controls, clipped focus rings, visual-only order | Tab through every project and Tidy; activate with Enter; inspect focus visibility with screen reader and zoom |
| [ ] Readable static/narrow layout | Early fallback and `.stage.is-static`; CSS `:224–245` | Reliance on JS for basic layout; retained desktop pointer handlers | Initial narrow load, narrow→wide, wide→narrow→wide, no JS; document current failures before hardening |
| [ ] Shared navigation/veil/Back recovery | `.nav`, `.nav__links`, `.nav__link`, `.veil`; `site.js:12–55`; CSS `:198–319` | Missing selectors, changed timing, overlays/stacking, renamed routes | Navigate all sections; Back/Forward repeatedly; external/new-tab/hash links; small-screen nav and theme control reachability |
| [ ] Theme persistence and live recoloring without restart | `theme.js:5–41`; `data-theme`, `barry-theme`, `themechange`; main palette | Renamed tokens, invalid field RGB format, duplicate toggles | Toggle during galaxy intro/drag/tidy; reload and cross-tab changes; blocked storage; no geometry reset |
| [ ] Homepage typography/link entrances and hover feedback | `hero.css:55–69,92–113,124–136,165–184` | Broad animation overrides, reduced-motion removal, opaque covers | First load, keyboard focus, pointer hover/press, reduced motion; all primary links remain accessible |
| [ ] Portfolio direct access and project scroll effects | `.index__preview`, `.progress`, `.plate`, `.plate__img`, `.beat`; `portfolio.js`; portfolio CSS | Applying outer transforms elsewhere, removing reveal targets, sticky containment changes | Open every completed project directly; scroll both directions; mobile and reduced motion; block reveal JS and check readable content |
| [ ] Existing full-size media links and video demos | Project HTML anchors/iframes; `project-media.css`; editorial CSS | New wrappers capture clicks; iframe overlays; wrong aspect ratios | Open original images; play embedded demos; keyboard controls; fallback external links; no autoplay pile-up |
| [ ] Contact copy and mail composer | `contact.js:8–98`, field IDs/data attributes/status | Replacing buttons/IDs, interrupting clipboard or mailto | Copy success/failure; empty message focuses textarea; populated mailto; live status; address still directly usable |
| [ ] Arcade chart, chat, lock/reveal/retry states | `financial-analyst-arcade.js`; app IDs; `faa-pulse`; theme events | Global CSS/ID collisions; resize changes; removing status controls | API success/error/slow response; retry; view toggle; pointer/touch chart inspection; theme/resize; keyboard form use |
| [ ] Crossy Road simulation and procedural effects | `CrossingCore`, `Crossing.update`, `game.js` renderer/fireflies, standalone CSS | Importing site globals/keyboard handlers, changing Canvas geometry | Start/hop/collide/ride/curse/pause/restart; D-pad; blur/visibility; focus return; reduced decoration; score persistence |
| [ ] Existing project and legacy routes | All project hrefs; 404 redirect map; old portfolio redirects | Renaming folders or generating inconsistent Archive/Studies URLs | Direct-load routes, old links with query/hash, unknown 404 recovery, and returns from play routes |

For new cards, add explicit tests for delayed image decode, failed thumbnails, unusually long titles, 200% text zoom, and pointer-down on the image itself. For an Archive, verify that filtering changes neither Workbench body count nor its existing handlers. For a player, verify that selection and Escape do not hijack unrelated navigation or game controls.

## 10. Recommended implementation phases

### Baseline gate before Phase A

Capture the current interaction behavior and screenshots/video at representative desktop/mobile sizes and both themes. Reproduce the source-identified lifecycle/fallback issues separately, so existing defects are not mistaken for redesign regressions. Decide whether those fixes will precede design work or be isolated maintenance changes. This audit authorizes no fixes.

### Phase A — Global UI refinement

**Scope:** navigation layout, typography, hierarchy, spacing, focus states, and control presentation. Keep Portfolio, BarryMade, About Me, Contact, and the theme toggle reachable. Retain all complete Portfolio projects and detail pages. Preserve galaxy source, geometry, material, and interaction logic.

**Dependencies:** agree on a restrained modern-retro visual direction and a reference screenshot set. Inventory repeated header markup so changes remain consistent across static pages. Keep one working theme toggle per page and existing event/selectors.

**Difficulty:** low to moderate; broad regression surface because `main.css` is shared.

**Major risks:** changing font metrics affects card heights; larger nav or hero text can obscure the galaxy; palette token changes can alter shader output; stacking contexts can block links or veil behavior. Do not treat `--field-*` as ordinary text-color tokens.

**Exit tests:** all primary navigation and project links work; Back/Forward restores pages; no control overlap at narrow widths/zoom; both themes persist; keyboard focus remains visible; galaxy intro/drift/cursor response matches the baseline. Run game/contact/arcade smoke checks for shared-style regressions.

### Phase B — BarryMade Workbench upgrade

**Scope:** improve card imagery, title hierarchy, and object presentation inside a stable outer physical footprint. Keep one stage, the current simulation, native links, Tidy, throwing, spotlight, and hover depth. Begin with a small number of representative cards before upgrading all.

**Dependencies:** choose physical footprint versus true mixed-size objects; choose a bounded Workbench membership policy; supply optimized thumbnails/posters. Reserve media space before load. Agree on static-mode and reduced-motion expectations before lifecycle changes.

**Difficulty:** moderate for stable shells; high if mixed geometry or new collisions are required.

**Major risks:** outer transform competition, stale dimensions, overcrowding, Tidy overlap, native image dragging, and nested controls. A new fixed-size image region may still require a larger common shell; recalculate capacity before adopting it. Keep loading previews and image controls out of the anchor's input path.

**Exit tests:** all card preservation checks in section 9; slow fonts/media and failed images; Tidy at smallest active stage; click versus drag; interrupted gestures; keyboard activation; initial/resized static modes; high-refresh feel comparison. Profile frame cost with the intended number of previews. Do not declare success from screenshots alone.

**Optional separate maintenance work:** static-first fallback, correct static-mode input disabling, live preference handling, and measurement hooks. Keep these separate from visual commits and avoid retuning simulation constants while fixing lifecycle behavior.

### Phase C — Archive integration

**Scope:** a normal-flow, accessible archive below the Workbench, with category/tool filters and direct project links. Use existing project detail routes and media. Prefer below over alongside initially to avoid reducing stage width.

**Dependencies:** establish stable project IDs, titles, categories, tags, thumbnail paths, routes, and a `featured`/Workbench selection flag in one content source. Decide whether HTML is generated at build time or enhanced at runtime. The current site has no build system, so do not add one without a deliberate decision. If runtime rendering is chosen, preserve a useful no-JS archive and initialize physics only after its cards exist.

**Difficulty:** moderate; little physics risk if scope remains separate.

**Major risks:** duplicated metadata, filtering active bodies with `display:none`, moving the same live node between containers, accidentally selecting Archive items as `.chip`, and an ever-growing simulated collection. A curated Workbench and a complete Archive may show the same project in both contexts, but must share identity/content rather than become independent collections.

Use an Archive-specific root and classes, native filter controls, result counts, an empty state, and stable focus after filtering. Initially filter only the Archive. Do not alter active Workbench membership. Consider separately pausing offscreen simulation work once browser profiling shows the cost of browsing below it.

**Exit tests:** every intended project is discoverable and routes correctly; filters/reset work by keyboard and touch; no-JS content remains useful; counts/status are understandable; Workbench behavior/body membership remains unchanged; resizing and scrolling through the Archive do not break the stage. Check load and frame cost with the full collection.

### Phase D — Technical Studies player

**Scope:** a dedicated BarryMade collection for VFX, Houdini, shaders, and tools, optionally using disc artwork/selection. It is a collection/player interface, not another free-floating physics gallery.

**Dependencies:** agree on study taxonomy and whether studies have their own detail routes; provide media/posters and accessible descriptions/captions as appropriate; decide inline versus separate collection page. Reuse the catalog from Phase C and existing theme conventions.

**Difficulty:** moderate for direct selection; moderate to high if optional drag-to-load, complex media sequencing, or custom player controls are added.

**Major risks:** global pointer/keyboard listeners, reuse of `.chip`/`.tidy`/`#stage`, nested interactive elements, simultaneous media playback, focus loss, and motion-heavy ornamental spinning. Keep selectors under a dedicated player root; use buttons for in-page selection and anchors for navigation. Maintain one active media element/embed and pause/unload the previous selection as appropriate.

Direct click/tap/keyboard selection must always work. Optional drag-to-load should call the same selection action through local handlers and provide cancellation; it must not be required to reveal content. Give loading, selected, playback, empty, and error states readable labels. Keep disc spin/decorative motion optional and respect reduced motion. A native media player or existing embed controls are preferable to inventing playback controls without need.

**Exit tests:** select every study without dragging; keyboard focus/state announcements are coherent; no unintended Workbench motion or navigation; only one preview plays; media failure has a useful fallback; reduced-motion and mobile use remain straightforward; Back/Forward/direct links behave according to the agreed routing design. Profile memory/decoders after repeated selection.

## 11. Unresolved questions and decisions requiring owner input

1. **Physical fidelity:** should cards retain a common rectangular body with varied artwork, or should books/discs collide according to their visible shapes? Recommended first step: varied interiors, common physical shell.
2. **Workbench membership:** all current projects or a curated featured subset as the Archive grows? Recommended: a bounded subset, with the Archive as the complete collection.
3. **Archive relation:** should filters affect only the Archive, or also rebuild the Workbench? Recommended: Archive only initially; rebuilding the stage adds lifecycle complexity.
4. **Technical Studies destination:** inline within BarryMade or a dedicated collection route? Either can be isolated; a separate route gives more room and naturally limits concurrent animation/media work.
5. **Study media:** videos, still sequences, interactive demos, or a mixture? This determines player controls, loading, captions, resource limits, and external-host dependencies.
6. **Preview policy:** static posters, intentional hover/focus previews, or click-to-play? Recommended: posters first and only one intentional animated preview at a time.
7. **Content ownership:** retain handwritten HTML with a deliberate synchronization workflow, or introduce one catalog that generates/enhances both views? Recommended: one stable project record per item; choose delivery tooling separately.
8. **Motion controls:** is reduced-motion preference plus responsive fallback sufficient, or should users be able to choose a static Workbench/pause ambient motion? The current active Workbench has no such explicit control.
9. **Bug-fix sequencing:** should source-identified lifecycle/fallback issues be fixed before Phase A? Recommended: reproduce them, then make narrowly scoped fixes independently of visual changes.
10. **Preservation strictness:** does “unchanged galaxy” mean unchanged algorithm and motion, or an exact palette/composition match as well? Recommended: preserve both during Phase A and review any future palette adjustment explicitly.
11. **Acceptance devices:** which phones/tablets and browsers matter most, and is high-refresh consistency a requirement? Performance budgets should follow a measured baseline on those devices rather than guessed frame-rate claims.

No owner answers are required to accept this audit. They become implementation decisions before the relevant phase begins. All behavior described as needing browser verification remains unverified; no redesign phase has been started.
