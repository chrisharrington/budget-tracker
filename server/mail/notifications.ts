import { Expo, ExpoPushMessage } from 'expo-server-sdk';

import Config from '@lib/config';
import logger from '@lib/logger';
import DeviceService from '@lib/data/device';
import TransactionService from '@lib/data/transaction';
import { Transaction, Device } from '@lib/models';

const log = logger.child({ module: 'mail' });

export default class Notifications {
    private static expo = new Expo({ accessToken: Config.expoAccessToken });

    static async send(transaction: Transaction, device?: Device) : Promise<void> {
        const devices = device ? [device] : await DeviceService.find({});
        const messages = devices.map((device: Device) => ({
            to: device.token,
            body: `A new transaction was made by ${transaction.owner} at ${transaction.description} for $${transaction.amount.toFixed(2)}.`
        }));
        
        const chunks = this.expo.chunkPushNotifications(messages);
        chunks.forEach(async (chunk: ExpoPushMessage[]) => {
            const ticket = await this.expo.sendPushNotificationsAsync(chunk);
            log.info({ ticket }, 'Sent notification.');
        });
    }
    
    static async test(token?: string) : Promise<void> {
        log.info('Sending test notification.');

        const device = await DeviceService.findOne({ token }),
            transaction = await TransactionService.findOne({}, { date: -1 });

        if (!transaction) {
            log.warn('No transaction found to send a test notification for.');
            return;
        }

        await this.send(transaction, device ?? undefined);
    }
    
    static async test2(token?: string) : Promise<void> {
        log.info('Sending test notification (2).');

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