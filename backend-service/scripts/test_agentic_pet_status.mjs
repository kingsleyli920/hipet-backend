#!/usr/bin/env node

/**
 * Test script for Agentic Pet Status Query
 * Tests whether Router Agent can correctly determine if pet status is needed
 * 
 * Usage:
 *   bun run test:agentic
 *   or
 *   node scripts/test_agentic_pet_status.mjs
 * 
 * Environment variables:
 *   AGENT_SERVICE_URL - Agent service URL (default: http://localhost:8001)
 *   BACKEND_URL - Backend service URL (default: http://localhost:8000)
 */

// Use native fetch (available in Node.js 18+ and Bun)

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:8001';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// Test cases: [message, expected_needs_status, description]
const testCases = [
  // Should NOT need pet status
  ['你好', false, 'Simple greeting'],
  ['谢谢', false, 'Thank you message'],
  ['这个应用是做什么的？', false, 'General FAQ question'],
  ['如何使用设备？', false, 'Device usage question'],
  ['什么是健康监测？', false, 'General knowledge question'],
  ['hello', false, 'English greeting'],
  
  // Should NEED pet status
  ['我的宠物最近怎么样？', true, 'Ask about recent status'],
  ['宠物的健康状态如何？', true, 'Ask about health status'],
  ['最近体温正常吗？', true, 'Ask about temperature'],
  ['心率是多少？', true, 'Ask about heart rate'],
  ['最近活动量怎么样？', true, 'Ask about activity'],
  ['我的宠物健康吗？', true, 'Ask if pet is healthy'],
  ['最近有什么异常吗？', true, 'Ask about anomalies'],
  ['how is my pet doing?', true, 'English: ask about status'],
  ['what is the current temperature?', true, 'English: ask about vital signs'],
];

