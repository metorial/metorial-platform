import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderTriggers
} from '@metorial/state';
import { Button, Callout, Flex, Text } from '@metorial/ui';
import { Link } from 'react-router-dom';
import { ConfigureSectionCard } from '../integrations/providerPanelFlow';
import { AuthMethodPicker } from '../providerAuthConfigs/authMethodPicker';
import { CallbackSyncErrorCallout, type CallbackSync } from './shared';

export type ProviderCallbacksStatus = 'enabled' | 'disabled';

export let IntegrationProviderCallbacksSection = ({
  instanceId,
  providerVersionId,
  providerName,
  webhookRegistrationSupported,
  callback,
  value,
  onChange
}: {
  instanceId: string;
  providerVersionId: string | null | undefined;
  providerName: string;
  webhookRegistrationSupported: boolean;
  callback: { id: string; sync: CallbackSync } | null;
  value: ProviderCallbacksStatus;
  onChange: (value: ProviderCallbacksStatus) => void;
}) => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let instance = useCurrentInstance();
  let triggers = useProviderTriggers(
    instanceId,
    providerVersionId ? { providerVersionId } : null
  );

  let triggerItems = triggers.data?.items ?? [];

  return (
    <ConfigureSectionCard
      title="Callbacks"
      description={`Let ${providerName} push events into Metorial. Metorial registers for the events below on every integration instance.`}
      requirement="optional"
      completed={value === 'enabled'}
    >
      <Flex direction="column" gap={12}>
        <AuthMethodPicker
          label="Callbacks"
          hideLabel
          value={value}
          onChange={next => {
            if (next !== 'enabled' && next !== 'disabled') return;
            onChange(next);
          }}
          items={[
            {
              id: 'disabled',
              name: 'Off',
              description: 'Metorial does not receive events from this provider.'
            },
            {
              id: 'enabled',
              name: 'Receive Events',
              description:
                'Metorial registers with the provider and records every event it sends.'
            }
          ]}
        />

        {callback ? (
          <>
            <Flex align="center" gap={10} wrap="wrap">
              <Text size="2" color="gray600">
                Registration active
              </Text>
              <Link
                to={Paths.instance.callback(
                  organization.data,
                  project.data,
                  instance.data,
                  callback.id
                )}
              >
                <Button size="1" as="span" variant="outline">
                  Open Callback
                </Button>
              </Link>
            </Flex>

            <CallbackSyncErrorCallout sync={callback.sync} />
          </>
        ) : null}

        {value === 'enabled' && webhookRegistrationSupported ? (
          <Callout color="blue" size="1">
            <span>
              This provider needs a webhook receiver. Metorial gives you a receive URL to
              register in the provider's own dashboard — set one up under Callbacks → Webhook
              Receivers.
            </span>
          </Callout>
        ) : null}
      </Flex>
    </ConfigureSectionCard>
  );
};
