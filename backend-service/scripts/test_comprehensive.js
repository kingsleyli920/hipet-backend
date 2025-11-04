#!/usr/bin/env node

/**
 * Comprehensive Test Script
 * Tests the complete HiPet backend system including:
 * - User authentication and management
 * - Pet management
 * - Avatar generation
 * - File upload
 * - Service integration
 */

import { PrismaClient } from '@prisma/client';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';
const AGENT_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:8001';
const prisma = new PrismaClient();

// Test data
const testUsers = [
  {
    email: 'user1@example.com',
    password: 'password123',
    firstName: 'John',
    lastName: 'Doe'
  },
  {
    email: 'user2@example.com',
    password: 'password123',
    firstName: 'Jane',
    lastName: 'Smith'
  }
];

const testPets = [
  {
    name: 'Buddy',
    species: 'dog',
    breed: 'Golden Retriever',
    weight: 25.5,
    gender: 'male'
  },
  {
    name: 'Whiskers',
    species: 'cat',
    breed: 'Persian',
    weight: 4.2,
    gender: 'female'
  }
];

let authTokens = {};
let userIds = {};
let petIds = {};

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

async function testSystemHealth() {
  console.log('\n🏥 Testing system health...');
  
  // Test backend health
  const backendHealth = await makeRequest('GET', '/health');
  if (backendHealth.status !== 200) {
    console.log('❌ Backend service unhealthy');
    return false;
  }
  console.log('✅ Backend service healthy');

  // Test AI Agent service
  try {
    const agentResponse = await fetch(`${AGENT_URL}/health`);
    if (agentResponse.ok) {
      console.log('✅ AI Agent service healthy');
    } else {
      console.log('⚠️ AI Agent service not responding (will use placeholder mode)');
    }
  } catch (error) {
    console.log('⚠️ AI Agent service not available (will use placeholder mode)');
  }

  return true;
}

async function testUserAuthentication() {
  console.log('\n👤 Testing user authentication...');
  
  for (let i = 0; i < testUsers.length; i++) {
    const user = testUsers[i];
    const userKey = `user${i + 1}`;
    
    console.log(`\n📝 Testing ${userKey} registration...`);
    const registerResult = await makeRequest('POST', '/auth/register', user);
    if (registerResult.status !== 201) {
      console.log(`❌ ${userKey} registration failed:`, registerResult.data);
      return false;
    }
    userIds[userKey] = registerResult.data.user.id;
    console.log(`✅ ${userKey} registered (ID: ${userIds[userKey]})`);

    console.log(`🔐 Testing ${userKey} login...`);
    const loginResult = await makeRequest('POST', '/auth/login', {
      email: user.email,
      password: user.password
    });
    if (loginResult.status !== 200) {
      console.log(`❌ ${userKey} login failed:`, loginResult.data);
      return false;
    }
    authTokens[userKey] = loginResult.data.tokens.accessToken;
    console.log(`✅ ${userKey} logged in`);
  }

  return true;
}

async function testPetManagement() {
  console.log('\n🐾 Testing pet management...');
  
  for (let i = 0; i < testUsers.length; i++) {
    const userKey = `user${i + 1}`;
    const pet = testPets[i];
    
    console.log(`\n🐕 Testing ${userKey} pet creation...`);
    const petResult = await makeRequest('POST', '/pets', pet, {
      'Authorization': `Bearer ${authTokens[userKey]}`
    });
    if (petResult.status !== 201) {
      console.log(`❌ ${userKey} pet creation failed:`, petResult.data);
      return false;
    }
    petIds[userKey] = petResult.data.pet.id;
    console.log(`✅ ${userKey} pet created (ID: ${petIds[userKey]})`);

    console.log(`📋 Testing ${userKey} pet list...`);
    const petsResult = await makeRequest('GET', '/pets', null, {
      'Authorization': `Bearer ${authTokens[userKey]}`
    });
    if (petsResult.status !== 200) {
      console.log(`❌ ${userKey} pet list failed:`, petsResult.data);
      return false;
    }
    console.log(`✅ ${userKey} has ${petsResult.data.pets.length} pet(s)`);

    console.log(`✏️ Testing ${userKey} pet update...`);
    const updateResult = await makeRequest('PUT', `/pets/${petIds[userKey]}`, {
      name: `${pet.name} Updated`,
      weight: pet.weight + 1
    }, {
      'Authorization': `Bearer ${authTokens[userKey]}`
    });
    if (updateResult.status !== 200) {
      console.log(`❌ ${userKey} pet update failed:`, updateResult.data);
      return false;
    }
    console.log(`✅ ${userKey} pet updated`);
  }

  return true;
}

async function testAvatarGeneration() {
  console.log('\n🎨 Testing avatar generation...');
  
  for (let i = 0; i < testUsers.length; i++) {
    const userKey = `user${i + 1}`;
    
    console.log(`\n🎭 Testing ${userKey} avatar generation...`);
    const avatarResult = await makeRequest('POST', `/upload/pet/${petIds[userKey]}/avatar/generate`, {
      message: `Generate a cute cartoon style avatar for my ${testPets[i].species}`,
      style: 'cartoon_neo',
      language: 'en'
    }, {
      'Authorization': `Bearer ${authTokens[userKey]}`
    });
    
    if (avatarResult.status === 200) {
      console.log(`✅ ${userKey} avatar generated successfully`);
      console.log(`🎨 Style: ${avatarResult.data.avatar.style}, Quality: ${avatarResult.data.avatar.quality}`);
    } else {
      console.log(`❌ ${userKey} avatar generation failed:`, avatarResult.data);
      return false;
    }
  }

  return true;
}

async function testAvatarStyles() {
  console.log('\n🎨 Testing avatar styles...');
  
  const stylesResult = await makeRequest('GET', '/upload/avatar/styles', null, {
    'Authorization': `Bearer ${authTokens.user1}`
  });
  
  if (stylesResult.status === 200) {
    console.log('✅ Avatar styles retrieved successfully');
    console.log('📋 Available styles:', Object.keys(stylesResult.data.styles));
    return true;
  } else {
    console.log('❌ Avatar styles retrieval failed:', stylesResult.data);
    return false;
  }
}

async function testAvatarValidation() {
  console.log('\n✅ Testing avatar validation...');
  
  const validationResult = await makeRequest('POST', '/upload/avatar/validate', {
    message: 'Generate a beautiful watercolor portrait of my dog',
    language: 'en'
  }, {
    'Authorization': `Bearer ${authTokens.user1}`
  });
  
  if (validationResult.status === 200) {
    console.log('✅ Avatar validation successful');
    console.log('📝 Validation result:', validationResult.data);
    return true;
  } else {
    console.log('❌ Avatar validation failed:', validationResult.data);
    return false;
  }
}

async function testFileUpload() {
  console.log('\n📸 Testing file upload...');
  
  for (let i = 0; i < testUsers.length; i++) {
    const userKey = `user${i + 1}`;
    
    console.log(`\n👤 Testing ${userKey} avatar upload...`);
    const avatarResult = await makeRequest('POST', '/upload/avatar', {
      imageUrl: `https://example.com/avatar-${userKey}.jpg`
    }, {
      'Authorization': `Bearer ${authTokens[userKey]}`
    });
    
    if (avatarResult.status === 200) {
      console.log(`✅ ${userKey} avatar uploaded`);
    } else {
      console.log(`❌ ${userKey} avatar upload failed:`, avatarResult.data);
      return false;
    }

    console.log(`🐾 Testing ${userKey} pet photo upload...`);
    const petPhotoResult = await makeRequest('POST', `/upload/pet/${petIds[userKey]}`, {
      imageUrl: `https://example.com/pet-${userKey}.jpg`
    }, {
      'Authorization': `Bearer ${authTokens[userKey]}`
    });
    
    if (petPhotoResult.status === 200) {
      console.log(`✅ ${userKey} pet photo uploaded`);
    } else {
      console.log(`❌ ${userKey} pet photo upload failed:`, petPhotoResult.data);
      return false;
    }
  }

  return true;
}

async function testServiceStatus() {
  console.log('\n📊 Testing service status...');
  
  const statusResult = await makeRequest('GET', '/upload/status', null, {
    'Authorization': `Bearer ${authTokens.user1}`
  });
  
  if (statusResult.status === 200) {
    console.log('✅ Service status retrieved successfully');
    console.log('🔧 Services:', statusResult.data.status.services);
    return true;
  } else {
    console.log('❌ Service status retrieval failed:', statusResult.data);
    return false;
  }
}

async function testUserSessions() {
  console.log('\n🔐 Testing user sessions...');
  
  const sessionsResult = await makeRequest('GET', '/users/me/sessions', null, {
    'Authorization': `Bearer ${authTokens.user1}`
  });
  
  if (sessionsResult.status === 200) {
    console.log('✅ User sessions retrieved successfully');
    console.log('📊 Active sessions:', sessionsResult.data.sessions.length);
    return true;
  } else {
    console.log('❌ User sessions retrieval failed:', sessionsResult.data);
    return false;
  }
}

