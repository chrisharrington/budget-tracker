import { Expo } from 'expo-server-sdk';

import DeviceService from '../lib/data/device';
import Config from '../lib/config';
import { Transaction, Device } from '../lib/models';

export default class Notifications {
    static expo = new Expo();

    static async send(transaction: Transaction) : Promise<void> {
        const devices = await DeviceService.find({});
        const messages = devices.map((device: Device) => (
            {
                to: device.token,
                body: `A new transaction was made by ${transaction.owner} at ${transaction.description} for $${transaction.amount.toFixed(2)}.`
            }
        ));

        await this.expo.sendPushNotificationsAsync(messages); 
    }
}