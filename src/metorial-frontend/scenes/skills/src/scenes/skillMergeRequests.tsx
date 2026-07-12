import { MergeEditor } from '@metorial/code-editor';
import { renderWithLoader, renderWithPagination, useForm } from '@metorial/data-hooks';
import { PageHeader } from '@metorial/layout';
import { Readme } from '@metorial/markdown';
import {
  useBulkResolveSkillMergeRequestItems,
  useCloseSkillMergeRequest,
  useCreateSkillMergeRequest,
  useCreateSkillMergeRequestComment,
  useCurrentOrganization,
  useDeleteSkillMergeRequestComment,
  useFiles,
  usePerformSkillMergeRequest,
  useRollbackSkillMergeRequest,
  useSkill,
  useSkillMergeRequest,
  useSkillMergeRequestEvents,
  useSkillMergeRequestPlan,
  useSkillMergeRequests,
  useStorePermissions,
  useUpdateSkillMergeRequestComment,
  skillMergeRequestLoader,
  type SkillMergeRequestEvent
} from '@metorial/state';
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  Flex,
  Input,
  LargePanelDialog,
  LinkTabs,
  RenderDate,
  Select,
  Text,
  confirm,
  showModal,
  theme,
  toast
} from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import {
  RiArrowDownSLine,
  RiArrowGoBackLine,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiChat3Line,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiErrorWarningLine,
  RiFile3Line,
  RiFileTextLine,
  RiFolderLine,
  RiGitMergeLine,
  RiGitPullRequestLine
} from '@remixicon/react';
import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import {
  getSkillMergeChangeLabel,
  getSkillMergeErrorMessage,
  getSkillMergeItemStatusLabel,
  getSkillMergeResolutionOptions,
  type SkillMergeDirection
} from './skillMergeRequestUtils';

type MergePlan = NonNullable<ReturnType<typeof useSkillMergeRequestPlan>['data']>;
type MergePlanItem = MergePlan['items'][number];
type ResolutionType = NonNullable<MergePlanItem['item']['resolutionType']>;

let Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let MergePanel = styled.section<{ $tone: 'green' | 'blue' | 'orange' | 'gray' | 'red' }>`
  display: grid;
  grid-template-columns: 25px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 15px;
  margin-bottom: 20px;
  border: 1px solid
    ${p =>
      p.$tone == 'green'
        ? theme.colors.green400
        : p.$tone == 'blue'
          ? theme.colors.blue400
          : p.$tone == 'orange'
            ? theme.colors.orange400
            : p.$tone == 'red'
              ? theme.colors.red400
              : theme.colors.gray400};
  border-radius: 10px;
  background: ${p =>
    p.$tone == 'green'
      ? theme.colors.green100
      : p.$tone == 'blue'
        ? theme.colors.blue100
        : p.$tone == 'orange'
          ? theme.colors.orange100
          : p.$tone == 'red'
            ? theme.colors.red100
            : theme.colors.gray100};
`;

let MergePanelIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

let MergePanelCopy = styled.div`
  min-width: 0;

  strong {
    display: block;
    font-size: 13px;
    font-weight: 600;
  }

  span {
    color: ${theme.colors.gray700};
    font-size: 12px;
  }
`;

let Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

let Empty = styled.div`
  text-align: center;
`;

let Status = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
`;

let StatusDot = styled.span<{ $color: string }>`
  width: 10px;
  height: 10px;
  flex: none;
  border-radius: 50%;
  background: ${p => p.$color};
`;

let ReviewShell = styled.div`
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: min(80vh, 820px);
`;

let ReviewHeader = styled.div`
  padding: 22px 24px 16px;
  border-bottom: 1px solid ${theme.colors.gray300};
`;

let ReviewBody = styled.div`
  overflow: auto;
  padding: 18px 24px;
`;

let ReviewFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 24px;
  border-top: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.gray100};
`;

let ChangeCard = styled.div`
  border: 1px solid ${theme.colors.gray400};
  border-radius: 10px;
  overflow: hidden;
`;

let ChangesOverview = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 2px 2px;
`;

let ChangeStats = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
`;

let Additions = styled.span`
  color: ${theme.colors.green900};
`;

let Deletions = styled.span`
  color: ${theme.colors.red900};
`;

let DiffBlocks = styled.span`
  display: grid;
  grid-template-columns: repeat(5, 4px);
  gap: 2px;
`;

let DiffBlock = styled.span<{ $tone: 'green' | 'red' | 'gray' }>`
  width: 4px;
  height: 13px;
  border-radius: 1px;
  background: ${p =>
    p.$tone == 'green'
      ? theme.colors.green800
      : p.$tone == 'red'
        ? theme.colors.red800
        : theme.colors.gray400};
`;

let FileChangeCard = styled.article`
  border: 1px solid ${theme.colors.gray400};
  border-radius: 8px;
  overflow: hidden;
  background: ${theme.colors.background};
`;

let FileChangeHeader = styled.button`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 46px;
  padding: 9px 12px;
  border: 0;
  background: ${theme.colors.gray100};
  color: ${theme.colors.foreground};
  text-align: left;
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease;

  &:hover {
    background: ${theme.colors.gray200};
    color: ${theme.colors.gray900};
    box-shadow: inset 3px 0 0 ${theme.colors.blue700};
  }
`;

let FileIdentity = styled.span`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

let FileChevron = styled.span<{ $open: boolean }>`
  display: flex;
  flex: none;
  color: ${theme.colors.gray700};
  transform: rotate(${p => (p.$open ? '0deg' : '-90deg')});
  transition: transform 120ms ease;
`;

let ChangeKind = styled.span<{ $tone: 'green' | 'red' | 'orange' | 'gray' }>`
  flex: none;
  color: ${p =>
    p.$tone == 'green'
      ? theme.colors.green900
      : p.$tone == 'red'
        ? theme.colors.red900
        : p.$tone == 'orange'
          ? theme.colors.orange900
          : theme.colors.gray700};
  font-size: 12px;
  font-weight: 600;
`;

let FileStatus = styled.span`
  flex: none;
  color: ${theme.colors.gray600};
  font-size: 12px;
