# Parallel Crossy Road — prototype 0.1

## Barry's introduction (write before submitting)

**TODO — Barry:** In your own words, write 1–2 sentences describing the game and how it differs from stock Crossy Road. The assignment specifically asks you to write this section yourself.

## Play

Open `index.html` in a modern browser and select **Let's hop**. No installation, server, internet connection, or build is needed. The game uses plain HTML, CSS, JavaScript, and native Canvas geometry. There are no external assets or dependencies.

- **Arrow keys / WASD:** move forward, backward, left, or right, one grid tile per press. Release and press again for another hop. Inputs during a hop are ignored.
- **Touch:** use the four directional buttons under the game.
- **P / Escape:** pause or resume. Switching tabs or leaving the browser also pauses.
- **R:** restart. After a collision, select **Try again** or press Enter on the focused button.
- Grass is safe. Cars move across the gray roads; touching one ends the run, including during a hop. Hopping does not jump over cars.
- Distance is the furthest forward lane successfully reached. Backtracking never awards the same lane twice. You can return to the starting lane; the camera follows you.
- Personal best is stored only in this browser when local storage is available.

## GitHub Pages

This folder lives at `BarryMade/Parallel Crossy Road/` in the existing portfolio. All game resources and the return link use relative paths. The existing `barrymade.html` links here.

After Barry commits and pushes to the repository's configured Pages source, the expected URL is:

<https://1h-barryy.github.io/BarryMade/Parallel%20Crossy%20Road/>

This prototype has not been committed, pushed, or published by Codex. No Pages configuration changes are required for an existing root-based static Pages site.

## Files

- `index.html`: game page and accessible controls.
- `style.css`: responsive page presentation.
- `core.js`: deterministic lane generation, grid movement, traffic, scoring, and collision simulation.
- `game.js`: procedural isometric Canvas renderer, input, camera, and game states.
- `prompt_log.md`: verbatim development prompts available from this task.

## AI tools and approach

Implementation assistance: OpenAI Codex (GPT-6). Planning context: the linked ChatGPT discussion, “Vibe Coding Plan” (model not recorded in the supplied conversation). The approach was to inspect the existing portfolio, isolate the game, build and test the core loop, then add the procedural art and a single portfolio card. Development checks use local Node.js tooling; visitors do not need Node.js.

## Scope and unfinished work

This is the first playable prototype: grass, roads, cars, an original blocky traveler, distance scoring, death, restart, and pause. Rivers, trains, audio, character selection, and parallel-world mechanics are not implemented. The title is a working title. Scenery is decorative and outside the playable columns. Mobile controls are included; performance on physical phones still needs hands-on testing. Canvas visuals are not a fully nonvisual gameplay interface.

Before submission, Barry should complete the introduction above, add any earlier in-class prompts/model details to the prompt log, playtest, and publish through the normal portfolio workflow.

## Prototype verification

Passed seven simulation checks for movement, bounds, scoring on new lanes only, collisions (including during a hop), pause/reset, deterministic traffic, and bounded lane storage. Browser checks in Microsoft Edge passed desktop keyboard play, collision/game-over/restart, touch emulation, score persistence, disabled local storage, and layouts from 320px through 1920px wide. Both direct `file://` loading and static HTTP subfolder loading were checked, along with the portfolio card, relative return link, and local assets. No JavaScript runtime errors were observed. These are local checks; live GitHub Pages deployment remains for Barry to perform.

## Reference

[Crossy Road, official site](https://www.crossyroad.com/) was used as a reference for the lane-crossing loop and chunky visual direction. No Crossy Road models, textures, characters, logos, or sound assets are used. All game graphics are drawn from procedural boxes and polygons.
