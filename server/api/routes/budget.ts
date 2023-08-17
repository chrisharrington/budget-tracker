import { Application, Request, Response } from 'express';
import dayjs from 'dayjs';
import getTimezoneOffset from 'get-timezone-offset';

import Config from '@lib/config';
import TransactionService from '@lib/data/transaction';
import BalanceService from '@lib/data/balance';
import OneTimeService from '@lib/data/one-time';
import { Budget, Transaction } from '@lib/models';
import Balances from '@lib/balances';

import timeZonePlugin from 'dayjs-ext/plugin/timeZone';

dayjs.extend(timeZonePlugin);

export default class BudgetRoute {
    static initialize(app: Application) {
        app.get('/week', this.getBudgetForWeek.bind(this));
        app.get('/history', this.getHistory.bind(this));
        app.get('/transaction/sum-monthly', this.getSummedMonthlyAmountForTag.bind(this));

        app.post('/transaction', this.updateTransaction.bind(this));
        app.post('/transaction/split', this.splitTransaction.bind(this));
    }

    private static async getBudgetForWeek(request: Request, response: Response) {
        try {
            console.log('Request received: GET /week');

            if (!request.query || !request.query.date)
                throw new Error('Missing date parameter in query string.');

            let current = dayjs(request.query.date as string, 'YYYY-MM-DD').startOf('day');
            while (current.day() !== 1)
                current = current.subtract(1, 'day');

            const date = current.toDate(),
                transactions = await TransactionService.getForWeek(date),
                weeklyAmount = Config.weeklyAmount(date);

            response.status(200).send(new Budget({
                date,
                balance: await this.getBalanceFromPreviousWeek(current),
                weeklyAmount,
                transactions
            }));
        } catch (e) {
            console.log('Request failed: GET /week');
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
                let week = dayjs(transaction.date).subtract(getTimezoneOffset('America/Edmonton'), 'minute').startOf('day');
                while (week.day() !== 1)
                    week = week.subtract(1, 'day');

                const weekLabel = week.format();
                if (!dict[weekLabel])
                    dict[weekLabel] = {
                        balance: Config.weeklyAmount(week.toDate())
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

            const transaction = Transaction.fromRaw(request.body);

            var valid = await this.checkTransaction(transaction);
            if (!valid) {
                console.error('Cannot update transactions from further back than the previous week.');
                response.sendStatus(400);
                return;
            }

            await OneTimeService.applyTransaction(transaction);
            await TransactionService.updateOne(Transaction.fromRaw(request.body));
            await this.updateBalance(transaction);

            response.sendStatus(200);
        } catch (e) {
            console.log('Request failed: POST /transaction');
            console.error(e);
            response.status(500).send(e);
        }
    }

    private static async splitTransaction(request: Request, response: Response) {
        try {
            console.log('Request received: POST /transaction/split');

            const transaction = Transaction.fromRaw(request.body.transaction);

            var valid = await this.checkTransaction(transaction);
            if (!valid) {
                console.error('Cannot update transactions from further back than the previous week.');
                response.sendStatus(400);
                return;
            }

            const newAmount = request.body.newAmount,
                copy = Transaction.copy(transaction);

            transaction.amount -= newAmount;
            copy.amount = newAmount;

            await Promise.all([
                TransactionService.updateOne(transaction),
                TransactionService.insertOne(copy)
            ]);

            await this.updateBalance(transaction);

            response.sendStatus(200);
        } catch (e) {
            console.log('Request failed: POST /transaction/split');
            console.error(e);
            response.status(500).send(e);
        }
    }

    private static async getSummedMonthlyAmountForTag(request: Request, response: Response) {
        try {
            console.log('Request received: GET /transaction/sum-monthly');

            if (!request.query.start)
                return response.status(400).send('Missing start date.');
            if (!request.query.end)
                return response.status(400).send('Missing end date.');
            if (!request.query.tag)
                return response.status(400).send('Missing tag.');

            const start = dayjs(request.query.start as string),
                end = dayjs(request.query.end as string),
                tag = request.query.tag;

            const transactions = await TransactionService.find({
                date: {
                    $gte: start.toDate(),
                    $lt: end.toDate()
                },
                tags: {
                    $elemMatch: {
                        name: tag
                    }
                }
            });

            const sum = transactions.reduce((sum: number, curr: Transaction) => sum += curr.amount, 0);
            response.status(200).contentType('application/json').send(JSON.stringify({
                sum,
                transactions: transactions
                    .sort((first, second) => dayjs(first.date).isBefore(dayjs(second.date)) ? 1 : -1)
                    .map(t => ({ description: t.description, amount: t.amount, date: dayjs(t.date).format() }))
            }));
        } catch (e) {
            console.log('Request failed: GET /transaction/sum-monthly');
            console.error(e);
            response.status(500).send(e);
        }
    }

    private static async getBalanceFromPreviousWeek(date: dayjs.Dayjs) {
        const startOfPreviousWeek = dayjs(date).tz(Config.timezone).startOf('week').add(1, 'day').subtract(1, 'week').toDate();
        const balance = await BalanceService.findOne({ weekOf: startOfPreviousWeek });
        return balance?.amount;
    }

    private static async checkTransaction(transaction: Transaction) : Promise<boolean> {
        const startOfPreviousWeek = dayjs().tz(Config.timezone).startOf('week').add(1, 'day').subtract(1, 'week');
        const date = dayjs(transaction.date);

        return !date.isBefore(startOfPreviousWeek);
    }

    private static async updateBalance(transaction: Transaction) {
        const startOfPreviousWeek = dayjs().tz(Config.timezone).startOf('week').add(1, 'day').subtract(1, 'week');
        const startOfThisWeek = startOfPreviousWeek.add(1, 'week');
        const date = dayjs(transaction.date);
        if (date.isAfter(startOfPreviousWeek) && date.isBefore(startOfThisWeek))
            await Balances.upsertBalanceFromPreviousWeek(true);
    }
}