import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { AssistantStartScene } from '@metorial/scene-assistant';
import {
  metorialAssistantSlug,
  useCurrentInstance,
  useCurrentOrganization
} from '@metorial/state';
import { useNavigate } from 'react-router-dom';

export let AssistantPage = () => {
  let navigate = useNavigate();
  let organization = useCurrentOrganization();
  let instance = useCurrentInstance();

  return renderWithLoader({ organization, instance })(() => (
    <AssistantStartScene
      assistantSlug={metorialAssistantSlug}
      showBrandIcon
      onOpenConversation={(conversationId, state) =>
        navigate(
          Paths.instance.assistantConversation(
            organization.data!,
            instance.data!.project,
            instance.data!,
            conversationId
          ),
          { state }
        )
      }
    />
  ));
};
