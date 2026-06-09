import { EventEmitter } from 'events';
import { Stream } from 'stream';
import { MailParser } from 'mailparser-mit';

export default class Message {
    static async fromImap(imap: EventEmitter): Promise<string> {
        return new Promise<string>(resolve => {
            imap.on('message', (message: EventEmitter) => {
                const parser = new MailParser();

                parser.on('end', mail => {
                    resolve(mail.html);
                });

                message.on('body', (stream: Stream) => {
                    stream.pipe(parser);
                });

                message.on('end', () => {
                    parser.end();
                });
            });
        });
    }
}
