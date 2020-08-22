import { Stream } from 'stream';
import { MailParser } from 'mailparser-mit';

export default class Message {
    
    static async fromImap(imap: any) : Promise<string> {
        return new Promise<string>(resolve => {
            imap.on('message', message => {
                console.log('message received');

                const parser = new MailParser();

                parser.on('end', mail => {
                    resolve(mail.html);
                });

                message.on('body', async (stream: Stream) => {
                    stream.pipe(parser);
                });

                message.on('end', () => {
                    parser.end();
                });
            });
        });
    }
}

