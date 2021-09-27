export default class Config {
    static databaseConnectionString: string = 'mongodb://database:27017';
    static weeklyAmount = (date: Date) => date >= new Date(2021, 7, 16) ? 1000 : 500; 
}