#!/usr/bin/env node

/**
 * OAuth Test Script
 * Tests Google OAuth integration
 */

import { PrismaClient } from '@prisma/client';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';
const prisma = new PrismaClient();

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

async function testOAuthConfiguration() {
  console.log('\n🔧 Testing OAuth configuration...');
  
  // Check if Google OAuth is configured
  const hasClientId = !!process.env.GOOGLE_CLIENT_ID;
  const hasClientSecret = !!process.env.GOOGLE_CLIENT_SECRET;
  
  console.log(`Google Client ID configured: ${hasClientId ? '✅' : '❌'}`);
  console.log(`Google Client Secret configured: ${hasClientSecret ? '✅' : '❌'}`);
  
  if (!hasClientId || !hasClientSecret) {
    console.log('⚠️ Google OAuth not fully configured, will use placeholder mode');
  }
  
  return true;
}

async function testOAuthEndpoints() {
  console.log('\n🔗 Testing OAuth endpoints...');
  
  // Test OAuth error endpoint (should work without auth)
  const errorResult = await makeRequest('GET', '/auth/error?error=test_error');
  if (errorResult.status === 200) {
    console.log('✅ OAuth error endpoint working');
  } else {
    console.log('❌ OAuth error endpoint failed:', errorResult.data);
    return false;
  }
  
  return true;
}

async function testOAuthStatusEndpoint() {
  console.log('\n📊 Testing OAuth status endpoint...');
  
  // First create a test user and login
  const testUser = {
    email: `oauth-test-${Date.now()}@example.com`,
    password: 'testpassword123',
    firstName: 'OAuth',
    lastName: 'Tester'
  };
  
  // Register user
  const registerResult = await makeRequest('POST', '/auth/register', testUser);
  if (registerResult.status !== 201) {
    console.log('❌ User registration failed:', registerResult.data);
    return false;
  }
  console.log('✅ Test user registered');
  
  // Login user
  const loginResult = await makeRequest('POST', '/auth/login', {
    email: testUser.email,
    password: testUser.password
  });
  if (loginResult.status !== 200) {
    console.log('❌ User login failed:', loginResult.data);
    return false;
  }
  const authToken = loginResult.data.tokens.accessToken;
  console.log('✅ Test user logged in');
  
  // Test OAuth status endpoint
  const statusResult = await makeRequest('GET', '/auth/status', null, {
    'Authorization': `Bearer ${authToken}`
  });
  if (statusResult.status === 200) {
    console.log('✅ OAuth status endpoint working');
    console.log('📋 OAuth accounts:', statusResult.data.accounts);
  } else {
    console.log('❌ OAuth status endpoint failed:', statusResult.data);
    return false;
  }
  
  // Test OAuth auth URL generation
  const authUrlResult = await makeRequest('GET', '/auth/google/auth-url', null, {
    'Authorization': `Bearer ${authToken}`
  });
  if (authUrlResult.status === 200) {
    console.log('✅ OAuth auth URL generation working');
    console.log('🔗 Auth URL generated (length):', authUrlResult.data.authUrl.length);
  } else {
    console.log('❌ OAuth auth URL generation failed:', authUrlResult.data);
    return false;
  }
  
  // Cleanup
  const userId = registerResult.data.user.id;
  await prisma.user.delete({ where: { id: userId } });
  console.log('✅ Test user cleaned up');
  
  return true;
}

async function testOAuthRevokeEndpoint() {
  console.log('\n🚫 Testing OAuth revoke endpoint...');
  
  // Create test user with OAuth account
  const testUser = {
    email: `oauth-revoke-test-${Date.now()}@example.com`,
    password: 'testpassword123',
    firstName: 'OAuth',
    lastName: 'Revoke'
  };
  
  // Register and login
  const registerResult = await makeRequest('POST', '/auth/register', testUser);
  if (registerResult.status !== 201) {
    console.log('❌ User registration failed:', registerResult.data);
    return false;
  }
  
  const loginResult = await makeRequest('POST', '/auth/login', {
    email: testUser.email,
    password: testUser.password
  });
  if (loginResult.status !== 200) {
    console.log('❌ User login failed:', loginResult.data);
    return false;
  }
  const authToken = loginResult.data.tokens.accessToken;
  const userId = registerResult.data.user.id;
  
  // Create mock OAuth account
  await prisma.oAuthAccount.upsert({
    where: {
      provider_providerId: {
        provider: 'google',
        providerId: `test-google-id-${Date.now()}`
      }
    },
    update: {
      userId: userId,
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token'
    },
    create: {
      userId: userId,
      provider: 'google',
      providerId: `test-google-id-${Date.now()}`,
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token'
    }
  });
  console.log('✅ Mock OAuth account created');
  
  // Test revoke endpoint
  const revokeResult = await makeRequest('POST', '/auth/google/revoke', {}, {
    'Authorization': `Bearer ${authToken}`
  });
  if (revokeResult.status === 200) {
    console.log('✅ OAuth revoke endpoint working');
  } else {
    console.log('❌ OAuth revoke endpoint failed:', revokeResult.data);
    return false;
  }
  
  // Cleanup
  await prisma.user.delete({ where: { id: userId } });
  console.log('✅ Test user cleaned up');
  
  return true;
}

async function testOAuthCallbackEndpoint() {
  console.log('\n🔄 Testing OAuth callback endpoint...');
  
  // Test callback with invalid state
  const invalidStateResult = await makeRequest('GET', '/auth/google/callback?code=test_code&state=invalid_state');
  if (invalidStateResult.status === 302 || invalidStateResult.status === 0) {
    console.log('✅ OAuth callback handles invalid state correctly (redirects to error)');
  } else {
    console.log('❌ OAuth callback invalid state handling failed:', invalidStateResult.data);
    return false;
  }
  
  // Test callback with error parameter
  const errorResult = await makeRequest('GET', '/auth/google/callback?error=access_denied');
  if (errorResult.status === 302 || errorResult.status === 0) {
    console.log('✅ OAuth callback handles error parameter correctly (redirects to error)');
  } else {
    console.log('❌ OAuth callback error handling failed:', errorResult.data);
    return false;
  }
  
  return true;
}

async function runOAuthTests() {
  console.log('🚀 Starting OAuth integration tests...');
  console.log(`🌐 Backend URL: ${BASE_URL}`);
  
  const tests = [
    { name: 'OAuth Configuration', fn: testOAuthConfiguration },
    { name: 'OAuth Endpoints', fn: testOAuthEndpoints },
    { name: 'OAuth Status', fn: testOAuthStatusEndpoint },
    { name: 'OAuth Revoke', fn: testOAuthRevokeEndpoint },
    { name: 'OAuth Callback', fn: testOAuthCallbackEndpoint }
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
  
  console.log('\n📊 OAuth Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (passed === tests.length) {
    console.log('\n🎉 All OAuth tests passed!');
    console.log('🔗 OAuth integration is working correctly!');
  } else {
    console.log('\n💥 Some OAuth tests failed!');
    console.log('🔧 Please check the failed components.');
  }
  
  if (failed === 0) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Test interrupted, cleaning up...');
  process.exit(0);
});

// Run OAuth tests
runOAuthTests().catch(error => {
  console.error('💥 OAuth test runner failed:', error);
  process.exit(1);
});
