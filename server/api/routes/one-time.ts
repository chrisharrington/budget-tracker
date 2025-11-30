import { Application, Request, Response } from 'express';

import OneTimeService from '@lib/data/one-time';


export default class TagRoute {
    static initialize(app: Application) {
        app.get('/one-time/balance', this.getOneTimeBalance.bind(this));
    }

    private static async getOneTimeBalance(_: Request, response: Response) {
        try {
            console.log('Request received: GET /one-time/balance');

            const oneTime = await OneTimeService.get();
            response.status(200).send(JSON.stringify(oneTime));
        } catch (e) {
            console.log('Request failed: GET /one-time/balance');
            console.error(e);
            response.status(500).send(e);
        }
    }
}