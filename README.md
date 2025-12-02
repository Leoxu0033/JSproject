# Mini Flat Heroes — Survival Platformer Game

[![Play Game](https://img.shields.io/badge/Play-Game-success?style=for-the-badge&logo=html5)](https://leoxu0033.github.io/JSproject/)

A minimalist survival platformer game built with vanilla JavaScript, HTML5 Canvas, and ES6 modules. Survive waves of enemies across 9 challenging levels!

## 🎮 Game Overview

**Mini Flat Heroes** is a fast-paced survival platformer where you must survive for 20 seconds in each level while avoiding or defeating enemies. The game features progressive difficulty, dynamic safe havens, and a comprehensive scoring system.

### Key Features

- **10 Unique Levels** - Including a new **Tutorial Level** to learn the basics!
- **5 Visual Styles** - Experience Neon, Cyber, Nature, Underwater, and Space themes!
- **Local 2-Player Mode** - Play with a friend on the same keyboard!
- **Star Rating System** - Earn 1 to 3 stars on each level based on your performance.
- **Progressive Difficulty** - Enemy spawn rates and quantities increase as you progress.
- **Dynamic Safe Havens** - Randomly spawning safe zones where you can hide and hover freely.
- **Multiple Enemy Types** - Walkers, jumpers, floaters, roamers, and aggressive tadpoles.
- **Scoring System** - Track your best score for each level and total score across all levels.
- **Level Selection** - Beautiful glassmorphism UI to choose any unlocked level.
- **Rich Audio** - Procedural music and sound effects using Web Audio API.
- **Visual Polish** - Particle effects, screen shake, dynamic backgrounds, and smooth animations.

## 🎯 Gameplay

### Objective
Survive for 20 seconds in each level to progress. Avoid enemies or defeat them to earn points.

### Controls

| Action | Player 1 | Player 2 |
| :--- | :--- | :--- |
| **Move** | WASD | Arrow Keys |
| **Jump** | W / Space | Up Arrow |
| **Dash** | Shift / K | / (Slash) |
| **Pause** | P | P |
| **Mute** | M | M |

### 2-Player Co-op
- Toggle 2-Player mode in the Level Select screen by pressing `TAB`.
- Both players share a pool of **5 Lives**.
- Work together to survive and defeat enemies!

### Enemy Types & Kill Bonuses
Defeating enemies grants points and special power-ups!

- **Walkers** (Red)
  - *Behavior*: Basic enemies that patrol horizontally.
  - *Kill Reward*: **+100 Points**

- **Chasers** (Orange Triangle)
  - *Behavior*: Aggressively chases the player.
  - *Kill Reward*: **+200 Points** & **SPEED UP** (5s Speed Boost)

- **Jumpers** (Yellow Circle)
  - *Behavior*: Jumps periodically to reach high places.
  - *Kill Reward*: **+150 Points** & **HIGH JUMP** (5s Jump Boost)

- **Roamers** (Purple Diamond)
  - *Behavior*: Moves randomly around the arena.
  - *Kill Reward*: **+150 Points** & **HEAL +1** (Restores 1 Life)

- **Floaters** (Green Hexagon)
  - *Behavior*: Hovers and moves slowly in the air.
  - *Kill Reward*: **+300 Points** & **SHIELD** (3s Invulnerability)

- **Tadpoles** (Blue)
  - *Behavior*: Small, fast enemies that swarm the player.
  - *Note*: They die on contact with walls or the player (causing damage). No kill reward.

### Safe Havens
- Randomly spawn and despawn throughout each level
- Player can "dock" inside safe havens to hover freely
- When a safe haven despawns, it creates an explosion that kills nearby enemies
- If the player is inside when it despawns, nearby enemies are eliminated

### Scoring
- **Enemy Kills** - 100 points per enemy (non-tadpole)
- **Full Health Bonus** - 1000 bonus points for completing a level with full health (3 lives)
- **Star Rating** - Earn up to 3 stars per level based on your score!
- **Best Score Tracking** - Each level tracks your highest score
- **Total Score** - Sum of all level best scores

## 🚀 How to Run

### Quick Start (Recommended)
The game must be served over HTTP for ES modules and audio to work correctly. From the project root:

**Python 3:**
```bash
python3 -m http.server 8000
# Then open http://localhost:8000 in your browser
```

**Node.js:**
```bash
npx http-server -c-1
# Then open the printed URL (usually http://localhost:8080)
```

**Important**: Click or tap the page once after loading to unlock audio (browsers require a user gesture before playing sound).

## 📁 Project Structure

```
Project/
├── index.html          # Main HTML file
├── styles.css          # Game styles
├── README.md           # This file
├── src/
│   ├── main.js         # Game initialization and input handling
│   ├── game.js         # Main game engine and loop
│   ├── player.js       # Player logic, movement, and rendering
│   ├── enemy2.js       # Enemy AI and behavior
│   ├── level.js        # Level definitions (9 levels)
│   ├── audio.js        # Audio manager (Web Audio API)
│   ├── particles.js    # Particle effects system
│   ├── input.js        # Input handling
│   └── utils.js        # Utility functions (collision detection, etc.)
```

## 🛠️ Technical Details

### Technologies
- **Vanilla JavaScript (ES6+)** - No frameworks or build tools required
- **HTML5 Canvas** - 2D rendering
- **Web Audio API** - Procedural audio generation
- **ES6 Modules** - Modular code organization
- **localStorage** - Persistent high score storage

## 🤝 Contributing

Feel free to fork the project and submit pull requests!

## 📄 License

This project is open source.

## 🎉 Credits

Built as a student project reimagining the feel of Flat Heroes using plain JavaScript and HTML5 Canvas.

---

**Enjoy the game!** 🎮
