import { ObjectID } from 'mongodb';

import { Device } from '../models';

import { Base } from './base';

class DeviceService extends Base<Device> {
    constructor() {
        super('devices');
    }

    async upsert(device: Device) : Promise<void> {
        let collection = await this.connect();

        return new Promise<void>((resolve, reject) => {
            collection.updateOne({
                token: device.token
            }, {
                $set: {
                    token: device.token
                }
            }, {
                upsert: true
            }, (error) => {
                if (error) reject(error);
                else resolve();
            })
        });
    }
}

export default new DeviceService();