`;

let FileChangeBody = styled.div`
  border-top: 1px solid ${theme.colors.gray300};

  > div {
    border: 0;
    border-radius: 0;
  }
`;

let NoDiff = styled.div`
  padding: 15px 20px;
  text-align: center;
  background: ${theme.colors.background};
`;

let ChangeHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 11px 13px;
  background: ${theme.colors.gray100};
  border-bottom: 1px solid ${theme.colors.gray300};
`;

let ChangeBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 13px;
`;

let ResolutionSummary = styled.div`
  padding: 9px 11px;
  border-radius: 7px;
  color: ${theme.colors.gray800};
  background: ${theme.colors.gray200};
  font-size: 12px;
  line-height: 1.45;
`;

let Path = styled.code`
  font-size: 12px;
  overflow-wrap: anywhere;
`;

let DiffPreview = styled.div``;

let DiffLabels = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  border-bottom: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.gray100};

  > div {
    padding: 8px 12px;
    color: ${theme.colors.gray700};
    font-size: 12px;
    font-weight: 600;
  }

  > div + div {
    border-left: 1px solid ${theme.colors.gray300};
  }
`;

let Discussion = styled.div`
  display: flex;
  flex-direction: column;
`;

let Timeline = styled.div`
  display: flex;
  flex-direction: column;
`;

let TimelineRow = styled.div`
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 10px;
  position: relative;
  padding-bottom: 26px;

  &:not(:last-child)::before {
    content: '';
    position: absolute;
    top: 30px;
    bottom: 0;
    left: 16px;
    width: 2px;
    background: ${theme.colors.gray300};
  }
`;

let TimelineIcon = styled.div<{ $color?: string }>`
  position: relative;
  z-index: 1;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid ${theme.colors.gray400};
  color: ${p => p.$color ?? theme.colors.gray700};
  background: ${theme.colors.gray100};
`;

let LifecycleContent = styled.div`
  min-height: 32px;
  display: flex;
  align-items: center;
  width: 100%;

  > div {
    width: 100%;
  }
`;

let TimelineMeta = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
`;

let CommentMeta = styled(TimelineMeta)`
  margin-bottom: 5px;
  margin-top: 6px;
`;

let CommentCard = styled.div`
  position: relative;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 10px;
  background: ${theme.colors.background};

  &:hover [data-comment-actions],
  &:focus-within [data-comment-actions] {
    opacity: 1;
    pointer-events: auto;
  }
`;

let CommentActions = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
`;

let CommentBody = styled.div`
  padding: 15px 20px;
  font-size: 13px;
  line-height: 1.55;

  > :first-child {
    margin-top: 0;
  }

  > :last-child {
    margin-bottom: 0;
  }

  pre {
    overflow: auto;
    padding: 10px;
    border-radius: 7px;
    background: ${theme.colors.gray200};
  }

  code {
    overflow-wrap: anywhere;
  }
`;

let DeletedComment = styled.div`
  padding: 14px;
  color: ${theme.colors.gray600};
  font-size: 13px;
  font-style: italic;
`;

let EventError = styled.div`
  margin-top: 8px;
  padding: 9px 11px;
  border: 1px solid ${theme.colors.red400};
  border-radius: 7px;
  color: ${theme.colors.red900};
  background: ${theme.colors.red100};
  font-size: 12px;
  white-space: pre-wrap;
`;

let Composer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let statusColor = (status: string): 'gray' | 'blue' | 'green' | 'orange' | 'red' => {
  if (status == 'merged') return 'green';
  if (status == 'merging') return 'blue';
  if (status == 'open') return 'orange';
  return 'gray';
};

let statusLabel = (status: string) =>
  ({ open: 'Open', closed: 'Closed', merging: 'Merging', merged: 'Merged' })[status] ?? status;

let statusDotColor = (status: string) => {
  if (status == 'merged') return theme.colors.green900;
  if (status == 'merging') return theme.colors.blue900;
  if (status == 'open') return theme.colors.orange900;
  return theme.colors.gray600;
};

type EventActor = NonNullable<SkillMergeRequestEvent['actor']>;

let actorName = (actor: EventActor | null | undefined) => actor?.name || 'Metorial';

let EventActor = ({ actor, size = 24 }: { actor: EventActor | null; size?: number }) => (
  <Flex align="center" gap="7px">
    <Avatar
      entity={
        actor
          ? { name: actorName(actor), imageUrl: actor.imageUrl }
          : {
              name: 'Metorial',
              imageUrl:
                'https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg'
            }
      }
      size={size}
      noTooltip
      radius={actor ? undefined : 1}
      imageFit="contain"
    />
    <Text size="2" weight="strong">
      {actorName(actor)}
    </Text>
  </Flex>
);

let eventCopy = (event: SkillMergeRequestEvent) => {
  switch (event.type) {
    case 'created':
      return 'opened this merge request';
    case 'commented':
      return 'commented';
    case 'all_conflicts_resolved':
      return 'resolved all conflicts';
    case 'merge_started':
      return 'started merging changes';
    case 'merge_completed':
      return 'merged changes';
    case 'merge_failed':
      return 'could not merge changes';
    case 'closed':
      return 'closed this merge request';
    case 'rolled_back':
      return 'rolled back this merge';
  }
};

let EventTypeIcon = ({ type }: { type: SkillMergeRequestEvent['type'] }) => {
  if (type == 'commented') return <RiChat3Line size="16px" />;
  if (type == 'created') return <RiGitPullRequestLine size="16px" />;
  if (type == 'all_conflicts_resolved') return <RiCheckboxCircleLine size="16px" />;
  if (type == 'merge_started' || type == 'merge_completed')
    return <RiGitMergeLine size="16px" />;
  if (type == 'merge_failed') return <RiErrorWarningLine size="16px" />;
  if (type == 'rolled_back') return <RiArrowGoBackLine size="16px" />;
  return <RiCloseCircleLine size="16px" />;
};

let eventColor = (type: SkillMergeRequestEvent['type']) => {
  if (type == 'merge_completed' || type == 'all_conflicts_resolved')
    return theme.colors.green900;
  if (type == 'merge_failed') return theme.colors.red900;
  if (type == 'merge_started') return theme.colors.blue900;
  return theme.colors.gray700;
};

