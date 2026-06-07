import { Device } from '@lib/models';

import { Base } from '@lib/data/base';

class DeviceService extends Base<Device> {
    constructor() {
        super('devices');
    }

    async upsert(device: Device) : Promise<void> {
        const collection = await this.connect();
        await collection.updateOne({ token: device.token }, { $set: { token: device.token } }, { upsert: true });
    }
}

export default new DeviceService();
