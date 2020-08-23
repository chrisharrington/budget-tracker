import 'module-alias/register';

import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

import Secret from '@lib/secret';

import Budget from '@api/routes/budget';
import Device from '@api/routes/device';

class Server {
    private port: number;

    constructor(port: number) {
        this.port = port;
    }

    run() {
        const app = express();
        app.use(cors());
        app.use(bodyParser.json());
        app.use(this.auth);

        Budget.initialize(app);
        Device.initialize(app);

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