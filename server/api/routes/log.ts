import dayjs from 'dayjs';
import { Application, Request, Response, text } from 'express';

export default class Log {
    static initialize(app: Application) {
        app.post('/log', text(), this.log.bind(this));

        app.get('/test', (_: Request, response: Response) => response.send('Log service is running!').status(200));
    }

    private static async log(request: Request, response: Response) {
        console.log(`${dayjs().format('YYYY-MM-DD HH:mm:ss')} | ${request.method} ${request.url} | ${request.body}`);
        response.sendStatus(200);
    }
}