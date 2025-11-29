#!/usr/bin/env node

/**
 * Check test data in database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTestData() {
  try {
    console.log('🔍 Checking test data in database...\n');

    // Check users
    const users = await prisma.user.findMany({
      take: 10,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerified: true,
        isActive: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📊 Found ${users.length} users:\n`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Name: ${user.firstName || ''} ${user.lastName || ''}`);
      console.log(`   Verified: ${user.emailVerified ? '✅' : '❌'}`);
      console.log(`   Active: ${user.isActive ? '✅' : '❌'}`);
      console.log(`   Created: ${user.createdAt.toISOString()}`);
      console.log('');
    });

    // Check pets
    const pets = await prisma.pet.findMany({
      take: 10,
      include: {
        owner: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        },
        deviceBindings: {
          where: { status: 'active' },
          include: {
            device: {
              select: {
                deviceId: true,
                deviceType: true,
                status: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`\n🐾 Found ${pets.length} pets:\n`);
    pets.forEach((pet, index) => {
      console.log(`${index + 1}. ${pet.name}`);
      console.log(`   ID: ${pet.id}`);
      console.log(`   Owner: ${pet.owner.email} (${pet.owner.firstName || ''} ${pet.owner.lastName || ''})`);
      console.log(`   Species: ${pet.species || 'N/A'}`);
      console.log(`   Breed: ${pet.breed || 'N/A'}`);
      console.log(`   Age: ${pet.birthDate ? Math.floor((Date.now() - new Date(pet.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 'N/A'} years`);
      console.log(`   Weight: ${pet.weight || 'N/A'} kg`);
      console.log(`   Devices: ${pet.deviceBindings.length}`);
      pet.deviceBindings.forEach((binding, i) => {
        console.log(`     ${i + 1}. ${binding.device.deviceId} (${binding.device.deviceType}) - ${binding.device.status}`);
      });
      console.log('');
    });

    // Check health data
    const healthDataCount = await prisma.healthData.count();
    const recentHealthData = await prisma.healthData.findMany({
      take: 5,
      orderBy: { timestamp: 'desc' },
      include: {
        pet: {
          select: {
            name: true,
            id: true
          }
        }
      }
    });

    console.log(`\n💊 Health Data: ${healthDataCount} total records`);
    console.log(`   Recent 5 records:\n`);
    recentHealthData.forEach((data, index) => {
      console.log(`${index + 1}. Pet: ${data.pet.name} (${data.pet.id})`);
      console.log(`   Temperature: ${data.temperature || 'N/A'}°C`);
      console.log(`   Heart Rate: ${data.heartRate || 'N/A'} bpm`);
      console.log(`   Activity: ${data.activity || 'N/A'}`);
      console.log(`   Anomaly: ${data.anomaly ? '⚠️' : '✅'}`);
      console.log(`   Timestamp: ${data.timestamp.toISOString()}`);
      console.log('');
    });

    // Check sensor data sessions
    const sessionCount = await prisma.sensorDataSession.count();
    const recentSessions = await prisma.sensorDataSession.findMany({
      take: 5,
      orderBy: { timestamp: 'desc' },
      include: {
        device: {
          select: {
            deviceId: true
          }
        }
      }
    });

    console.log(`\n📡 Sensor Data Sessions: ${sessionCount} total`);
    console.log(`   Recent 5 sessions:\n`);
    recentSessions.forEach((session, index) => {
      console.log(`${index + 1}. Session: ${session.sessionId}`);
      console.log(`   Device: ${session.device.deviceId}`);
      console.log(`   Timestamp: ${session.timestamp.toISOString()}`);
      console.log('');
    });

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   Users: ${users.length}`);
    console.log(`   Pets: ${pets.length}`);
    console.log(`   Health Data Records: ${healthDataCount}`);
    console.log(`   Sensor Sessions: ${sessionCount}`);
    console.log('='.repeat(60));

    // Suggest test user
    if (users.length > 0) {
      const testUser = users[0];
      console.log(`\n💡 Suggested test user: ${testUser.email}`);
      console.log(`   User ID: ${testUser.id}`);
      if (pets.length > 0) {
        const testPet = pets.find(p => p.ownerId === testUser.id) || pets[0];
        console.log(`   Test Pet: ${testPet.name} (${testPet.id})`);
      }
    }

  } catch (error) {
    console.error('❌ Error checking test data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkTestData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

