import { renderWithPagination } from '@metorial/data-hooks';
import { useSkillParticipants } from '@metorial/state';
import { Avatar, Badge, Button, Entity, Flex, RenderDate, Text } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import styled from 'styled-components';
import { SkillSharePopover, type SkillSharePanelContext } from '../components/skillSharePanel';

let EmptyState = styled.div`
  line-height: 1.6;
  padding: 8px 0;
`;

let Items = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let roleLabels: Record<string, string> = {
  creator: 'Creator',
  editor: 'Editor',
  viewer: 'Viewer',
  user: 'User',
  forker: 'Forker'
};

let actorTypeLabels: Record<string, string> = {
  organization_actor: 'Organization Actor',
  consumer: 'Consumer',
  unknown: 'Unknown'
};

export let SkillParticipantsScene = (p: {
  instanceId: string | null | undefined;
  skillId: string | null | undefined;
  shareContext?: SkillSharePanelContext | null;
}) => {
  let participants = useSkillParticipants(p.instanceId, p.skillId, { order: 'asc' });

  return renderWithPagination(participants)(participantList => (
    <Box
      title="Participants"
      description="People who have contributed to or used this skill."
      rightActions={
        p.shareContext ? (
          <SkillSharePopover
            instanceId={p.instanceId}
            context={p.shareContext}
            onShared={() => participants.refetch()}
            trigger={
              <Button size="2" variant="outline">
                Share
              </Button>
            }
          />
        ) : null
      }
    >
      {participantList.data.items.length === 0 ? (
        <EmptyState>
          <Text color="gray600" size="2">
            No participants found for this skill yet.
          </Text>
        </EmptyState>
      ) : (
        <Items>
          {participantList.data.items.map(participant => (
            <Entity.Wrapper key={participant.id} aligned>
              <Entity.Content>
                <Entity.Field
                  prefix={
                    <Avatar
                      entity={{
                        name: participant.actor.name,
                        imageUrl: participant.actor.imageUrl ?? undefined
                      }}
                      size={32}
                    />
                  }
                  title={participant.actor.name}
                  description={participant.actor.email ?? undefined}
                />

                {/* <Entity.Field
                  title="Type"
                  value={
                    <Badge color="gray" size="1">
                      {actorTypeLabels[participant.actor.type] ?? participant.actor.type}
                    </Badge>
                  }
                /> */}

                <Entity.Field
                  title="Roles"
                  value={
                    <Flex gap={6} style={{ flexWrap: 'wrap' }}>
                      {participant.roles.map(role => (
                        <Badge key={role} color="blue" size="1">
                          {roleLabels[role] ?? role}
                        </Badge>
                      ))}
                    </Flex>
                  }
                />

                <Entity.Field
                  title="Created"
                  value={<RenderDate date={participant.createdAt} />}
                />
              </Entity.Content>
            </Entity.Wrapper>
          ))}
        </Items>
      )}
    </Box>
  ));
};