async function testUserProfile() {
  console.log('\n👤 Testing user profile management...');
  
  const profileResult = await makeRequest('GET', '/users/me', null, {
    'Authorization': `Bearer ${authTokens.user1}`
  });
  
  if (profileResult.status === 200) {
    console.log('✅ User profile retrieved successfully');
    console.log('👤 User:', profileResult.data.user.email);
  } else {
    console.log('❌ User profile retrieval failed:', profileResult.data);
    return false;
  }

  const updateResult = await makeRequest('PUT', '/users/me', {
    firstName: 'Updated John',
    phone: '+1234567890'
  }, {
    'Authorization': `Bearer ${authTokens.user1}`
  });
  
  if (updateResult.status === 200) {
    console.log('✅ User profile updated successfully');
    return true;
  } else {
    console.log('❌ User profile update failed:', updateResult.data);
    return false;
  }
}

async function testPasswordChange() {
  console.log('\n🔒 Testing password change...');
  
  const passwordResult = await makeRequest('PUT', '/users/me/password', {
    currentPassword: 'password123',
    newPassword: 'newpassword123'
  }, {
    'Authorization': `Bearer ${authTokens.user1}`
  });
  
  if (passwordResult.status === 200) {
    console.log('✅ Password changed successfully');
    
    // Test login with new password
    const loginResult = await makeRequest('POST', '/auth/login', {
      email: testUsers[0].email,
      password: 'newpassword123'
    });
    
    if (loginResult.status === 200) {
      console.log('✅ Login with new password successful');
      authTokens.user1 = loginResult.data.tokens.accessToken; // Update token
      return true;
    } else {
      console.log('❌ Login with new password failed:', loginResult.data);
      return false;
    }
  } else {
    console.log('❌ Password change failed:', passwordResult.data);
    return false;
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  try {
    // Delete pets
    for (const petId of Object.values(petIds)) {
      if (petId) {
        await prisma.pet.delete({ where: { id: petId } });
        console.log(`✅ Pet ${petId} deleted`);
      }
    }
    
    // Delete users
    for (const userId of Object.values(userIds)) {
      if (userId) {
        await prisma.user.delete({ where: { id: userId } });
        console.log(`✅ User ${userId} deleted`);
      }
    }
    
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.log('⚠️ Cleanup error:', error.message);
  }
}

async function runComprehensiveTests() {
  console.log('🚀 Starting comprehensive HiPet system tests...');
  console.log(`🌐 Backend URL: ${BASE_URL}`);
  console.log(`🤖 Agent URL: ${AGENT_URL}`);
  
  const tests = [
    { name: 'System Health', fn: testSystemHealth },
    { name: 'User Authentication', fn: testUserAuthentication },
    { name: 'Pet Management', fn: testPetManagement },
    { name: 'Avatar Generation', fn: testAvatarGeneration },
    { name: 'Avatar Styles', fn: testAvatarStyles },
    { name: 'Avatar Validation', fn: testAvatarValidation },
    { name: 'File Upload', fn: testFileUpload },
    { name: 'Service Status', fn: testServiceStatus },
    { name: 'User Sessions', fn: testUserSessions },
    { name: 'User Profile', fn: testUserProfile },
    { name: 'Password Change', fn: testPasswordChange }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      console.log(`\n🧪 Running ${test.name}...`);
      const success = await test.fn();
      if (success) {
        passed++;
        console.log(`✅ ${test.name} passed`);
      } else {
        failed++;
        console.log(`❌ ${test.name} failed`);
      }
    } catch (error) {
      console.log(`💥 ${test.name} failed with error:`, error.message);
      failed++;
    }
  }
  
  console.log('\n📊 Comprehensive Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (passed === tests.length) {
    console.log('\n🎉 All comprehensive tests passed!');
    console.log('🌟 HiPet system is fully functional!');
  } else {
    console.log('\n💥 Some tests failed!');
    console.log('🔧 Please check the failed components.');
  }
  
  await cleanup();
  
  if (failed === 0) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Test interrupted, cleaning up...');
  await cleanup();
  process.exit(0);
});

// Run comprehensive tests
runComprehensiveTests().catch(error => {
  console.error('💥 Comprehensive test runner failed:', error);
  process.exit(1);
});





