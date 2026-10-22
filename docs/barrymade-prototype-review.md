# BarryMade 2.0 — Concept A local review

Implemented October 22, 2026. Local, uncommitted prototype only.

## Preview

From the repository root run `node scripts/preview.cjs`, then open
http://127.0.0.1:8080/barrymade/. Stop with Ctrl+C. Node is already installed;
there are no packages to install. The server binds only to loopback. If port
8080 is occupied by the preview already running, use that existing server.

## Design and content

- Editorial masthead, numbered section navigation, warm accents on the existing
  graphite/paper palette, and the site's existing Fraunces / Instrument Sans.
- All 13 original physics anchors remain. Eight reuse existing project images;
  the others use typographic treatments rather than invented artwork.
- Uniform 220 × 248px shells reserve image space. The table height accommodates
  the existing Tidy Up grid. The larger table deliberately makes this a scrolling
  workbench rather than crowding all objects into one screen.
- The Archive derives 15 rows from the 13 workbench anchors and two study links.
  Titles, routes, kinds, and tools are read from those source elements, not a
  second handwritten catalog. Filtering never changes simulation membership.
- Six filters: all 15; games 5; objects/print 4; image/motion 2; technical studies
  3 (existing Maya/Python tool plus shader and VFX projects); experiments 1.
- Technical Studies has two existing portfolio entry points and a collection
  filter link. Circular cropped previews suggest a future disc interaction;
  no player or playback behavior has been implemented.
- Existing missing content is presented as “Untitled” / “Details forthcoming.”
  No new project descriptions were invented. Detail pages retain their original
  placeholders and need a separate content pass later.

## Preservation and implementation

Collision separation, tuning constants, throwing, spotlight, transform
composition, and homing equations remain unchanged. Page-local maintenance:
static-first HTML, static input guards, responsive initialization in both
directions, live reduced-motion preference handling, keyboard activation after
dragging, and stage sizing for the larger cards. The no-JavaScript page exposes
the same project links as a static grid; the Archive provides a fallback link.

No shared styles, theme scripts, navigation scripts, homepage/WebGL files,
portfolio/detail pages, About, Contact, or standalone games were edited.

## Verification

Passed static checks: `node --check` for both BarryMade scripts and the preview
server; `git diff --check`; all 39 root-relative references in BarryMade HTML
resolve locally; all 13 original physics cards remain.

Observed in local Chrome:

- Card drag into neighbors displaced/rotated neighboring cards and stayed on
  BarryMade; the lamp reacted to pointer movement. Throw/collision response was
  observed visually, not benchmarked for frame-rate equivalence.
- Tidy Up returned cards to rows. All measured bodies were 220 × 248px.
- Filters and count updates, including keyboard Enter on a filter, worked.
- Keyboard card activation reached Parallel Crossy Road; Archive activation
  reached Feather Falloff Shader; Back returned to the prototype.
- Light and dark themes rendered; light preference survived reload.
- At 390 × 844, static grid and navigation were readable with no horizontal
  overflow; Tidy was disabled. Returning to desktop restored dynamic mode.
- All loaded images were valid and the browser error log was empty when checked.

Not browser-verified: reduced-motion emulation/live preference switching,
JavaScript-disabled mode, touch hardware, screen readers, Firefox/Safari,
high-refresh timing, multi-pointer cancellation, and exhaustive link navigation.
Reduced-motion/no-JS paths were inspected in source only. The existing axis-aligned
collision model still permits visual overlap of rotated cards. Existing project
content placeholders remain. No full website regression run was performed because
shared files and other pages were unchanged.

## Files

Modified: `barrymade/index.html`, `assets/css/barrymade.css`,
`assets/js/barrymade.js`.

Added: `assets/js/barrymade-archive.js`, `scripts/preview.cjs`, this review note,
and `docs/barrymade-prototype/{workbench-dark,archive-light,mobile-light}.jpg`.

The working tree was clean before implementation. No commits, pushes, remote
branches, pull requests, deployments, or publishing operations were performed.
