import { Expo, ExpoPushMessage } from 'expo-server-sdk';

import Config from '@lib/config';
import logger from '@lib/logger';
import * as DeviceService from '@lib/data/device';
import { Transaction, Device } from '@lib/models';

const log = logger.child({ module: 'mail' });

export default class Notifications {
    private static expo = new Expo({ accessToken: Config.expoAccessToken });

    static async send(transaction: Transaction, device?: Device) : Promise<void> {
        const devices = device ? [device] : await DeviceService.list();
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
}
