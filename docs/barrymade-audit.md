# BarryMade audit

Inspection date: 2026-10-01. Read-only: no site files were changed, moved, renamed or deleted.
Image previews were made from copies in a temporary scratch folder, outside the repo.

Note: the folder on disk is `barrymade/` (lowercase), not `BarryMade/`.

---

## 1. The `barrymade/` tree

```
barrymade/
├── index.html                      card wall (hand-written HTML, 13 cards)
├── .DS_Store                       (gitignored)
├── financial-analyst-arcade/
│   ├── index.html                  detail page
│   ├── media/hero.png              1329×1175, 1.2 MB
│   └── play/index.html             Web Edition app (uses /assets/js/financial-analyst-arcade.js + .css)
├── parallel-crossy-road/
│   ├── index.html                  detail page (no hero image yet)
│   └── play/                       self-contained game
│       ├── index.html  style.css  core.js  game.js
│       ├── core.test.cjs           Node test file (published as-is)
│       ├── README.txt              notes, with typos ("obsticals")
│       └── prompt_log.txt          12 KB AI prompt log (published as-is)
├── thing-two/    index.html only
├── thing-three/  index.html + media/slides/  (3 jpg)
├── thing-four/   index.html + media/slides/  (8 jpg)
├── thing-five/   index.html + media/slides/  (9 jpg)
├── thing-six/    index.html + media/         (23 HEIC)
├── thing-seven/  index.html + media/         (1 mp4, 176 MB)
├── thing-eight/  index.html + media/         (7 HEIC)
├── thing-nine/   index.html + media/         (8 HEIC)
├── thing-ten/    index.html + media/         (12 HEIC)
├── thing-eleven/ index.html only
└── thing-twelve/ index.html only
```

There is no `thing-one`. All `thing-*/media/` folders are **untracked** in git (`??` in `git status`), so none of this media is live yet.
`.DS_Store` files sit in almost every folder but are gitignored.

### Per-folder detail

Counts and sizes below cover media only (the `index.html` is about 4 KB in each folder).

#### thing-three — slides only
- **Layout:** `media/slides/`, no loose media.
- **Files:** 3 × `.jpg`, 2899×1400 each. About 1.1 MB in total; the largest is 472 KB.
- **Naming:** `TableTop_00.jpg` … `TableTop_02.jpg`. Zero-padded, starts at `_00`, and has no gaps.
- **> 10 MB:** none.
- **First slide:** title card for **"Sail the Seas"**, "a grid-occupying board game for 2–6 players". It shows a woodcut-style boat on waves against a blue sky.
- **Project:** *Sail the Seas*, a tabletop board game. The filename prefix `TableTop` refers to the genre, not the title.

#### thing-four — slides only
- **Layout:** `media/slides/`.
- **Files:** 8 × `.jpg`, 2899×1400. About 2.8 MB in total; the largest is 603 KB.
- **Naming:** `KittyKat_00.jpg` … `KittyKat_07.jpg`. Zero-padded, starts at `_00`, and has no gaps.
- **> 10 MB:** none.
- **First slide:** title card for **"Nauty Cat"**, a pixel-art game: "The house is quieter than usual, and you are a little black cat. Okay, let's go make trouble." It shows an isometric pixel room with a desk and a black cat.
- **Project:** *Nauty Cat* (a "Naughty Cat" spelling). The filename prefix `KittyKat` does not match the title.

#### thing-five — slides only
- **Layout:** `media/slides/`.
- **Files:** 9 × `.jpg`, 2899×1400. About 3.1 MB in total; the largest is 532 KB.
- **Naming:** `EchosOfSchrödinger_00.jpg` … `_08.jpg`. Zero-padded, starts at `_00`, and has no gaps.
  - The `ö` is stored **decomposed (NFD)**, as `o` plus a combining diaeresis. URL-encoded hrefs typed by hand are usually NFC, so they can 404 on GitHub Pages.
  - "Echos" is a misspelling; the slide says "Echoes".
- **> 10 MB:** none.
- **First slide:** title/menu screen for **"Echoes of Schrödinger"**, "a 3D sci-fi adventure game based on … Schrödinger's Cat". The player switches between states to escape. One half shows a space scene with ships, the other a sunlit temple interior.
- **Project:** *Echoes of Schrödinger*, a 3D game.

#### thing-six — photos only
- **Layout:** `media/`, no slides folder.
- **Files:** 23 × `.HEIC`, 4032×3024. About 64 MB in total; the largest is 3.5 MB.
- **Naming:** camera names `IMG_9559` … `IMG_9581`, a continuous run. They sort correctly but are not slide-style names.
- **> 10 MB:** no single file, but the folder is 64 MB.
- **First image:** a closed book or portfolio bound in dark navy suede, tied with a tan leather cord.
  - A later frame (IMG_9566) shows a cut-paper page with a window over a print and red/black threads strung across it.
