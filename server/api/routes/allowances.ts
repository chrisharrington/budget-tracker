import { Application, Request, Response } from 'express';
import TransactionService from '@lib/data/transaction'

export function initialize(app: Application) {
    app.get('/allowances', getAllowances);
}

async function getAllowances(request: Request, response: Response) {
    try {
        const owner = request.query?.owner;
        if (!owner)
            return response.status(400).send('Unable to retrieve allowance transactions due to missing owner.');
        if (owner !== 'quinn' && owner !== 'zoe')
            return response.status(400).send('Unable to retrieve allowance transactions due to invalid owner.');

        response.status(200).send(await TransactionService.getAllowanceTransactions(owner as string));
    } catch (e) {
        console.error(e);
        response.sendStatus(500);
    }
}