// Real test data from database
const TEST_USER_EMAIL = 'test@hipet.com';
const TEST_PET_ID = 'cmhwxtxy70007ztqcr7q04q81'; // Buddy from test@hipet.com
const TEST_PET_PROFILE = {
  name: 'Buddy',
  breed: 'Golden Retriever',
  age: 3,
  weight: 28
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testRouterCheck(message, expectedNeedsStatus, description) {
  try {
    log(`\n📝 Testing: "${message}"`, 'cyan');
    log(`   Expected: needs_pet_status = ${expectedNeedsStatus}`, 'blue');
    log(`   Description: ${description}`, 'blue');

    // Try router-check endpoint first, fallback to stream endpoint
    let result = null;
    let useStream = false;

    try {
      const routerCheckResponse = await fetch(`${AGENT_SERVICE_URL}/chat/router-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversation_summary: '',
          pet_profile: TEST_PET_PROFILE,
          language: 'zh'
        })
      });

      if (routerCheckResponse.ok) {
        result = await routerCheckResponse.json();
      } else {
        useStream = true;
      }
    } catch (e) {
      useStream = true;
    }

    // Fallback to stream endpoint if router-check not available
    if (useStream) {
      const streamResponse = await fetch(`${AGENT_SERVICE_URL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversation_summary: '',
          pet_profile: TEST_PET_PROFILE,
          language: 'zh'
        })
      });

      if (!streamResponse.ok) {
        const errorText = await streamResponse.text();
        log(`   ❌ HTTP Error: ${streamResponse.status} - ${errorText}`, 'red');
        return { success: false, error: `HTTP ${streamResponse.status}` };
      }

      // Parse stream to get router response
      const reader = streamResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
                result = evt.content;
                reader.cancel();
                break;
              }
            } catch (e) {
              // Continue parsing
            }
          }
        }

        if (result) break;
      }

      if (!result) {
        log(`   ❌ No router response found in stream`, 'red');
        return { success: false, error: 'No router response' };
      }
    }

    const actualNeedsStatus = result.needs_pet_status;
    const matches = actualNeedsStatus === expectedNeedsStatus;

    if (matches) {
      log(`   ✅ Correct! needs_pet_status = ${actualNeedsStatus}`, 'green');
    } else {
      log(`   ❌ Mismatch! Expected ${expectedNeedsStatus}, got ${actualNeedsStatus}`, 'red');
    }

    log(`   📊 Details:`, 'yellow');
    log(`      - next: ${result.next}`, 'yellow');
    log(`      - confidence: ${result.confidence}`, 'yellow');
    log(`      - reason: ${result.reason}`, 'yellow');
    if (useStream) {
      log(`      - method: stream endpoint (router-check not available)`, 'yellow');
    }

    return {
      success: matches,
      expected: expectedNeedsStatus,
      actual: actualNeedsStatus,
      result
    };

  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testFullChatFlow(message, shouldQueryDB) {
  try {
    log(`\n🔄 Testing Full Chat Flow: "${message}"`, 'cyan');
    log(`   Should query DB: ${shouldQueryDB}`, 'blue');

    // Note: This requires authentication token
    // For now, we'll just test the router check part
    log(`   ⚠️  Full chat flow test requires authentication token`, 'yellow');
    log(`   ⚠️  Skipping full flow test for now`, 'yellow');

    return { success: true, skipped: true };

  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function main() {
  log('🚀 Starting Agentic Pet Status Query Tests', 'cyan');
  log('=' .repeat(60), 'cyan');
  log(`\n📋 Using test data:`, 'blue');
  log(`   User: ${TEST_USER_EMAIL}`, 'blue');
  log(`   Pet: ${TEST_PET_PROFILE.name} (${TEST_PET_ID})`, 'blue');
  log(`   Profile: ${JSON.stringify(TEST_PET_PROFILE)}`, 'blue');

  // Check if agent service is available
  try {
    const healthCheck = await fetch(`${AGENT_SERVICE_URL}/health`);
    if (!healthCheck.ok) {
      log(`\n❌ Agent service is not available at ${AGENT_SERVICE_URL}`, 'red');
      log(`   Please make sure the agent service is running`, 'yellow');
      process.exit(1);
    }
    log(`\n✅ Agent service is available at ${AGENT_SERVICE_URL}`, 'green');
    
    // Check if router-check endpoint exists
    const routerCheckTest = await fetch(`${AGENT_SERVICE_URL}/chat/router-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'test',
        pet_profile: {},
        conversation_summary: ''
      })
    });
    
    if (routerCheckTest.status === 404) {
      log(`\n⚠️  Router-check endpoint not found (404)`, 'yellow');
      log(`   Will use /chat/stream endpoint instead (works but slower)`, 'yellow');
      log(`   To enable router-check: restart agent service to load new route`, 'yellow');
    } else if (routerCheckTest.ok) {
      log(`✅ Router-check endpoint is available`, 'green');
    } else {
      log(`⚠️  Router-check endpoint returned status ${routerCheckTest.status}`, 'yellow');
      log(`   Will use /chat/stream endpoint instead`, 'yellow');
    }
  } catch (error) {
    log(`\n❌ Cannot connect to agent service: ${error.message}`, 'red');
    log(`   Please make sure the agent service is running at ${AGENT_SERVICE_URL}`, 'yellow');
    process.exit(1);
  }

  // Run tests
  const results = [];
  let passed = 0;
  let failed = 0;

  for (const [message, expectedNeedsStatus, description] of testCases) {
    const result = await testRouterCheck(message, expectedNeedsStatus, description);
    results.push({ message, description, ...result });
    
    if (result.success) {
      passed++;
    } else {
      failed++;
    }

    // Small delay to avoid overwhelming the service
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 Test Summary', 'cyan');
  log('='.repeat(60), 'cyan');
  log(`Total tests: ${testCases.length}`, 'blue');
  log(`✅ Passed: ${passed}`, 'green');
  log(`❌ Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  log(`Success rate: ${((passed / testCases.length) * 100).toFixed(1)}%`, 
      passed === testCases.length ? 'green' : 'yellow');

  // Detailed results
  if (failed > 0) {
    log('\n❌ Failed Tests:', 'red');
    results.forEach((r, i) => {
      if (!r.success) {
        log(`   ${i + 1}. "${r.message}"`, 'red');
        log(`      Expected: ${r.expected}, Got: ${r.actual}`, 'red');
      }
    });
  }

  // Recommendations
  log('\n💡 Recommendations:', 'yellow');
  if (failed === 0) {
    log('   ✅ All tests passed! Router Agent is working correctly.', 'green');
  } else {
    log('   ⚠️  Some tests failed. Consider:', 'yellow');
    log('      1. Review Router Agent prompt for better guidance', 'yellow');
    log('      2. Check if LLM model is responding correctly', 'yellow');
    log('      3. Verify needs_pet_status field is being set properly', 'yellow');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  log(`\n💥 Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

