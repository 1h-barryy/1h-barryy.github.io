# Prompt log — Parallel Crossy Road

Implementation tool: OpenAI Codex (GPT-6). Date: September 13, 2026.

Planning context supplied by Barry: [Vibe Coding Plan](https://chatgpt.com/c/6aa6f4d8-8dd4-83ea-9981-1a5839f6045a). The ChatGPT model used for that discussion was not recorded in the supplied context. Prompts below are the substantive user messages from this implementation task, preserved verbatim, including original spelling and formatting escapes. No fabricated iteration prompts are included.

## Initial request

```text
I am going to give you permission to my github portfolio access. I am creating the first playable prototype of a browser game inspired by Crossy Road \
You are working in my existing github repo portfolio pages.\
Before making changes, check the repository structure so you understand where the portfolio files live. Then create the game inside its own folder. Do not restructure or unnecessarily modify the rest of my portfolio. \
Create a folder in BarryMade called Parallel Crossy Road.\
Here are some requirement for the game:\
&#x20;it should be a browser game. It should Written in JavaScript, running as a static page. Someone visiting the URL should be able to play it without installing anything. 
Must work on GitHub Pages
Use plain HTML/CSS/JavaScript
No build step
No server/backend
If using a library, load it through a CDN \<script> tag or include the library file locally
The game folder needs its own index.html
The game folder needs its own README.md
The game folder needs its own prompt\_log.md
Your portfolio must include a link to the playable game
Someone visiting the game URL must be able to play it without installing anything
Use relative file paths so the game works correctly when hosted inside a GitHub Pages subfolder.

The game should be:\
A simple blocky player character made from procedural geometry.
A world composed of horizontal lanes.
At least two lane types:

   \* safe grass lanes
   \* road lanes
Vehicles that move horizontally across road lanes.
Grid-based player movement.\
he player must be able to move:

   \* forward
   \* backward
   \* left
   \* right
Moving vehicles must be able to collide with the player.
A vehicle collision ends the current run.
Display a score on screen.
Score should increase when the player reaches a new furthest-forward lane, not simply from repeatedly moving backward and forward.
Add a clear game-over state.
\
Keep the art style simple but also have those isometric colorful lowpoly chucky style\
\
Get some reference from the game Crossy Road but do not copy or recreate every Crossy Road feature

Ask me any question before you start working on it\
```

## Repository location and prototype scope

```text
[Vibe Coding Plan](chatgpt-conversation://6aa6f4d8-8dd4-83ea-9981-1a5839f6045a) Here are some of the discussion and requirement and Here are the path to my github repo:
E:\1h-barryy\CMU\15113\PersonalWebsite\1h-barryy.github.io
Give me a protatype first and I will submit the changes
```

## Earlier work to add before submission

Barry: append any important in-class and earlier implementation prompts verbatim, with the actual tool/model names. They are not available in this task. The planning conversation contains suggested prompts, but those are not represented here as prompts you actually ran.

## Character direction correction

```text
So I notice that the character is not facing toward the direction that it is going. Make it can "turn"toward the direction it is moving
```
