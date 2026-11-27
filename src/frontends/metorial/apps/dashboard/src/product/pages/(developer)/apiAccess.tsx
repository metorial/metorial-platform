import { renderWithLoader } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { useCurrentInstance } from '@metorial/state';
import { Callout, Select } from '@metorial/ui';
import styled from 'styled-components';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

export let ProjectDeveloperApiAccessPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(() => (
    <ContentLayout>
      <PageHeader title="API Settings" description="Manage details about the Metorial API." />

      <Wrapper>
        <Callout color="blue">
          This environment has full access to the Metorial API under standard rate limits. It
          is using the latest version of the Metorial API.
        </Callout>

        <Select
          label="API Version"
          description="Select the default Metorial API version. You can override it per request; in most cases, use the latest version."
          items={[{ label: '2026-01-01 (Magnetar)', id: '2026-01-01' }]}
          value="2026-01-01"
        />
      </Wrapper>
    </ContentLayout>
  ));
};
