# Mini Flat Heroes — Survival Platformer Game

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

### Enemy Types
- **Walkers** - Basic enemies that patrol horizontally
- **Jumpers** - Enemies that jump periodically
- **Floaters** - Enemies that move in floating patterns
- **Roamers** - Enemies with random movement patterns
- **Tadpoles** - Aggressive enemies that track the player and attack. They die on contact with walls.

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

## 🛠️ Installation & Running

1. **Clone the repository**
   ```bash
   git clone https://github.com/Leoxu0033/JSproject.git
   cd JSproject
   ```

2. **Run a local server**
   Since the game uses ES6 modules, it must be served via HTTP/HTTPS (not file://).
   
   **Using Python:**
   ```bash
   python3 -m http.server 8000
   ```
   
   **Using Node (http-server):**
   ```bash
   npx http-server .
   ```

3. **Play**
   Open your browser and navigate to `http://localhost:8000`.

## 🤝 Contributing

Feel free to fork the project and submit pull requests!

## 📄 License

This project is open source.


### Keyboard (Single Player)
- **Movement**: Arrow Keys or `A`/`D`
- **Jump**: `Space`, `W`, or `Arrow Up`
- **Dash**: `Left Shift` (dash in current direction)
- **Pause**: `P`
- **Mute**: `M`
- **Restart**: `R` (when game over)
- **Change Style**: `Y`
- **Return to Level Select**: `ESC`
- **Level Select Navigation**: Arrow Keys or `WASD`
- **Select Level**: `Enter`
- **Toggle 1P/2P Mode**: `TAB` (in Level Select)

### Keyboard (2-Player Mode)
- **Player 1**: `WASD` to move, `Space` or `W` to jump.
- **Player 2**: `Arrow Keys` to move, `Enter` or `Arrow Up` to jump.

### Gamepad (Optional)
- **Left Stick**: Move left/right
- **Button 0 (A)**: Jump
- **Button 1 (B)**: Dash
- Press any button to join as a player

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

### Direct File Opening
You can also open `index.html` directly in your browser, but some features (like audio) may not work due to browser security restrictions.

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

## 🎨 Game Features

### Level System
- **9 Progressive Levels** - Each level increases in difficulty
- **Level Selection Menu** - Choose any unlocked level
- **High Score Tracking** - Best score saved per level using localStorage
- **Completion Tracking** - Tracks which levels have been completed

### Enemy Spawning
- **Progressive Difficulty**: 
  - Level 1-3: 1 batch, 2-3 tadpoles per batch
  - Level 4-6: 1 batch, 4-5 tadpoles per batch
  - Level 7-9: 3 batches, 6-7 tadpoles per batch
- **Multiple Simultaneous Batches** - Higher levels spawn multiple batches at once
- **Dynamic Spawn Rates** - Spawn intervals decrease as levels progress

### Physics & Movement
- **Advanced Gravity** - Faster falling than rising for snappier gameplay
- **Dash Mechanics** - Quick dash with cooldown and invulnerability frames
- **Wall Climbing** - Climb and slide on walls
- **Coyote Time** - Small grace period for jumping after leaving a platform
- **Jump Buffering** - Input buffering for more responsive controls

### Visual Effects
- **5 Distinct Themes**:
  - **Neon**: Classic grid style
  - **Cyber**: Dark towers and neon lights
  - **Nature**: Mountains, trees, and clouds
  - **Underwater**: Deep blue gradients, bubbles, and seaweed
  - **Space**: Stars, planets, and rotating asteroids
- **Particle Systems** - Enemy death, explosions, and celebration effects
- **Screen Shake** - Impact feedback for combat and explosions
- **Flash Effects** - Visual feedback for important events
- **Smooth Animations** - Squash/stretch effects and motion trails
- **Fusion Main Menu** - A dynamic cover showcasing all visual styles

### Audio System
- **Procedural Music** - Multi-layered ambient background music
- **Rich Sound Effects**:
  - Jump, dash, land
  - Enemy stomp/kill
  - Player hit
  - Score collection
  - Win celebration
  - Explosions
  - Menu selection
- **Volume Control** - Adjustable master volume and mute toggle

## 🏆 Scoring & Progression

### Score System
- **Star Ratings**:
  - ⭐ 1 Star: Complete the level (< 400 pts)
  - ⭐⭐ 2 Stars: Good performance (400 - 1000 pts)
  - ⭐⭐⭐ 3 Stars: Excellent performance (> 1000 pts)
- Each level tracks your best score independently
- Total score is the sum of all level best scores
- Scores persist across sessions using localStorage

### Level Progression
- Complete a level by surviving 20 seconds
- Automatically advance to the next level upon completion
- Return to level select menu at any time with `ESC`
- Final completion screen appears after completing all 9 levels

## 🛠️ Technical Details

### Technologies
- **Vanilla JavaScript (ES6+)** - No frameworks or build tools required
- **HTML5 Canvas** - 2D rendering
- **Web Audio API** - Procedural audio generation
- **ES6 Modules** - Modular code organization
- **localStorage** - Persistent high score storage

### Game Loop
- Fixed timestep update loop (60 FPS)
- RequestAnimationFrame for smooth rendering
- Delta time-based movement and physics

### Collision Detection
- AABB (Axis-Aligned Bounding Box) collision detection
- Support for walls, platforms, one-way platforms, and slopes
- Solid collision resolution for all object types

## 🐛 Troubleshooting

### Audio Issues
- **No sound**: Click or tap the page once to unlock audio (browser security requirement)
- **Audio not working**: Ensure you're running the game over HTTP, not `file://`

### Module Loading Errors
- **CORS errors**: Use a local HTTP server (see "How to Run" above)
- **Module not found**: Check browser console for specific errors

### Game Not Starting
- Open browser DevTools Console to see error messages
- Ensure all files are present in the `src/` directory
- Check that your browser supports ES6 modules

## 📝 Notes

- The game uses procedural audio generation, so no external audio files are required
- High scores are stored in browser localStorage
- The game supports local multiplayer via gamepad (up to several players)
- All game logic runs client-side with no server required

## 🚀 Deployment

### GitHub Pages
To deploy to GitHub Pages:
1. Push your code to a GitHub repository
2. Go to Settings → Pages
3. Select "Branch: main / / (root)" as the source
4. Your game will be available at `https://<username>.github.io/<repo-name>/`

## 📄 License

See LICENSE file for details.

## 🎉 Credits

Built as a student project reimagining the feel of Flat Heroes using plain JavaScript and HTML5 Canvas.

---

**Enjoy the game!** 🎮
