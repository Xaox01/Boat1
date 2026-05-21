# Operacja Październik

A Cold War submarine simulation game built with [Phaser 3](https://phaser.io/) and Vite. Play as the Soviet submarine **K-244 «Nalim»** (Kilo-class, Project 877) and hunt surface warships using sonar, torpedoes, and tactical maneuvering.

![Submarine](ships.jpg)

---

## Requirements

- **Node.js** 18 or newer — [nodejs.org](https://nodejs.org)
- **npm** (comes with Node.js)

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Xaox01/Boat1.git
cd Boat1

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Open **http://localhost:3000** in your browser. The game loads immediately — no account or login required.

---

## Controls

### Movement
| Key | Action |
|-----|--------|
| `W` / `S` | Increase / decrease engine power |
| `A` / `D` | Rotate submarine (rudder) |
| `R` / `F` | Blow / flood ballast tanks (ascend / descend) |

### Weapons
| Key | Action |
|-----|--------|
| `Space` | Fire torpedo |
| `E` | Fire anti-ship missile |
| `T` | Deploy acoustic decoy (noisemaker) |

### Stations & UI
| Key | Action |
|-----|--------|
| `F1` | CONN — main helm view |
| `F2` | SONAR station — PPI, waterfall, contact list |
| `F3` | PERISCOPE — optical identification, stadimetry |
| `F4` | WEAPONS station — tube status, loadout |
| `F6` | DAMAGE CONTROL — system health panels |
| `M` | Tactical map overlay |
| `Q` | Active sonar ping |
| `Esc` | Close active station / return to CONN |

---

## Building for Production

```bash
npm run build
```

Output goes to `dist/`. Serve it with any static file server:

```bash
npx serve dist
```

---

## Automated Tests

Visual regression tests use [Playwright](https://playwright.dev/) and screenshot baselines.

```bash
# Run all tests (starts dev server automatically)
npm test

# Update screenshot baselines after intentional visual changes
npm run test:update

# Open the interactive Playwright UI
npm run test:ui

# View the last test report
npm run test:report
```

> The first run of `npm test` generates the baseline screenshots. Subsequent runs compare against them and fail if the diff exceeds the configured threshold (4–8% depending on the effect).

---

## Project Structure

```
src/
  GameScene.js      — main game loop, camera, wave system
  Submarine.js      — player submarine: physics, sprite, systems
  Enemy.js          — destroyer AI (patrol → alert → hunt → search)
  Torpedo.js        — torpedo guidance and physics
  Missile.js        — anti-ship missile (sea-skimming)
  ImpactFX.js       — explosion effects (surface / underwater / floor)
  Sonar.js          — PPI sonar, contact tracking, DEMON waterfall
  DevConsole.js     — in-game developer console (~ key)
tests/
  effects.spec.js   — Playwright visual regression tests
```

---

## Developer Console

Press **`~`** (tilde) in-game to open the dev console. Useful commands:

| Command | Description |
|---------|-------------|
| `god` | Toggle invincibility |
| `depth <m>` | Teleport to depth in metres |
| `speed <n>` | Set game speed multiplier |
| `boom [n] [spread] [surf\|deep\|floor]` | Trigger explosion(s) |
| `testfx` | Run full FX sequence (used by automated tests) |
| `firetest 1` | Spawn a burning ship |
| `help` | List all commands |

---

## License

Private project — all rights reserved.
