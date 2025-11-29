#!/usr/bin/env node

/**
 * Quick test to check if Router Agent returns needs_pet_status in stream response
 */

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:8001';

const testMessages = [
  '你好',
  '我的宠物最近怎么样？'
];

async function testRouterResponse(message) {
  console.log(`\n📝 Testing: "${message}"`);
  
  try {
    const response = await fetch(`${AGENT_SERVICE_URL}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversation_summary: '',
        pet_profile: {
          name: 'Buddy',
          breed: 'Golden Retriever',
          age: 3,
          weight: 28
        },
        language: 'zh'
      })
    });

    if (!response.ok) {
      console.log(`   ❌ HTTP Error: ${response.status}`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let routerResponse = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;

          try {
            const evt = JSON.parse(payload);
            if (evt.type === 'router' && evt.content) {
              routerResponse = evt.content;
              console.log(`   ✅ Router response received:`);
              console.log(`      - next: ${routerResponse.next}`);
              console.log(`      - needs_pet_status: ${routerResponse.needs_pet_status ?? 'NOT SET'}`);
              console.log(`      - reason: ${routerResponse.reason}`);
              console.log(`      - confidence: ${routerResponse.confidence}`);
              reader.cancel();
              break;
            }
          } catch (e) {
            // Continue parsing
          }
        }
      }

      if (routerResponse) break;
    }

    if (!routerResponse) {
      console.log(`   ⚠️  No router response found in stream`);
    }

  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Testing Router Agent Response');
  console.log('='.repeat(60));

  for (const message of testMessages) {
    await testRouterResponse(message);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test completed');
}

main().catch(console.error);