let resolutionCopy = (resolution: ResolutionType | '', direction: SkillMergeDirection) => {
  let source = direction == 'upstream_to_fork' ? 'upstream' : 'fork';
  let target = direction == 'upstream_to_fork' ? 'fork' : 'upstream';

  if (resolution == 'accept_source') {
    return `Use the ${source} version and replace the current ${target} version.`;
  }
  if (resolution == 'keep_target') {
    return `Keep the current ${target} version and ignore this proposed change.`;
  }
  if (resolution == 'edit_document') {
    return `Create the final document by editing the proposed result before merging.`;
  }
  if (resolution == 'replace_file') {
    return `Choose another readable file as the final ${target} version.`;
  }
  if (resolution == 'remove') return `Remove this item from the ${target}.`;
  if (resolution == 'skip') return 'Leave this item unchanged and continue with the merge.';
  return '';
};

let CreateMergeRequestDialog = ({
  instanceId,
  sourceSkillId,
  close,
  dialogProps,
  onCreated
}: {
  instanceId: string;
  sourceSkillId: string;
  close: () => void;
  dialogProps: any;
  onCreated: (mergeRequestId: string) => void;
}) => {
  let create = useCreateSkillMergeRequest();
  let form = useForm({
    initialValues: { title: '', description: '' },
    schema: yup =>
      yup.object({
        title: yup.string().trim().required('Add a title'),
        description: yup.string().ensure()
      }),
    onSubmit: async values => {
      let [mergeRequest, error] = await create.mutate({
        instanceId,
        sourceSkillId,
        title: values.title.trim(),
        description: values.description.trim() || undefined
      });
      if (error || !mergeRequest) return;
      close();
      onCreated(mergeRequest.id);
    }
  });

  return (
    <Dialog.Wrapper {...dialogProps} width={520}>
      <Dialog.Title>Open a merge request</Dialog.Title>
      <Dialog.Description>
        Propose the changes in this fork to its upstream skill.
      </Dialog.Description>
      <form onSubmit={form.handleSubmit}>
        <Stack>
          <Input label="Title" autoFocus {...form.getFieldProps('title')} />
          <form.RenderError field="title" />
          <Input
            as="textarea"
            minRows={4}
            label="Description"
            placeholder="What changed?"
            {...form.getFieldProps('description')}
          />
          <create.RenderError />
          <Dialog.Actions>
            <Button type="button" variant="soft" color="gray" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isLoading}>
              Create
            </Button>
          </Dialog.Actions>
        </Stack>
      </form>
    </Dialog.Wrapper>
  );
};

export let showCreateSkillMergeRequestModal = (p: {
  instanceId: string;
  sourceSkillId: string;
  onCreated: (mergeRequestId: string) => void;
}) =>
  showModal(({ close, dialogProps }) => (
    <CreateMergeRequestDialog {...p} close={close} dialogProps={dialogProps} />
  ));

let SkillMergeRequestsIncoming = (p: {
  loader: ReturnType<typeof useSkillMergeRequests>;
  outgoing: any;
  href: (mergeRequestId: string) => string;
  skillId: string | null | undefined;
}) =>
  renderWithPagination(p.loader)(incomingList => {
    let requests = [...p.outgoing.data.items, ...incomingList.data.items]
      .filter((request, index, all) => all.findIndex(i => i.id == request.id) == index)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (!requests.length) {
      return (
        <Empty>
          <Text color="gray600" size="2">
            No merge requests yet.
          </Text>
        </Empty>
      );
    }

    return (
      <Table
        headers={['Title', 'Status', 'Created']}
        data={requests.map(request => ({
          href: p.href(request.id),
          data: [
            <Flex gap="8px" align="center">
              {request.sourceSkillId == p.skillId ? (
                <RiArrowRightLine size="14px" aria-label="Outgoing merge request" />
              ) : (
                <RiArrowLeftLine size="14px" aria-label="Incoming merge request" />
              )}
              <Text size="2" weight="strong">
                {request.title}
              </Text>
            </Flex>,
            <Status>
              <StatusDot
                $color={statusDotColor(request.status)}
                aria-label={statusLabel(request.status)}
                title={statusLabel(request.status)}
              />
              <Text size="2">{statusLabel(request.status)}</Text>
            </Status>,
            <RenderDate date={request.createdAt} />
          ]
        }))}
      />
    );
  });

let SkillMergeRequestsPagination = (p: {
  outgoing: ReturnType<typeof useSkillMergeRequests>;
  incoming: ReturnType<typeof useSkillMergeRequests>;
  href: (mergeRequestId: string) => string;
  skillId: string | null | undefined;
}) =>
  renderWithPagination(p.outgoing)(outgoingList => (
    <SkillMergeRequestsIncoming
      loader={p.incoming}
      outgoing={outgoingList}
      href={p.href}
      skillId={p.skillId}
    />
  ));

export let SkillMergeRequestsScene = (p: {
  instanceId: string | null | undefined;
  skillId: string | null | undefined;
  href: (mergeRequestId: string) => string;
}) => {
  let [status, setStatus] = useState('all');
  let query =
    status == 'all' ? {} : { status: status as 'open' | 'closed' | 'merging' | 'merged' };
  let outgoing = useSkillMergeRequests(
    p.instanceId,
    p.skillId ? { sourceSkillId: p.skillId, order: 'desc', ...query } : null
  );
  let incoming = useSkillMergeRequests(
    p.instanceId,
    p.skillId ? { targetSkillId: p.skillId, order: 'desc', ...query } : null
  );

  return (
    <>
      <PageHeader
        size="6"
        title="Merge requests"
        description="Review changes proposed between this skill and its forks."
        actions={
          <Select
            hideLabel
            label="Status"
            size="2"
            value={status}
            onChange={setStatus}
            items={[
              { id: 'all', label: 'All' },
              { id: 'open', label: 'Open' },
              { id: 'merging', label: 'Merging' },
              { id: 'merged', label: 'Merged' },
              { id: 'closed', label: 'Closed' }
            ]}
          />
        }
      />
      <SkillMergeRequestsPagination
        outgoing={outgoing}
        incoming={incoming}
        href={p.href}
        skillId={p.skillId}
      />
    </>
  );
};