- **Project:** a hand-bound artist's book with cut and stitched pages.

#### thing-seven — single video
- **Layout:** `media/`.
- **Files:** 1 × `.mp4`, **`Mondrian's paradox.4k.mp4`**. It is H.264/AAC, 3840×2160, 3 min 18 s.
- **Size:** **176 MB.** ⚠ This is over GitHub's 100 MB per-file hard limit, so a push will be rejected. It also counts against Pages' recommended 1 GB site size.
- **Naming:** the filename contains a space and an apostrophe, so it needs URL-encoding.
- **First frame:** yellow title card reading **"Mondrain's Paradox"**. The video misspells it as "Mondrain"; the filename says "Mondrian".
- **Project:** *Mondrian's Paradox*, a video piece (motion graphics or game trailer).

#### thing-eight — photos only
- **Layout:** `media/`.
- **Files:** 7 × `.HEIC`, 4032×3024. About 21 MB in total; the largest is 3.6 MB.
- **Naming:** `IMG_9550` … `IMG_9556`, continuous.
- **> 10 MB:** none.
- **First image:** a printed booklet with a purple cover, a layered head-silhouette cut-out and "Barry Yuan" on the front.
  - A later frame (IMG_9553) shows an inside spread with a black-and-white photo collage of a figure on pink paper.
- **Project:** a printed zine or photo-collage booklet.

#### thing-nine — photos only
- **Layout:** `media/`.
- **Files:** 8 × `.HEIC`, 4032×3024. About 18 MB in total; the largest is 3.0 MB.
- **Naming:** `IMG_0664` … `IMG_0671`, continuous. This uses a different camera-roll range from the other photo folders.
- **> 10 MB:** none.
- **First image:** a terracotta clay portrait bust (head and shoulders, curly hair) on a wood floor.
- **Project:** a ceramic or clay portrait bust (sculpture).

#### thing-ten — photos only
- **Layout:** `media/`.
- **Files:** 12 × `.HEIC`, 4032×3024. About 31 MB in total; the largest is 3.7 MB.
- **Naming:** `IMG_9668`–`9674` and `IMG_9684`–`9686`, `9688`, `9689`.
  - **Gaps:** 9675–9683 and 9687 are missing, which is fine but shows the set was hand-picked.
- **> 10 MB:** none.
- **First image:** a hanging gallery installation. Clear plastic or acrylic wire lattices are suspended with teal and grey tulle mesh, and a lattice form sits on a white plinth.
- **Project:** a suspended sculptural installation (mixed media: wire/acrylic and fabric).

#### thing-two, thing-eleven, thing-twelve — page only
Each folder has only a placeholder `index.html` and no media.

#### financial-analyst-arcade
`media/hero.png` (1.2 MB) is the only media file. It is used as the hero on the detail page.

#### parallel-crossy-road
There is no media folder; the hero is still the empty `plate__empty` placeholder.

### Files > 10 MB
| File | Size | Problem |
|---|---|---|
| `thing-seven/media/Mondrian's paradox.4k.mp4` | 176 MB | Over GitHub's 100 MB hard limit, so the push will fail. It needs Git LFS (which Pages does not serve), external hosting (YouTube/Vimeo), or a heavily compressed web encode. |

No other single file is over 10 MB.

Folder totals are still large:
- thing-six: 64 MB
- thing-ten: 31 MB
- thing-eight: 21 MB
- thing-nine: 18 MB

The HEIC photos alone come to about 134 MB.

**HEIC files will not display in Chrome or Firefox; only Safari can show them.** All 50 HEIC files will need converting to JPG/WebP and resizing (around 2000 px on the long edge) before they can go on a web page.

---

## 2. How `barrymade/index.html` builds the cards

- **The cards are hand-written HTML.** Each card is a literal `<a class="chip" href="/barrymade/<folder>/">` block inside `<div class="stage" id="stage">` (lines ~65–181). It holds `.chip__face > .chip__inner`, with `.chip__meta` (kind + year), `.chip__title`, `.chip__note` and `.chip__tools`.
- There are 13 cards: Parallel Crossy Road, Financial Analyst Arcade, and thing-two through thing-twelve.
- **`items.js` does not exist, and nothing anywhere references `window.BARRYMADE`.** No data file or template generates the cards.
- **Physics init:** `/assets/js/barrymade.js` is an IIFE loaded at the end of `<body>`.
  - It does `stage = document.getElementById("stage")`, then `chips = [].slice.call(stage.querySelectorAll(".chip"))`.
  - From that point it builds one `body` object per chip element. It reads size from `el.offsetWidth/offsetHeight` in `measure()`.
  - The DOM is queried **once at load**, so any card added after the script runs (for example by a future `items.js` renderer) will not get physics. A renderer would have to run *before* `barrymade.js`, or the script would need an init hook.
