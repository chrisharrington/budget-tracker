import Imap from 'imap';
import { Stream } from 'stream';
import { MailParser } from 'mailparser-mit';
import dayjs from 'dayjs';

import Message from './message';

const HOURS: number = 1;

export default class Inbox {
    private imap: Imap;
    private onMessageCallback: (message: Message, date: Date) => void;
    private ready: Promise<void>;
    private emailAddress: string;
    private password: string;
    private searching: boolean;

    constructor(emailAddress: string, password: string) {
        this.emailAddress = emailAddress;
        this.password = password;
        this.searching = false;

        this.connect();
        
        setInterval(() => this.connect(true), HOURS*60*60*1000);
    }

    onMessage(callback: (message: string, date: Date) => void) {
        this.onMessageCallback = callback;
    }

    private async connect(disconnect: boolean = false) {
        if (disconnect) {
            console.log('[mail] Disconnected.');
            this.imap.end();
        }

        console.log('[mail] Connecting...');
        this.ready = new Promise<void>((resolve, reject) => {
            this.imap = new Imap({
                user: this.emailAddress,
                password: this.password,
                host: 'outlook.office365.com',
                port: 993,
                tls: true,
                tlsOptions: { rejectUnauthorized: false }
            });

            this.imap.on('error', async (error: Error) => {
                if (error.message.indexOf('This socket has been ended by the other party') > -1) {
                    console.log('[mail] Socket terminated. Reconnecting...');
                    await this.connect();
                } else {
                    console.log('[mail] IMAP reported error.');
                    reject(error);
                }
            });

            this.imap.once('ready', () => {
                console.log('[mail] Ready.')
                this.imap.openBox('INBOX', false, error => {
                    if (error)
                        reject(error);
                    else
                        resolve();
                });
            });

            this.imap.on('mail', async () => {
                console.log('[mail] Mail event triggered.');

                if (this.searching)
                    console.log('[mail] Search already in progress. No additional search performed.');
                else {
                    this.searching = true;
                    console.log('[mail] Search block enabled.');
                    await this.unread();

                    this.searching = false;
                    console.log('[mail] Search block disabled.');
                }
            });
        }).catch(console.error);

        this.imap.connect();
    }

    private async unread() : Promise<void> {
        await this.ready;

        return new Promise<void>((resolve, reject) => {
            console.log('[mail] Searching for unread messages.');
            this.imap.search(['UNSEEN'], async (error: Error, messageIds) => {
                if (error) {
                    console.error(error);
                    reject(error);
                } else {
                    if (!messageIds.length) {
                        console.log('[mail] No unread messages found.');
                        resolve();
                    }

                    console.log(`[mail] Found ${messageIds.length} unread message${messageIds.length === 1 ? '' : 's'}.`);

                    if (!messageIds.length) {
                        resolve();
                        return;
                    }

                    const fetch = this.imap.fetch(messageIds, { bodies: '' });
                    fetch.on('message', message => {
                        const parser = new MailParser(); 
        
                        parser.once('end', mail => {
                            if (this.onMessageCallback && mail.subject.indexOf('A new Credit Card transaction has been made') > -1) {
                                console.log('[mail] Transaction email received.');
                                this.onMessageCallback(mail.html, dayjs(mail.receivedDate).toDate());
                                resolve();
                            }
                        });
        
                        message.on('body', (stream: Stream) => {
                            stream.pipe(parser);
                        });
        
                        message.once('end', () => {
                            parser.end();
                        });
                    });
                        
                    this.imap.setFlags(messageIds, ['\\Seen'], (error: Error) => {
                        console.log('[mail] Marking unread messages as read.');
                        if (error) {
                            console.error(error);
                            reject(error);
                        }
                    });
                }
            });
        });
    }
}