let DocumentPreview = ({
  entry,
  direction
}: {
  entry: MergePlanItem;
  direction: SkillMergeDirection;
}) => {
  if (!entry.documentMerge) return null;
  let targetLabel = direction == 'upstream_to_fork' ? 'Fork' : 'Upstream';
  let sourceLabel = direction == 'upstream_to_fork' ? 'Upstream' : 'Fork';

  return (
    <DiffPreview>
      <DiffLabels>
        <div>{targetLabel}</div>
        <div>{sourceLabel}</div>
      </DiffLabels>
      <MergeEditor
        key={entry.item.id}
        original={entry.documentMerge.targetContent ?? ''}
        value={entry.documentMerge.sourceContent ?? ''}
        readOnly
      />
    </DiffPreview>
  );
};

type LineStats = { additions: number; deletions: number };

let contentLines = (content: string) => {
  if (!content) return [];
  let lines = content.replace(/\r\n/g, '\n').split('\n');
  if (lines[lines.length - 1] == '') lines.pop();
  return lines;
};

let getLineStats = (entry: MergePlanItem): LineStats => {
  if (!entry.documentMerge) {
    if (entry.item.changeType == 'added') return { additions: 1, deletions: 0 };
    if (entry.item.changeType == 'removed') return { additions: 0, deletions: 1 };
    if (entry.item.changeType == 'unchanged') return { additions: 0, deletions: 0 };
    return { additions: 1, deletions: 1 };
  }

  let before = contentLines(entry.documentMerge.targetContent ?? '');
  let after = contentLines(entry.documentMerge.sourceContent ?? '');
  if (before.length == after.length && before.every((line, index) => line == after[index])) {
    return { additions: 0, deletions: 0 };
  }

  // Keep the browser responsive for unusually large documents. The fallback still
  // produces useful review statistics without constructing a large diff matrix.
  if (before.length * after.length > 250_000) {
    let prefix = 0;
    while (
      prefix < before.length &&
      prefix < after.length &&
      before[prefix] == after[prefix]
    ) {
      prefix++;
    }
    let suffix = 0;
    while (
      suffix < before.length - prefix &&
      suffix < after.length - prefix &&
      before[before.length - suffix - 1] == after[after.length - suffix - 1]
    ) {
      suffix++;
    }
    return {
      additions: Math.max(0, after.length - prefix - suffix),
      deletions: Math.max(0, before.length - prefix - suffix)
    };
  }

  let previous = new Array(after.length + 1).fill(0);
  for (let beforeIndex = 1; beforeIndex <= before.length; beforeIndex++) {
    let current = new Array(after.length + 1).fill(0);
    for (let afterIndex = 1; afterIndex <= after.length; afterIndex++) {
      current[afterIndex] =
        before[beforeIndex - 1] == after[afterIndex - 1]
          ? previous[afterIndex - 1] + 1
          : Math.max(previous[afterIndex], current[afterIndex - 1]);
    }
    previous = current;
  }

  let unchanged = previous[after.length];
  return {
    additions: after.length - unchanged,
    deletions: before.length - unchanged
  };
};

let DiffStats = ({ additions, deletions }: LineStats) => {
  let total = additions + deletions;
  let greenBlocks =
    !total || !additions
      ? 0
      : !deletions
        ? 5
        : Math.min(4, Math.max(1, Math.round((additions / total) * 5)));
  let redBlocks = !total || !deletions ? 0 : 5 - greenBlocks;

  return (
    <ChangeStats aria-label={`${additions} additions and ${deletions} deletions`}>
      <Additions>+{additions}</Additions>
      <Deletions>−{deletions}</Deletions>
      <DiffBlocks aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <DiffBlock
            key={index}
            $tone={
              index < greenBlocks ? 'green' : index < greenBlocks + redBlocks ? 'red' : 'gray'
            }
          />
        ))}
      </DiffBlocks>
    </ChangeStats>
  );
};

let changeTone = (
  changeType: MergePlanItem['item']['changeType']
): 'green' | 'red' | 'orange' | 'gray' => {
  if (changeType == 'added') return 'green';
  if (changeType == 'removed' || changeType == 'conflicted') return 'red';
  if (changeType == 'modified') return 'orange';
  return 'gray';
};

let ChangeFileIcon = ({ kind }: { kind: MergePlanItem['item']['kind'] }) => {
  if (kind == 'document') return <RiFileTextLine size={16} />;
  if (kind == 'directory') return <RiFolderLine size={16} />;
  return <RiFile3Line size={16} />;
};

let CollapsibleChange = ({
  entry,
  direction
}: {
  entry: MergePlanItem;
  direction: SkillMergeDirection;
}) => {
  let [open, setOpen] = useState(true);
  let stats = getLineStats(entry);
  let item = entry.item;

  return (
    <FileChangeCard>
      <FileChangeHeader
        type="button"
        aria-expanded={open}
        aria-label={`${open ? 'Collapse' : 'Expand'} changes for ${item.path}`}
        onClick={() => setOpen(current => !current)}
      >
        <FileIdentity>
          <FileChevron $open={open}>
            <RiArrowDownSLine size={17} />
          </FileChevron>
          <ChangeFileIcon kind={item.kind} />
          <Path>{item.path}</Path>
          <ChangeKind $tone={changeTone(item.changeType)}>
            {getSkillMergeChangeLabel(item.changeType, direction)}
          </ChangeKind>
          <FileStatus>· {getSkillMergeItemStatusLabel(item, direction)}</FileStatus>
        </FileIdentity>
        <DiffStats {...stats} />
      </FileChangeHeader>
      {open && (
        <FileChangeBody>
          {entry.documentMerge ? (
            <DocumentPreview entry={entry} direction={direction} />
          ) : (
            <NoDiff>
              <Text color="gray600" size="2">
                A text diff is not available for this {item.kind}.
              </Text>
            </NoDiff>
          )}
        </FileChangeBody>
      )}
    </FileChangeCard>
  );
};

