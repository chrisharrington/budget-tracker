import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { CronJob } from 'cron';

import Config from '@lib/config';
import logger from '@lib/logger';
import * as DeviceService from '@lib/data/device';
import * as NotificationService from '@lib/data/notification';
import { Transaction, Device, NotificationTicket } from '@lib/models';

const log = logger.child({ module: 'mail' });

export default class Notifications {
    private static expo = new Expo({ accessToken: Config.expoAccessToken });

    static async send(transaction: Transaction, device?: Device) : Promise<void> {
        const devices = device ? [device] : await DeviceService.list();
        const messages: ExpoPushMessage[] = devices.map((device: Device) => ({
            to: device.token,
            body: `A new transaction was made by ${transaction.owner} at ${transaction.description} for $${transaction.amount.toFixed(2)}.`
        }));

        const chunks = this.expo.chunkPushNotifications(messages);
        const pending: Omit<NotificationTicket, '_id'>[] = [];

        for (const chunk of chunks) {
            const tickets = await this.expo.sendPushNotificationsAsync(chunk);
            log.info({ tickets }, 'Sent notification.');

            // Tickets correspond by index to the messages in the chunk, so `chunk[index].to` is the
            // token this ticket was sent to. Only `ok` tickets carry a receipt id worth polling; an
            // `error` ticket is terminal here, so handle a dead token inline.
            for (let index = 0; index < tickets.length; index++) {
                const ticket: ExpoPushTicket = tickets[index];
                const token = chunk[index].to as string;

                if (ticket.status === 'ok') {
                    pending.push({ status: ticket.status, notificationId: ticket.id, token, receiptAcquired: false });
                } else {
                    log.warn({ token, message: ticket.message, details: ticket.details }, 'Push ticket reported an error.');
                    if (ticket.details?.error === 'DeviceNotRegistered')
                        await DeviceService.disableByToken(token);
                }
            }
        }

        await NotificationService.insert(pending);
    }

    // Reconciles persisted tickets against Expo delivery receipts. Run on a cron: receipts become
    // available a few minutes after send and persist for ~a day. Receipts not yet ready are absent
    // from the response and stay pending for the next run.
    static async acquireReceipts(): Promise<void> {
        const pending = await NotificationService.listUnacquired();
        if (!pending.length)
            return;

        log.info({ count: pending.length }, 'Acquiring push notification receipts.');

        const tokensByReceiptId = new Map(pending.map(ticket => [ticket.notificationId, ticket.token]));
        const acquired: string[] = [];

        const chunks = this.expo.chunkPushNotificationReceiptIds(pending.map(ticket => ticket.notificationId));
        for (const chunk of chunks) {
            const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);

            for (const [receiptId, receipt] of Object.entries(receipts)) {
                acquired.push(receiptId);

                if (receipt.status === 'ok') {
                    log.info({ receiptId }, 'Push notification delivered.');
                } else {
                    log.warn({ receiptId, message: receipt.message, details: receipt.details }, 'Push notification delivery failed.');
                    if (receipt.details?.error === 'DeviceNotRegistered') {
                        const token = tokensByReceiptId.get(receiptId);
                        if (token)
                            await DeviceService.disableByToken(token);
                    }
                }
            }
        }

        await NotificationService.markAcquired(acquired);
    }

    static startReceiptAcquisitionJob(): void {
        const job = new CronJob(Config.notificationReceiptCron, async () => {
            await this.acquireReceipts();
        }, null, true, Config.timezone);

        job.start();

        log.info(`Started job to acquire push notification receipts. Next run on ${job.nextDates()}`);
    }
}
