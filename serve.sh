#!/bin/bash
# =============================================================
# 🎮 Minecraft Web 3D - 本地服务器启动脚本
# =============================================================
# 用法:
#   bash serve.sh           # 默认端口 8080
#   bash serve.sh 3000      # 自定义端口
# =============================================================

cd "$(dirname "$0")"
PORT=${1:-8080}
HOST=127.0.0.1

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     🌍 Minecraft Web 3D - 本地服务器       ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  🖥️  地址: http://${HOST}:${PORT}/minecraft-3d.html  ║"
echo "║  ⌨️  按 Ctrl+C 停止服务器                    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# 检查 Python3 是否可用
if command -v python3 &> /dev/null; then
    python3 -m http.server "$PORT" --bind "$HOST"
elif command -v python &> /dev/null; then
    python -m http.server "$PORT" --bind "$HOST"
else
    echo "❌ 未找到 Python，请安装后重试"
    echo "   macOS:  brew install python3"
    echo "   Ubuntu: sudo apt install python3"
    exit 1
fi