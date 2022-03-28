import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { CronJob } from 'cron';

import { Balance, Tag, Transaction } from '@lib/models';

import TransactionService from '@lib/data/transaction';
import BalanceService from '@lib/data/balance';

import Config from './config';

dayjs.extend(utc);
dayjs.extend(timezone);


class Balances {
    async startWeeklyJob() {
        await this.upsertBalanceFromPreviousWeek();

        const job = new CronJob(Config.balanceUpdateCron, async () => {
            await this.upsertBalanceFromPreviousWeek();
        }, null, true, Config.timezone);

        job.start();

        console.log(`Started weekly job to update balance. Next run on ${job.nextDates().toDate()}`);
    }

    async upsertBalanceFromPreviousWeek() {
        console.log('Updating balance for previous week.');

        const startOfPreviousWeek = dayjs().tz(Config.timezone).startOf('week').add(1, 'day').subtract(1, 'week').toDate();
        let balance = await BalanceService.findOne({ weekOf: startOfPreviousWeek });
        if (balance) {
            console.log('Balance found. Skipping.');
            return;
        }
            
        const transactions = await TransactionService.getForWeek(startOfPreviousWeek);
        const sum = transactions
            .filter((transaction: Transaction) => !transaction.ignored && transaction.tags.every((tag: Tag) => !tag.ignore))
            .map((transaction: Transaction) => transaction.amount)
            .reduce((sum: number, curr: number) => sum + curr, 0);
        const weeklyAmount = Config.weeklyAmount(startOfPreviousWeek); 

        balance = new Balance();
        balance.amount = weeklyAmount - sum;
        balance.weekOf = startOfPreviousWeek;
        await BalanceService.insertOne(balance);

        console.log(`Inserted balance with amount ${balance.amount.toFixed(2)}.`)
    }
}

export default new Balances();