#!/usr/bin/env python3
"""
测试基于 LangGraph 的聊天功能
"""
import asyncio
import httpx
from datetime import datetime


async def test_langgraph_chat():
    """测试 LangGraph 聊天功能"""
    print("🧪 测试基于 LangGraph 的聊天功能")
    print("=" * 60)
    
    # 测试数据
    request_data = {
        "message": "我的狗狗最近总是呕吐，没有精神，已经2天了，还拉稀，我很担心",
        "conversation_summary": "",
        "pet_profile": {
            "name": "小白",
            "breed": "金毛",
            "age": 24,
            "weight": 25.5,
            "gender": "male",
            "neutered": True
        },
        "window_stats": {
            "timestamp": datetime.now().isoformat(),
            "heart_rate": 125.0,
            "hrv": 40.0,
            "activity_level": 0.2
        }
    }
    
    print(f"📤 发送请求: {request_data['message']}")
    print("\n📥 接收流式响应:")
    print("-" * 60)
    
    async with httpx.AsyncClient() as client:
        try:
            async with client.stream(
                "POST",
                "http://localhost:8001/chat/stream",
                json=request_data,
                timeout=30.0
            ) as response:
                if response.status_code != 200:
                    print(f"❌ 请求失败: {response.status_code}")
                    return
                
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        
                        if data == "[DONE]":
                            print("\n✅ 流式响应完成")
                            break
                        
                        try:
                            import json
                            response_data = json.loads(data)
                            response_type = response_data.get("type")
                            agent = response_data.get("agent")
                            content = response_data.get("content")
                            
                            if response_type == "router":
                                print(f"\n🤖 AI管家 ({agent}):")
                                print(f"   🎯 目标: {content.get('next', 'unknown')}")
                                print(f"   💭 原因: {content.get('reason', 'unknown')}")
                                print(f"   📊 置信度: {content.get('confidence', 0)}")
                                
                            elif response_type == "transfer":
                                print(f"\n🔄 系统提示:")
                                print(f"   {content.get('message', 'unknown')}")
                                
                            elif response_type == "specialist":
                                print(f"\n🤖 {agent.upper()} specialist:")
                                if agent == "doctor":
                                    print(f"   🏥 评估: {content.get('assessment', 'unknown')}")
                                    print(f"   ⚠️  风险等级: {content.get('risk_level', 'unknown').upper()}")
                                    print(f"   📋 建议行动:")
                                    for i, action in enumerate(content.get('next_actions', [])[:3], 1):
                                        print(f"      {i}. {action}")
                                elif agent == "nutritionist":
                                    print(f"   🍽️  总结: {content.get('summary', 'unknown')}")
                                    print(f"   📝 饮食计划:")
                                    for i, plan in enumerate(content.get('meal_plan', [])[:3], 1):
                                        print(f"      {i}. {plan}")
                                        
                            elif response_type == "error":
                                print(f"\n❌ 错误: {content.get('error', 'unknown')}")
                                
                        except json.JSONDecodeError as e:
                            print(f"⚠️  JSON 解析错误: {e}")
                            print(f"   原始数据: {data}")
                            
        except httpx.TimeoutException:
            print("⏰ 请求超时")
        except Exception as e:
            print(f"❌ 请求失败: {e}")


async def test_simple_chat():
    """测试Simple chat interface"""
    print(f"\n🚀 测试简单聊天 API")
    print("=" * 60)
    
    request_data = {
        "message": "我的狗狗体重超标，应该吃什么狗粮？",
        "conversation_summary": "",
        "pet_profile": {
            "name": "小白",
            "breed": "金毛",
            "age": 24,
            "weight": 30.0,
            "gender": "male",
            "neutered": True
        }
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "http://localhost:8001/chat/simple",
                json=request_data,
                timeout=30.0
            )
            
            if response.status_code == 200:
                result = response.json()
                print("📥 完整响应:")
                import json
                print(json.dumps(result, indent=2, ensure_ascii=False))
                
            else:
                print(f"❌ 请求失败: {response.status_code}")
                print(response.text)
                
        except Exception as e:
            print(f"❌ 请求失败: {e}")


async def test_agents_list():
    """测试Agent列表接口"""
    print(f"\n📋 测试Agent列表 API")
    print("=" * 60)
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get("http://localhost:8001/chat/agents")
            
            if response.status_code == 200:
                result = response.json()
                print("📥 Agent列表:")
                for agent in result['agents']:
                    print(f"   - {agent['name']}: {agent['description']}")
                print(f"\n📝 说明: {result['note']}")
                
            else:
                print(f"❌ 请求失败: {response.status_code}")
                
        except Exception as e:
            print(f"❌ 请求失败: {e}")


async def main():
    """主函数"""
    print("请确保 agent-service 正在运行 (python main.py)")
    print("服务地址: http://localhost:8001")
    print("=" * 60)
    
    # 测试Agent列表
    await test_agents_list()
    
    # 测试流式聊天
    await test_langgraph_chat()
    
    # 测试简单聊天
    await test_simple_chat()


if __name__ == "__main__":
    asyncio.run(main())
