import { MergeEditor } from '@metorial/code-editor';
import { renderWithLoader, renderWithPagination, useForm } from '@metorial/data-hooks';
import {
  useBulkResolveSkillMergeRequestItems,
  useCloseSkillMergeRequest,
  useCreateSkillMergeRequest,
  useCreateSkillMergeRequestComment,
  useDeleteSkillMergeRequestComment,
  useFiles,
  usePerformSkillMergeRequest,
  useRollbackSkillMergeRequest,
  useSkill,
  useSkillMergeRequest,
  useSkillMergeRequestComments,
  useSkillMergeRequestPlan,
  useSkillMergeRequests,
  useStorePermissions,
  useUpdateSkillMergeRequestComment
} from '@metorial/state';
import {
  Badge,
  Button,
  Callout,
  Dialog,
  Flex,
  Input,
  LargePanelDialog,
  RenderDate,
  Select,
  Text,
  confirm,
  showModal,
  theme,
  toast
} from '@metorial/ui';
import { Box, Table } from '@metorial/ui-product';
import { RiArrowLeftLine, RiArrowRightLine } from '@remixicon/react';
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

let MutedRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  color: ${theme.colors.gray700};
  font-size: 12px;
`;

let Empty = styled.div`
  padding: 24px 8px;
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

let Path = styled.code`
  font-size: 12px;
  overflow-wrap: anywhere;
`;

let DiffPreview = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  overflow: hidden;

  > div {
    min-width: 0;
    padding: 10px;
  }

  > div + div {
    border-left: 1px solid ${theme.colors.gray300};
  }

  pre {
    max-height: 180px;
    margin: 7px 0 0;
    overflow: auto;
    white-space: pre-wrap;
    font: 12px/1.5 monospace;
  }
`;

let Comments = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let Comment = styled.div`
  padding: 12px 14px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 9px;
