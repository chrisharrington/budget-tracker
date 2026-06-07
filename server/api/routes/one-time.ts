import { Application, Request, Response } from 'express';

import OneTimeService from '@lib/data/one-time';


export default class TagRoute {
    static initialize(app: Application) {
        app.get('/one-time/balance', this.getOneTimeBalance.bind(this));
    }

    private static async getOneTimeBalance(request: Request, response: Response) {
        try {
            request.log.info('Request received: GET /one-time/balance');

            const oneTime = await OneTimeService.get();
            response.status(200).send(JSON.stringify(oneTime));
        } catch (e) {
            request.log.error({ err: e }, 'Request failed: GET /one-time/balance');
            response.status(500).send(e);
        }
    }
}