#!/usr/bin/env node

/**
 * Create a test account for local development
 * Usage: node scripts/create_test_account.mjs
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';

const testUser = {
  email: 'test@hipet.com',
  password: 'Test123456',
  firstName: 'Test',
  lastName: 'User'
};

async function createTestAccount() {
  console.log('📝 Creating test account...');
  console.log(`   Email: ${testUser.email}`);
  console.log(`   Password: ${testUser.password}`);
  console.log(`   API URL: ${BASE_URL}\n`);

  try {
    const response = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser),
    });

    const data = await response.json();

    if (response.ok || response.status === 201) {
      console.log('✅ Test account created successfully!');
      console.log(`   User ID: ${data.user.id}`);
      console.log(`   Email: ${data.user.email}`);
      console.log(`   Name: ${data.user.firstName} ${data.user.lastName}`);
      console.log(`   Email Verified: ${data.user.emailVerified}`);
      console.log('\n📧 Note: Email verification may be required depending on your configuration.');
      return true;
    } else {
      if (data.error === 'User already exists' || data.message?.includes('already exists')) {
        console.log('⚠️  Test account already exists!');
        console.log('   You can use this account to login:');
        console.log(`   Email: ${testUser.email}`);
        console.log(`   Password: ${testUser.password}`);
        return true;
      } else {
        console.log('❌ Failed to create test account:');
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${data.error || data.message || JSON.stringify(data)}`);
        return false;
      }
    }
  } catch (error) {
    console.error('❌ Error creating test account:');
    console.error(`   ${error.message}`);
    console.error('\n💡 Make sure the backend service is running on', BASE_URL);
    return false;
  }
}

// Run the script
createTestAccount()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });

