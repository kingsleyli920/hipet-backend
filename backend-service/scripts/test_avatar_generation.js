#!/usr/bin/env node

/**
 * Test script for avatar generation functionality
 * Tests AI Agent integration for pet avatar generation
 */

import { PrismaClient } from '@prisma/client';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';
const AGENT_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:8001';
const prisma = new PrismaClient();

// Test data
const testUser = {
  email: 'avatar-test@example.com',
  password: 'testpassword123',
  firstName: 'Avatar',
  lastName: 'Tester'
};

const testPet = {
  name: 'Avatar Pet',
  species: 'dog',
  breed: 'Golden Retriever',
  weight: 25.5,
  gender: 'male'
};

let authToken = null;
let userId = null;
let petId = null;

async function makeRequest(method, endpoint, data = null, headers = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    const result = await response.json();
    
    return {
      status: response.status,
      data: result
    };
  } catch (error) {
    console.error(`Request failed: ${error.message}`);
    return { status: 0, data: { error: error.message } };
  }
}

async function testAgentServiceHealth() {
  console.log('\n🔍 Testing AI Agent service health...');
  const result = await makeRequest('GET', '/health');
  
  if (result.status === 200) {
    console.log('✅ Backend service health check passed');
  } else {
    console.log('❌ Backend service health check failed:', result.data);
    return false;
  }

  // Test AI Agent service directly
  try {
    const agentResponse = await fetch(`${AGENT_URL}/health`);
    if (agentResponse.ok) {
      console.log('✅ AI Agent service is running');
      return true;
    } else {
      console.log('⚠️ AI Agent service not responding, will use placeholder mode');
      return true;
    }
  } catch (error) {
    console.log('⚠️ AI Agent service not available, will use placeholder mode');
    return true;
  }
}

async function testUserSetup() {
  console.log('\n👤 Setting up test user...');
  
  // Register user
  const registerResult = await makeRequest('POST', '/auth/register', testUser);
  if (registerResult.status !== 201) {
    console.log('❌ User registration failed:', registerResult.data);
    return false;
  }
  userId = registerResult.data.user.id;
  console.log('✅ User registered');

  // Login user
  const loginResult = await makeRequest('POST', '/auth/login', {
    email: testUser.email,
    password: testUser.password
  });
  if (loginResult.status !== 200) {
    console.log('❌ User login failed:', loginResult.data);
    return false;
  }
  authToken = loginResult.data.tokens.accessToken;
  console.log('✅ User logged in');

  // Create pet
  const petResult = await makeRequest('POST', '/pets', testPet, {
    'Authorization': `Bearer ${authToken}`
  });
  if (petResult.status !== 201) {
    console.log('❌ Pet creation failed:', petResult.data);
    return false;
  }
  petId = petResult.data.pet.id;
  console.log('✅ Pet created');

  return true;
}

async function testGetAvatarStyles() {
  console.log('\n🎨 Testing get avatar styles...');
  const result = await makeRequest('GET', '/upload/avatar/styles', null, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.status === 200) {
    console.log('✅ Avatar styles retrieved successfully');
    console.log('📋 Available styles:', Object.keys(result.data.styles));
    return true;
  } else {
    console.log('❌ Get avatar styles failed:', result.data);
    return false;
  }
}

async function testValidateAvatarRequest() {
  console.log('\n✅ Testing avatar request validation...');
  const result = await makeRequest('POST', '/upload/avatar/validate', {
    message: 'Generate a cute cartoon style avatar for my dog',
    language: 'en'
  }, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.status === 200) {
    console.log('✅ Avatar request validation successful');
    console.log('📝 Validation result:', result.data);
    return true;
  } else {
    console.log('❌ Avatar request validation failed:', result.data);
    return false;
  }
}

async function testGenerateAvatar() {
  console.log('\n🎭 Testing avatar generation...');
  const result = await makeRequest('POST', `/upload/pet/${petId}/avatar/generate`, {
    message: 'Generate a cute cartoon style avatar for my golden retriever',
    style: 'cartoon_neo',
    language: 'en'
  }, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.status === 200) {
    console.log('✅ Avatar generation successful');
    console.log('🎨 Generated avatar:', result.data.avatar);
    console.log('🐾 Updated pet:', result.data.pet);
    return true;
  } else {
    console.log('❌ Avatar generation failed:', result.data);
    return false;
  }
}

async function testGenerateAvatarWithDifferentStyle() {
  console.log('\n🎨 Testing avatar generation with watercolor style...');
  const result = await makeRequest('POST', `/upload/pet/${petId}/avatar/generate`, {
    message: 'Create a beautiful watercolor portrait of my dog',
    style: 'watercolor',
    language: 'en'
  }, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.status === 200) {
    console.log('✅ Watercolor avatar generation successful');
    console.log('🎨 Generated avatar:', result.data.avatar);
    return true;
  } else {
    console.log('❌ Watercolor avatar generation failed:', result.data);
    return false;
  }
}

async function testGetServiceStatus() {
  console.log('\n📊 Testing service status...');
  const result = await makeRequest('GET', '/upload/status', null, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.status === 200) {
    console.log('✅ Service status retrieved successfully');
    console.log('🔧 Services status:', result.data.status);
    return true;
  } else {
    console.log('❌ Get service status failed:', result.data);
    return false;
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  try {
    if (petId) {
      await prisma.pet.delete({ where: { id: petId } });
      console.log('✅ Pet deleted');
    }
    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
      console.log('✅ User deleted');
    }
  } catch (error) {
    console.log('⚠️ Cleanup error:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting avatar generation tests...');
  console.log(`🌐 Backend URL: ${BASE_URL}`);
  console.log(`🤖 Agent URL: ${AGENT_URL}`);
  
  const tests = [
    { name: 'Agent Service Health', fn: testAgentServiceHealth },
    { name: 'User Setup', fn: testUserSetup },
    { name: 'Get Avatar Styles', fn: testGetAvatarStyles },
    { name: 'Validate Avatar Request', fn: testValidateAvatarRequest },
    { name: 'Generate Avatar', fn: testGenerateAvatar },
    { name: 'Generate Watercolor Avatar', fn: testGenerateAvatarWithDifferentStyle },
    { name: 'Get Service Status', fn: testGetServiceStatus }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const success = await test.fn();
      if (success) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name} failed with error:`, error.message);
      failed++;
    }
  }
  
  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  await cleanup();
  
  if (failed === 0) {
    console.log('\n🎉 All avatar generation tests passed!');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed!');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Test interrupted, cleaning up...');
  await cleanup();
  process.exit(0);
});

// Run tests
runTests().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});





