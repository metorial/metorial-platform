import { delay } from '@lowerdeck/delay';
import { ProgrammablePromise } from '@lowerdeck/programmable-promise';
import {
  createRelayClient,
  type EmailIdentity,
  type ITemplate
} from '@metorial-services/relay-client';
import { env } from '../env';

export let relay: ReturnType<typeof createRelayClient> = createRelayClient({
  endpoint: env.service.RELAY_URL
});

let senderProm = new ProgrammablePromise<Awaited<ReturnType<typeof relay.sender.upsert>>>();
export let sender = senderProm.promise;

let emailIdentityProm = new ProgrammablePromise<
  Awaited<ReturnType<typeof relay.emailIdentity.upsert>>
>();
export let emailIdentity = emailIdentityProm.promise;

(async () => {
  while (true) {
    console.log('Registering email sender and identity with Ares relay...');

    try {
      let sender = await relay.sender.upsert({
        identifier: 'metorial-ares',
        name: 'Metorial Ares'
      });

      let emailIdentity = await relay.emailIdentity.upsert({
        name: env.email.EMAIL_NAME,
        email: env.email.EMAIL_ADDRESS,
        senderId: sender.id
      });

      senderProm.resolve(sender);
      emailIdentityProm.resolve(emailIdentity);

      console.log(
        `Registered email sender with relay: ${sender.id}, email identity: ${emailIdentity.id}`
      );
      return;
    } catch (err) {
      console.error('Failed to register app with relay', err);
    }

    await delay(5000);
  }
})();

export let createTemplateSender = <Data>(
  template: ITemplate<Data>,
  identity: EmailIdentity | Promise<EmailIdentity>,
  sender: { id: string } | Promise<{ id: string }>
) => {
  return {
    send: async (i: { data: Data; to: string[] }) => {
      let rendered = await template.render(i.data);

      await relay.email.send({
        type: 'email',
        to: i.to,
        template: i.data as any,

        emailIdentityId: (await identity).id,
        senderId: (await sender).id,

        content: {
          subject: rendered.subject,
          html: await rendered.html,
          text: await rendered.text
        }
      });
    }
  };
};
