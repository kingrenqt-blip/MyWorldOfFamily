# 🎨 纹理替换说明

## 快速开始

游戏已内置 15 张纯色占位纹理，开箱即玩，**不需要任何图片文件**。

如果想换成自己的图片，可按下方步骤替换。

> ⚠️ **提交到 GitHub 前，请确认纹理和 `minecraft-3d.js` 里都没有个人照片。**

---

## 📁 文件对应关系

| 文件名 | 对应怪物 | 说明 |
|--------|----------|------|
| `creeper.png` | 🟩 苦力怕 | 纯色占位纹理 |
| `zombie.png` | 🟫 僵尸 | 纯色占位纹理 |
| `pig.png` | 🌸 猪 | 纯色占位纹理 |
| `cow.png` | 🟤 牛 | 纯色占位纹理 |
| `sheep.png` | ⬜ 羊 | 纯色占位纹理 |
| `chicken.png` | ⬜ 鸡 | 纯色占位纹理 |
| `bat.png` | ⬛ 蝙蝠 | 纯色占位纹理 |
| `spider.png` | ⬛ 蜘蛛 | 纯色占位纹理 |
| `enderman.png` | 🟪 末影人 | 纯色占位纹理 |
| `wolf.png` | ⬜ 狼 | 纯色占位纹理 |
| `skeleton.png` | ⬜ 骷髅 | 纯色占位纹理 |
| `rabbit.png` | ⬜ 兔子 | 纯色占位纹理 |
| `blaze.png` | 🟨 烈焰人 | 纯色占位纹理（守护者） |
| `phantom.png` | 🔵 幻翼 | 纯色占位纹理（守护者） |
| `player.png` | 🔵 玩家 | 纯色占位纹理 |

---

## 📸 使用步骤

### 1. 创建 textures 文件夹

```bash
mkdir textures
```

### 2. 放入纹理图片

游戏已内置纯色占位纹理，开箱即玩，**不需要任何图片文件**。

如果想换成自己的图片，把 `.png` 命名为对应怪物名放入 `textures/` 文件夹：

```
textures/
├── creeper.png      # 苦力怕
├── zombie.png       # 僵尸
├── pig.png          # 猪
├── cow.png          # 牛
├── sheep.png        # 羊
├── chicken.png      # 鸡
├── bat.png          # 蝙蝠
├── spider.png       # 蜘蛛
├── enderman.png     # 末影人
├── wolf.png         # 狼
├── skeleton.png     # 骷髅
├── rabbit.png       # 兔子
├── blaze.png        # 烈焰人（守护者）
├── phantom.png      # 幻翼（守护者）
└── player.png       # 玩家皮肤
```

然后运行 `python3 convert_textures.py` 把图片转成 base64 写回 JS。

### 3. 启动游戏

```bash
bash serve.sh
# 或
python3 -m http.server 8080
```

打开浏览器访问 `http://localhost:8080/minecraft-3d.html`

---

## 🖼️ 照片要求

| 项目 | 要求 |
|------|------|
| **格式** | JPG / JPEG / PNG |
| **尺寸** | 建议 128x128 或 256x256 像素 |
| **比例** | 正方形（1:1） |
| **内容** | 人脸/角色正面照最佳 |
| **大小** | 建议 < 200KB |

---

## 🔧 高级用法：批量转换脚本

如果想让照片在 `file://` 协议下也能加载（双击 HTML 直接打开），可以使用转换脚本：

```bash
# 安装依赖
pip3 install Pillow

# 运行转换脚本
python3 convert_textures.py
```

转换脚本会将 `textures/` 文件夹中的图片转换为 base64 并更新到 JS 文件中。

---

## 📝 转换脚本示例

创建 `convert_textures.py`：

```python
import base64
import os
from PIL import Image

TEXTURE_DIR = 'textures'
OUTPUT_FILE = 'minecraft-3d.js'

# 纹理映射：文件名 -> 代码中的键名
FILE_MAP = {
    'creeper': 'CREEPER',
    'zombie': 'ZOMBIE',
    'pig': 'PIG',
    'cow': 'COW',
    'sheep': 'SHEEP',
    'chicken': 'CHICKEN',
    'bat': 'BAT',
    'spider': 'SPIDER',
    'enderman': 'ENDERMAN',
    'wolf': 'WOLF',
    'skeleton': 'SKELETON',
    'rabbit': 'RABBIT',
    'blaze': 'GRANDMA',     # 烈焰人（守护者）
    'phantom': 'GRANDPA',   # 幻翼（守护者）
    'player': 'PLAYER',
}

def image_to_base64(img_path):
    with open(img_path, 'rb') as f:
        return base64.b64encode(f.read()).decode('ascii')

def resize_image(img_path, size=128):
    img = Image.open(img_path)
    img = img.resize((size, size), Image.LANCZOS)
    temp_path = f'/tmp/{os.path.basename(img_path)}'
    img.save(temp_path, 'JPEG', quality=85)
    return temp_path

def convert():
    textures = {}
    
    for filename, key in FILE_MAP.items():
        for ext in ['.jpg', '.jpeg', '.png']:
            path = os.path.join(TEXTURE_DIR, filename + ext)
            if os.path.exists(path):
                resized = resize_image(path)
                b64 = image_to_base64(resized)
                mime = 'image/jpeg' if ext in ['.jpg', '.jpeg'] else 'image/png'
                textures[key] = f'data:{mime};base64,{b64}'
                print(f'✓ {filename} -> {key}')
                break
    
    # 生成 TEXTURE_MAP 代码
    print('\n=== 生成的 TEXTURE_MAP ===')
    print('const TEXTURE_MAP = {')
    for key, b64 in sorted(textures.items()):
        print(f"    {key}: '{b64}',")
    print('};')
    
    # 保存为文件供复制
    with open('texture_map.txt', 'w') as f:
        f.write('const TEXTURE_MAP = {\n')
        for key, b64 in sorted(textures.items()):
            f.write(f"    {key}: '{b64}',\n")
        f.write('};\n')
    
    print('\n✅ 已保存到 texture_map.txt')
    print('请将内容复制到 minecraft-3d.js 中替换 TEXTURE_MAP')

if __name__ == '__main__':
    convert()
```

---

## 💡 提示

1. **不需要转换**：如果使用本地服务器（`serve.sh` 或 `python3 -m http.server`），可以直接使用 `textures/` 文件夹中的图片
2. **双击打开**：如果直接双击 HTML 文件打开，需要将图片转换为 base64 嵌入到 JS 中
3. **自定义纹理**：可以在 `minecraft-3d.js` 中修改 `TEXTURE_MAP` 添加更多自定义纹理

---

## 📦 完整示例结构

```
minecraft-web-3d/
├── minecraft-3d.html
├── minecraft-3d.css
├── minecraft-3d.js
├── serve.sh
├── textures/              # 你的照片文件夹
│   ├── dad.jpg
│   ├── mom.jpg
│   ├── grandma.jpg
│   ├── grandpa.jpg
│   ├── player.jpg
│   └── ...
├── README.md
├── TEXTURES.md            # 本文件
└── LICENSE
```

---

Made with ❤️ for kids learning through play!