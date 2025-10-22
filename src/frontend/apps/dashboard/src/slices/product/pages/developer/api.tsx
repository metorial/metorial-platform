import { renderWithLoader } from '@metorial/data-hooks';
import { PageHeader } from '@metorial/layout';
import { useCurrentProject } from '@metorial/state';
import { Callout, Select } from '@metorial/ui';
import { styled } from 'styled-components';

let Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

export let ProjectDeveloperAPIPage = () => {
  let project = useCurrentProject();

  return (
    <>
      <PageHeader title="API Access" description="Manage details about the Metorial API" />

      <Wrapper>
        {renderWithLoader({
          project
        })(({ project }) => (
          <>
            <Callout color="blue">
              You have full access to the Metorial API under standard rate limits. You are
              using the latest version of the Metorial API.
            </Callout>

            <Select
              label="API Version"
              description="Select the default version of the Metorial API you would like to use. This determines the formatting of events, but can be overridden on a per-request basis. In most cases, you should use the latest version."
              items={[
                {
                  label: '2025-01-01 (Pulsar)',
                  id: '2025-01-01'
                }
              ]}
              value="2025-01-01"
            />
          </>
        ))}
      </Wrapper>
    </>
  );
};
