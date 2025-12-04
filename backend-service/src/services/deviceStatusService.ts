import { z } from 'zod';
import { prisma } from '../lib/prisma';

export const deviceStatusSchema = z.object({
  batteryLevel: z.number().int().min(0).max(100).optional(),
  signalStrength: z.number().int().min(0).max(100).optional(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
    accuracy: z.number().optional()
  }).optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

export type DeviceStatusPayload = z.infer<typeof deviceStatusSchema>;

export async function updateDeviceStatus(
  deviceId: string,
  rawBody: unknown
) {
  const data = deviceStatusSchema.parse(rawBody);

  const device = await prisma.device.findUnique({
    where: { id: deviceId }
  });

  if (!device) {
    const err: any = new Error('Device not found');
    err.statusCode = 404;
    err.code = 'DEVICE_NOT_FOUND';
    throw err;
  }

  const updateData: any = {
    lastOnlineAt: new Date(),
    lastSyncAt: new Date()
  };

  if (data.batteryLevel !== undefined) {
    updateData.batteryLevel = data.batteryLevel;

    if (data.batteryLevel < 20 && (device.batteryLevel ?? 100) >= 20) {
      await prisma.deviceEvent.create({
        data: {
          deviceId,
          eventType: 'battery_low',
          severity: data.batteryLevel < 10 ? 'critical' : 'warning',
          message: `Battery level is ${data.batteryLevel}%`,
          data: { level: data.batteryLevel }
        }
      });
    }
  }

  if (data.signalStrength !== undefined) {
    updateData.signalStrength = data.signalStrength;
  }

  if (data.metadata) {
    updateData.metadata = data.metadata;
  }

  const updatedDevice = await prisma.device.update({
    where: { id: deviceId },
    data: updateData
  });

  if (data.location) {
    await prisma.deviceEvent.create({
      data: {
        deviceId,
        eventType: 'location_update',
        severity: 'info',
        data: data.location
      }
    });
  }

  return updatedDevice;
}


