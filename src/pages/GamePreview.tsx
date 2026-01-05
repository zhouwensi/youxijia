import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { GameConfig } from '../types/game'
import { Logger } from '../utils/logger'

export default function GamePreview() {
  const gameRef = useRef<Phaser.Game | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  const addDebugInfo = (info: string) => {
    setDebugInfo(prev => [...prev, info])
    Logger.info(info)
  }

  useEffect(() => {
    addDebugInfo('初始化游戏预览...')
    
    // 从localStorage获取游戏配置
    const configStr = localStorage.getItem('gameConfig')
    if (!configStr) {
      addDebugInfo('❌ 没有找到游戏配置')
      setError('没有找到游戏配置，请先创建游戏')
      setLoading(false)
      return
    }

    let gameConfig: GameConfig
    try {
      gameConfig = JSON.parse(configStr)
      addDebugInfo('✓ 游戏配置加载成功')
    } catch (e) {
      addDebugInfo('❌ 解析游戏配置失败')
      setError('游戏配置格式错误')
      setLoading(false)
      return
    }

    const settings = gameConfig.settings
    addDebugInfo(`游戏尺寸: ${settings.width}x${settings.height}`)
    addDebugInfo(`背景颜色: ${settings.backgroundColor}`)

    if (!containerRef.current) {
      addDebugInfo('❌ 容器元素未准备好')
      setError('容器初始化失败')
      setLoading(false)
      return
    }

    addDebugInfo('容器元素已准备好')

    // 创建游戏场景类
    class GameScene extends Phaser.Scene {
      private settings: any
      private player: any
      private cursors?: Phaser.Types.Input.Keyboard.CursorKeys
      private wasd?: any
      private spaceKey?: Phaser.Input.Keyboard.Key

      constructor(settings: any) {
        super({ key: 'GameScene' })
        this.settings = settings
      }

      create() {
        addDebugInfo('开始创建游戏场景...')
        
        try {
          // 设置背景颜色
          const bgColorStr = this.settings.backgroundColor.replace('#', '')
          const bgColor = parseInt(bgColorStr, 16)
          this.cameras.main.setBackgroundColor(bgColor)
          addDebugInfo(`✓ 背景颜色设置: ${this.settings.backgroundColor} (0x${bgColor.toString(16)})`)

          // 创建玩家
          const playerColorStr = this.settings.player.color.replace('#', '')
          const playerColor = parseInt(playerColorStr, 16)
          addDebugInfo(`创建玩家，颜色: ${this.settings.player.color} (0x${playerColor.toString(16)})`)
          
          // 先创建矩形图形对象（显示对象）并添加物理体
          const playerShape = this.add.rectangle(
            this.settings.width / 4,
            this.settings.height / 2,
            this.settings.player.size,
            this.settings.player.size,
            playerColor
          )

          // 添加动态物理体（false 表示动态物体）并保存对象（它包含 body）
          this.player = this.physics.add.existing(playerShape, false)

          // 设置物理属性（通过 body 操作）
          const body = (this.player.body as Phaser.Physics.Arcade.Body)
          body.setCollideWorldBounds(true)
          addDebugInfo(`✓ 玩家创建完成，位置: (${this.settings.width / 4}, ${this.settings.height / 2})`)

          // 创建平台
          const platformBodies: Phaser.Physics.Arcade.StaticBody[] = []
          const platformCount = this.settings.platforms?.length || 0
          addDebugInfo(`创建 ${platformCount} 个平台...`)
          
          this.settings.platforms?.forEach((platform: any, index: number) => {
            const platformColorStr = platform.color.replace('#', '')
            const platformColor = parseInt(platformColorStr, 16)
            const platformObj = this.add.rectangle(
              platform.x + platform.width / 2,
              platform.y + platform.height / 2,
              platform.width,
              platform.height,
              platformColor
            )
            const platformBody = this.physics.add.existing(platformObj, true) as Phaser.Physics.Arcade.StaticBody
            platformBodies.push(platformBody)
            this.physics.add.collider(this.player, platformBody)
          })
          addDebugInfo(`✓ ${platformCount} 个平台创建完成`)

          // 创建敌人
          const enemyCount = this.settings.enemies?.length || 0
          addDebugInfo(`创建 ${enemyCount} 个敌人...`)
          
          const enemies: Phaser.Physics.Arcade.Sprite[] = []
          this.settings.enemies?.forEach((enemy: any) => {
            const enemyColorStr = enemy.color.replace('#', '')
            const enemyColor = parseInt(enemyColorStr, 16)
            // 先创建矩形图形对象
            const enemyShape = this.add.rectangle(
              enemy.x,
              enemy.y,
              enemy.size,
              enemy.size,
              enemyColor
            )
            
            // 添加动态物理体
            const enemyObj = this.physics.add.existing(enemyShape, false) as Phaser.Physics.Arcade.Sprite
            enemies.push(enemyObj)
            
            if (enemy.type === 'moving') {
              const enemyBody = enemyObj.body as Phaser.Physics.Arcade.Body
              enemyBody.setVelocityX(-enemy.speed)
              enemyBody.setCollideWorldBounds(true)
              enemyBody.setBounceX(1)
            }
            
            platformBodies.forEach(platformBody => {
              this.physics.add.collider(enemyObj, platformBody)
            })
          })
          addDebugInfo(`✓ ${enemyCount} 个敌人创建完成`)

          // 创建收集品
          const collectibleCount = this.settings.collectibles?.length || 0
          addDebugInfo(`创建 ${collectibleCount} 个收集品...`)
          
          const collectibles: any[] = []
          this.settings.collectibles?.forEach((item: any) => {
            // 先创建显示圆形，再为其添加 Arcade 物理体并设置为圆形碰撞
            const color = item.type === 'coin' ? 0xFFD700 : item.type === 'key' ? 0xFF69B4 : 0x00FF00
            const collectibleShape = this.add.circle(item.x, item.y, 15, color)
            const collectibleObj: any = this.physics.add.existing(collectibleShape, false)
            const collBody = collectibleObj.body as Phaser.Physics.Arcade.Body
            // 将碰撞体设为圆形半径 15，并关闭重力（可按需调整）
            if (collBody.setCircle) collBody.setCircle(15)
            collBody.setAllowGravity(false)

            collectibles.push(collectibleObj)

            // 收集逻辑
            this.physics.add.overlap(this.player, collectibleObj, () => {
              if (collectibleObj.active) {
                collectibleObj.destroy()
                const index = collectibles.indexOf(collectibleObj)
                if (index > -1) {
                  collectibles.splice(index, 1)
                }
              }
            })
          })
          addDebugInfo(`✓ ${collectibleCount} 个收集品创建完成`)

          // 键盘控制
          this.cursors = this.input.keyboard?.createCursorKeys()
          this.wasd = this.input.keyboard?.addKeys('W,S,A,D')
          this.spaceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
          addDebugInfo('✓ 键盘控制初始化完成')

          // 显示控制提示
          const style: Phaser.Types.GameObjects.Text.TextStyle = {
            fontSize: '16px',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 10, y: 5 }
          }
          this.add.text(10, 10, '使用方向键或WASD移动，空格或W跳跃', style)
          this.add.text(10, 40, `关卡: ${this.settings.level.name} | 难度: ${this.settings.level.difficulty}`, style)
          
          addDebugInfo('✓✓✓ 游戏场景创建完成！')
        } catch (err) {
          addDebugInfo(`❌ 场景创建出错: ${err}`)
          console.error('Scene create error:', err)
        }
      }

      update() {
        if (!this.player || !this.player.body) return

        // 左右移动
        const left = this.cursors?.left.isDown || this.wasd?.A.isDown
        const right = this.cursors?.right.isDown || this.wasd?.D.isDown

        if (left) {
          (this.player.body as Phaser.Physics.Arcade.Body).setVelocityX(-this.settings.player.speed)
        } else if (right) {
          (this.player.body as Phaser.Physics.Arcade.Body).setVelocityX(this.settings.player.speed)
        } else {
          (this.player.body as Phaser.Physics.Arcade.Body).setVelocityX(0)
        }

        // 跳跃
        const up = this.cursors?.up.isDown || this.wasd?.W.isDown
        if ((up || this.spaceKey?.isDown) && (this.player.body as Phaser.Physics.Arcade.Body).touching.down) {
          (this.player.body as Phaser.Physics.Arcade.Body).setVelocityY(-this.settings.player.jumpPower)
        }
      }
    }

    addDebugInfo('创建Phaser游戏实例...')
    
    let timeoutId: NodeJS.Timeout | null = null
    
    try {
      // 创建场景就绪回调
      const onSceneReady = () => {
        addDebugInfo('✓✓✓ 游戏场景就绪回调触发')
        if (timeoutId) clearTimeout(timeoutId)
        setTimeout(() => {
          setLoading(false)
        }, 500)
      }
      
      // 扩展 GameScene 以支持回调
      class GameSceneWithCallback extends GameScene {
        private readyCallback: () => void
        
        constructor(settings: any, callback: () => void) {
          super(settings)
          this.readyCallback = callback
        }
        
        create() {
          super.create()
          // 场景创建完成后调用回调
          setTimeout(() => {
            this.readyCallback()
          }, 300)
        }
      }

      // 转换背景颜色为数字格式
      const bgColorForConfig = parseInt(settings.backgroundColor.replace('#', ''), 16)
      addDebugInfo(`背景颜色转换: ${settings.backgroundColor} -> 0x${bgColorForConfig.toString(16)}`)

      // Phaser游戏配置
      const phaserConfig: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: settings.width,
        height: settings.height,
        parent: containerRef.current,
        backgroundColor: bgColorForConfig,
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { y: settings.gravity },
            debug: false
          }
        },
        scene: new GameSceneWithCallback(settings, onSceneReady)
      }
      
      addDebugInfo(`游戏配置: ${settings.width}x${settings.height}, 父元素: ${containerRef.current ? '存在' : '不存在'}`)
      
      gameRef.current = new Phaser.Game(phaserConfig)
      addDebugInfo('✓ Phaser游戏实例创建成功')
      
      // 超时保护
      timeoutId = setTimeout(() => {
        addDebugInfo('⚠ 加载超时，强制完成')
        setLoading(false)
      }, 5000)
    } catch (error) {
      addDebugInfo(`❌ 创建游戏失败: ${error}`)
      setError(`游戏初始化失败: ${error}`)
      setLoading(false)
    }

    // 清理函数
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      if (gameRef.current) {
        addDebugInfo('清理游戏实例')
        gameRef.current.destroy(true)
        gameRef.current = null
      }
    }
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-red-500/20 backdrop-blur-lg rounded-2xl p-8 border border-red-500/50 text-center max-w-2xl">
          <p className="text-red-400 text-xl mb-4">{error}</p>
          <div className="bg-black/50 rounded-lg p-4 text-left text-sm text-gray-300 font-mono max-h-64 overflow-y-auto mb-4">
            <div className="text-cyan-400 mb-2">调试信息：</div>
            {debugInfo.map((info, index) => (
              <div key={index}>{info}</div>
            ))}
          </div>
          <button
            onClick={() => window.close()}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      {loading && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-8 border border-cyan-500/30 max-w-2xl w-full mx-4">
            <div className="flex flex-col items-center mb-4">
              <div className="relative mb-4">
                <div className="w-16 h-16 border-4 border-cyan-500/20 rounded-full"></div>
                <div className="w-16 h-16 border-4 border-transparent border-t-cyan-400 rounded-full animate-spin absolute inset-0"></div>
              </div>
              <p className="text-white text-lg mb-4">加载游戏中...</p>
            </div>
            <div className="bg-black/50 rounded-lg p-4 text-left text-xs text-gray-300 font-mono max-h-64 overflow-y-auto">
              <div className="text-cyan-400 mb-2">调试信息：</div>
              {debugInfo.map((info, index) => (
                <div key={index} className={info.startsWith('✓') ? 'text-green-400' : info.startsWith('❌') ? 'text-red-400' : info.startsWith('⚠') ? 'text-yellow-400' : ''}>
                  {info}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
        <div ref={containerRef} className="rounded-lg overflow-hidden" style={{ backgroundColor: '#000' }}></div>
        <div className="mt-4 flex items-center justify-between">
          <div className="text-white/60 text-sm">
            提示：按 F12 打开浏览器控制台查看详细日志
          </div>
          <button
            onClick={() => window.close()}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            关闭预览
          </button>
        </div>
      </div>
    </div>
  )
}
