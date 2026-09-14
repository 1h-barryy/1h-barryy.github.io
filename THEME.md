# Graphite / Paper

The portfolio is a static, five-page GitHub Pages site with no build step.

| Page | Presentation | Existing interaction script |
| --- | --- | --- |
| `index.html` | `assets/css/hero.css` | `assets/js/field.js` — WebGL field |
| `portfolio.html` | `assets/css/portfolio.css` | `assets/js/portfolio.js` — progress, sticky plates, reveals |
| `barrymade.html` | `assets/css/barrymade.css` | `assets/js/barrymade.js` — cards, collisions, lamp, tidy |
| `about.html` | `assets/css/about.css` | Shared navigation only |
| `contact.html` | `assets/css/contact.css` | `assets/js/contact.js` — clipboard and mail composer |

All five pages share `assets/css/main.css` and `assets/js/site.js`. The standalone game in `BarryMade/Parallel Crossy Road/` keeps its own presentation and simulation. `Claude outputs/` contains earlier reference screenshots; `PLACEHOLDERS.md` records unfinished content.

## Materials

`main.css` defines two intentional palettes. Dark uses ink `#101213`, graphite `#1c1f21`, ivory `#e8e6df`, and mineral blue-grey; warm pigment is reserved for a few atmospheric particles. Light uses paper `#f2f0e9`, charcoal `#292e30`, slate pigment, soft contact shadows, and pale surfaces. Component colors, the spotlight, inputs, and navigation all use the shared tokens.

Mineral blue-grey leads the active navigation, button surfaces and edges, and BarryMade lighting. The workspace has its own graphite floor, while cards use lighter neutral surfaces (`#24282a` through `#34393d` in dark mode). All twelve cards share this palette; no clay or gold card overrides remain. A separate low-opacity monochrome grain tile, fine inset edges, and a small contact shadow give the cards material detail. Their reflections follow the existing lamp proximity without changing its response or the original dynamic shadow calculation.

`assets/img/grain.svg` supplies a faint, static, monochrome texture. It does not intercept pointer events. Fraunces and Instrument Sans remain in place; the hero uses a quieter optical setting and small monospace labels. Existing text sizes, layout rules, breakpoints, and animation timing remain in place.

`assets/js/theme.js` runs in the head before styles load. Dark is the initial default; the navigation toggle saves a preference under `barry-theme`. It works with keyboard input, updates its pressed state, tolerates unavailable storage, and synchronizes open tabs. Without JavaScript, the default palette remains usable and the toggle stays hidden.

## Particle rendering boundary

The original particle count, position and seed buffers, random-number sequence, drift equations, cursor repulsion, camera parallax, entrance easing, and frame loop are retained. The new `aMaterial` buffer is calculated **after** the original geometry and never writes to it.

The material buffer emphasizes interwoven, irregular diagonal strands using opacity, with denser knots and subdued surrounding grains. Following Barry's two particle references, sprites stay between 1.4 and 3.8 CSS pixels with small, softly edged cores; the large blurred dust sprites have been removed. Middle-distance grains receive a static brightness lift to make the strands visible. Most points stay neutral; roughly a quarter carry mineral blue-grey, with a few warm grains confined to spatial pockets. This color selection reuses an existing seed without altering it or consuming randomness. Dark uses silvery light and additive compositing; light uses graphite, slate and clay pigment with multiply compositing. Changing mode updates rendering uniforms and blend factors without restarting the field. Reduced motion redraws its still frame when the palette changes.

`site.js`, `portfolio.js`, `barrymade.js`, and `contact.js` remain unchanged. BarryMade's dimensions, lamp radii, proximity values, transforms, and timing remain unchanged in CSS as well.

## Reference direction

- [Igloo Inc — Awwwards Site of the Day, July 23, 2024](https://www.awwwards.com/sites/igloo-inc): mineral grey-blue palette and particulate material.
- [Jordan Delcros — Awwwards Site of the Day, May 28, 2025](https://www.awwwards.com/sites/jordan-delcros-portfolio): restrained experimental portfolio and tactile digital objects.

These informed the palette and material treatment; the portfolio keeps its existing composition and interactions.

## Verification

A deterministic comparison against the pre-change source passed at 390px and 1440px, with and without reduced motion: identical geometry, seeds, random calls, motion shader, cursor uniforms, projection/view matrices, and sampled frame timing, including visibility pause/resume. Existing page markup also matched after removing the added theme control, metadata, and asset cache versions.

Theme tests covered first visit, saved light/dark preferences, invalid values, unavailable storage, keyboard-compatible button state, and storage-event synchronization. The existing game's 14 simulation tests passed. Browser checks covered the two palettes, responsive layout, navigation, portfolio scroll effects, card dragging, spotlight, and contact validation.
