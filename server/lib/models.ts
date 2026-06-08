export interface Id {
    _id: string;
}

export interface Device extends Id {
    token: string;
}

export interface Budget {
    date: Date;
    weeklyAmount: number;
    balance?: number;
    transactions: Transaction[];
}

export interface Transaction extends Id {
    amount: number;
    date: Date;
    description: string;
    owner: string;
    ignored: boolean;
    tags: Tag[];
    isAllowancePayment?: boolean;
}

export interface Tag extends Id {
    name: string;
    ignore: boolean;
}

export interface NotificationTicket extends Id {
    status: string;
    notificationId: string;
    receiptAcquired: boolean;
}

export interface Balance extends Id {
    weekOf: Date;
    amount: number;
}

export interface OneTime extends Id {
    balance: number;
}
