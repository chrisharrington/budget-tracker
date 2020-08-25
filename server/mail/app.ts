import 'module-alias/register';

import Secret from '@lib/secret';
import { Transaction } from '@lib/models';
import TransactionService from '@lib/data/transaction';

import Inbox from './inbox';
import Notifications from './notifications';

(async () => {
    try {
        const inbox = new Inbox(Secret.mailEmailAddress, Secret.mailPassword);

        inbox.onMessage(async (message: string) => {
            try {
                console.log(`Message received.`);

                const transaction = Transaction.fromString(message);
                console.log(`Built transaction: ${JSON.stringify(transaction)}`);

                await Promise.all([
                    TransactionService.insertOne(transaction), 
                    Notifications.send(transaction)
                ]);

                console.log('Transaction saved and notification sent.');
            } catch (e) {
                console.log('Transaction failed to save.');
                console.error(e);
            }
        });

        console.log('Listening for messages...');
    } catch (e) {
        console.error(e);
    }
})();