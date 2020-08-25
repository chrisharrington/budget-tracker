import { Application, Request, Response } from 'express';
import dayjs from 'dayjs';

import Config from '@lib/config';
import TransactionService from '@lib/data/transaction';
import { Budget, Transaction } from '@lib/models';

import timeZonePlugin from 'dayjs-ext/plugin/timeZone';

dayjs.extend(timeZonePlugin);

export default class BudgetRoute {
    static initialize(app: Application) {
        app.get('/', this.getCurrentBudget.bind(this));
        app.get('/history', this.getHistory.bind(this));
        app.post('/transaction', this.updateTransaction.bind(this));
    }

    private static async getCurrentBudget(_: Request, response: Response) {
        try {
            console.log('Request received: GET /');
            
            const current = await TransactionService.getForWeek(dayjs().toDate()),
                last = await TransactionService.getForWeek(dayjs().subtract(1, 'week').toDate());

            response.status(200).send(new Budget({
                weeklyAmount: Config.weeklyAmount,
                lastWeekRemaining: Config.weeklyAmount - last
                    .filter((transaction: Transaction) => !transaction.ignored)
                    .map((transaction: Transaction) => transaction.amount)
                    .reduce((amount: number, sum: number) => sum + amount, 0),
                transactions: current
            }));
        } catch (e) {
            console.log('Request failed: GET /');
            console.error(e);
            response.status(500).send(e);
        }
    }

    private static async getHistory(_: Request, response: Response) {
        try {
            console.log('Request received: GET /history');
        
            const transactions = await TransactionService.find({ ignored: false }),
                dict = {};

            transactions.forEach((transaction: Transaction) => {
                let week = dayjs(transaction.date);
                while (week.day() !== 1)
                    week = week.subtract(1, 'day');

                const weekLabel = week.format();
                if (!dict[weekLabel])
                    dict[weekLabel] = {
                        balance: Config.weeklyAmount
                    };

                dict[weekLabel].balance -= transaction.amount;
            });

            const history = Object.keys(dict)
                .map((key: string) => ({ date: dayjs(key).toDate(), balance: dict[key].balance }))
                .sort((first, second) => dayjs(first.date).isBefore(second.date) ? 1 : -1);

            response.status(200).send(history);
        } catch (e) {
            console.log('Request failed: GET /history');
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