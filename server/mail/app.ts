import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

import Config from '@lib/config';
import logger from '@lib/logger';
import * as TransactionService from '@lib/data/transaction';

import Inbox from './inbox';
import Notifications from './notifications';
import { parseMessage } from './parser';

const log = logger.child({ module: 'mail' });

dayjs.extend(timezone);
dayjs.extend(utc);

// Fail loud before doing any work — a missing credential should crash the process at startup, not
// leave it running idle. Kept outside the IIFE's try/catch so the throw exits non-zero.
Config.assertMailConfig();

void (async () => {
    try {
        const inbox = new Inbox(Config.mailHost, Config.mailEmailAddress, Config.mailPassword);

        inbox.onMessage(async (message: string) => {
            try {
                log.info('Message received.');

                const transaction = parseMessage(message);
                log.info({ transaction }, 'Built transaction.');

                const existingTransactions = await TransactionService.find({
                    description: { $regex: new RegExp(`^${transaction.description}`) },
                    amount: transaction.amount,
                    date: {
                        $gte: dayjs.utc(transaction.date).startOf('day').toDate(),
                        $lte: dayjs.utc(transaction.date).endOf('day').toDate(),
                    },
                });
                if (existingTransactions.length)
                    transaction.description = `${transaction.description} (${existingTransactions.length + 1})`;

                await Promise.all([Notifications.send(transaction), TransactionService.insertOne(transaction)]);
                log.info('Transaction saved and notification sent.');
            } catch (e) {
                log.error({ err: e }, 'Transaction failed to save.');
            }
        });

        await inbox.parseUnread();

        Notifications.startReceiptAcquisitionJob();

        log.info('Listening for messages...');
    } catch (e) {
        log.error({ err: e }, 'Error during message handling.');
    }
})();
