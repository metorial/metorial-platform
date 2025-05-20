'use client';

import { CodeBlock } from '@metorial/code';
import { Button, Dialog, showModal, Spacer } from '@metorial/ui';
import copy from 'copy-to-clipboard';
import dedent from 'dedent';
import { useState } from 'react';
import { toast } from 'sonner';
import styled from 'styled-components';
import { ServerInstance } from '../../../../../../../state/client/serverInstance';
import { useEnsureToken } from '../../../../../../../state/client/token';
import { useExplorer } from '../explorer/context';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

export let ServerInstanceUsage = ({
  instance,
  onExplorerOpen
}: {
  instance: ServerInstance;
  onExplorerOpen?: () => void;
}) => {
  let token = useEnsureToken();
  let explorer = useExplorer(instance.server);

  let code = dedent`
    import MetorialConnect, { aiSDK } from '@metorial/connect';
    import { generateText } from 'ai';
    import { openai } from '@ai-sdk/openai';

    let metorialConnect = new MetorialConnect('${token}')

    let result = await generateText({
      model: openai('gpt-4o'),
      prompt: 'Your prompt here',
      maxSteps: 5,
      tools: aiSDK(metorialConnect, {
        servers: ['${instance.server.slug}-${instance.identifier}'],
      })
    });
  `;

  let [copied, setCopied] = useState(false);

  return (
    <Wrapper>
      <CodeBlock code={code} language="json" lineNumbers={false} />

      <Spacer size={10} />

      <div
        style={{
          display: 'flex',
          gap: 10
        }}
      >
        <Button
          size="2"
          onClick={() => {
            if (onExplorerOpen) {
              onExplorerOpen();
              setTimeout(() => explorer.open(), 100);
            } else {
              explorer.open();
            }
          }}
        >
          Open in Explorer
        </Button>

        <Button
          size="2"
          onClick={() => {
            setCopied(true);

            copy(code);
            toast.success('Code copied to clipboard');

            setTimeout(() => setCopied(false), 2000);
          }}
          variant="outline"
          success={copied}
        >
          Copy Code
        </Button>
      </div>
    </Wrapper>
  );
};

export let openServerInstanceUsageModal = (instance: ServerInstance) =>
  showModal(({ dialogProps, close }) => {
    return (
      <Dialog.Wrapper {...dialogProps}>
        <Dialog.Title>
          Use <span>{instance.server.name}</span>
        </Dialog.Title>

        <ServerInstanceUsage instance={instance} onExplorerOpen={close} />
      </Dialog.Wrapper>
    );
  });
