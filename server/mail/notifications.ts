import { Expo, ExpoPushMessage } from 'expo-server-sdk';

import DeviceService from '../lib/data/device';
import TransactionService from '../lib/data/transaction';
import { Transaction, Device } from '../lib/models';

export default class Notifications {
    private static expo = new Expo();

    static async send(transaction: Transaction, device?: Device) : Promise<void> {
        const devices = device ? [device] : await DeviceService.find({});
        const messages = devices.map((device: Device) => ({
            to: device.token,
            body: `A new transaction was made by ${transaction.owner} at ${transaction.description} for $${transaction.amount.toFixed(2)}.`
        }));
        
        const chunks = this.expo.chunkPushNotifications(messages);
        chunks.forEach(async (chunk: ExpoPushMessage[]) => {
            await this.expo.sendPushNotificationsAsync(chunk);
        });
    }
    
    static async test(token?: string) : Promise<void> {
        console.log('[mail] Sending test notification.');
    
        const device = await DeviceService.findOne({ token }),
            transaction = await TransactionService.findOne({}, { date: -1 });
        
        await this.send(transaction, device);
    }
    
    static async test2(token?: string) : Promise<void> {
        console.log('[mail] Sending test notification.');

        const tokens = [];
        if (token)
            tokens.push(token);
        else {
            const devices = await DeviceService.find({});
            devices.forEach((device: Device) => tokens.push(device.token));
        }

        const messages = tokens.map((token: string) => ({
            to: token,
            body: 'test'
        }));
        
        const chunks = this.expo.chunkPushNotifications(messages);
        chunks.forEach(async (chunk: ExpoPushMessage[]) => {
            await this.expo.sendPushNotificationsAsync(chunk);
        });
    }
}