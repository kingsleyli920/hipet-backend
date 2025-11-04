#!/usr/bin/env node

/**
 * Simple route test script
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';

async function testRoute(method, endpoint, data = null, headers = {}) {
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
    return { status: 0, data: { error: error.message } };
  }
}

async function testRoutes() {
  console.log('🔍 Testing routes...');
  
  // Test health
  console.log('\n1. Testing health endpoint...');
  const health = await testRoute('GET', '/health');
  console.log(`Status: ${health.status}, Data:`, health.data);
  
  // Test root
  console.log('\n2. Testing root endpoint...');
  const root = await testRoute('GET', '/');
  console.log(`Status: ${root.status}, Data:`, root.data);
  
  // Test upload status (should require auth)
  console.log('\n3. Testing upload status (no auth)...');
  const status = await testRoute('GET', '/upload/status');
  console.log(`Status: ${status.status}, Data:`, status.data);
  
  // Test avatar styles (should require auth)
  console.log('\n4. Testing avatar styles (no auth)...');
  const styles = await testRoute('GET', '/upload/avatar/styles');
  console.log(`Status: ${styles.status}, Data:`, styles.data);
  
  console.log('\n✅ Route testing completed');
}

testRoutes().catch(console.error);





