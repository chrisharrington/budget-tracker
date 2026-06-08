import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';

import Config from '@lib/config';
import logger from '@lib/logger';
import budgetRouter from '@api/routes/budget';
import deviceRouter from '@api/routes/device';
import tagsRouter from '@api/routes/tags';
import oneTimeRouter from '@api/routes/one-time';
import { startWeeklyRemainingBalanceJob, startMonthlyOneTimeBalanceIncreaseJob } from '@lib/balances';
import { errorHandler } from '@api/error-handler';
import logRouter from './routes/log';

const PORT = 9999;

async function start() {
    const app = express();

    app.use(pinoHttp({ logger }));
    app.use(cors({ origin: Config.corsOrigins }));
    app.use(express.json());

    app.use('/', budgetRouter);
    app.use('/', deviceRouter);
    app.use('/', tagsRouter);
    app.use('/', oneTimeRouter);
    app.use('/', logRouter);

    startWeeklyRemainingBalanceJob();
    startMonthlyOneTimeBalanceIncreaseJob();

    // Registered last so it catches errors forwarded from any route handler.
    app.use(errorHandler);

    app.listen(PORT, '0.0.0.0', () => logger.info(`Listening on port ${PORT}...`));
}

start();