- **Fallback:** with reduced motion or a viewport under 760 px wide, the script adds `.is-static` to the stage and returns. The CSS then lays the same cards out as a grid.
- **Stale comment:** the "ADDING A CARD" comment tells you to point the href at `barrymade-<name>.html`. That convention is no longer used; cards now link to folder URLs `/barrymade/<name>/`.
- **Card text vs. reality:** the kind/tools on the thing cards are generic guesses that don't match the media:
  - thing-six says "VR / Unity, Quest", but it is a bound book.
  - thing-eight says "Object / Stoneware", but it is a zine.
  - thing-nine says "Tool / Unreal", but it is a clay bust.
  - thing-ten says "Shader / HLSL", but it is an installation.
  - thing-four says "Rig / Maya", but it is a pixel game.
  - thing-five says "VFX / Houdini", but it is a 3D game.
  - thing-seven says "Experiment / WebGL", but it is a video.

---

## 3. How the existing project pages work

### Shared skeleton
Every detail page has the same structure: `financial-analyst-arcade/index.html`, `parallel-crossy-road/index.html`, and all eleven `thing-*/index.html`.

- **Head:**
  - `/assets/js/theme.js` (theme, loaded before first paint)
  - Google Fonts (Fraunces + Instrument Sans)
  - `/assets/css/main.css`, `/assets/css/portfolio.css` and `/assets/css/barrymade-project.css`
  - an inline script that adds the `js` class
- **Body:** `body.project-page`, `.veil`, `.progress` bar, then the shared `<nav>`.
  - The nav's BarryMade link is hard-coded `aria-current="true"`. `site.js` also sets `aria-current="page"` on the link matching the current URL.
- **Main:**
  - `.project-head` holds **`← Back to BarryMade`** (`href="/barrymade/"`).
  - `article.study#<slug>` contains:
    - `.study__stage > figure.plate-figure > .plate`, holding either `img.plate__img` or a `.plate__empty` placeholder, plus a `figcaption`
    - `.study__body`: eyebrow, `h1.study__title`, the `dl.study__facts` facts list, the `.made-cta` button area, then `.beat` sections (Overview / How it works / Project links)
- **Footer:** links back to `/barrymade/`, `/about/` and `/contact/`.
- **Scripts:**
  - `/assets/js/site.js` handles the page fade-out veil, sticky nav and nav highlight.
  - `/assets/js/portfolio.js` handles the reading-progress bar, the plate `--enter` scroll effect and `.beat` reveal on scroll.
- **`barrymade-project.css`** (52 lines) only adds the `.made-cta` button and note. It includes a disabled variant: `span.made-cta__button[aria-disabled="true"]`, which reads "Project link coming soon".
- **Images** are referenced relatively (`media/hero.png`), so they resolve from each project's own folder.

### Per project
- **financial-analyst-arcade:**
  - The detail page has a real hero (`media/hero.png`), and its CTA links to `play/`. It also links to the backend repo on GitHub.
  - `play/index.html` is a full site page (same nav and fonts) with its own CSS and JS: `/assets/css/financial-analyst-arcade.css` and `/assets/js/financial-analyst-arcade.js`.
  - The play page links back through `../` ("← About the project") and the footer links (`../`, `/barrymade/`).
  - 3 PLACEHOLDERs remain: the hero caption, the architecture detail and the source-repo link.
- **parallel-crossy-road:**
  - The detail page has the CTA linking to `play/`. Its hero is still the `plate__empty` placeholder, and the caption is a PLACEHOLDER.
  - `play/` is a **standalone** mini-site. It has its own `style.css`, `core.js` and `game.js`, and it does *not* use the site nav, theme or fonts.
  - It links back through the brand link `href="../../"` (to `/barrymade/`).
  - Dev files are also published here: `core.test.cjs`, `README.txt` and `prompt_log.txt`.
- **thing-two … thing-twelve:**
  - These are byte-for-byte copies of one template, differing only in title/description, `article id`, eyebrow, Kind and Built-with.
  - Each has the empty hero placeholder, the disabled "coming soon" CTA and 6 PLACEHOLDER strings.
  - **None of them reference anything in their `media/` folder.**
  - thing-nine's eyebrow and Kind still say "Tool", copied from thing-two.
- **Template folder:** there is no dedicated template folder in `barrymade/` (nothing named `*template*` anywhere in the repo). In practice, `thing-two/index.html` *is* the template.
- **For comparison:** `portfolio/` has `thought-path/` (with media) plus `project-2/` and `project-3/` placeholders.
- `assets/README.md` says BarryMade project files belong in `assets/barrymade/<project-name>/`. That folder does not exist, and current practice is `barrymade/<project>/media/` instead (see §5).

