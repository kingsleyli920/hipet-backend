#!/usr/bin/env node

// 查询测试账号信息的脚本
// 在EC2上运行: node scripts/check_test_account.mjs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTestAccount() {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 测试账号信息');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    const user = await prisma.user.findUnique({
      where: { email: 'test@hipet.com' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerified: true,
        createdAt: true
      }
    });

    if (user) {
      console.log('✅ 找到测试账号:');
      console.log(JSON.stringify(user, null, 2));
    } else {
      console.log('❌ 未找到测试账号 test@hipet.com');
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🐕 测试账号的宠物');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    if (user) {
      const pets = await prisma.pet.findMany({
        where: { ownerId: user.id },
        select: {
          id: true,
          name: true,
          species: true,
          breed: true,
          createdAt: true
        }
      });

      if (pets.length > 0) {
        console.log(`✅ 找到 ${pets.length} 只宠物:`);
        pets.forEach((pet, index) => {
          console.log(`\n宠物 ${index + 1}:`);
          console.log(JSON.stringify(pet, null, 2));
        });
      } else {
        console.log('❌ 该账号没有宠物');
      }
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 测试账号的设备绑定');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    if (user) {
      const pets = await prisma.pet.findMany({
        where: { ownerId: user.id },
        include: {
          deviceBindings: {
            where: { status: 'active' },
            include: {
              device: {
                select: {
                  id: true,
                  deviceId: true,
                  deviceType: true,
                  status: true
                }
              }
            }
          }
        }
      });

      let hasBindings = false;
      for (const pet of pets) {
        if (pet.deviceBindings.length > 0) {
          hasBindings = true;
          console.log(`\n宠物 "${pet.name}" 的设备绑定:`);
          pet.deviceBindings.forEach((binding, index) => {
            console.log(`\n绑定 ${index + 1}:`);
            console.log(JSON.stringify({
              bindingId: binding.id,
              deviceId: binding.device.deviceId,
              deviceType: binding.device.deviceType,
              deviceStatus: binding.device.status,
              bindingType: binding.bindingType,
              isPrimary: binding.isPrimary,
              petName: pet.name
            }, null, 2));
          });
        }
      }

      if (!hasBindings) {
        console.log('❌ 该账号没有设备绑定');
      }
    }

    console.log('');
    console.log('✅ 查询完成');

  } catch (error) {
    console.error('❌ 查询出错:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkTestAccount();