let ReplacementFileSelect = (p: {
  files: ReturnType<typeof useFiles>;
  value: string;
  onChange: (value: string) => void;
}) =>
  renderWithPagination(p.files)(fileList => (
    <Select
      label="Replacement file"
      placeholder="Choose a readable file"
      value={p.value || undefined}
      items={fileList.data.items.map(file => ({
        id: file.id,
        label: file.title
      }))}
      onChange={p.onChange}
    />
  ));

let MergeReviewDialog = ({
  instanceId,
  plan,
  readableStoreIds,
  close,
  dialogProps,
  onSubmitted
}: {
  instanceId: string;
  plan: MergePlan;
  readableStoreIds: string[];
  close: () => void;
  dialogProps: any;
  onSubmitted: () => Promise<void> | void;
}) => {
  let bulkResolve = useBulkResolveSkillMergeRequestItems();
  let perform = usePerformSkillMergeRequest();
  let files = useFiles(instanceId, {
    order: 'desc',
    limit: 100,
    storeId: readableStoreIds
  });
  let [choices, setChoices] = useState<Record<string, ResolutionType | ''>>(() =>
    Object.fromEntries(
      plan.items.map(entry => [entry.item.id, entry.item.resolutionType ?? ''])
    )
  );
  let [contents, setContents] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      plan.items.map(entry => [
        entry.item.id,
        typeof entry.item.resolution?.content == 'string'
          ? entry.item.resolution.content
          : (entry.documentMerge?.sourceContent ?? entry.documentMerge?.targetContent ?? '')
      ])
    )
  );
  let [replacementFiles, setReplacementFiles] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      plan.items.map(entry => [
        entry.item.id,
        typeof entry.item.resolution?.fileId == 'string' ? entry.item.resolution.fileId : ''
      ])
    )
  );
  let direction = plan.mergeRequest.direction;
  let targetLabel = direction == 'upstream_to_fork' ? 'fork' : 'upstream';

  let actionable = plan.items.filter(entry => entry.item.status != 'applied');
  let unresolved = actionable.filter(entry => !choices[entry.item.id]);
  let invalid = actionable.some(entry => {
    let choice = choices[entry.item.id];
    if (choice == 'edit_document') return contents[entry.item.id] == null;
    if (choice == 'replace_file') return !replacementFiles[entry.item.id];
    return !choice;
  });

  let submit = async () => {
    let items = actionable.map(entry => {
      let resolutionType = choices[entry.item.id] as ResolutionType;
      let resolution =
        resolutionType == 'edit_document'
          ? {
              content: contents[entry.item.id],
              title: entry.source?.documentTitle ?? entry.target?.documentTitle ?? undefined
            }
          : resolutionType == 'replace_file'
            ? { fileId: replacementFiles[entry.item.id] }
            : undefined;
      return { itemId: entry.item.id, resolutionType, resolution };
    });

    let [, resolveError] = await bulkResolve.mutate({
      instanceId,
      skillMergeRequestId: plan.mergeRequest.id,
      items
    });
    if (resolveError) return;

    toast.promise(
      async () => {
        let [, performError] = await perform.mutate({
          instanceId,
          skillMergeRequestId: plan.mergeRequest.id
        });
        if (performError) throw performError;

        close();
        await onSubmitted();
      },
      {
        loading: 'Merging changes...',
        success: 'Changes merged successfully',
        error: 'Failed to merge changes'
      }
    );
  };

  return (
    <LargePanelDialog.Wrapper {...dialogProps}>
      <ReviewShell>
        <ReviewHeader>
          <Flex justify="space-between" align="center" gap="16px">
            <div>
              <Text size="4" weight="strong">
                Review merge
              </Text>
              <div>
                <Text size="2" color="gray600">
                  Choose the result for each change.
                </Text>
              </div>
            </div>
            <Badge color={unresolved.length ? 'orange' : 'green'}>
              {unresolved.length ? `${unresolved.length} unresolved` : 'Ready'}
            </Badge>
          </Flex>
        </ReviewHeader>
        <ReviewBody>
          <Stack>
            {plan.items.map(entry => {
              let item = entry.item;
              let choice = choices[item.id];
              return (
                <ChangeCard key={item.id}>
                  <ChangeHeader>
                    <Flex align="center" gap="8px">
                      <Badge color={item.changeType == 'conflicted' ? 'red' : 'gray'}>
                        {getSkillMergeChangeLabel(item.changeType, direction)}
                      </Badge>
                      <Path>{item.path}</Path>
                    </Flex>
                    {item.status == 'applied' ? (
                      <Badge color="green">Applied</Badge>
                    ) : (
                      <div style={{ width: 190 }}>
                        <Select
                          hideLabel
                          label={`Resolution for ${item.path}`}
                          size="2"
                          value={choice || undefined}
                          placeholder="Choose result"
                          items={getSkillMergeResolutionOptions(entry, direction)}
                          onChange={value =>
                            setChoices(current => ({
                              ...current,
                              [item.id]: value as ResolutionType
                            }))
                          }
                        />
                      </div>
                    )}
                  </ChangeHeader>
                  {(entry.documentMerge || choice) && (
                    <ChangeBody>
                      {choice && (
                        <ResolutionSummary>
                          {resolutionCopy(choice, direction)}
                        </ResolutionSummary>
                      )}
                      {choice == 'edit_document' ? (
                        <MergeEditor
                          original={entry.documentMerge?.targetContent ?? ''}
                          value={contents[item.id] ?? ''}
                          onChange={value =>
                            setContents(current => ({ ...current, [item.id]: value }))
                          }
                          height="440px"
                        />
                      ) : entry.documentMerge ? (
                        <DocumentPreview entry={entry} direction={direction} />
                      ) : null}
                      {choice == 'replace_file' && (
                        <>
                          <Text size="2" color="gray700">
                            Select the file that should replace the current {targetLabel}{' '}
                            version.
                          </Text>
                          <ReplacementFileSelect
                            files={files}
                            value={replacementFiles[item.id] ?? ''}
                            onChange={value =>
                              setReplacementFiles(current => ({
                                ...current,
                                [item.id]: value
                              }))
                            }
                          />
                        </>
                      )}
                    </ChangeBody>
                  )}
                </ChangeCard>
              );
            })}
            <bulkResolve.RenderError />
            <perform.RenderError />
          </Stack>
        </ReviewBody>
        <ReviewFooter>
          <Text size="2" color="gray600">
            The {targetLabel} is checked again before changes are applied.
          </Text>
          <Flex gap="8px">
            <Button variant="soft" color="gray" onClick={close}>
              Cancel
            </Button>
            <Button
              disabled={invalid}
              loading={bulkResolve.isLoading || perform.isLoading}
              onClick={submit}
            >
              Merge Changes
            </Button>
          </Flex>
        </ReviewFooter>
      </ReviewShell>
    </LargePanelDialog.Wrapper>
  );
};

