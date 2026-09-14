#!/usr/bin/env python3
"""
🎨 Minecraft Web 3D 纹理转换工具
将 textures/ 文件夹中的照片转换为 base64 并更新到 JS 文件中

使用方法:
1. 将照片放入 textures/ 文件夹
2. 运行: python3 convert_textures.py
3. 照片会自动替换到游戏中!

照片命名对应关系:
  dad.jpg      → 苦力怕
  mom.jpg      → 僵尸
  pig.jpg      → 猪
  cow.jpg      → 牛
  sheep.jpg    → 羊
  chicken.jpg  → 鸡
  bat.jpg      → 蝙蝠
  spider.jpg   → 蜘蛛 (或 aunt.jpg)
  enderman.jpg → 末影人 (或 uncle.jpg)
  wolf.jpg     → 狼 (或 shuaishu.jpg)
  skeleton.jpg → 骷髅 (或 ruyi.jpg)
  rabbit.jpg   → 兔子 (或 zeyu.jpg)
  grandma.jpg  → 奶奶
  grandpa.jpg  → 爷爷
  player.jpg   → 玩家皮肤
"""

import base64
import os
import re
import sys

# 检查依赖
try:
    from PIL import Image
except ImportError:
    print("❌ 需要安装 Pillow 库")
    print("   运行: pip3 install Pillow")
    sys.exit(1)

# 配置
TEXTURE_DIR = 'textures'
JS_FILE = 'minecraft-3d.js'
IMAGE_SIZE = 128  # 纹理尺寸

# 纹理映射：文件名 -> 代码中的键名
FILE_MAP = {
    'dad': 'DAD',
    'mom': 'MOM',
    'pig': 'PIG',
    'cow': 'COW',
    'sheep': 'SHEEP',
    'chicken': 'CHICKEN',
    'bat': 'BAT',
    'spider': 'AUNT',
    'aunt': 'AUNT',
    'enderman': 'UNCLE',
    'uncle': 'UNCLE',
    'wolf': 'SHUAISHU',
    'shuaishu': 'SHUAISHU',
    'skeleton': 'RUYI',
    'ruyi': 'RUYI',
    'rabbit': 'RABBIT',
    'zeyu': 'RABBIT',
    'grandma': 'GRANDMA',
    'grandpa': 'GRANDPA',
    'player': 'PLAYER',  # 玩家皮肤
}


def resize_image(img_path, size=IMAGE_SIZE):
    """调整图片尺寸并保存为临时文件"""
    try:
        img = Image.open(img_path)
        # 转换为 RGB（去除 alpha 通道）
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        # 调整尺寸
        img = img.resize((size, size), Image.LANCZOS)
        # 保存为临时文件
        temp_path = f'/tmp/texture_{os.path.basename(img_path)}'
        img.save(temp_path, 'JPEG', quality=85, optimize=True)
        return temp_path
    except Exception as e:
        print(f"  ⚠️  处理失败: {e}")
        return None


def image_to_base64(img_path):
    """将图片转换为 base64 字符串"""
    with open(img_path, 'rb') as f:
        return base64.b64encode(f.read()).decode('ascii')


def find_textures():
    """查找 textures 文件夹中的图片"""
    if not os.path.exists(TEXTURE_DIR):
        print(f"❌ 未找到 {TEXTURE_DIR}/ 文件夹")
        print(f"   请创建文件夹并放入照片")
        return {}

    textures = {}
    files = os.listdir(TEXTURE_DIR)
    
    for filename, ext in files:
        pass  # 不使用
    
    for filename in files:
        name, ext = os.path.splitext(filename)
        name_lower = name.lower()
        ext_lower = ext.lower()
        
        if ext_lower not in ['.jpg', '.jpeg', '.png']:
            continue
        
        if name_lower not in FILE_MAP:
            print(f"  ⚠️  跳过未知文件: {filename}")
            continue
        
        key = FILE_MAP[name_lower]
        path = os.path.join(TEXTURE_DIR, filename)
        
        print(f"  📸 处理: {filename} -> {key}")
        
        # 调整尺寸
        resized_path = resize_image(path)
        if not resized_path:
            continue
        
        # 转换为 base64
        b64 = image_to_base64(resized_path)
        mime = 'image/jpeg'
        
        textures[key] = f'data:{mime};base64,{b64}'
    
    return textures


def generate_texture_map(textures):
    """生成 TEXTURE_MAP 代码"""
    lines = ['const TEXTURE_MAP = {']
    for key in sorted(textures.keys()):
        if key == 'PLAYER':
            continue  # 玩家皮肤单独处理
        lines.append(f"    {key}: '{textures[key]}',")
    lines.append('};')
    return '\n'.join(lines)


def update_js_file(texture_map, player_texture):
    """更新 JS 文件中的纹理数据"""
    if not os.path.exists(JS_FILE):
        print(f"❌ 未找到 {JS_FILE}")
        return False
    
    with open(JS_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. 替换 TEXTURE_MAP
    old_pattern = r"const TEXTURE_MAP = \{.*?\n\};"
    match = re.search(old_pattern, content, re.DOTALL)
    
    if match:
        old_map = match.group()
        new_map = generate_texture_map(textures)
        content = content[:match.start()] + new_map + content[match.end():]
        print(f"  ✅ TEXTURE_MAP 已更新 ({len(new_map)} 字符)")
    else:
        print(f"  ⚠️  未找到 TEXTURE_MAP，跳过")
    
    # 2. 替换玩家纹理
    if player_texture:
        player_pattern = r"playerTexture = texLoader\.load\('data:image/[^']*'\);"
        player_match = re.search(player_pattern, content)
        
        if player_match:
            new_player_line = f"playerTexture = texLoader.load('{player_texture}');"
            content = content[:player_match.start()] + new_player_line + content[player_match.end():]
            print(f"  ✅ 玩家纹理已更新")
        else:
            print(f"  ⚠️  未找到玩家纹理，跳过")
    
    # 保存文件
    with open(JS_FILE, 'w', encoding='utf-8') as f:
        f.write(content)
    
    return True


def main():
    print("=" * 50)
    print("🎨 Minecraft Web 3D 纹理转换工具")
    print("=" * 50)
    print()
    
    # 查找纹理
    print("🔍 扫描 textures/ 文件夹...")
    textures = find_textures()
    
    if not textures:
        print("\n❌ 未找到有效纹理")
        print("   请将照片放入 textures/ 文件夹")
        print("   文件名参考: dad.jpg, mom.jpg, pig.jpg, ...")
        return
    
    print(f"\n✅ 找到 {len(textures)} 个纹理")
    
    # 获取玩家纹理
    player_texture = textures.get('PLAYER')
    
    # 更新 JS 文件
    print(f"\n💾 更新 {JS_FILE}...")
    success = update_js_file(textures, player_texture)
    
    if success:
        print("\n" + "=" * 50)
        print("🎉 完成！纹理已成功更新到游戏中")
        print("=" * 50)
        print("\n📌 提示:")
        print("  • 使用 bash serve.sh 启动游戏")
        print("  • 或 python3 -m http.server 8080")
        print("  • 访问 http://localhost:8080/minecraft-3d.html")
    else:
        print("\n❌ 更新失败，请检查错误信息")


if __name__ == '__main__':
    main()