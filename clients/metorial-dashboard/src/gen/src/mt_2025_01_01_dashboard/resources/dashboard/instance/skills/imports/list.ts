import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsImportsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSkillsImportsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsImportsListOutput>(
    [
      7,
      [
        1,
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
        ]
      ]
    ],
    1
  );

export type DashboardInstanceSkillsImportsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  status?:
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | ('pending' | 'processing' | 'completed' | 'failed')[]
    | undefined;
};

export let mapDashboardInstanceSkillsImportsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsImportsListQuery>(0);
