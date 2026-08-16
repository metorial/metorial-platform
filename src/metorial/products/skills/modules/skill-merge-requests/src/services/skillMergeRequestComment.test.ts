import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findComment: vi.fn(),
  findItem: vi.fn(),
  createComment: vi.fn(),
  getItem: vi.fn(),
  createEvent: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {
    skillMergeRequestComment: {
      findFirst: mocks.findComment
    },
    skillMergeRequestItem: {
      findFirst: mocks.findItem
    }
  },
  ID: {
    generateId: vi.fn(() => Promise.resolve('skmrc_reply'))
  },
  withTransaction: async (callback: (tx: unknown) => unknown) =>
    callback({
      skillMergeRequestComment: {
        create: mocks.createComment
      }
    })
}));

vi.mock('@metorial/module-access', () => ({
  assertResourceActorScope: vi.fn()
}));

vi.mock('./skillMergeRequestEvent', () => ({
  skillMergeRequestEventService: {
    createEvent: mocks.createEvent
  }
}));

vi.mock('./skillMergeRequestInternal', () => ({
  skillMergeRequestCommentInclude: {},
  skillMergeRequestInternalService: {
    getSkillMergeRequestItemById: mocks.getItem
  }
}));

import { skillMergeRequestCommentService } from './skillMergeRequestComment';

let mergeRequest = { oid: 1n } as any;
let context = {
  project: { oid: 2n },
  instance: { oid: 3n },
  mergeRequest,
  actor: { oid: 30n, id: 'act_test' },
  body: 'A reply'
} as any;

let parentComment = (overrides?: {
  skillMergeRequestItemOid?: bigint | null;
  path?: string | null;
}) => ({
  oid: 10n,
  id: 'skmrc_parent',
  skillMergeRequestOid: mergeRequest.oid,
  skillMergeRequestItemOid:
    overrides?.skillMergeRequestItemOid === undefined
      ? 20n
      : overrides.skillMergeRequestItemOid,
  path: overrides?.path === undefined ? '/instructions.md' : overrides.path,
  deletedAt: null
});

describe('skillMergeRequestCommentService replies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findItem.mockResolvedValue({ oid: 20n });
    mocks.createComment.mockImplementation(async ({ data }: { data: unknown }) => data);
    mocks.createEvent.mockResolvedValue(undefined);
  });

  it('inherits the parent item and path when reply context is omitted', async () => {
    mocks.findComment.mockResolvedValue(parentComment());

    await skillMergeRequestCommentService.createComment({
      ...context,
      inReplyToCommentId: 'skmrc_parent'
    });

    expect(mocks.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          skillMergeRequestItemOid: 20n,
          inReplyToCommentOid: 10n,
          path: '/instructions.md'
        })
      })
    );
  });

  it('accepts matching explicit item and path context', async () => {
    mocks.findComment.mockResolvedValue(parentComment());
    mocks.getItem.mockResolvedValue({ oid: 20n, path: '/instructions.md' });

    await skillMergeRequestCommentService.createComment({
      ...context,
      itemId: 'skmri_instructions',
      path: '/instructions.md',
      inReplyToCommentId: 'skmrc_parent'
    });

    expect(mocks.createComment).toHaveBeenCalled();
  });

  it('rejects a reply with a different item or path', async () => {
    mocks.findComment.mockResolvedValue(parentComment());
    mocks.getItem.mockResolvedValue({ oid: 21n, path: '/other.md' });

    await expect(
      skillMergeRequestCommentService.createComment({
        ...context,
        itemId: 'skmri_other',
        inReplyToCommentId: 'skmrc_parent'
      })
    ).rejects.toThrow('Replies must belong to the same merge request item');

    mocks.getItem.mockResolvedValue({ oid: 20n, path: '/instructions.md' });

    await expect(
      skillMergeRequestCommentService.createComment({
        ...context,
        itemId: 'skmri_instructions',
        path: '/other.md',
        inReplyToCommentId: 'skmrc_parent'
      })
    ).rejects.toThrow('Replies must use the same path as the parent comment');
  });

  it('replies to a merge-request-level comment without an item', async () => {
    mocks.findComment.mockResolvedValue(
      parentComment({
        skillMergeRequestItemOid: null,
        path: null
      })
    );

    await skillMergeRequestCommentService.createComment({
      ...context,
      inReplyToCommentId: 'skmrc_parent'
    });

    expect(mocks.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          skillMergeRequestItemOid: null,
          inReplyToCommentOid: 10n,
          path: null
        })
      })
    );
  });
});
