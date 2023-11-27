import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { CronJob } from 'cron';

import { Balance, Tag, Transaction } from '@lib/models';

import TransactionService from '@lib/data/transaction';
import BalanceService from '@lib/data/balance';
import OneTimeService from '@lib/data/one-time';

import Config from './config';

dayjs.extend(utc);
dayjs.extend(timezone);


class Balances {
    async startMonthlyOneTimeBalanceIncreaseJob() {
        const job = new CronJob(Config.oneTimeBalanceUpdateCron, async () => {
            const oneTime = await OneTimeService.get();
            oneTime.balance += Config.oneTimeBalanceIncrease;
            await OneTimeService.updateOne(oneTime);

            console.log(`Updated one-time balance to ${oneTime.balance}.`);
        }, null, true, Config.timezone);

        job.start();

        console.log(`Started monthly job to update one-time balance. Next run on ${job.nextDates().toDate()}`);
    }

    async startWeeklyRemainingBalanceJob() {
        await this.upsertBalanceFromPreviousWeek();

        const job = new CronJob(Config.remainingBalanceUpdateCron, async () => {
            await this.upsertBalanceFromPreviousWeek();
        }, null, true, Config.timezone);

        job.start();

        console.log(`Started weekly job to update remaining balance. Next run on ${job.nextDates().toDate()}`);
    }

    async upsertBalanceFromPreviousWeek(force: boolean = false) {
        console.log('Updating remaining balance for previous week.');

        const startOfPreviousWeek = dayjs().tz(Config.timezone).startOf('week').add(1, 'day').subtract(1, 'week').toDate();
        console.log('Previous week start date is ' + startOfPreviousWeek);
        let balance = await BalanceService.findOne({ weekOf: startOfPreviousWeek });
        if (balance && !force) {
            console.log('Balance found. Skipping.');
            return;
        }
            
        const transactions = await TransactionService.getForWeek(startOfPreviousWeek),
            isUpdate = !!balance;

        let sum = transactions
            .filter((transaction: Transaction) => !transaction.ignored && transaction.tags.every((tag: Tag) => !tag.ignore))
            .map((transaction: Transaction) => transaction.amount)
            .reduce((sum: number, curr: number) => sum + curr, 0);

        const lastWeeksBalance = await BalanceService.findOne({
            weekOf: {
                $gt: dayjs(startOfPreviousWeek).subtract(1, 'week').subtract(1, 'day').toDate(),
                $lt: dayjs(startOfPreviousWeek).subtract(1, 'week').add(1, 'day').toDate()
            }
        });

        if (lastWeeksBalance)
            sum -= lastWeeksBalance.amount;

        if (!balance) {
            balance = new Balance();
            balance.weekOf = startOfPreviousWeek;
            balance = await BalanceService.insertOne(balance);
        }

        balance.amount = Config.weeklyAmount(startOfPreviousWeek) - sum;
        await BalanceService.updateOne(balance);

        console.log(`${isUpdate ? 'Updated' : 'Inserted'} remaining balance with amount ${balance.amount.toFixed(2)}.`)
    }
}

export default new Balances();