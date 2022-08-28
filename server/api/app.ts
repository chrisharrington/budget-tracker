import 'module-alias/register';

import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

import Secret from '@lib/secret';

import TransactionService from '@lib/data/transaction';

import Budget from '@api/routes/budget';
import Device from '@api/routes/device';
import Tags from '@api/routes/tags';

import Balances from '@lib/balances';


class Server {
    private port: number;

    constructor(port: number) {
        this.port = port;
    }

    async run() {
        // const tags = [];
        // tags.push('allowance');
        // tags.push('gas');
        // tags.push('health');
        // tags.push('holiday');
        // tags.push('one-time');

        // const transactions = await TransactionService.find({ 'tags.name': { $in: tags }, date: { $gte: new Date(2022, 0, 1) } });
        // const amount = transactions
        //     .map(x => x.amount)
        //     .reduce((prev, curr) => prev + curr, 0);

        // console.log(amount);

        const app = express();
        app.use(cors());
        app.use(bodyParser.json());
        app.use(this.auth);

        Budget.initialize(app);
        Device.initialize(app);
        Tags.initialize(app);

        await Balances.startWeeklyJob();

        app.listen(this.port, () => console.log(`Listening on port ${this.port}...`));
    }

    private auth(request: Request, response: Response, next: any) {
        if (request.headers.authorization !== Secret.apiKey)
            response.sendStatus(403);
        else
            next();
    }
}

new Server(9999).run();