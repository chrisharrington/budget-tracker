import 'module-alias/register';

import Secret from '@lib/secret';
import { Transaction } from '@lib/models';
import TransactionService from '@lib/data/transaction';

import Inbox from './inbox';
import Notifications from './notifications';

(async () => {
    try {
        const inbox = new Inbox(Secret.mailEmailAddress, Secret.mailPassword);

        inbox.onMessage(async (message: string, date: Date) => {
            try {
                console.log(`[mail] Message received.`);

                const transaction = Transaction.fromMessage(message, date);
                console.log(`[mail] Built transaction: ${JSON.stringify(transaction)}`);

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

        Notifications.test('ExponentPushToken[yQlvRcLBdmiwEj1v6Ez-e1]');

        console.log('[mail] Listening for messages...');
    } catch (e) {
        console.log('[mail] Error during message handling.');
        console.error(e);
    }
})();