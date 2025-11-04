#!/usr/bin/env python3
"""
Test multilingual functionality
"""
import asyncio
import httpx
from datetime import datetime


async def test_multilingual_chat():
    """Test multilingual chat functionality"""
    print("🌍 Testing Multilingual Chat Functionality")
    print("=" * 60)
    
    # Test cases in different languages
    test_cases = [
        {
            "language": "English",
            "message": "My dog is vomiting and has diarrhea for 2 days, very worried",
            "expected_agent": "doctor"
        },
        {
            "language": "Chinese",
            "message": "我的狗狗最近总是呕吐，没有精神，已经2天了，还拉稀，我很担心",
            "expected_agent": "doctor"
        },
        {
            "language": "Japanese", 
            "message": "私の犬は2日間嘔吐と下痢をしており、とても心配です",
            "expected_agent": "doctor"
        },
        {
            "language": "Korean",
            "message": "우리 강아지가 2일째 구토와 설사를 하고 있어서 매우 걱정됩니다",
            "expected_agent": "doctor"
        },
        {
            "language": "Spanish",
            "message": "Mi perro ha estado vomitando y con diarrea durante 2 días, muy preocupado",
            "expected_agent": "doctor"
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n🧪 Test {i}: {test_case['language']}")
        print(f"📤 Message: {test_case['message']}")
        print(f"🎯 Expected Agent: {test_case['expected_agent']}")
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
                        print(f"❌ Request failed: {response.status_code}")
                        continue
                    
                    router_agent = None
                    specialist_agent = None
                    response_language = None
                    
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
                                    print(f"🤖 Butler routed to: {router_agent}")
                                    
                                elif response_type == "transfer":
                                    print(f"🔄 Transfer message: {content.get('message')}")
                                    
                                elif response_type == "specialist":
                                    specialist_agent = agent
                                    print(f"🤖 Specialist Agent: {specialist_agent}")
                                    
                                    # Check response language
                                    if agent == "doctor":
                                        assessment = content.get('assessment', '')
                                        if assessment:
                                            # Simple language detection based on content
                                            if any(char in assessment for char in '的是一了我不在有人这个'):
                                                response_language = "Chinese"
                                            elif any(word in assessment.lower() for word in ['the', 'is', 'are', 'and', 'or']):
                                                response_language = "English"
                                            elif any(char in assessment for char in 'ですますである'):
                                                response_language = "Japanese"
                                            elif any(char in assessment for char in '입니다습니다이다'):
                                                response_language = "Korean"
                                            elif any(word in assessment.lower() for word in ['el', 'la', 'de', 'que', 'en']):
                                                response_language = "Spanish"
                                            else:
                                                response_language = "Unknown"
                                            
                                            print(f"🌍 Response Language: {response_language}")
                                            print(f"📝 Assessment: {assessment[:100]}...")
                                        
                            except json.JSONDecodeError:
                                pass
                    
                    # Verify results
                    if router_agent == test_case["expected_agent"]:
                        print(f"✅ Routing correct: {router_agent}")
                    else:
                        print(f"❌ Routing error: Expected {test_case['expected_agent']}, got {router_agent}")
                    
                    if specialist_agent == test_case["expected_agent"]:
                        print(f"✅ Specialist Agent correct: {specialist_agent}")
                    else:
                        print(f"❌ Specialist Agent error: Expected {test_case['expected_agent']}, got {specialist_agent}")
                        
            except Exception as e:
                print(f"❌ Test failed: {e}")
        
        print()


async def test_language_detection():
    """Test language detection functionality"""
    print(f"\n🔍 Testing Language Detection")
    print("=" * 60)
    
    from app.core.language_detector import language_detector
    
    test_texts = [
        ("Hello, how are you?", "English"),
        ("你好，你好吗？", "Chinese"),
        ("こんにちは、元気ですか？", "Japanese"),
        ("안녕하세요, 어떻게 지내세요?", "Korean"),
        ("Hola, ¿cómo estás?", "Spanish"),
        ("Bonjour, comment allez-vous?", "French"),
        ("Hallo, wie geht es dir?", "German")
    ]
    
    for text, expected in test_texts:
        detected = language_detector.detect_language(text)
        language_name = language_detector.get_language_name(detected)
        instruction = language_detector.get_language_instruction(detected)
        
        print(f"📝 Text: {text}")
        print(f"🎯 Expected: {expected}")
        print(f"🔍 Detected: {detected} ({language_name})")
        print(f"💬 Instruction: {instruction}")
        print("-" * 30)


async def main():
    """Main function"""
    print("🌍 HiPet Agent Service - Multilingual Testing")
    print("=" * 60)
    
    # Test language detection
    await test_language_detection()
    
    # Test multilingual chat
    await test_multilingual_chat()
    
    print("\n🎉 Multilingual testing completed!")
    print("=" * 60)
    print("💡 Notes:")
    print("   1. Language detection should work automatically")
    print("   2. Responses should be in the same language as input")
    print("   3. All routing should work regardless of language")
    print("   4. System messages can be in English (technical)")


if __name__ == "__main__":
    asyncio.run(main())
