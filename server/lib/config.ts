import dayjs from 'dayjs';

export default class Config {
    static databaseConnectionString: string = 'mongodb://database:27017';
    static timezone: string = 'America/Edmonton';
    static remainingBalanceUpdateCron: string = '0 0 * * MON';
    static oneTimeBalanceUpdateCron: string = '0 0 1 * *';
    static allowanceUpdateCron: string = '0 0 * * FRI';
    static allowanceBaseWeeklyAmount: number = 5;
    static allowanceIncrement: number = 1;
    static allowanceMax: number = 10;

    static weeklyAmount = (date: Date) => {
        if (date >= new Date(2025, 0, 1))
            return 350;
        if (date >= new Date(2024, 7, 19))
            return 750;
        if (date >= new Date(2021, 11, 5))
            return 800;
        if (date >= new Date(2021, 7, 16))
            return 1000;
        return 500;
    }

    static oneTimeAmount = (date: Date = new Date()) => {
        return date >= new Date(2024, 11, 15) ? 2000 : 1500;
    }
} 