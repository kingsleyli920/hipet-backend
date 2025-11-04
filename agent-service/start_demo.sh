#!/bin/bash

echo "🚀 启动 HiPet Agent Service 演示"
echo "=================================="

# 检查服务是否运行
if ! curl -s http://localhost:8001/health/ > /dev/null; then
    echo "❌ Agent Service 未运行，正在启动..."
    
    # 设置环境变量
    export GOOGLE_APPLICATION_CREDENTIALS="/Users/kingsley/Downloads/huolab-ai-aa17c2427b35.json"
    
    # 启动服务
    echo "🔄 启动 Agent Service..."
    python main.py &
    SERVICE_PID=$!
    
    # 等待服务启动
    echo "⏳ 等待服务启动..."
    for i in {1..30}; do
        if curl -s http://localhost:8001/health/ > /dev/null; then
            echo "✅ Agent Service 启动成功！"
            break
        fi
        sleep 1
    done
    
    if ! curl -s http://localhost:8001/health/ > /dev/null; then
        echo "❌ 服务启动失败"
        exit 1
    fi
else
    echo "✅ Agent Service 已在运行"
fi

# 打开演示页面
echo "🌐 打开演示页面..."
open demo.html

echo ""
echo "🎉 演示准备就绪！"
echo "📱 演示页面已在浏览器中打开"
echo "🔗 服务地址: http://localhost:8001"
echo "📄 演示页面: demo.html"
echo ""
echo "💡 提示："
echo "   - 点击演示按钮体验不同场景"
echo "   - 也可以直接输入自定义问题"
echo "   - 按 Ctrl+C 停止服务"
echo ""

# 保持脚本运行
wait $SERVICE_PID 2>/dev/null || true
