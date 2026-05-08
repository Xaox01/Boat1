import Phaser from 'phaser';
import { GameScene } from './GameScene.js';

const W = 1024;
const H = 640;

const config = {
  type: Phaser.CANVAS,
  width: W,
  height: H,
  backgroundColor: '#000814',
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scene: [GameScene],
};

new Phaser.Game(config);
