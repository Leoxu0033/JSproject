import { Player } from './player.js';

// 仅在 OPS 面板添加一个 Co-op 按钮；不修改主菜单。
// 第二玩家键位：WASD 移动，Space/W/ArrowUp 跳跃，Shift 预留冲刺。

function ready(fn){
	if(document.readyState!=='loading') fn();
	else document.addEventListener('DOMContentLoaded',fn);
}

function createKeyboardInput(allowed){
	const keys = new Set(allowed && allowed.length ? allowed : ['w','W','a','A','s','S','d','D',' ','Space','Shift','ArrowUp']);
	const pressed = new Set();
	function down(e){ if(keys.has(e.key)) pressed.add(e.key); }
	function up(e){ if(pressed.has(e.key)) pressed.delete(e.key); }
	window.addEventListener('keydown',down);
	window.addEventListener('keyup',up);
	return {
		isDown(...names){ for(const n of names) if(pressed.has(n)) return true; return false; },
		destroy(){ window.removeEventListener('keydown',down); window.removeEventListener('keyup',up); }
	};
}

function toast(msg){
	const ops = document.getElementById('ops');
	if(!ops) return;
	const el = document.createElement('div');
	el.textContent = msg;
	el.style.cssText = 'background:rgba(0,0,0,.55);padding:6px 10px;border-radius:8px;font-size:12px;font-weight:600;margin-top:6px;color:#fff;';
	ops.appendChild(el);
	setTimeout(()=> el.remove(),1600);
}

ready(()=>{
	const ops = document.getElementById('ops');
	if(!ops) return;
	const canvas = document.getElementById('gameCanvas');
	const game = canvas && canvas.__game;
	if(!game) return; // 游戏尚未初始化

	// 创建按钮
	const btn = document.createElement('button');
	btn.className = 'glass-btn';
	btn.textContent = 'Co-op';
	btn.style.fontSize = '12px';
	btn.style.padding = '8px 12px';
	btn.title = 'Toggle Player 2 (WASD)';
	ops.appendChild(btn);

	let joined = false;
	let p2 = null;
	let p2Input = null;

	function addPlayer2(){
		if(game.showLevelSelect){ toast('请先进入关卡'); return; }
		p2Input = createKeyboardInput();
		const baseX = (game.player && game.player.pos ? game.player.pos.x : 120) + 80;
		p2 = new Player(Math.min(game.width - 120, baseX), game.height - 120);
		// 颜色区分
		p2.color = '#06d6a0';
		p2.input = p2Input; // 独立输入
		p2.gamepadIndex = null;
		game.entities.push(p2);
		try { game.spawnParticles(p2.pos.x + p2.w/2, p2.pos.y + p2.h/2, '#06d6a0', 14); } catch(e){}
		try { game.audio && game.audio.playSfx && game.audio.playSfx('jump'); } catch(e){}
		joined = true;
		toast('Player2 加入 (WASD)');
	}

	function removePlayer2(){
		if(p2){
			game.entities = game.entities.filter(e => e !== p2);
			p2 = null;
		}
		if(p2Input){ p2Input.destroy(); p2Input = null; }
		joined = false;
		toast('Player2 离开');
	}

	btn.addEventListener('click',()=>{
		if(!joined) addPlayer2(); else removePlayer2();
	});
});
