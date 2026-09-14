# 🌍 MyWorldOfFamily - 我的世界家族版

> 面向小学低年级学生的 **纯 HTML5 + JavaScript** 3D 沙盒教育游戏
> 无需安装，打开浏览器即可玩！

![Minecraft Web 3D](docs/screenshot.png)

---

## 📖 项目简介

这是一个基于 **Three.js** 构建的 Minecraft 风格 3D 网页游戏，专为小学低年级学生设计。游戏融合 **游戏化学习** 理念，将语文、数学、英语教材内容嵌入游戏关卡中，让孩子在挖矿、战斗、建造的同时完成学业任务。

### ✨ 核心特色

| 特性 | 说明 |
|------|------|
| 🎮 **3D 沙盒世界** | 96×96 方块世界，可挖掘、放置、建造 |
| 📚 **教材闯关** | 二年级语文/数学/英语教材内容嵌入副本关卡 |
| 🔊 **拼音 + 语音朗读** | 所有中文自动标注拼音，支持 TTS 语音朗读 |
| ⚔️ **怪物系统** | 14 种怪物，各有独特夜间技能 |
| 🏆 **装备合成** | 工作台合成系统，从木剑到坦克 40+ 装备 |
| 💾 **本地存档** | 浏览器 localStorage 自动保存游戏进度 |
| 🌍 **昼夜天气** | 昼夜循环 + 晴朗/下雨/阴天/台风 4 种天气 |
| 🗺️ **世界地图** | 小地图 + 世界地图，支持标记和导航 |

---

## 🚀 快速开始

### 方式一：直接打开

```bash
# 下载项目后，直接用浏览器打开
open minecraft-3d.html    # macOS
xdg-open minecraft-3d.html  # Linux
start minecraft-3d.html   # Windows
```

### 方式二：本地服务器（推荐）

```bash
# 方式 A：使用内置脚本
bash serve.sh

# 方式 B：使用 Python
python3 -m http.server 8080

# 方式 C：使用 Node.js
npx serve -p 8080
```

然后访问 `http://localhost:8080/minecraft-3d.html`

---

## 🎯 游戏操作

### 移动与视角

| 按键 | 功能 |
|------|------|
| `W A S D` | 前后左右移动 |
| `鼠标拖动` | 旋转视角 |
| `空格` | 跳跃 |
| `Shift` | 加速奔跑 |
| `F` | 切换飞行/行走模式 |
| `Q` | 飞行下降 |

### 交互

| 按键 | 功能 |
|------|------|
| `左键` | 破坏方块 / 攻击怪物 |
| `右键` | 放置方块 |
| `1-9, 0` | 快捷栏选物品 |
| `滚轮` | 切换物品 |
| `E` | 打开/关闭工作台 |
| `P` | 玩家属性面板 |
| `C` | 怪物图鉴 |
| `Esc` | 暂停 / 返回菜单 |

---

## 📁 项目结构

```
minecraft-web-3d/
├── minecraft-3d.html      # 游戏主页面
├── minecraft-3d.css       # 样式文件
├── minecraft-3d.js        # 游戏逻辑（含内嵌纹理）
├── serve.sh               # 本地服务器脚本
├── convert_textures.py    # 纹理转换工具
├── TEXTURES.md            # 纹理替换说明
├── README.md              # 项目说明
├── LICENSE                # 开源许可证
├── .gitignore             # Git 忽略文件
├── package.json           # Node.js 配置
├── CONTRIBUTING.md        # 贡献指南
├── 📁 textures/           # 照片文件夹（放入家人照片）
└── 📁 docs/               # 文档
```

> 💡 **自定义纹理**：将家人照片放入 `textures/` 文件夹，运行 `python3 convert_textures.py` 即可替换默认纹理！
> 详见 [TEXTURES.md](TEXTURES.md)

---

## 🎮 游戏系统

### 战斗系统

