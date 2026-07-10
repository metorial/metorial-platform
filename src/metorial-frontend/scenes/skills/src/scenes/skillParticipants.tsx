import { renderWithPagination } from '@metorial/data-hooks';
import { useSkillParticipants } from '@metorial/state';
import { Avatar, Badge, Button, Flex, RenderDate, Text } from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import styled from 'styled-components';
import { SkillSharePopover, type SkillSharePanelContext } from '../components/skillSharePanel';

let EmptyState = styled.div`
  line-height: 1.6;
  padding: 8px 0;
`;

let roleLabels: Record<string, string> = {
  creator: 'Creator',
  editor: 'Editor',
  viewer: 'Viewer',
  user: 'User',
  forker: 'Forker'
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
        <Table
          headers={['Participant', 'Roles', 'Created']}
          data={participantList.data.items.map(participant => [
            <Flex gap="10px" align="center">
              <Avatar
                entity={{
                  name: participant.actor.name,
                  imageUrl: participant.actor.imageUrl ?? undefined
                }}
                size={32}
              />
              <div>
                <Text size="2" weight="strong">
                  {participant.actor.name}
                </Text>
                {participant.actor.email && (
                  <Text size="1" color="gray600">
                    {participant.actor.email}
                  </Text>
                )}
              </div>
            </Flex>,
            <Flex gap={6} style={{ flexWrap: 'wrap' }}>
              {participant.roles.map(role => (
                <Badge key={role} color="blue" size="1">
                  {roleLabels[role] ?? role}
                </Badge>
              ))}
            </Flex>,
            <RenderDate date={participant.createdAt} />
          ])}
        />
      )}
    </Box>
  ));
};
