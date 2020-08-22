import { Application, Request, Response } from 'express';
import dayjs from 'dayjs';

import Config from '@lib/config';
import TransactionService from '@lib/data/budget';
import { Budget, Transaction } from '@lib/models';

export default class BudgetRoute {
    static initialize(app: Application) {
        app.get('/', this.getCurrentBudget.bind(this));
        app.post('/transaction', this.updateTransaction.bind(this));
    }

    private static async getCurrentBudget(_: Request, response: Response) {
        try {
            console.log('Request received: GET /');
            
            const current = await TransactionService.getForWeek(dayjs().startOf('w').toDate()),
                last = await TransactionService.getForWeek(dayjs().subtract(1, 'w').startOf('w').toDate());

            response.status(200).send(new Budget({
                weeklyAmount: Config.weeklyAmount,
                lastWeekRemaining: Config.weeklyAmount - last
                    .map((l: Transaction) => l.amount)
                    .reduce((amount: number, sum: number) => sum + amount, 0),
                transactions: current
            }));
        } catch (e) {
            console.log('Request failed: GET /');
            console.error(e);
            response.status(500).send(e);
        }
    }

    private static async updateTransaction(request: Request, response: Response) {
        try {
            console.log('Request received: POST /transaction');

            await TransactionService.updateOne(Transaction.fromRaw(request.body));

            response.sendStatus(200);
        } catch (e) {
            console.log('Request failed: POST /transaction');
            console.error(e);
            response.status(500).send(e);
        }
    }
}