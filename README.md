# JOSHWAY: Courage to Rise

**A 3D Star Coin Adventure**

Play as Joshway in a legacy-style 3D collectathon. Collect all the Star Coins in each world to unlock the Courage Portal and RISE to the next environment!

Worlds:
- Cozy Living Room (tight platforming)
- Backyard (outdoor fun)
- Playground Realm (the heart)
- City Lights
- The Moon (low gravity, dreamy)
- Open Starfield (NEW: zero gravity open space with stars, momentum-based flight, floating 3D coins - different dynamics to reach Mars!)
- Red Mars
- Volcanic Io (Jupiter's moon - mysterious challenges)

Deployed at: https://joshway-starcoins.vercel.app
(Production Vercel project under AllianceOptimalLLC team: joshway-starcoins. Standalone deployment at root. For joshway.app/starcoins slug integration: add rewrites in the main project's vercel.json or use subdomain alias like starcoins.joshway.app.)

GitHub: https://github.com/AllianceOptimalLLC/Joshway-Game-Coin-Star

Each world has its own unique chiptune music, coin challenges, gravity, and funny CPU pals (kids, toys, aliens) that bump, distract, and entertain without harming you.

HOLD SPACE to rise high with your cape as long as courage lasts. Refuel at orbs. High ceilings and epic verticality!

Inspired by Maggie Isamoyer's gorgeous illustrations for the Joshway books.

![Joshway Hero](public/joshway-hero.jpg)

**Theme reference:** The visuals and story are inspired by the wonderful illustrations of Artist Maggie (Maggie Isamoyer) for the Joshway children's book series.

The game world translates the book' s playgrounds, glowing courage light, friendship, and "rise" motif into an interactive 3D experience.

## Features
- Fully 3D retro-inspired bedroom environment (blue starry walls, pink desk, bunk bed, dresser, wooden furniture)
- Original hero: **Captain Nova** — toy space ranger with jetpack and wings (heavily inspired by the reference video style)
- Smooth third-person controls with pointer lock
- Double jump + sustained jetpack flight with particle thrusters and limited energy meter
- 15 collectible spinning gold Star Coins scattered around the room
- Procedural wood and star wall textures
- Retro pixel UI with rich sound effects + original chiptune background music (pure Web Audio, toggle with M key or button)
- Win screen with time tracking

## Controls
- **Click** the game to lock mouse cursor
- **WASD** / Arrow keys — Move
- **Space** — Jump. Press again in the air for a double-jump + jet boost
- **Hold Space** (while airborne) — Keep thrusting with the jetpack
- **Mouse** — Freely look around
- **ESC** — Release mouse cursor
- **R** (on win screen) — Replay

## Run Locally

```bash
# 1. Install dependencies (already done if you ran npm install)
npm install

# 2. Start the development server
npm run dev
```

The game will open automatically at **http://localhost:5173**

Press the big **START MISSION** button and enjoy!

You can also build for static hosting:

```bash
npm run build
# Then serve the `dist` folder
```

## Tech
- Vite + Three.js (WebGL + WebGPU renderer support)
- GLTFLoader included — ready for real 3D models
- Pure JavaScript (no extra heavy frameworks)
- All assets generated procedurally (textures, character model, particles, sounds)

Tech note: We evaluated Babylon.js, PlayCanvas, Godot web exports, and raw WebGPU. For a lightweight single-level nostalgic browser game, enhanced Three.js is the sweet spot.

## Credits & Inspiration
Created as a personal web homage to classic 3D toy adventure games.  
The bedroom, jetpack flight, and golden coin collecting are directly inspired by the provided reference video.

Enjoy collecting every last Star Coin, Captain!

---

Made with ❤️ in a single focused session. All decisions on gameplay, art direction, controls, and polish made autonomously.
