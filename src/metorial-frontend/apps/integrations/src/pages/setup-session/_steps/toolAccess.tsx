import { ToolAccessEditor } from '@metorial/tool-selection';
import { CenteredSpinner } from '@metorial/ui';
import styled from 'styled-components';
import type { SetupFlow } from '../_useSetupFlow';

let Loading = styled.div`
  padding: 12px 0;
`;

export let ToolAccess = ({
  toolAccess
}: {
  toolAccess: NonNullable<SetupFlow['toolAccess']>;
}) => {
  if (toolAccess.isLoading) {
    return (
      <Loading>
        <CenteredSpinner size={20} />
      </Loading>
    );
  }

  return (
    <ToolAccessEditor
      title="Tool Access"
      description="Choose whether setup should allow all tools or only a selected subset."
      emptyText="No selectable tools are currently available for this provider. Continue to keep the default access settings."
      mode={toolAccess.selection.mode}
      onModeChange={toolAccess.onModeChange}
      tools={toolAccess.tools}
      categories={toolAccess.categories}
      selection={toolAccess.selection}
      onSelectionChange={toolAccess.onSelectionChange}
    />
  );
};