export let SkillMergeRequestScene = (p: {
  instanceId: string | null | undefined;
  mergeRequestId: string | null | undefined;
  tab?: 'conversation' | 'changes';
  conversationHref?: string;
  changesHref?: string;
  onMerged?: (targetSkillId: string) => void;
  readOnly?: boolean;
}) => {
  let mergeRequest = useSkillMergeRequest(p.instanceId, p.mergeRequestId);
  let plan = useSkillMergeRequestPlan(p.instanceId, p.mergeRequestId);
  let targetSkill = useSkill(p.instanceId, mergeRequest.data?.targetSkillId);
  let targetPermissions = useStorePermissions(p.instanceId, targetSkill.data?.storeId);
  let events = useSkillMergeRequestEvents(p.instanceId, p.mergeRequestId, {
    order: 'asc'
  });
  let createComment = useCreateSkillMergeRequestComment();
  let updateComment = useUpdateSkillMergeRequestComment();
  let deleteComment = useDeleteSkillMergeRequestComment();
  let closeRequest = useCloseSkillMergeRequest();
  let rollback = useRollbackSkillMergeRequest();
  let currentOrganization = useCurrentOrganization();
  let currentActorId = currentOrganization.data?.member?.actor.id;
  let isOrganizationMember = !!currentOrganization.data?.member;
  let previousStatus = useRef<string | undefined>(undefined);
  let [commentBody, setCommentBody] = useState('');
  let [editingComment, setEditingComment] = useState<{
    id: string;
    body: string;
  } | null>(null);
  let [commentTarget, setCommentTarget] = useState<{
    itemId?: string;
    path?: string | null;
    replyToCommentId?: string;
  } | null>(null);

  useEffect(() => {
    if (mergeRequest.data?.status != 'merging') return;
    let timer = window.setInterval(() => {
      mergeRequest.refetch();
      plan.refetch();
      events.refetch();
    }, 1800);
    return () => window.clearInterval(timer);
  }, [mergeRequest.data?.status]);

  useEffect(() => {
    let status = mergeRequest.data?.status;
    let targetSkillId = mergeRequest.data?.targetSkillId;
    let transitionedToMerged = previousStatus.current === 'merging' && status === 'merged';
    previousStatus.current = status;
    if (!transitionedToMerged || !targetSkillId) return;

    void Promise.resolve(targetSkill.refetch()).finally(() => {
      p.onMerged?.(targetSkillId);
    });
  }, [mergeRequest.data?.status, mergeRequest.data?.targetSkillId]);

  let addComment = async () => {
    let body = commentBody.trim();
    if (!p.instanceId || !p.mergeRequestId || !body) return;
    let [, error] = await createComment.mutate({
      instanceId: p.instanceId,
      skillMergeRequestId: p.mergeRequestId,
      itemId: commentTarget?.itemId,
      path: commentTarget?.path,
      inReplyToCommentId: commentTarget?.replyToCommentId,
      body
    });
    if (!error) {
      setCommentBody('');
      setCommentTarget(null);
      events.refetch();
    }
  };

  return renderWithLoader({ mergeRequest, plan })(({ mergeRequest, plan }) => {
    let request = mergeRequest.data;
    let direction = request.direction;
    let targetLabel = direction == 'upstream_to_fork' ? 'fork' : 'upstream';
    let sourceLabel = direction == 'upstream_to_fork' ? 'upstream' : 'fork';
    let canWriteTarget =
      !p.readOnly &&
      (targetPermissions.data?.hasFullAccess ||
        targetPermissions.data?.permissions.includes('content_write'));
    let unresolved = plan.data.items.filter(entry => entry.item.status == 'unresolved').length;
    let visibleChangeItems = plan.data.items.filter(entry => entry.item.kind != 'directory');
    let totalStats = visibleChangeItems.reduce(
      (total, entry) => {
        let stats = getLineStats(entry);
        return {
          additions: total.additions + stats.additions,
          deletions: total.deletions + stats.deletions
        };
      },
      { additions: 0, deletions: 0 }
    );
    let openReview = () => {
      if (!p.instanceId) return;
      showModal(({ close, dialogProps }) => (
        <MergeReviewDialog
          instanceId={p.instanceId!}
          plan={plan.data}
          readableStoreIds={targetPermissions.data?.readableStoreIds ?? []}
          close={close}
          dialogProps={dialogProps}
          onSubmitted={async () => {
            while (true) {
              let updatedRequest = await skillMergeRequestLoader.fetchAndReturn(
                {
                  instanceId: p.instanceId!,
                  skillMergeRequestId: p.mergeRequestId!
                },
                { force: true }
              );

              if (updatedRequest.status == 'merged') break;
              if (updatedRequest.mergeError || updatedRequest.status == 'closed') {
                throw new Error('The merge could not be completed');
              }

              await new Promise(resolve => window.setTimeout(resolve, 1800));
            }

            mergeRequest.refetch();
            plan.refetch();
            events.refetch();
          }}
        />
      ));
    };

    let closeMergeRequest = () =>
      confirm({
        title: 'Close merge request?',
        description: 'The proposed changes will not be applied.',
        confirmText: 'Close request',
        onConfirm: async () => {
          if (!p.instanceId || !p.mergeRequestId) return;
          let [, error] = await closeRequest.mutate({
            instanceId: p.instanceId,
            skillMergeRequestId: p.mergeRequestId
          });
          if (!error) {
            mergeRequest.refetch();
            events.refetch();
          }
        }
      });

    let rollbackMerge = () =>
      confirm({
        title: 'Roll back this merge?',
        description: `The ${targetLabel} skill will return to its state before this merge.`,
        confirmText: 'Roll back',
        onConfirm: async () => {
          if (!p.instanceId || !p.mergeRequestId) return;
          let [, error] = await rollback.mutate({
            instanceId: p.instanceId,
            skillMergeRequestId: p.mergeRequestId
          });
          if (!error) {
            mergeRequest.refetch();
            plan.refetch();
            events.refetch();
          }
        }
      });

    let panelTone: 'green' | 'blue' | 'orange' | 'gray' | 'red' = request.mergeError
      ? 'red'
      : request.status == 'merged' && !request.rolledBackAt
        ? 'green'
        : request.status == 'merging'
          ? 'blue'
          : request.status == 'open'
            ? unresolved
              ? 'orange'
              : 'green'
            : 'gray';
    let panelTitle = request.mergeError
      ? 'This merge needs attention'
      : request.rolledBackAt
        ? 'This merge was rolled back'
        : request.status == 'merged'
          ? 'Changes merged successfully'
          : request.status == 'merging'
            ? 'Applying changes'
            : request.status == 'closed'
              ? 'This merge request is closed'
              : unresolved
                ? `${unresolved} ${unresolved == 1 ? 'conflict needs' : 'conflicts need'} review`
                : 'This request is ready to merge';
    let panelCopy = request.mergeError
      ? getSkillMergeErrorMessage(request.mergeErrorCode, direction)
      : request.rolledBackAt
        ? `The ${targetLabel} was restored to its state before this merge.`
        : request.status == 'merged'
          ? `The proposed changes are now part of the ${targetLabel}.`
          : request.status == 'merging'
            ? `The ${targetLabel} is being updated. This page will refresh automatically.`
            : request.status == 'closed'
              ? 'No changes from this request were applied.'
              : !canWriteTarget
                ? `You can review this request, but you do not have permission to update the ${targetLabel}.`
                : unresolved
                  ? 'Review each conflict and choose the version that should be kept.'
                  : `The changes can be applied to the ${targetLabel}.`;
    let mergePanel = (
      <MergePanel $tone={panelTone}>
        <MergePanelIcon>
          {request.mergeError ? (
            <RiErrorWarningLine size={20} />
          ) : request.status == 'merged' ? (
            <RiCheckboxCircleLine size={20} />
          ) : (
            <RiGitMergeLine size={20} />
          )}
        </MergePanelIcon>
        <MergePanelCopy>
          <strong>{panelTitle}</strong>
          <span>{panelCopy}</span>
        </MergePanelCopy>
        <Flex gap="8px" align="center">
          {request.status == 'open' && canWriteTarget && (
            <Button
              size="2"
              onClick={openReview}
              menu={
                request.status == 'open'
                  ? [{ label: 'Close merge request', onClick: closeMergeRequest }]
                  : request.status == 'merged' && !request.rolledBackAt && canWriteTarget
                    ? [
                        {
                          label: 'Roll back merge',
                          onClick: rollbackMerge
                        }
                      ]
                    : []
              }
            >
              {unresolved ? 'Resolve Conflicts' : 'Merge Changes'}
            </Button>
          )}
        </Flex>
      </MergePanel>
    );

    return (
      <>
        <PageHeader
          size="6"
          title={request.title}
          description={request.description}
          actions={
            <Badge color={statusColor(request.status)}>{statusLabel(request.status)}</Badge>
          }
        />

        {p.conversationHref && p.changesHref && (
          <LinkTabs
            current={p.tab == 'changes' ? p.changesHref : p.conversationHref}
            links={[
              { to: p.conversationHref, label: 'Conversation' },
              { to: p.changesHref, label: 'Changes' }
            ]}
          />
        )}

        <Stack>
          {mergePanel}
          <closeRequest.RenderError />
          <rollback.RenderError />

          {p.tab == 'changes' && (
            <Section>
              {visibleChangeItems.length ? (
                <>
                  <ChangesOverview>
                    <Text size="2" weight="strong">
                      {visibleChangeItems.length}{' '}
                      {visibleChangeItems.length == 1 ? 'file' : 'files'} changed
                    </Text>
                    <DiffStats {...totalStats} />
                  </ChangesOverview>
                  <Stack>
                    {visibleChangeItems.map(entry => (
                      <CollapsibleChange
                        key={entry.item.id}
                        entry={entry}
                        direction={direction}
                      />
                    ))}
                  </Stack>
                </>
              ) : (
                <Empty>
                  <Text color="gray600" size="2">
                    This request does not contain any changes.
                  </Text>
                </Empty>
              )}
            </Section>
          )}

          {p.tab != 'changes' && (
            <Section>
              <Discussion>
                {renderWithLoader({ events })(({ events }) => (
                  <>
                    <Timeline>
                      {!events.data.length && (
                        <Empty>
                          <Text color="gray600" size="2">
                            No activity yet.
                          </Text>
                        </Empty>
                      )}
                      {events.data.map(event => {
                        let comment = event.comment;
                        let eventActor = comment?.actor ?? event.actor;
                        let ownsComment =
                          comment?.actor.organizationActor?.id === currentActorId;
                        let canManageComment = isOrganizationMember || ownsComment;
                        return (
                          <TimelineRow
                            key={event.id}
                            style={
                              comment?.inReplyToCommentId ? { paddingLeft: 20 } : undefined
                            }
                          >
                            <TimelineIcon $color={eventColor(event.type)}>
                              {event.type == 'commented' && comment ? (
                                <Avatar
                                  entity={
                                    comment.actor
                                      ? {
                                          name: actorName(comment.actor),
                                          imageUrl: comment.actor.imageUrl
                                        }
                                      : null
                                  }
                                  size={30}
                                  noTooltip
                                />
                              ) : (
                                <EventTypeIcon type={event.type} />
                              )}
                            </TimelineIcon>
                            {event.type == 'commented' && comment ? (
                              <div>
                                <CommentMeta>
                                  <Flex align="center" gap="8px" wrap="wrap">
                                    <Text size="2" weight="strong">
                                      {actorName(comment.actor)}
                                    </Text>
                                    {comment.inReplyToCommentId && (
                                      <Badge color="gray">Reply</Badge>
                                    )}
                                    {comment.path && <Path>{comment.path}</Path>}
                                  </Flex>
                                  <Text size="1" color="gray600">
                                    <RenderDate date={event.createdAt} />
                                  </Text>
                                </CommentMeta>
                                <CommentCard>
                                  {!p.readOnly && !comment.deletedAt && (
                                    <CommentActions data-comment-actions>
                                      <Button
                                        size="1"
                                        variant="soft"
                                        color="gray"
                                        onClick={() => {
                                          setCommentTarget({
                                            itemId:
                                              comment.skillMergeRequestItemId ?? undefined,
                                            path: comment.path,
                                            replyToCommentId: comment.id
                                          });
                                          window.setTimeout(
                                            () =>
                                              document
                                                .getElementById('skill-merge-comment')
                                                ?.focus(),
                                            0
                                          );
                                        }}
                                        menu={
                                          canManageComment
                                            ? [
                                                {
                                                  label: 'Edit comment',
                                                  onClick: () =>
                                                    setEditingComment({
                                                      id: comment.id,
                                                      body: comment.body
                                                    })
                                                },
                                                {
                                                  label: 'Delete comment',
                                                  onClick: () =>
                                                    confirm({
                                                      title: 'Delete comment?',
                                                      description:
                                                        'The timeline entry will remain, but its content will be hidden.',
                                                      confirmText: 'Delete',
                                                      onConfirm: async () => {
                                                        if (!p.instanceId || !p.mergeRequestId)
                                                          return;
                                                        let [, error] =
                                                          await deleteComment.mutate({
                                                            instanceId: p.instanceId,
                                                            skillMergeRequestId:
                                                              p.mergeRequestId,
                                                            commentId: comment.id
                                                          });
                                                        if (!error) events.refetch();
                                                      }
                                                    })
                                                }
                                              ]
                                            : undefined
                                        }
                                      >
                                        Reply
                                      </Button>
                                    </CommentActions>
                                  )}
                                  {comment.deletedAt ? (
                                    <DeletedComment>This comment was deleted.</DeletedComment>
                                  ) : editingComment?.id == comment.id ? (
                                    <CommentBody>
                                      <Input
                                        as="textarea"
                                        minRows={3}
                                        label="Edit comment"
                                        hideLabel
                                        value={editingComment?.body ?? ''}
                                        onInput={body =>
                                          setEditingComment(current =>
                                            current ? { ...current, body } : current
                                          )
                                        }
                                      />
                                      <Flex justify="end" gap="6px" style={{ marginTop: 8 }}>
                                        <Button
                                          size="1"
                                          variant="soft"
                                          color="gray"
                                          onClick={() => setEditingComment(null)}
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          size="1"
                                          loading={updateComment.isLoading}
                                          disabled={!editingComment?.body.trim()}
                                          onClick={async () => {
                                            if (!p.instanceId || !p.mergeRequestId) return;
                                            let [, error] = await updateComment.mutate({
                                              instanceId: p.instanceId,
                                              skillMergeRequestId: p.mergeRequestId,
                                              commentId: comment.id,
                                              body: editingComment?.body.trim() ?? ''
                                            });
                                            if (!error) {
                                              setEditingComment(null);
                                              events.refetch();
                                            }
                                          }}
                                        >
                                          Save
                                        </Button>
                                      </Flex>
                                    </CommentBody>
                                  ) : (
                                    <CommentBody>
                                      <Readme readme={comment.body} fontSize="14px" />
                                    </CommentBody>
                                  )}
                                </CommentCard>
                              </div>
                            ) : (
                              <LifecycleContent>
                                <div>
                                  <TimelineMeta>
                                    <Flex align="center" gap="6px" wrap="wrap">
                                      <EventActor actor={eventActor} />
                                      <Text size="2">{eventCopy(event)}</Text>
                                    </Flex>
                                    <Text size="1" color="gray600">
                                      <RenderDate date={event.createdAt} />
                                    </Text>
                                  </TimelineMeta>
                                  {event.type == 'merge_failed' &&
                                    (event.errorMessage || event.errorCode) && (
                                      <EventError>
                                        {event.errorMessage ??
                                          getSkillMergeErrorMessage(
                                            event.errorCode,
                                            direction
                                          )}
                                        {event.errorCode && (
                                          <div>Error code: {event.errorCode}</div>
                                        )}
                                      </EventError>
                                    )}
                                </div>
                              </LifecycleContent>
                            )}
                          </TimelineRow>
                        );
                      })}
                    </Timeline>
                  </>
                ))}
                {!p.readOnly && (
                  <Composer>
                    <Input
                      id="skill-merge-comment"
                      as="textarea"
                      minRows={3}
                      hideLabel
                      label={
                        commentTarget?.replyToCommentId
                          ? 'Reply'
                          : commentTarget?.path
                            ? `Comment on ${commentTarget.path}`
                            : 'Add a comment'
                      }
                      value={commentBody}
                      onInput={setCommentBody}
                      onKeyDown={event => {
                        if (
                          event.key == 'Enter' &&
                          (event.metaKey || event.ctrlKey) &&
                          commentBody.trim() &&
                          !createComment.isLoading
                        ) {
                          event.preventDefault();
                          void addComment();
                        }
                      }}
                      placeholder="Leave a comment"
                    />
                    <Flex justify="end">
                      {commentTarget && (
                        <Button
                          size="2"
                          variant="soft"
                          color="gray"
                          onClick={() => setCommentTarget(null)}
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        size="2"
                        disabled={!commentBody.trim()}
                        loading={createComment.isLoading}
                        onClick={addComment}
                      >
                        Comment
                      </Button>
                    </Flex>
                    <createComment.RenderError />
                    <updateComment.RenderError />
                    <deleteComment.RenderError />
                  </Composer>
                )}
              </Discussion>
            </Section>
          )}
        </Stack>
      </>
    );
  });
};
