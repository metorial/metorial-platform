import { ipInfo } from '@lowerdeck/ip-info';
import {
  createEmail,
  createTemplate,
  DataList,
  Layout,
  Text
} from '@metorial-platform-systems/relay-client';
import { UAParser } from 'ua-parser-js';
import type { User } from '../../prisma/generated/client';
import { createTemplateSender, emailIdentity, sender } from './client';

export let successfulLoginVerification = createTemplateSender(
  createTemplate({
    render: async ({
      user,
      method,
      ip,
      ua: uaString,
      createdAt
    }: {
      user: User;
      method: string;
      ip: string;
      ua?: string | null;
      createdAt: Date;
    }) => {
      let ua = uaString ? new UAParser(uaString).getResult() : undefined;
      let geo = await ipInfo.getSafe(ip);

      let localDate = new Date(createdAt);

      try {
        localDate = geo?.timezone
          ? new Date(
              localDate.toLocaleString('en-US', {
                timeZone: geo.timezone,
                hour12: false
              })
            )
          : localDate;
      } catch (e) {}

      return createEmail({
        subject: `New login to your Metorial account`,
        preview: `A new login was detected on your Metorial account.`,
        content: (
          <Layout
            title="We've noticed a new login"
            description={
              <>
                Hey, {user.name}. A new login was detected on your Metorial account.
                <br />
                <DataList
                  items={[
                    { label: 'Time', value: localDate.toLocaleString() },
                    { label: 'IP Address', value: ip },
                    {
                      label: 'Browser',
                      value: ua
                        ? [ua.browser.name, ua.os.name].filter(Boolean).join(' on ')
                        : 'Unknown'
                    },
                    {
                      label: 'Location',
                      value: geo
                        ? [geo.city ?? geo.region, geo.countryName ?? geo.country]
                            .filter(Boolean)
                            .join(', ')
                        : 'Unknown'
                    },
                    {
                      label: 'Method',
                      value: method
                    }
                  ]}
                />
              </>
            }
          >
            <Text>
              If this was you, you can ignore this email. If this was not you, please visit
              your account settings to secure your account.
            </Text>
          </Layout>
        )
      });
    }
  }),
  emailIdentity,
  sender
);
