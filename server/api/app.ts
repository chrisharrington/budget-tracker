import 'module-alias/register';
import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import Secret from '@lib/secret';
import Budget from '@api/routes/budget';
import Device from '@api/routes/device';
import Tags from '@api/routes/tags';
import OneTime from '@api/routes/one-time';
import Balances from '@lib/balances';
import * as Allowances from '@api/routes/allowances';

class Server {
    private port: number;

    constructor(port: number) {
        this.port = port;
    }

    async run() {
        const app = express();
        app.use(cors());
        app.use(bodyParser.json());
        app.use(this.auth);

        Budget.initialize(app);
        Device.initialize(app);
        Tags.initialize(app);
        OneTime.initialize(app);
        Allowances.initialize(app);

        await Balances.startWeeklyRemainingBalanceJob();
        await Balances.startMonthlyOneTimeBalanceIncreaseJob();

        app.listen(this.port, () => console.log(`Listening on port ${this.port}...`));
    }

    private auth(request: Request, response: Response, next: any) {
        if (request.headers.authorization !== `Bearer ${Secret.apiKey}`) {
            console.log('Unauthorized request: ' + request.url, request.headers.authorization);
            response.sendStatus(403);
        } else
            next();
    }
}

new Server(9999).run();