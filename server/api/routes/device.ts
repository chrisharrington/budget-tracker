import { Application, Request, Response } from 'express';

import DeviceService from '@lib/data/device';
import { parseDevice } from '@lib/parse';

export default class DeviceRoute {
    static initialize(app: Application) {
        app.post('/device', this.upsertDevice.bind(this));
    }

    private static async upsertDevice(request: Request, response: Response) {
        try {
            request.log.info('Request received: POST /device');
            await DeviceService.upsert(parseDevice(request.body));
            request.log.info(`Registered device with token ${request.body.token}`);

            response.sendStatus(200);
        } catch (e) {
            request.log.error({ err: e }, 'Request failed: POST /device');
            response.sendStatus(500);
        }
    }
}