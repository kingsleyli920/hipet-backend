/**
 * Seed script for device data
 * 用于创建示例设备数据
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding device data...\n');

  // 1. 创建示例设备
  const devices = [
    {
      deviceId: 'COLLAR-001-AABBCCDD',
      deviceType: 'collar',
      model: 'HiPet Collar Pro',
      firmwareVersion: '1.2.0',
      hardwareVersion: '2.0',
      status: 'inactive', // 未绑定
      batteryLevel: 100,
      signalStrength: 95,
      metadata: {
        color: 'blue',
        size: 'M',
        waterproof: true,
        gpsEnabled: true
      }
    },
    {
      deviceId: 'CAMERA-001-EEFF1122',
      deviceType: 'camera',
      model: 'HiPet Camera 360',
      firmwareVersion: '2.1.5',
      hardwareVersion: '1.5',
      status: 'inactive',
      batteryLevel: null, // 有线供电
      signalStrength: 88,
      metadata: {
        resolution: '1080p',
        nightVision: true,
        twoWayAudio: true
      }
    },
    {
      deviceId: 'FEEDER-001-33445566',
      deviceType: 'feeder',
      model: 'HiPet Auto Feeder',
      firmwareVersion: '1.0.3',
      hardwareVersion: '1.0',
      status: 'inactive',
      batteryLevel: null,
      signalStrength: 92,
      metadata: {
        capacity: '5L',
        portions: 6,
        schedule: true
      }
    }
  ];

  console.log('📱 Creating devices...');
  for (const deviceData of devices) {
    const device = await prisma.device.upsert({
      where: { deviceId: deviceData.deviceId },
      update: deviceData,
      create: deviceData
    });
    console.log(`  ✓ Created device: ${device.deviceType} (${device.deviceId})`);
  }

  // 2. 获取用户和宠物
  const user = await prisma.user.findFirst();
  const pet = await prisma.pet.findFirst();

  if (!user || !pet) {
    console.log('\n⚠️  No user or pet found. Please create a user and pet first.');
    return;
  }

  console.log(`\n👤 Using user: ${user.email}`);
  console.log(`🐕 Using pet: ${pet.name}\n`);

  // 3. 绑定第一个设备（项圈）到宠物
  const collar = await prisma.device.findFirst({
    where: { deviceType: 'collar' }
  });

  if (collar) {
    console.log('🔗 Creating device binding...');
    const binding = await prisma.deviceBinding.upsert({
      where: {
        deviceId_petId_status: {
          deviceId: collar.id,
          petId: pet.id,
          status: 'active'
        }
      },
      update: {},
      create: {
        deviceId: collar.id,
        petId: pet.id,
        userId: user.id,
        status: 'active',
        isPrimary: true,
        bindingType: 'owner',
        permissions: {
          canTrack: true,
          canControl: true,
          canShare: true
        },
        settings: {
          updateInterval: 60, // 每60秒更新一次
          alerts: ['location', 'health', 'battery'],
          quietHours: {
            enabled: false,
            start: '22:00',
            end: '08:00'
          }
        }
      }
    });

    // 更新设备状态
    await prisma.device.update({
      where: { id: collar.id },
      data: {
        status: 'active',
        lastOnlineAt: new Date()
      }
    });

    console.log(`  ✓ Bound ${collar.deviceType} to ${pet.name}`);

    // 4. 创建设备事件
    console.log('\n📋 Creating device events...');
    const events = [
      {
        deviceId: collar.id,
        eventType: 'binding_created',
        severity: 'info',
        message: `Device bound to pet ${pet.name}`,
        data: {
          petId: pet.id,
          userId: user.id,
          bindingType: 'owner'
        }
      },
      {
        deviceId: collar.id,
        eventType: 'online',
        severity: 'info',
        message: 'Device came online',
        data: {
          ip: '192.168.1.100',
          signalStrength: 95
        }
      },
      {
        deviceId: collar.id,
        eventType: 'firmware_update',
        severity: 'info',
        message: 'Firmware updated successfully',
        data: {
          from: '1.1.0',
          to: '1.2.0',
          duration: 120
        },
        resolved: true,
        resolvedAt: new Date()
      }
    ];

    for (const eventData of events) {
      await prisma.deviceEvent.create({ data: eventData });
      console.log(`  ✓ Created event: ${eventData.eventType}`);
    }
  }

  // 5. 创建一些健康数据（从设备采集）
  if (collar && pet) {
    console.log('\n💓 Creating sample health data from device...');
    const healthDataPoints = [
      { heartRate: 75, temperature: 38.5, activity: 450 },
      { heartRate: 82, temperature: 38.6, activity: 680 },
      { heartRate: 78, temperature: 38.4, activity: 520 },
      { heartRate: 85, temperature: 38.7, activity: 750 }
    ];

    for (let i = 0; i < healthDataPoints.length; i++) {
      const data = healthDataPoints[i];
      await prisma.healthData.create({
        data: {
          petId: pet.id,
          heartRate: data.heartRate,
          temperature: data.temperature,
          activity: data.activity,
          timestamp: new Date(Date.now() - (3 - i) * 3600000), // 每小时一个数据点
          anomaly: false
        }
      });
      console.log(`  ✓ Created health data point ${i + 1}`);
    }

    // 更新设备最后同步时间
    await prisma.device.update({
      where: { id: collar.id },
      data: { lastSyncAt: new Date() }
    });
  }

  console.log('\n✅ Device seeding completed!\n');

  // 6. 显示摘要
  const deviceCount = await prisma.device.count();
  const bindingCount = await prisma.deviceBinding.count();
  const eventCount = await prisma.deviceEvent.count();
  const healthCount = await prisma.healthData.count();

  console.log('📊 Summary:');
  console.log(`  • Devices: ${deviceCount}`);
  console.log(`  • Bindings: ${bindingCount}`);
  console.log(`  • Events: ${eventCount}`);
  console.log(`  • Health Data: ${healthCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

