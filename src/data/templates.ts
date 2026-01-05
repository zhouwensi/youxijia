import { GameTemplate } from '../types/game'

export const gameTemplates: GameTemplate[] = [
  {
    id: 'platformer-basic',
    name: '基础平台跳跃',
    description: '经典的平台跳跃游戏，控制角色跳跃和移动',
    preview: '🦘',
    config: {
      width: 800,
      height: 600,
      backgroundColor: '#87CEEB',
      player: {
        speed: 200,
        jumpPower: 400,
        color: '#FF6B6B',
        size: 32
      },
      gravity: 800,
      platforms: [
        { x: 0, y: 550, width: 800, height: 50, color: '#8B4513' },
        { x: 200, y: 450, width: 200, height: 20, color: '#228B22' },
        { x: 500, y: 350, width: 200, height: 20, color: '#228B22' },
        { x: 300, y: 250, width: 150, height: 20, color: '#228B22' },
      ],
      enemies: [],
      collectibles: [
        { x: 250, y: 400, type: 'coin', value: 10 },
        { x: 550, y: 300, type: 'coin', value: 10 },
        { x: 350, y: 200, type: 'coin', value: 10 },
      ],
      level: {
        name: '第一关',
        difficulty: 'easy'
      }
    }
  },
  {
    id: 'shooter-basic',
    name: '基础射击游戏',
    description: '射击游戏，消灭敌人获得分数',
    preview: '🎯',
    config: {
      width: 800,
      height: 600,
      backgroundColor: '#1a1a2e',
      player: {
        speed: 300,
        jumpPower: 0,
        color: '#00D9FF',
        size: 40
      },
      gravity: 0,
      platforms: [],
      enemies: [
        { x: 700, y: 100, speed: 50, color: '#FF0000', size: 30, type: 'moving' },
        { x: 700, y: 300, speed: 50, color: '#FF0000', size: 30, type: 'moving' },
        { x: 700, y: 500, speed: 50, color: '#FF0000', size: 30, type: 'moving' },
      ],
      collectibles: [],
      level: {
        name: '射击挑战',
        difficulty: 'medium'
      }
    }
  },
  {
    id: 'puzzle-basic',
    name: '基础解谜游戏',
    description: '收集物品，解开谜题',
    preview: '🧩',
    config: {
      width: 800,
      height: 600,
      backgroundColor: '#E8F5E9',
      player: {
        speed: 150,
        jumpPower: 0,
        color: '#4CAF50',
        size: 30
      },
      gravity: 0,
      platforms: [
        { x: 0, y: 550, width: 800, height: 50, color: '#8B4513' },
        { x: 100, y: 400, width: 150, height: 20, color: '#795548' },
        { x: 300, y: 300, width: 150, height: 20, color: '#795548' },
        { x: 550, y: 200, width: 150, height: 20, color: '#795548' },
      ],
      enemies: [],
      collectibles: [
        { x: 150, y: 350, type: 'key', value: 1 },
        { x: 600, y: 150, type: 'coin', value: 50 },
      ],
      level: {
        name: '谜题关卡',
        difficulty: 'easy'
      }
    }
  }
]
