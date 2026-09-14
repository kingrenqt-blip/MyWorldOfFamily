# 🎨 纹理替换说明

## 快速开始

将家人/朋友的照片放入 `textures/` 文件夹，游戏会自动使用对应纹理！

---

## 📁 文件对应关系

| 文件名 | 对应怪物 | 说明 |
|--------|----------|------|
| `dad.jpg` | 🟩 苦力怕 | 爸爸的照片 |
| `mom.jpg` | 🟫 僵尸 | 妈妈的照片 |
| `pig.jpg` | 🌸 猪 | 宠物猪 |
| `cow.jpg` | 🟤 牛 | 宠物牛 |
| `sheep.jpg` | ⬜ 羊 | 宠物羊 |
| `chicken.jpg` | ⬜ 鸡 | 宠物鸡 |
| `bat.jpg` | ⬛ 蝙蝠 | 蝙蝠 |
| `spider.jpg` | ⬛ 蜘蛛 | 蜘蛛（也可用 `aunt.jpg`）|
| `enderman.jpg` | 🟪 末影人 | 末影人（也可用 `uncle.jpg`）|
| `wolf.jpg` | ⬜ 狼 | 狼（也可用 `shuaishu.jpg`）|
| `skeleton.jpg` | ⬜ 骷髅 | 骷髅（也可用 `ruyi.jpg`）|
| `rabbit.jpg` | ⬜ 兔子 | 兔子（也可用 `zeyu.jpg`）|
| `grandma.jpg` | 🟨 奶奶 | 奶奶的照片 |
| `grandpa.jpg` | 🔵 爷爷 | 爷爷的照片 |
| `player.jpg` | 🔵 玩家 | 玩家角色皮肤 |

---

## 📸 使用步骤

### 1. 创建 textures 文件夹

```bash
mkdir textures
```

### 2. 放入照片

将照片命名为对应的文件名，放入 `textures/` 文件夹：

```
textures/
├── dad.jpg          # 爸爸 → 苦力怕
├── mom.jpg          # 妈妈 → 僵尸
├── pig.jpg          # 宠物猪
├── cow.jpg          # 宠物牛
├── sheep.jpg        # 宠物羊
├── chicken.jpg      # 宠物鸡
├── bat.jpg          # 蝙蝠
├── spider.jpg       # 蜘蛛
├── enderman.jpg     # 末影人
├── wolf.jpg         # 狼
├── skeleton.jpg     # 骷髅
├── rabbit.jpg       # 兔子
├── grandma.jpg      # 奶奶
├── grandpa.jpg      # 爷爷
└── player.jpg       # 玩家皮肤
```

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
    'dad': 'DAD',
    'mom': 'MOM', 
    'pig': 'PIG',
    'cow': 'COW',
    'sheep': 'SHEEP',
    'chicken': 'CHICKEN',
    'bat': 'BAT',
    'spider': 'AUNT',      # 蜘蛛使用 AUNT 键
    'aunt': 'AUNT',
    'enderman': 'UNCLE',   # 末影人使用 UNCLE 键
    'uncle': 'UNCLE',
    'wolf': 'SHUAISHU',    # 狼使用 SHUAISHU 键
    'shuaishu': 'SHUAISHU',
    'skeleton': 'RUYI',    # 骷髅使用 RUYI 键
    'ruyi': 'RUYI',
    'rabbit': 'RABBIT',
    'zeyu': 'RABBIT',
    'grandma': 'GRANDMA',
    'grandpa': 'GRANDPA',
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