import { Device } from '@lib/models';

import { collection } from '@lib/data/base';

const devices = () => collection<Device>('devices');

export async function upsert(device: Device): Promise<void> {
    const collection = await devices();
    await collection.updateOne({ token: device.token }, { $set: { token: device.token } }, { upsert: true });
}

export async function list(): Promise<Device[]> {
    const collection = await devices();
    return await collection.find({}).toArray() as Device[];
}
