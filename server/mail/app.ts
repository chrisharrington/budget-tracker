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
                console.log(`Message received.`);

                const transaction = Transaction.fromMessage(message, date);
                console.log(`Built transaction: ${JSON.stringify(transaction)}`);

                await Promise.all([
                    Notifications.send(transaction),
                    TransactionService.insertOne(transaction)
                ]);
                console.log('Transaction saved and notification sent.');
            } catch (e) {
                console.log('Transaction failed to save.');
                console.error(e);
            }
        });

        console.log('Listening for messages...');
    } catch (e) {
        console.log('Error during message handling.');
        console.error(e);
    }
})();