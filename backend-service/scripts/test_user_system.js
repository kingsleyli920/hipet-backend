#!/usr/bin/env node

/**
 * Test script for user system functionality
 * Tests authentication, user management, and pet management
 */

import { PrismaClient } from '@prisma/client';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';
const prisma = new PrismaClient();

// Test data
const testUser = {
  email: 'test@example.com',
  password: 'testpassword123',
  firstName: 'Test',
  lastName: 'User'
};

const testPet = {
  name: 'Buddy',
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

async function testHealthCheck() {
  console.log('\n🔍 Testing health check...');
  const result = await makeRequest('GET', '/health');
  
  if (result.status === 200) {
    console.log('✅ Health check passed');
    return true;
  } else {
    console.log('❌ Health check failed:', result.data);
    return false;
  }
}

async function testUserRegistration() {
  console.log('\n📝 Testing user registration...');
  const result = await makeRequest('POST', '/auth/register', testUser);
  
  if (result.status === 201) {
    console.log('✅ User registration successful');
    console.log('📧 User ID:', result.data.user.id);
    userId = result.data.user.id;
    return true;
  } else {
    console.log('❌ User registration failed:', result.data);
    return false;
  }
}

async function testUserLogin() {
  console.log('\n🔐 Testing user login...');
  const result = await makeRequest('POST', '/auth/login', {
    email: testUser.email,
    password: testUser.password
  });
  
  if (result.status === 200) {
    console.log('✅ User login successful');
    authToken = result.data.tokens.accessToken;
    return true;
  } else {
    console.log('❌ User login failed:', result.data);
    return false;
  }
}

async function testGetUserProfile() {
  console.log('\n👤 Testing get user profile...');
  const result = await makeRequest('GET', '/users/me', null, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.status === 200) {
    console.log('✅ Get user profile successful');
    console.log('📧 User email:', result.data.user.email);
    return true;
  } else {
    console.log('❌ Get user profile failed:', result.data);
    return false;
  }
}

async function testUpdateUserProfile() {
  console.log('\n✏️ Testing update user profile...');
  const result = await makeRequest('PUT', '/users/me', {
    firstName: 'Updated',
    lastName: 'Name',
    phone: '+1234567890'
  }, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.status === 200) {
    console.log('✅ Update user profile successful');
    return true;
  } else {
    console.log('❌ Update user profile failed:', result.data);
    return false;
  }
}

async function testCreatePet() {
  console.log('\n🐕 Testing create pet...');
  const result = await makeRequest('POST', '/pets', testPet, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.status === 201) {
    console.log('✅ Create pet successful');
    console.log('🐾 Pet ID:', result.data.pet.id);
    petId = result.data.pet.id;
    return true;
  } else {
    console.log('❌ Create pet failed:', result.data);
    return false;
  }
}

async function testGetPets() {
  console.log('\n🐾 Testing get pets...');
  const result = await makeRequest('GET', '/pets', null, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.status === 200) {
    console.log('✅ Get pets successful');
    console.log('📊 Pet count:', result.data.pets.length);
    return true;
  } else {
    console.log('❌ Get pets failed:', result.data);
    return false;
  }
}

async function testUpdatePet() {
  console.log('\n✏️ Testing update pet...');
  const result = await makeRequest('PUT', `/pets/${petId}`, {
    name: 'Updated Buddy',
    weight: 30.0
  }, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.status === 200) {
    console.log('✅ Update pet successful');
    return true;
  } else {
    console.log('❌ Update pet failed:', result.data);
    return false;
  }
}

async function testUploadAvatar() {
  console.log('\n📸 Testing upload avatar...');
  const result = await makeRequest('POST', '/upload/avatar', {
    imageUrl: 'https://example.com/avatar.jpg'
  }, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.status === 200) {
    console.log('✅ Upload avatar successful');
    return true;
  } else {
    console.log('❌ Upload avatar failed:', result.data);
    return false;
  }
}

async function testUploadPetPhoto() {
  console.log('\n📸 Testing upload pet photo...');
  const result = await makeRequest('POST', `/upload/pet/${petId}`, {
    imageUrl: 'https://example.com/pet-photo.jpg'
  }, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.status === 200) {
    console.log('✅ Upload pet photo successful');
    return true;
  } else {
    console.log('❌ Upload pet photo failed:', result.data);
    return false;
  }
}

async function testGetUploadStatus() {
  console.log('\n📊 Testing upload status...');
  const result = await makeRequest('GET', '/upload/status', null, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.status === 200) {
    console.log('✅ Get upload status successful');
    console.log('🔧 Services status:', result.data.status);
    return true;
  } else {
    console.log('❌ Get upload status failed:', result.data);
    return false;
  }
}

async function testUserLogout() {
  console.log('\n🚪 Testing user logout...');
  const result = await makeRequest('POST', '/auth/logout', {
    refreshToken: 'dummy-refresh-token'
  }, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.status === 200) {
    console.log('✅ User logout successful');
    return true;
  } else {
    console.log('❌ User logout failed:', result.data);
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
  console.log('🚀 Starting user system tests...');
  console.log(`🌐 Testing against: ${BASE_URL}`);
  
  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'User Registration', fn: testUserRegistration },
    { name: 'User Login', fn: testUserLogin },
    { name: 'Get User Profile', fn: testGetUserProfile },
    { name: 'Update User Profile', fn: testUpdateUserProfile },
    { name: 'Create Pet', fn: testCreatePet },
    { name: 'Get Pets', fn: testGetPets },
    { name: 'Update Pet', fn: testUpdatePet },
    { name: 'Upload Avatar', fn: testUploadAvatar },
    { name: 'Upload Pet Photo', fn: testUploadPetPhoto },
    { name: 'Get Upload Status', fn: testGetUploadStatus },
    { name: 'User Logout', fn: testUserLogout }
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
    console.log('\n🎉 All tests passed!');
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
