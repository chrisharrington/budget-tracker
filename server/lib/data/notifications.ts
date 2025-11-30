import { NotificationTicket } from '../models';
import { Base } from './base';


class NotificationTicketService extends Base<NotificationTicket> {
    constructor() {
        super('notifications');
    }
}

export default new NotificationTicketService();