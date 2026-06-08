import { Request, Response, Router } from 'express';

import * as DeviceService from '@lib/data/device';
import { Device } from '@lib/models';
import { asyncHandler } from '@api/async-handler';
import { validate } from '@api/validate';
import { deviceTokenSchema } from '@lib/schemas';

const router = Router();

async function upsertDevice(request: Request, response: Response) {
    request.log.info('Request received: POST /device');
    await DeviceService.upsert(request.body as Device);
    request.log.info(`Registered device with token ${request.body.token}`);

    response.sendStatus(200);
}

router.post('/device', validate(deviceTokenSchema), asyncHandler(upsertDevice));

export default router;
