import { createTemplateSender, emailIdentity, sender } from './relay';
import { ITemplate } from './templates';

export class EmailClient {
  constructor() {}

  createTemplate<Data>(template: ITemplate<Data>) {
    return createTemplateSender(template, emailIdentity, sender);
  }
}
