import Imap from 'imap';
import { Stream } from 'stream';
import { MailParser } from 'mailparser-mit';
import dayjs from 'dayjs';

import Message from './message';

export default class Inbox {
    private imap: Imap;
    private onMessageCallback: (message: Message, date: Date) => void;
    private ready: Promise<void>;

    constructor(emailAddress: string, password: string) {
        this.ready = new Promise((resolve, reject) => {
            this.imap = new Imap({
                user: emailAddress,
                password,
                host: 'imap.gmail.com',
                port: 993,
                tls: true,
                tlsOptions: { rejectUnauthorized: false }
            });

            this.imap.once('error', error => {
                console.log('IMAP reported error.');
                console.error(reject(error));
            });

            this.imap.once('ready', () => {
                this.imap.openBox('INBOX', false, error => {
                    if (error)
                        reject(error);
                    else
                        resolve();
                });
            });

            this.imap.on('mail', async () => {
                console.log('IMAP mail event triggered.');
                await this.unread();
            });
        });

        this.imap.connect();
    }

    onMessage(callback: (message: string, date: Date) => void) {
        this.onMessageCallback = callback;
    }

    async unread() : Promise<void> {
        await this.ready;

        this.imap.search(['UNSEEN'], async (error: Error, messageIds) => {
            if (error) {
                console.error(error);
                throw error;
            } else {
                if (!messageIds.length) {
                    console.log('No message IDs found, so doing nothing.');
                    return;
                }

                const fetch = this.imap.fetch(messageIds, { bodies: '' });
                fetch.on('message', message => {
                    const parser = new MailParser();
    
                    parser.once('end', mail => {
                        if (this.onMessageCallback && mail.subject === 'A new Credit Card transaction has been made') {
                            console.log('Transaction email received.');
                            this.onMessageCallback(mail.html, dayjs(mail.receivedDate).toDate());
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
                    if (error) {
                        console.error(error);
                        throw error;
                    }
                });
            }
        });
    }
}