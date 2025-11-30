import { Base } from './base';

import { Balance } from '@lib/models';


class BalanceService extends Base<Balance> {
    constructor() {
        super('balances');
    }
}

export default new BalanceService();