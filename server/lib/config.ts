export default class Config {
    static databaseConnectionString: string = 'mongodb://database:27017';
    static weeklyAmount = (date: Date) => {
        if (date >= new Date(2021, 11, 5))
            return 800;
        if (date >= new Date(2021, 7, 16))
            return 1000;
        return 500;
    }
}