`;

let CommentBody = styled.div`
  margin-top: 7px;
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.55;
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
            <Button type="button" variant="outline" color="gray" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isLoading}>
              Create Merge Request
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
    <Box
      title="Merge requests"
      description="Review changes proposed between this skill and its forks."
      rightActions={
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
    >
      {renderWithPagination(outgoing)(outgoingList =>
        renderWithPagination(incoming)(incomingList => {
          let requests = [...outgoingList.data.items, ...incomingList.data.items]
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
        })
      )}
    </Box>
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
      <div>
        <Text size="1" color="gray600">
          {targetLabel}
        </Text>
        <pre>{entry.documentMerge.targetContent ?? 'Empty'}</pre>
      </div>
      <div>
        <Text size="1" color="gray600">
          {sourceLabel}
        </Text>
        <pre>{entry.documentMerge.sourceContent ?? 'Empty'}</pre>
      </div>
    </DiffPreview>
  );
};

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
  onSubmitted: () => void;
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

    let [, performError] = await perform.mutate({
      instanceId,
      skillMergeRequestId: plan.mergeRequest.id
    });
    if (performError) return;

    close();
    onSubmitted();
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
                  {(choice == 'edit_document' || choice == 'replace_file') && (
                    <ChangeBody>
                      {choice == 'edit_document' && (
                        <MergeEditor
                          original={entry.documentMerge?.targetContent ?? ''}
                          value={contents[item.id] ?? ''}
                          onChange={value =>
                            setContents(current => ({ ...current, [item.id]: value }))
                          }
                        />
                      )}
                      {choice == 'replace_file' &&
                        renderWithPagination(files)(fileList => (
                          <Select
                            label="Replacement file"
                            placeholder="Choose a readable file"
                            value={replacementFiles[item.id] || undefined}
                            items={fileList.data.items.map(file => ({
                              id: file.id,
                              label: file.title
                            }))}
                            onChange={value =>
                              setReplacementFiles(current => ({
                                ...current,
                                [item.id]: value
                              }))
                            }
                          />
                        ))}
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
            <Button variant="outline" color="gray" onClick={close}>
              Cancel
            </Button>
            <Button
              color="green"
              disabled={invalid}
              loading={bulkResolve.isLoading || perform.isLoading}
              onClick={submit}
            >
              Merge changes
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
  onMerged?: (targetSkillId: string) => void;
}) => {
  let mergeRequest = useSkillMergeRequest(p.instanceId, p.mergeRequestId);
  let plan = useSkillMergeRequestPlan(p.instanceId, p.mergeRequestId);
  let targetSkill = useSkill(p.instanceId, mergeRequest.data?.targetSkillId);
  let targetPermissions = useStorePermissions(p.instanceId, targetSkill.data?.storeId);
  let comments = useSkillMergeRequestComments(p.instanceId, p.mergeRequestId);
  let createComment = useCreateSkillMergeRequestComment();
  let updateComment = useUpdateSkillMergeRequestComment();
  let deleteComment = useDeleteSkillMergeRequestComment();
  let closeRequest = useCloseSkillMergeRequest();
  let rollback = useRollbackSkillMergeRequest();
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
      comments.refetch();
    }
  };

  return renderWithLoader({ mergeRequest, plan, comments })(
    ({ mergeRequest, plan, comments }) => {
      let request = mergeRequest.data;
      let direction = request.direction;
      let targetLabel = direction == 'upstream_to_fork' ? 'fork' : 'upstream';
      let sourceLabel = direction == 'upstream_to_fork' ? 'upstream' : 'fork';
      let canWriteTarget =
        targetPermissions.data?.hasFullAccess ||
        targetPermissions.data?.permissions.includes('content_write');
      let unresolved = plan.data.items.filter(
        entry => entry.item.status == 'unresolved'
      ).length;
      let openReview = () => {
        if (!p.instanceId) return;
        showModal(({ close, dialogProps }) => (
          <MergeReviewDialog
            instanceId={p.instanceId!}
            plan={plan.data}
            readableStoreIds={targetPermissions.data?.readableStoreIds ?? []}
            close={close}
            dialogProps={dialogProps}
            onSubmitted={() => {
              mergeRequest.refetch();
              plan.refetch();
              toast('Merge started');
            }}
          />
        ));
      };

      return (
        <Stack>
          {request.mergeError && (
            <Callout color="orange">
              {getSkillMergeErrorMessage(request.mergeErrorCode, direction)}
            </Callout>
          )}
          <Box
            title={request.title}
            description={request.description ?? undefined}
            rightActions={
              <Flex gap="8px">
                <Badge color={statusColor(request.status)}>
                  {statusLabel(request.status)}
                </Badge>
                {request.status == 'open' && (
                  <>
                    <Button
                      size="2"
                      variant="outline"
                      color="gray"
                      onClick={() =>
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
                            if (!error) mergeRequest.refetch();
                          }
                        })
                      }
                    >
                      Close
                    </Button>
                    {canWriteTarget && (
                      <Button size="2" color="green" onClick={openReview}>
                        {unresolved ? 'Resolve and merge' : 'Merge'}
                      </Button>
                    )}
                  </>
                )}
                {request.status == 'merged' && !request.rolledBackAt && canWriteTarget && (
                  <Button
                    size="2"
                    variant="outline"
                    color="orange"
                    loading={rollback.isLoading}
                    onClick={() =>
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
                          }
                        }
                      })
                    }
                  >
                    Roll back
                  </Button>
                )}
              </Flex>
            }
          >
            <MutedRow>
              <span>{request.itemCount} changes</span>
              <span>·</span>
              <span>{request.commentCount} comments</span>
              <span>·</span>
              <RenderDate date={request.createdAt} />
            </MutedRow>
            {request.status == 'merging' && (
              <div style={{ marginTop: 12 }}>
                <Callout color="blue">Applying changes…</Callout>
              </div>
            )}
            {request.rolledBackAt && (
              <div style={{ marginTop: 12 }}>
                <Callout color="gray">This merge was rolled back.</Callout>
              </div>
            )}
            <closeRequest.RenderError />
            <rollback.RenderError />
          </Box>

          <Box
            title="Changes"
            description={`Request snapshot: ${targetLabel} compared with the ${sourceLabel} at creation time.`}
          >
            <Stack>
              {plan.data.items.map(entry => (
                <ChangeCard key={entry.item.id}>
                  <ChangeHeader>
                    <Flex gap="8px" align="center">
                      <Badge color={entry.item.changeType == 'conflicted' ? 'red' : 'gray'}>
                        {getSkillMergeChangeLabel(entry.item.changeType, direction)}
                      </Badge>
                      <Path>{entry.item.path}</Path>
                    </Flex>
                    <Flex gap="6px" align="center">
                      <Badge
                        color={
                          entry.item.status == 'unresolved'
                            ? 'orange'
                            : entry.item.status == 'applied'
                              ? 'green'
                              : 'gray'
                        }
                      >
                        {getSkillMergeItemStatusLabel(entry.item, direction)}
                      </Badge>
                      <Button
                        size="1"
                        variant="ghost"
                        color="gray"
                        onClick={() => {
                          setCommentTarget({
                            itemId: entry.item.id,
                            path: entry.item.path
                          });
                          window.setTimeout(
                            () => document.getElementById('skill-merge-comment')?.focus(),
                            0
                          );
                        }}
                      >
                        Comment
                      </Button>
                    </Flex>
                  </ChangeHeader>
                  {entry.documentMerge && (
                    <ChangeBody>
                      <DocumentPreview entry={entry} direction={direction} />
                    </ChangeBody>
                  )}
                </ChangeCard>
              ))}
            </Stack>
          </Box>

          <Box title="Discussion">
            <Comments>
              {comments.data.items.map(comment => (
                <Comment
                  key={comment.id}
                  style={comment.inReplyToCommentId ? { marginLeft: 24 } : undefined}
                >
                  <Flex justify="space-between" align="center" gap="10px">
                    <MutedRow>
                      <span>Contributor</span>
                      <span>·</span>
                      <RenderDate date={comment.createdAt} />
                      {comment.path && <Path>{comment.path}</Path>}
                    </MutedRow>
                    <Button
                      size="1"
                      variant="ghost"
                      color="gray"
                      onClick={() =>
                        setEditingComment({
                          id: comment.id,
                          body: comment.body
                        })
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      size="1"
                      variant="ghost"
                      color="gray"
                      onClick={() => {
                        setCommentTarget({
                          itemId: comment.skillMergeRequestItemId ?? undefined,
                          path: comment.path,
                          replyToCommentId: comment.id
                        });
                        window.setTimeout(
                          () => document.getElementById('skill-merge-comment')?.focus(),
                          0
                        );
                      }}
                    >
                      Reply
                    </Button>
                    <Button
                      size="1"
                      variant="ghost"
                      color="gray"
                      onClick={() =>
                        confirm({
                          title: 'Delete comment?',
                          description: 'This comment will be removed from the discussion.',
                          confirmText: 'Delete',
                          onConfirm: async () => {
                            if (!p.instanceId || !p.mergeRequestId) return;
                            let [, error] = await deleteComment.mutate({
                              instanceId: p.instanceId,
                              skillMergeRequestId: p.mergeRequestId,
                              commentId: comment.id
                            });
                            if (!error) comments.refetch();
                          }
                        })
                      }
                    >
                      Delete
                    </Button>
                  </Flex>
                  {editingComment?.id == comment.id ? (
                    <div style={{ marginTop: 8 }}>
                      <Input
                        as="textarea"
                        minRows={2}
                        label="Edit comment"
                        hideLabel
                        value={editingComment.body}
                        onInput={body =>
                          setEditingComment(current =>
                            current ? { ...current, body } : current
                          )
                        }
                      />
                      <Flex justify="end" gap="6px" style={{ marginTop: 7 }}>
                        <Button
                          size="1"
                          variant="ghost"
                          color="gray"
                          onClick={() => setEditingComment(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="1"
                          loading={updateComment.isLoading}
                          onClick={async () => {
                            if (!p.instanceId || !p.mergeRequestId) return;
                            let [, error] = await updateComment.mutate({
                              instanceId: p.instanceId,
                              skillMergeRequestId: p.mergeRequestId,
                              commentId: comment.id,
                              body: editingComment.body.trim()
                            });
                            if (!error) {
                              setEditingComment(null);
                              comments.refetch();
                            }
                          }}
                        >
                          Save
                        </Button>
                      </Flex>
                    </div>
                  ) : (
                    <CommentBody>{comment.body}</CommentBody>
                  )}
                </Comment>
              ))}
              {!comments.data?.items.length && (
                <Text color="gray600" size="2">
                  No comments yet.
                </Text>
              )}
              <Input
                id="skill-merge-comment"
                as="textarea"
                minRows={3}
                label={
                  commentTarget?.replyToCommentId
                    ? 'Reply'
                    : commentTarget?.path
                      ? `Comment on ${commentTarget.path}`
                      : 'Add a comment'
                }
                value={commentBody}
                onInput={setCommentBody}
                placeholder="Leave a comment"
              />
              <Flex justify="end">
                {commentTarget && (
                  <Button
                    size="2"
                    variant="ghost"
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
            </Comments>
          </Box>
        </Stack>
      );
    }
  );
};
