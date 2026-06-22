# Joshway: Courage to Rise - Game Designer Mini-PRD (updated)

## Vision
Empowering 3D web collectathon platformer based on Maggie Isamoyer's "Joshway and the Courage to Rise" illustrations. Player as Joshway (with cape "rise" power) explores escalating worlds from cozy home to cosmic, collecting Star Coins, managing courage/energy, rising through portals. Fun interfering NPCs, unique per-world music/dynamics/challenges. Legacy-style 3D adventure with heart.

## Core Gameplay Pillars
- Exploration & Verticality: Multi-world from indoor to open space to planets. Use sustained cape rise (hold SPACE) to reach high/floating coins.
- Resource Management: Limited courage meter. Refuel orbs to keep rising high until gone.
- Different Dynamics: Grounded jet in early levels; zero-g momentum in Open Starfield (omnidirectional thrust, drift, 3D navigation).
- Juice & Theme: Warm storybook colors from art refs, chiptune music per realm, particles, funny pals. "Courage to Rise" metaphor.
- Progression: Collect all 12 coins per world -> fly into high Courage Portal -> next. 8 worlds ending in Io.

## Controls
- WASD / Arrows: Move (fixed)
- Mouse: Look (lock on click)
- SPACE (HOLD): Sustained rise/ascent with cape. In space: full 3D thrust.
- ESC: Pause / unlock
- M: Music toggle
- Character select pre-start.

## Level Design (Full Featured)
- 8 Worlds with unique music, gravity, visuals, challenges:
  1. Cozy Living Room (indoor tight, furniture)
  2. Backyard (grass, trees, wind)
  3. Playground Realm (core vertical platforms)
  4. City Lights (urban paths)
  5. The Moon (low-g dreamy float)
  6. Open Starfield (NEW: zero gravity open space w/ stars, momentum flying, floating 3D coins/debris - different dynamics to reach Mars)
  7. Red Mars (rocky, drag)
  8. Volcanic Io (slippery, geysers, mysterious)
- NPCs: 3+ types (pals, blockers, aliens) funny/annoying interference (bump, steal temp, popups) - no kill.
- End: After Io, victory with summary/credits. Scoring, high scores, pause, save.

## Tech
Vite + Three.js (WebGPU fallback). Web Audio music/SFX. LocalStorage save. Deployed standalone on Vercel.

## Deployment
- Live: https://joshway-starcoins.vercel.app
- New Vercel project "joshway-starcoins".
- For joshway.app/starcoins slug: Deploy standalone best. Add rewrites in main joshway.app vercel.json to proxy /starcoins/* to this URL (or better: custom subdomain starcoins.joshway.app). If monorepo later, adjust build base. Thoughts: Keeps game independent, easy updates. Subpath possible via rewrite but SPA routing needs care.

## Future
More secrets, level select UI, mobile touch, etc. Loop active for polish.

## Core Gameplay Pillars
- Exploration & Verticality: Big room with high shelves, furniture tops, hidden nooks. Use jetpack to reach them.
- Resource Management: Limited energy for flight. Collect refills (powerups) strategically to go higher/longer.
- Satisfying Movement: Smooth WASD + mouse look, hold SPACE for sustained ascent while fuel lasts.
- Juice & Nostalgia: Bright colors, particles, chiptune music, retro UI, toy-like character.

## Controls (Fixed)
- WASD / Arrows: Move (strafe left/right corrected)
- Mouse: Look around (click canvas to lock)
- SPACE (hold): Jump + sustained jetpack thrust upward. Ascends as long as energy >0. Releases to fall/gravity.
- ESC: Unlock mouse / pause
- M: Toggle music

## Level Design / Scope for "Real Game"
- Single large bedroom (scaled to w=26 d=22 h=10.5) - much more space than original small room.
- Furniture as platforms: desk, bed, dresser, shelves at varying heights.
- 15 Star Coins spread across floor, surfaces, floating high areas (some require good fuel management and flight skill).
- 4 Energy Powerups placed to encourage backtracking and planning routes.
- Secrets: High floating spots, behind furniture.

## Progression & Win Conditions (Current Implementation)
- Goal: Collect all 15 Star Coins.
- Energy management is key - holding SPACE lets you climb continuously until depleted. Refuel at powerups to reach more.
- Win screen with time on completion.

## Future / Full PRD Expansions (to iterate toward)
- Hazards: Falling books, moving toy cars that push player.
- More areas: "Door" interaction (E key) opens to hallway or playroom with new coins.
- Special "Memory Items" (3 unique larger collectibles) for 100% completion bonus.
- Multiple levels: 3 themed bedrooms (unlock by completing previous). Vary layout/colors.
- Timer + score: Base time bonus + efficiency (few refuels?).
- Simple enemies or obstacles for challenge (avoid or "bump" to collect?).
- Polish: Better camera options, run (shift), interact (push objects to reveal), high scores (localStorage), pause menu, options (sens, volumes).
- 3D Models: Support for custom GLTF (player, more props).
- Sound: More varied SFX, ambient hum.
- Accessibility: Key remap hints, colorblind friendly.

## Technical Constraints
- Pure web (Three.js + Web Audio + Vite). Run via `npm run dev` on localhost:517x.
- No external asset downloads at runtime.
- Self contained.

## Success Metrics (for "done")
- Feels fun and replayable for 5-10min sessions.
- Player must use flight skillfully (not just walk).
- "Wow" moments: reaching a very high coin after planning route + refuels.
- Controls responsive and not frustrating (WASD fixed, flight holds).
- Room feels big and worth exploring.

Status: Full featured: 8 worlds, pause, scoring with time/style, local high scores + unlock system, level select with previews/scores, enhanced NPCs, secrets (bonus coins), end game with credits/next. Loop continuing for more polish/secrets. Deployed at https://joshway-starcoins.vercel.app
