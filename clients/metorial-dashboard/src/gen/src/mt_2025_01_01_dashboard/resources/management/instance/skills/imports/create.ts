import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsImportsCreateOutput = {
  object: 'skill.import';
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  source:
    | {
        type: 'public';
        repositoryUrl: string;
        repositoryName: string | null;
        ref: string | null;
      }
    | {
        type: 'scm';
        repositoryId: string;
        repositoryName: string | null;
        ref: string | null;
        path: string | null;
      }
    | {
        type: 'file';
        fileId: string | null;
        fileName: string;
        format: 'zip' | 'markdown';
      };
  error: string | null;
  items: {
    object: 'skill.import.item';
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    path: string;
    error: string | null;
    skill: { id: string; name: string; description: string | null } | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
  }[];
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

export let mapManagementInstanceSkillsImportsCreateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSkillsImportsCreateOutput>(
    [
      [
        'source',
        0,
        [
          3,
          [
            [
              0,
              [
                1,
                [
                  'repository_url',
                  'repository_name',
                  'repository_id',
                  'file_id',
                  'file_name'
                ]
              ]
            ]
          ]
        ]
      ],
      ['items', 0, [2, [1, ['started_at', 'completed_at', 'created_at']]]],
      'started_at',
      'completed_at',
      'created_at'
    ],
    1
  );

export type ManagementInstanceSkillsImportsCreateBody = {
  source:
    | { type: 'public'; repositoryUrl: string; ref?: string | undefined }
    | {
        type: 'origin';
        repositoryId: string;
        ref?: string | undefined;
        path?: string | undefined;
      }
    | { type: 'file'; fileId: string };
};

export let mapManagementInstanceSkillsImportsCreateBody =
  /* @__PURE__ */ mapObject<ManagementInstanceSkillsImportsCreateBody>([
    [
      'source',
      0,
      [3, [[0, [1, ['repository_url', 'repository_id', 'file_id']]]]]
    ]
  ]);
