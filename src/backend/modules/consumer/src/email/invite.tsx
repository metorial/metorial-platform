import { Code, createEmail, createTemplate, Layout, Text } from '@metorial/module-email';
import React from 'react';
import { notificationClient } from './client';

export let sendAuthCodeEmail = notificationClient.createTemplate(
  createTemplate({
    render: ({ code, surfaceName }: { code: string; surfaceName: string }) => {
      let splitCode = code;
      if (code.length === 6) {
        let first3 = code.slice(0, 3);
        let last3 = code.slice(3, 6);
        splitCode = `${first3}-${last3}`;
      }

      return createEmail({
        subject: `Your ${surfaceName} authentication code: ${splitCode}`,
        preview: `Your authentication code for ${surfaceName} is ${splitCode}.`,
        content: (
          <Layout
            title={`Your ${surfaceName} code`}
            description={`Use the authentication code below to confirm your email address.`}
          >
            <Code code={code} />

            <Text>
              Do not share this code with anyone. If you did not request this code please
              ignore this email.
            </Text>
          </Layout>
        )
      });
    }
  })
);
