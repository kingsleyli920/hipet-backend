#!/bin/bash

# HiPet Agent Service 启动脚本

echo "Starting HiPet Agent Service..."

# 检查是否存在 .env 文件
if [ ! -f .env ]; then
    echo "Warning: .env file not found. Please create one based on config.py"
    echo "Required environment variables:"
    echo "- GOOGLE_PROJECT_ID: Your Google Cloud project ID"
    echo "- GOOGLE_APPLICATION_CREDENTIALS: Path to your service account key file"
    echo "- LLM_API_KEY: Your Google Vertex AI API key"
    echo "- LLM_MODEL: Model name (default: gemini-1.5-pro)"
fi

# 检查 Google 认证文件
if [ ! -f "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    echo "Error: Google credentials file not found at $GOOGLE_APPLICATION_CREDENTIALS"
    echo "Please set GOOGLE_APPLICATION_CREDENTIALS environment variable"
    exit 1
fi

# 安装依赖
echo "Installing dependencies..."
pip install -r requirements.txt

# 启动服务
echo "Starting service..."
python main.py
