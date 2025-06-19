import { useApiKeys, useCurrentInstance } from '@metorial/state';
import { theme, toast } from '@metorial/ui';
import copy from 'copy-to-clipboard';
import { useState } from 'react';
import styled from 'styled-components';

let Button = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  padding: 0 4px;
  border: none;
  border-radius: 4px;
  background: ${theme.colors.gray400};
`;

export let KeySelector = ({ name }: { name: string }) => {
  let instance = useCurrentInstance();
  let [apiKey, setApiKey] = useState<string>();

  let apiKeys = useApiKeys(
    instance.data
      ? {
          type: 'instance_access_token',
          instanceId: instance.data.id
        }
      : undefined
  );

  let create = apiKeys.createMutator();

  if (apiKey) return <span>{apiKey}</span>;

  return (
    <Button
      onClick={async () => {
        if (!apiKey) {
          let [res] = await create.mutate({
            type: 'instance_access_token_secret',
            instanceId: instance.data?.id ?? '',
            name
          });
          if (!res) return;

          setApiKey(res.secret!);
          apiKey = res.secret!;
        }

        copy(apiKey);

        toast.success('API key copied to clipboard');
      }}
    >
      Create API key
    </Button>
  );
};
