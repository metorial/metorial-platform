import { Panel, showModal } from '@metorial/ui';
import { ProviderInvocationByCallbackEventId, ProviderInvocationById } from './details';

type ProviderInvocationPanelProps =
  | { providerInvocationId: string }
  | { callbackEventId: string };

export let ProviderInvocationPanel = (p: ProviderInvocationPanelProps) => (
  <>
    <Panel.Header>
      <Panel.Title>Provider Invocation</Panel.Title>
    </Panel.Header>

    <Panel.Content>
      {'providerInvocationId' in p ? (
        <ProviderInvocationById providerInvocationId={p.providerInvocationId} />
      ) : (
        <ProviderInvocationByCallbackEventId callbackEventId={p.callbackEventId} />
      )}
    </Panel.Content>
  </>
);

export let showProviderInvocationPanel = (p: ProviderInvocationPanelProps) =>
  showModal(({ dialogProps }) => (
    <Panel.Wrapper {...dialogProps} width={900}>
      <ProviderInvocationPanel {...p} />
    </Panel.Wrapper>
  ));