---

## 4. thing-N folders not referenced by any card or page

- **Every `thing-*` folder (two through twelve) is linked by a card** on `barrymade/index.html`. Each also has its own `index.html`.
- **No media file in any `thing-*/media/` is referenced** by any HTML, CSS or JS. In practice, that unreferenced media covers:
  - thing-three, thing-four, thing-five, thing-six, thing-seven, thing-eight, thing-nine and thing-ten. All the media is orphaned (and untracked in git).
- **thing-two, thing-eleven and thing-twelve** are referenced, but they have no media or content behind them. They are pure placeholders.
- Nothing outside `barrymade/` (home page, portfolio, about) links to any thing-N page.

---

## 5. Inconsistencies

**Naming**
- Folder names (`thing-three`) say nothing about the projects inside them (Sail the Seas, Nauty Cat, …).
- The three slide sets use mixed prefix styles:
  - `TableTop_` is the genre, not the title.
  - `KittyKat_` doesn't match the "Nauty Cat" title.
  - `EchosOfSchrödinger_` is misspelled and contains a non-ASCII NFD `ö`.
- Slide folders sit at `media/slides/`, while photo sets are loose in `media/`.
- Photos keep their camera names (`IMG_####.HEIC`).
- The video filename has a space and an apostrophe, and its title card misspells "Mondrain".
- `assets/README.md` says BarryMade files go in `assets/barrymade/<name>/`, but the only real example (financial-analyst-arcade) uses `barrymade/<name>/media/`.
- The comment in `barrymade/index.html` still describes `barrymade-<name>.html` detail pages.

**Formats and sizes**
- 50 HEIC files won't render in non-Safari browsers.
- The 176 MB 4K mp4 can't be pushed to GitHub as-is.
- The slide JPGs are 2899×1400. That is fine, but their aspect ratio doesn't match the 1600×1200 hero size the template asks for.

**Stray or dev files published**
- `parallel-crossy-road/play/core.test.cjs`, `README.txt` and `prompt_log.txt`.
- A root-level `prompt_log.txt` (11 KB) is also tracked in the repo.
- `.DS_Store` files in nearly every folder, including `media/` and `media/slides/` (ignored by git, so harmless).

**Leftover PLACEHOLDERs** (counts of the string "PLACEHOLDER" per file)

| File | Count | Details |
|---|---|---|
| `barrymade/index.html` | 24 | The meta description, the page-head note, and "PLACEHOLDER" year + note on each of the 11 thing cards |
| each `thing-*/index.html` | 6 each, 66 total | |
| `financial-analyst-arcade/index.html` | 3 | |
| `parallel-crossy-road/index.html` | 1 | The hero caption |

**Copy mismatches**
- The card Kind/Tools don't match the actual content (see §2).
- thing-nine's detail page eyebrow and Kind say "Tool".
- The Parallel Crossy Road card year says 2026. Financial Analyst Arcade says "In progress".

---

## Summary

The "type" column means: **show** = slide deck (`media/slides/*.jpg`), **photo** = camera photos of a physical piece, **video** = film, **—** = nothing yet.

| folder | type | media count | likely project | referenced? (y/n) |
|---|---|---|---|---|
| thing-two | — | 0 | unknown (placeholder) | y (card + page, no media) |
| thing-three | show | 3 | *Sail the Seas*: board game for 2–6 players | y card / **n media** |
| thing-four | show | 8 | *Nauty Cat*: pixel-art cat game | y card / **n media** |
| thing-five | show | 9 | *Echoes of Schrödinger*: 3D sci-fi quantum game | y card / **n media** |
| thing-six | photo | 23 HEIC | hand-bound suede artist's book (cut and stitched pages) | y card / **n media** |
| thing-seven | video | 1 mp4 (176 MB ⚠) | *Mondrian's Paradox*: 4K video | y card / **n media** |
| thing-eight | photo | 7 HEIC | printed zine / photo-collage booklet (purple cover) | y card / **n media** |
| thing-nine | photo | 8 HEIC | terracotta clay portrait bust | y card / **n media** |
| thing-ten | photo | 12 HEIC | suspended wire + tulle gallery installation | y card / **n media** |
| thing-eleven | — | 0 | unknown (placeholder, card says "Photo / Series") | y (card + page, no media) |
| thing-twelve | — | 0 | unknown (placeholder) | y (card + page, no media) |
| financial-analyst-arcade | photo (screenshot) | 1 png | Financial Analyst Arcade | y |
| parallel-crossy-road | — (playable) | 0 | Parallel Crossy Road | y |
