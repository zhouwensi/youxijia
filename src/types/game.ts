// 游戏类型定义
export interface GameConfig {
  id: string
  name: string
  type: GameType
  template: GameTemplate
  settings: GameSettings
  createdAt: string
}

export type GameType = 'platformer' | 'shooter' | 'puzzle' | 'rpg'

export interface GameTemplate {
  id: string
  name: string
  description: string
  preview: string
  config: Partial<GameSettings>
}

export interface GameSettings {
  // 基础设置
  width: number
  height: number
  backgroundColor: string
  
  // 玩家设置
  player: {
    speed: number
    jumpPower: number
    color: string
    size: number
  }
  
  // 游戏设置
  gravity: number
  platforms: Platform[]
  enemies: Enemy[]
  collectibles: Collectible[]
  
  // 关卡设置
  level: {
    name: string
    difficulty: 'easy' | 'medium' | 'hard'
    timeLimit?: number
  }
}

export interface Platform {
  x: number
  y: number
  width: number
  height: number
  color: string
}

export interface Enemy {
  x: number
  y: number
  speed: number
  color: string
  size: number
  type: 'moving' | 'static'
}

export interface Collectible {
  x: number
  y: number
  type: 'coin' | 'powerup' | 'key'
  value: number
}
