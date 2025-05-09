import { ContentLayout, PageHeader } from '@metorial/layout';
import { useCurrentOrganization, useCurrentProject, useUser } from '@metorial/state';
import { styled } from 'styled-components';

let OnboardingHeader = styled.div`
  padding: 3px;
  background: linear-gradient(to right, #e9c176, #81b9e3);
  border-radius: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  display: flex;
`;

let OnboardingHeaderContent = styled.div`
  padding: 20px;
  border-radius: 17px;
  box-shadow: 0px 0px 2px rgba(0, 0, 0, 0.2);
  display: flex;
  background: rgba(255, 255, 255, 0.8);
`;

let OnboardingContent = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  color: white;
  padding: 30px;
  justify-content: center;

  a {
    color: inherit;
    text-decoration: underline;
  }
`;

let OnboardingCta = styled.div`
  display: flex;
  flex-direction: column;
  width: 500px;
  padding: 40px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 10px;
  box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.12);
`;

export let ProjectHomePage = () => {
  let project = useCurrentProject();
  let org = useCurrentOrganization();
  let user = useUser();

  let organization = useCurrentOrganization();

  return (
    <ContentLayout>
      {user.data && (
        <PageHeader
          title={`Welcome to Metorial, ${user.data?.name}!`}
          description="It's a good day to build something amazing."
        />
      )}

      {/* {agents.data?.length === 0 ? (
        <OnboardingHeader>
          <OnboardingHeaderContent>
            <OnboardingContent>
              <Title size="7" weight="bold">
                Welcome to Metorial!
              </Title>
              <Spacer size={5} />
              <Text size="2" weight="medium">
                Getting started is super easy. Let's begin by{' '}
                <Link to={Paths.workflows.agents(inst.data)}>creating your first agent</Link>.
                You can use your new agent to build the AI workflows you need. Just drag and
                drop the blocks, connect them, and you're good to go!
              </Text>
            </OnboardingContent>

            <OnboardingCta>
              <Title size="6" weight="strong">
                Ready to get started?
              </Title>
              <Spacer size={5} />
              <Text>Let's create your first agent.</Text>

              <Spacer size={15} />

              <Link to={Paths.workflows.agents(inst.data)}>
                <Button as="span">Create Agent</Button>
              </Link>
            </OnboardingCta>
          </OnboardingHeaderContent>
        </OnboardingHeader>
      ) : (
        <>
          <AgentGrid preview />

          <Spacer height={25} />

          <UsageScene
            title="Agent Usage"
            description="Recent usage of your agents."
            entityNames={
              agents.data?.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {}) ?? {}
            }
            organizationId={org.data?.id ?? null}
            entities={
              // [{ type: 'agent', id: c.id }]
              agents.data?.map(c => ({ type: 'agent', id: c.id })) ?? []
            }
            interval={{ unit: 'day', count: 1 }}
          />
        </>
      )} */}
    </ContentLayout>
  );
};
