import { renderWithLoader } from '@metorial/data-hooks';
import { PageHeader } from '@metorial/layout';
import { AssistantConversationScene } from '@metorial/scene-assistant';
import { useCurrentInstance, useCurrentOrganization } from '@metorial/state';

export let AssistantConversationPage = () => {
  let organization = useCurrentOrganization();
  let instance = useCurrentInstance();

  return renderWithLoader({
    organization,
    instance
  })(() => (
    <AssistantConversationScene
      setRestrictHeight={enabled => (window as any).metorial_setRestrictHeight?.(enabled)}
      renderHeader={({ title, assistantName, description }) => (
        <PageHeader title={title ?? assistantName} description={description} />
      )}
    />
  ));
};
