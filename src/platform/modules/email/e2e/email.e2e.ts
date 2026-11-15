import { uniqueEmail, uniqueId } from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import { createTemplate, EmailClient } from '../src';
import { emailIdentity, sender } from '../src/relay';

describe('module-email', () => {
  it('registers the sender and email identity with relay', async () => {
    let [registeredSender, identity] = await Promise.all([sender, emailIdentity]);
    expect(registeredSender.id).toBeTruthy();
    expect(identity.id).toBeTruthy();
  });

  it('renders a template and queues it for delivery through relay', async () => {
    let rendered: { code: string }[] = [];
    let template = createTemplate<{ code: string }>({
      render: data => {
        rendered.push(data);
        return {
          subject: `E2E ${data.code}`,
          html: `<p>Your code is ${data.code}</p>`,
          text: `Your code is ${data.code}`
        };
      }
    });

    let code = uniqueId('code');
    let result = await new EmailClient()
      .createTemplate(template)
      .send({ data: { code }, to: [uniqueEmail('email')] });

    expect(rendered).toEqual([{ code }]);
    expect(result).toEqual({ id: null });
  });
});