- **怪物种类**：苦力怕、僵尸、骷髅、蜘蛛、末影人、狼、蝙蝠 等 14 种
- **夜间技能**：每种怪物在夜晚激活独特技能（自爆、瞬移、爬墙等）
- **装备伤害**：木剑(1) → 石剑(3) → 铁剑(5) → 钻石剑(8)

### 合成系统

- **工作台**：按 `E` 打开，支持拖拽合成
- **配方数量**：40+ 种配方
- **材料来源**：挖掘方块获取（石头、原木、铁矿石、煤矿石等）

### 学习系统

- **XP 经验值**：完成关卡、朗读课文、答题均可获得
- **三科联动**：语文/数学/英语独立计数
- **关卡解锁**：随 XP 提升解锁更多教材关卡

---

## 💻 技术架构

```
┌─────────────────────────────────────────────┐
│                  浏览器浏览器                   │
│                                             │
│  ┌───────────┐  ┌───────────┐  ┌──────────┐ │
│  │   HTML    │  │   CSS     │  │   JS     │ │
│  │  (UI面板) │  │  (样式)   │  │ (逻辑)   │ │
│  └───────────┘  └───────────┘  └──────────┘ │
│                                    │         │
│                                    ▼         │
│                           ┌──────────────┐  │
│                           │  Three.js    │  │
│                           │  (3D 渲染引擎)│  │
│                           └──────────────┘  │
│                                    │         │
│                                    ▼         │
│  ┌──────────────────────────────────────┐   │
│  │           WebGL / Canvas              │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 核心模块

| 模块 | 功能 |
|------|------|
| `Audio System` | Web Audio API 音效合成 |
| `TTS Engine` | 浏览器语音合成，支持多语音切换 |
| `Pinyin System` | 中文-拼音映射，自动 ruby 标注 |
| `World Generator` | 程序化地形生成（山脉、河流、森林） |
| `Mob AI` | 怪物行为系统（追击、逃跑、夜间技能） |
| `Crafting` | 工作台合成系统 |
| `Save System` | localStorage 自动存档 |
| `Education Engine` | 教材关卡 + XP 系统 |

---

## 📱 兼容性

| 平台 | 支持状态 |
|------|----------|
| 🖥️ 桌面 Chrome/Firefox/Edge | ✅ 完整支持 |
| 🖥️ 桌面 Safari | ✅ 完整支持 |
| 📱 移动端 Chrome | ⚠️ 基础支持 |
| 📱 移动端 Safari | ⚠️ 基础支持 |
| 🌐 在线部署 (GitHub Pages) | ✅ 支持 |

---

## 📄 开源协议

本项目采用 **MIT License** 开源。

详见 [LICENSE](LICENSE)

---

## 🙏 致谢

- [Three.js](https://threejs.org/) - 3D 渲染引擎
- 教材内容来源：人教版小学二年级上册

---

## 📝 更新日志

### v1.0.0 - 初始版本
- ✅ 3D 沙盒世界
- ✅ 怪物战斗系统
- ✅ 装备合成系统
- ✅ 教材闯关系统
- ✅ 拼音标注 + 语音朗读
- ✅ 昼夜天气循环
- ✅ 本地存档

---

## 🔗 相关链接

- [Three.js 文档](https://threejs.org/docs/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [GitHub Pages 部署](https://pages.github.com/)

---

## 🚀 上传 GitHub

```bash
cd MyWorldOfFamily
git init
git add .
git commit -m "feat: 初始版本 - MyWorldOfFamily"
git remote add origin https://github.com/kingrenqt-blip/MyWorldOfFamily.git
git branch -M main
git push -u origin main
```

---

## ⚠️ 注意事项

1. 游戏需要 **鼠标锁定** 才能正常游玩（点击画面即可）
2. 存档保存在浏览器 `localStorage` 中，清除浏览器数据会丢失存档
3. 推荐在 **桌面浏览器** 上体验完整功能
4. 语音朗读依赖浏览器 TTS 引擎，不同浏览器效果可能不同

---

Made with ❤️ for kids learning through play!