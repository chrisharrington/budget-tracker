import { Request, Response, Router } from 'express';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import Config from '@lib/config';
import * as TransactionService from '@lib/data/transaction';
import * as BalanceService from '@lib/data/balance';
import * as OneTimeService from '@lib/data/one-time';
import { Budget, Transaction } from '@lib/models';
import { copyTransaction } from '@lib/parse';
import { upsertBalanceFromPreviousWeek } from '@lib/balances';
import { asyncHandler } from '@api/async-handler';
import { validate } from '@api/validate';
import { monthlyTagQuerySchema, transactionSchema, transactionSplitSchema, weekQuerySchema } from '@lib/schemas';

dayjs.extend(utc);
dayjs.extend(timezone);

async function getBudgetForWeek(request: Request, response: Response) {
    request.log.info('Request received: GET /week');

    let current = dayjs.utc(request.query.date as string).tz('America/Edmonton').startOf('day');
    while (current.day() !== 1)
        current = current.subtract(1, 'day');

    const date = current.toDate(),
        transactions = await TransactionService.getForWeek(date),
        weeklyAmount = Config.weeklyAmount(date);

    request.log.info('Weekly amount: ' + weeklyAmount);

    response.status(200).send({
        date,
        balance: await getBalanceFromPreviousWeek(current),
        weeklyAmount,
        transactions
    } satisfies Budget);
}

async function getHistory(request: Request, response: Response) {
    request.log.info('Request received: GET /history');

    const transactions = await TransactionService.find({ ignored: false }),
        dict: { [weekLabel: string]: { balance: number } } = {};

    transactions.forEach((transaction: Transaction) => {
        let week = dayjs(transaction.date).tz(Config.timezone).startOf('day');
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
}

async function updateTransaction(request: Request, response: Response) {
    request.log.info('Request received: POST /transaction');

    const transaction = request.body as Transaction;

    const valid = await checkTransaction(transaction);
    if (!valid) {
        request.log.warn('Cannot update transactions from further back than the previous week.');
        response.sendStatus(400);
        return;
    }

    await OneTimeService.applyTransaction(transaction);
    await TransactionService.updateOne(transaction);
    await updateBalance(transaction);

    response.sendStatus(200);
}

async function splitTransaction(request: Request, response: Response) {
    request.log.info('Request received: POST /transaction/split');

    const { transaction, newAmount } = request.body as { transaction: Transaction; newAmount: number };

    const valid = await checkTransaction(transaction);
    if (!valid) {
        request.log.warn('Cannot update transactions from further back than the previous week.');
        response.sendStatus(400);
        return;
    }

    const copy = copyTransaction(transaction);

    transaction.amount -= newAmount;
    copy.amount = newAmount;

    await Promise.all([
        TransactionService.updateOne(transaction),
        TransactionService.insertOne(copy)
    ]);

    await updateBalance(transaction);

    response.sendStatus(200);
}

async function getSummedMonthlyAmountForTag(request: Request, response: Response) {
    request.log.info('Request received: GET /transaction/sum-monthly');

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
}

async function getBalanceFromPreviousWeek(date: dayjs.Dayjs) {
    const startOfPreviousWeek = dayjs(date).tz(Config.timezone).startOf('week').add(1, 'day').subtract(1, 'week').toDate();
    const balance = await BalanceService.findForWeek(startOfPreviousWeek);
    return balance?.amount;
}

async function checkTransaction(transaction: Transaction) : Promise<boolean> {
    const startOfPreviousWeek = dayjs().tz(Config.timezone).startOf('week').add(1, 'day').subtract(1, 'week');
    const date = dayjs(transaction.date);

    return !date.isBefore(startOfPreviousWeek);
}

async function updateBalance(transaction: Transaction) {
    const startOfPreviousWeek = dayjs().tz(Config.timezone).startOf('week').add(1, 'day').subtract(1, 'week');
    const startOfThisWeek = startOfPreviousWeek.add(1, 'week');
    const date = dayjs(transaction.date);
    if (date.isAfter(startOfPreviousWeek) && date.isBefore(startOfThisWeek))
        await upsertBalanceFromPreviousWeek(true);
}

const router = Router();

router.get('/week', validate(weekQuerySchema, 'query'), asyncHandler(getBudgetForWeek));
router.get('/history', asyncHandler(getHistory));
router.get('/transaction/sum-monthly', validate(monthlyTagQuerySchema, 'query'), asyncHandler(getSummedMonthlyAmountForTag));
router.post('/transaction', validate(transactionSchema), asyncHandler(updateTransaction));
router.post('/transaction/split', validate(transactionSplitSchema), asyncHandler(splitTransaction));

export default router;
