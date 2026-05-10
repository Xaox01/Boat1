import Phaser from 'phaser';
import { GameScene } from './GameScene.js';
import { Menu } from './Menu.js';
import { SaveSystem } from './SaveSystem.js';

const W = 1024;
const H = 640;

const menu = new Menu();
menu.show().then(({ fromSave } = {}) => {
  if (fromSave) SaveSystem.requestLoad();
  new Phaser.Game({
    type: Phaser.CANVAS,
    width: W,
    height: H,
    backgroundColor: '#000814',
    parent: 'game-container',
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 0 }, debug: false },
    },
    scene: [GameScene],
  });
});
