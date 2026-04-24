import { Panel, showModal } from '@metorial/ui';
import { ProviderInvocationById } from './details';

export let ProviderInvocationPanel = (p: { providerInvocationId: string }) => (
  <>
    <Panel.Header>
      <Panel.Title>Provider Invocation</Panel.Title>
    </Panel.Header>

    <Panel.Content>
      <ProviderInvocationById providerInvocationId={p.providerInvocationId} />
    </Panel.Content>
  </>
);

export let showProviderInvocationPanel = (p: { providerInvocationId: string }) =>
  showModal(({ dialogProps }) => (
    <Panel.Wrapper {...dialogProps} width={900}>
      <ProviderInvocationPanel providerInvocationId={p.providerInvocationId} />
    </Panel.Wrapper>
  ));
