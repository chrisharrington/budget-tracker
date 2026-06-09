import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { CronJob } from 'cron';
import { Tag, Transaction } from '@lib/models';
import * as TransactionService from '@lib/data/transaction';
import * as BalanceService from '@lib/data/balance';
import * as OneTimeService from '@lib/data/one-time';
import logger from '@lib/logger';
import Config from '@lib/config';

const log = logger.child({ module: 'balances' });

dayjs.extend(utc);
dayjs.extend(timezone);

export function startMonthlyOneTimeBalanceIncreaseJob() {
    const job = new CronJob(
        Config.oneTimeBalanceUpdateCron,
        async () => {
            await OneTimeService.addAmount(Config.oneTimeAmount());
        },
        null,
        true,
        Config.timezone,
    );

    job.start();

    log.info(`Started monthly job to update one-time balance. Next run on ${job.nextDates()}`);
}

export function startWeeklyRemainingBalanceJob() {
    void upsertBalanceFromPreviousWeek();

    const job = new CronJob(
        Config.remainingBalanceUpdateCron,
        async () => {
            await upsertBalanceFromPreviousWeek();
        },
        null,
        true,
        Config.timezone,
    );

    job.start();

    log.info(`Started weekly job to update remaining balance. Next run on ${job.nextDates()}`);
}

export async function upsertBalanceFromPreviousWeek(force: boolean = false) {
    log.info('Updating remaining balance for previous week.');

    const startOfPreviousWeek = dayjs().tz(Config.timezone).startOf('week').add(1, 'day').subtract(1, 'week').toDate();
    log.info('Previous week start date is ' + startOfPreviousWeek);

    const existing = await BalanceService.findForWeek(startOfPreviousWeek);
    if (existing && !force) {
        log.info('Balance found. Skipping.');
        return;
    }

    const transactions = await TransactionService.getForWeek(startOfPreviousWeek);

    let sum = transactions
        .filter((transaction: Transaction) => !transaction.ignored && transaction.tags.every((tag: Tag) => !tag.ignore))
        .map((transaction: Transaction) => transaction.amount)
        .reduce((sum: number, curr: number) => sum + curr, 0);

    // Exact match on the prior week's start date (the unique weekOf index guarantees a single doc),
    // replacing the midnight-straddling range that was hedging against drift.
    const lastWeeksBalance = await BalanceService.findForWeek(dayjs(startOfPreviousWeek).subtract(1, 'week').toDate());

    if (lastWeeksBalance) sum -= lastWeeksBalance.amount;

    const amount = Config.weeklyAmount(startOfPreviousWeek) - sum;
    await BalanceService.upsertForWeek(startOfPreviousWeek, amount);

    log.info(`${existing ? 'Updated' : 'Inserted'} remaining balance with amount ${amount.toFixed(2)}.`);
}
