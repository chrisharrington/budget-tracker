import Imap from 'node-imap';
import { MailParser } from 'mailparser-mit';
import dayjs from 'dayjs';

import logger from '@lib/logger';

const log = logger.child({ module: 'mail' });

const HOURS: number = 1;

export default class Inbox {
    private imap!: Imap;
    private onMessageCallback!: (message: string, date: Date) => void;
    private ready!: Promise<void>;
    private host: string;
    private emailAddress: string;
    private password: string;
    private searching: boolean;

    constructor(host: string, emailAddress: string, password: string) {
        this.host = host;
        this.emailAddress = emailAddress;
        this.password = password;
        this.searching = false;

        this.connect();

        setInterval(() => this.connect(true), HOURS * 60 * 60 * 1000);
    }

    onMessage(callback: (message: string, date: Date) => void) {
        this.onMessageCallback = callback;
    }

    private connect(disconnect: boolean = false) {
        if (disconnect) {
            this.block(true);
            log.info('Disconnected.');
            this.block(false);
            this.imap.end();
        }

        log.info('Connecting...');
        this.ready = new Promise<void>((resolve, reject) => {
            this.imap = new Imap({
                user: this.emailAddress,
                password: this.password,
                host: this.host,
                port: 993,
                tls: true,
                tlsOptions: { rejectUnauthorized: false },
            });

            this.imap.on('error', (error: Error) => {
                if (error.message.indexOf('This socket has been ended by the other party') > -1) {
                    log.info('Socket terminated. Reconnecting...');
                    this.connect();
                } else {
                    log.warn('IMAP reported error.');
                    reject(error);
                }
            });

            this.imap.once('ready', () => {
                log.info('Inbox ready.');
                this.imap.openBox('INBOX', false, error => {
                    if (error) reject(error);
                    else resolve();
                });
            });

            this.imap.on('mail', async () => {
                log.info('Mail event triggered.');

                if (this.searching) log.info('Search already in progress. No additional search performed.');
                else {
                    this.block(true);
                    await this.unread();
                    this.block(false);
                }
            });
        }).catch(err => log.error({ err }, 'IMAP connection failed.'));

        this.imap.connect();
    }

    public async parseUnread(): Promise<void> {
        this.block(true);
        log.info('Parsing unread messages...');
        await this.unread();
        this.block(false);
    }

    private block(flag: boolean) {
        log.info(`Search block ${flag ? 'enabled' : 'disabled'}.`);
        this.searching = flag;
    }

    private async unread(): Promise<void> {
        await this.ready;

        return new Promise<void>((resolve, reject) => {
            log.info('Searching for unread messages.');
            this.imap.search(['UNSEEN'], (error: Error, messageIds) => {
                if (error) {
                    log.error({ err: error }, 'IMAP search failed.');
                    reject(error);
                } else {
                    if (!messageIds.length) {
                        log.info('No unread messages found.');
                        resolve();
                    }

                    log.info(`Found ${messageIds.length} unread message${messageIds.length === 1 ? '' : 's'}.`);

                    if (!messageIds.length) {
                        resolve();
                        return;
                    }

                    const fetch = this.imap.fetch(messageIds, { bodies: '' });
                    fetch.on('message', message => {
                        const parser = new MailParser();

                        parser.once('end', mail => {
                            if (
                                this.onMessageCallback &&
                                mail.subject.indexOf('A new Credit Card transaction has been made') > -1
                            ) {
                                log.info('Transaction email received.');
                                this.onMessageCallback(mail.html, dayjs(mail.receivedDate).toDate());
                                resolve();
                            }
                        });

                        message.on('body', stream => {
                            stream.pipe(parser);
                        });

                        message.once('end', () => {
                            parser.end();
                        });
                    });

                    this.imap.setFlags(messageIds, ['\\Seen'], (error: Error) => {
                        log.info('Marking unread messages as read.');
                        if (error) {
                            log.error({ err: error }, 'Failed to mark messages as read.');
                            reject(error);
                        }
                    });
                }
            });
        });
    }
}
