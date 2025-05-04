import { emailService } from './services';
import { ITemplate } from './templates';

export class EmailClient {
  constructor() {}

  createTemplate<Data>(template: ITemplate<Data>) {
    return {
      send: async (i: { data: Data; to: string[] }) => {
        let rendered = await template.render(i.data);

        return await emailService.sendEmail({
          type: 'email',
          to: i.to,
          template: i.data as any,

          content: {
            subject: rendered.subject,
            html: await rendered.html,
            text: await rendered.text
          }
        });
      }
    };
  }
}
