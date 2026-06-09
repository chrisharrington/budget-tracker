import { Device } from '@lib/models';

import { collection } from '@lib/data/base';

const devices = () => collection<Device>('devices');

export async function upsert(device: Device): Promise<void> {
    const collection = await devices();
    await collection.updateOne({ token: device.token }, { $set: { token: device.token } }, { upsert: true });
}

// Excludes disabled devices so callers (notably notification dispatch) never push to a token Expo
// has reported as stale.
export async function list(): Promise<Device[]> {
    const collection = await devices();
    return (await collection.find({ disabled: { $ne: true } }).toArray()) as Device[];
}

// Flags a device as stale after Expo reports its token as `DeviceNotRegistered`. A soft flag rather
// than a delete preserves the record and survives an idempotent re-upsert of the same token.
export async function disableByToken(token: string): Promise<void> {
    const collection = await devices();
    await collection.updateOne({ token }, { $set: { disabled: true } });
}
