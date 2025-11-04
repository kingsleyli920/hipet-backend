#!/usr/bin/env python3
"""
测试演示流程 - 模拟HTML演示页面的功能
"""
import asyncio
import httpx
from datetime import datetime


async def test_demo_flow():
    """测试完整的演示流程"""
    print("🎭 测试演示流程")
    print("=" * 60)
    
    # 测试用例
    test_cases = [
        {
            "name": "健康紧急情况",
            "message": "我的狗狗最近总是呕吐，没有精神，已经2天了，还拉稀，我很担心",
            "expected_agent": "doctor"
        },
        {
            "name": "营养咨询",
            "message": "我的狗狗体重超标，应该吃什么狗粮？",
            "expected_agent": "nutritionist"
        },
        {
            "name": "训练问题",
            "message": "我的狗狗总是乱叫，怎么训练它？",
            "expected_agent": "trainer"
        },
        {
            "name": "FAQ查询",
            "message": "狗狗多久洗一次澡？",
            "expected_agent": "faq"
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n🧪 测试 {i}: {test_case['name']}")
        print(f"📤 消息: {test_case['message']}")
        print(f"🎯 期望Agent: {test_case['expected_agent']}")
        print("-" * 40)
        
        request_data = {
            "message": test_case["message"],
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
                        continue
                    
                    router_agent = None
                    specialist_agent = None
                    
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            
                            if data == "[DONE]":
                                break
                            
                            try:
                                import json
                                response_data = json.loads(data)
                                response_type = response_data.get("type")
                                agent = response_data.get("agent")
                                content = response_data.get("content")
                                
                                if response_type == "router":
                                    router_agent = content.get("next")
                                    print(f"🤖 管家路由到: {router_agent}")
                                    
                                elif response_type == "transfer":
                                    print(f"🔄 转接提示: {content.get('message')}")
                                    
                                elif response_type == "specialist":
                                    specialist_agent = agent
                                    print(f"🤖 专科Agent: {specialist_agent}")
                                    
                                    # 显示部分响应内容
                                    if agent == "doctor":
                                        print(f"   🏥 评估: {content.get('assessment', '')[:100]}...")
                                        print(f"   ⚠️  风险等级: {content.get('risk_level', 'unknown')}")
                                    elif agent == "nutritionist":
                                        print(f"   🍽️  总结: {content.get('summary', '')[:100]}...")
                                    elif agent == "trainer":
                                        print(f"   🎯 目标: {content.get('goal', '')[:100]}...")
                                    elif agent == "faq":
                                        print(f"   ❓ 答案: {content.get('answer', '')[:100]}...")
                                        
                            except json.JSONDecodeError:
                                pass
                    
                    # 验证结果
                    if router_agent == test_case["expected_agent"]:
                        print(f"✅ 路由正确: {router_agent}")
                    else:
                        print(f"❌ 路由错误: 期望 {test_case['expected_agent']}, 实际 {router_agent}")
                    
                    if specialist_agent == test_case["expected_agent"]:
                        print(f"✅ 专科Agent正确: {specialist_agent}")
                    else:
                        print(f"❌ 专科Agent错误: 期望 {test_case['expected_agent']}, 实际 {specialist_agent}")
                        
            except Exception as e:
                print(f"❌ 测试失败: {e}")
        
        print()


async def test_return_to_butler():
    """测试返回管家功能"""
    print(f"\n🔄 测试返回管家功能")
    print("=" * 60)
    
    request_data = {
        "message": "返回管家",
        "conversation_summary": "用户之前咨询了健康问题",
        "pet_profile": {
            "name": "小白",
            "breed": "金毛",
            "age": 24,
            "weight": 25.5,
            "gender": "male",
            "neutered": True
        }
    }
    
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
                            break
                        
                        try:
                            import json
                            response_data = json.loads(data)
                            response_type = response_data.get("type")
                            agent = response_data.get("agent")
                            content = response_data.get("content")
                            
                            if response_type == "router":
                                print(f"🤖 管家路由: {content.get('next')}")
                                
                            elif response_type == "specialist" and agent == "butler":
                                if content.get("status") == "returned_to_butler":
                                    print(f"✅ 成功返回管家: {content.get('message')}")
                                else:
                                    print(f"❌ 返回管家失败")
                                    
                        except json.JSONDecodeError:
                            pass
                            
        except Exception as e:
            print(f"❌ 测试失败: {e}")


async def main():
    """主函数"""
    print("🎭 HiPet Agent Service 演示流程测试")
    print("=" * 60)
    
    # 测试主要演示流程
    await test_demo_flow()
    
    # 测试返回管家功能
    await test_return_to_butler()
    
    print("\n🎉 演示流程测试完成！")
    print("=" * 60)
    print("💡 提示：")
    print("   1. 所有测试用例都应该正确路由到对应的专科Agent")
    print("   2. 流式输出应该包含：Router -> Transfer -> Specialist")
    print("   3. 返回管家功能应该正常工作")
    print("   4. 可以打开 demo.html 进行可视化测试")


if __name__ == "__main__":
    asyncio.run(main())
