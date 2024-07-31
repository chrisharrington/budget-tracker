import 'module-alias/register';

import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

import Secret from '@lib/secret';
import { Transaction } from '@lib/models';
import TransactionService from '@lib/data/transaction';

import Inbox from './inbox';
import Notifications from './notifications';

dayjs.extend(timezone);
dayjs.extend(utc);

(async () => {
    try {
        const inbox = new Inbox(Secret.mailHost, Secret.mailEmailAddress, Secret.mailPassword);

        inbox.onMessage(async (message: string, date: Date) => {
            try {
                console.log(`[mail] Message received.`);

                const transaction = Transaction.fromMessage(message, date);
                console.log(`[mail] Built transaction: ${JSON.stringify(transaction)}`);

                const existingTransactions = await TransactionService.find({
                    description: { $regex: new RegExp(`^${transaction.description}`) },
                    amount: transaction.amount, 
                    date: {
                        $gte: dayjs.utc(transaction.date).startOf('day').toDate(),
                        $lte: dayjs.utc(transaction.date).endOf('day').toDate()
                    }
                });
                if (existingTransactions.length)
                    transaction.description = `${transaction.description} (${existingTransactions.length + 1})`;

                await Promise.all([
                    Notifications.send(transaction),
                    TransactionService.insertOne(transaction)
                ]);
                console.log('[mail] Transaction saved and notification sent.');
            } catch (e) {
                console.log('[mail] Transaction failed to save.');
                console.error(e);
            }
        });

        console.log('[mail] Listening for messages...');
    } catch (e) {
        console.log('[mail] Error during message handling.');
        console.error(e);
    }
})();