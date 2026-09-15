import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceChatsMessagesCreateOutput = {
  object: 'chat.message';
  id: string;
  chatId: string;
  channelId: string;
  threadId: string | null;
  providerType: string;
  providerMessageId: string;
  providerReplyToMessageId: string | null;
  author: {
    object: 'chat.author';
    id: string;
    chatId: string;
    type: 'user' | 'app' | 'system' | 'webhook' | 'unknown';
    role: 'member' | 'guest' | 'unknown';
    providerType: string;
    providerAuthorId: string;
    userName: string;
    fullName: string;
    email: string | null;
    imageUrl: string | null;
    isSelf: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastInteractionAt: Date | null;
  } | null;
  body: Record<string, any> | null;
  reactions:
    | {
        emoji:
          | { type: 'unicode'; value: string }
          | {
              type: 'custom';
              name: string;
              url?: string | undefined;
              id?: string | undefined;
            };
        count: number;
        authors?:
          | {
              userId: string;
              userName: string;
              fullName: string;
              type: 'user' | 'app' | 'system' | 'webhook' | 'unknown';
              role?: 'member' | 'guest' | 'unknown' | undefined;
              providerType?: string | undefined;
              isMe: boolean;
              email?: string | undefined;
              imageUrl?: string | undefined;
              raw?: any | undefined;
            }[]
          | undefined;
      }[]
    | null;
  unfurls:
    | {
        url: string;
        title?: string | undefined;
        description?: string | undefined;
        imageUrl?: string | undefined;
        siteName?: string | undefined;
        messageId?: string | undefined;
      }[]
    | null;
  attachments: {
    object: 'chat.message_attachment';
    id: string;
    providerAttachmentId: string | null;
    type: string;
    name: string | null;
    mimeType: string | null;
    size: number | null;
    width: number | null;
    height: number | null;
    position: number;
    fileId: string;
    downloadUrl: string | null;
    createdAt: Date;
  }[];
  sentAt: Date;
  edited: boolean;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastInteractionAt: Date | null;
  deletedAt: Date | null;
};

export let mapDashboardInstanceChatsMessagesCreateOutput =
  mtMap.object<DashboardInstanceChatsMessagesCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    chatId: mtMap.objectField('chat_id', mtMap.passthrough()),
    channelId: mtMap.objectField('channel_id', mtMap.passthrough()),
    threadId: mtMap.objectField('thread_id', mtMap.passthrough()),
    providerType: mtMap.objectField('provider_type', mtMap.passthrough()),
    providerMessageId: mtMap.objectField(
      'provider_message_id',
      mtMap.passthrough()
    ),
    providerReplyToMessageId: mtMap.objectField(
      'provider_reply_to_message_id',
      mtMap.passthrough()
    ),
    author: mtMap.objectField(
      'author',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        chatId: mtMap.objectField('chat_id', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        role: mtMap.objectField('role', mtMap.passthrough()),
        providerType: mtMap.objectField('provider_type', mtMap.passthrough()),
        providerAuthorId: mtMap.objectField(
          'provider_author_id',
          mtMap.passthrough()
        ),
        userName: mtMap.objectField('user_name', mtMap.passthrough()),
        fullName: mtMap.objectField('full_name', mtMap.passthrough()),
        email: mtMap.objectField('email', mtMap.passthrough()),
        imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
        isSelf: mtMap.objectField('is_self', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date()),
        lastInteractionAt: mtMap.objectField(
          'last_interaction_at',
          mtMap.date()
        )
      })
    ),
    body: mtMap.objectField('body', mtMap.passthrough()),
    reactions: mtMap.objectField(
      'reactions',
      mtMap.array(
        mtMap.object({
          emoji: mtMap.objectField(
            'emoji',
            mtMap.union([
              mtMap.unionOption(
                'object',
                mtMap.object({
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  value: mtMap.objectField('value', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  url: mtMap.objectField('url', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough())
                })
              )
            ])
          ),
          count: mtMap.objectField('count', mtMap.passthrough()),
          authors: mtMap.objectField(
            'authors',
            mtMap.array(
              mtMap.object({
                userId: mtMap.objectField('userId', mtMap.passthrough()),
                userName: mtMap.objectField('userName', mtMap.passthrough()),
                fullName: mtMap.objectField('fullName', mtMap.passthrough()),
                type: mtMap.objectField('type', mtMap.passthrough()),
                role: mtMap.objectField('role', mtMap.passthrough()),
                providerType: mtMap.objectField(
                  'providerType',
                  mtMap.passthrough()
                ),
                isMe: mtMap.objectField('isMe', mtMap.passthrough()),
                email: mtMap.objectField('email', mtMap.passthrough()),
                imageUrl: mtMap.objectField('imageUrl', mtMap.passthrough()),
                raw: mtMap.objectField('raw', mtMap.passthrough())
              })
            )
          )
        })
      )
    ),
    unfurls: mtMap.objectField(
      'unfurls',
      mtMap.array(
        mtMap.object({
          url: mtMap.objectField('url', mtMap.passthrough()),
          title: mtMap.objectField('title', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          imageUrl: mtMap.objectField('imageUrl', mtMap.passthrough()),
          siteName: mtMap.objectField('siteName', mtMap.passthrough()),
          messageId: mtMap.objectField('messageId', mtMap.passthrough())
        })
      )
    ),
    attachments: mtMap.objectField(
      'attachments',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          providerAttachmentId: mtMap.objectField(
            'provider_attachment_id',
            mtMap.passthrough()
          ),
          type: mtMap.objectField('type', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          mimeType: mtMap.objectField('mime_type', mtMap.passthrough()),
          size: mtMap.objectField('size', mtMap.passthrough()),
          width: mtMap.objectField('width', mtMap.passthrough()),
          height: mtMap.objectField('height', mtMap.passthrough()),
          position: mtMap.objectField('position', mtMap.passthrough()),
          fileId: mtMap.objectField('file_id', mtMap.passthrough()),
          downloadUrl: mtMap.objectField('download_url', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date())
        })
      )
    ),
    sentAt: mtMap.objectField('sent_at', mtMap.date()),
    edited: mtMap.objectField('edited', mtMap.passthrough()),
    editedAt: mtMap.objectField('edited_at', mtMap.date()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    lastInteractionAt: mtMap.objectField('last_interaction_at', mtMap.date()),
    deletedAt: mtMap.objectField('deleted_at', mtMap.date())
  });

export type DashboardInstanceChatsMessagesCreateBody = {
  channelId: string;
  threadId?: string | undefined;
  parts: (
    | { type: 'markdown'; markdown: string }
    | {
        type: 'text';
        content: string;
        style?: 'plain' | 'bold' | 'muted' | undefined;
      }
    | { type: 'image'; url: string; alt?: string | undefined }
    | { type: 'divider' }
    | { type: 'link'; url: string; label: string }
    | {
        type: 'fields';
        children: { type: 'field'; label: string; value: string }[];
      }
    | {
        type: 'table';
        headers: string[];
        rows: string[][];
        align?: ('left' | 'center' | 'right')[] | undefined;
        caption?: string | undefined;
        pageSize?: number | undefined;
      }
    | {
        type: 'chart';
        title: string;
        chart:
          | { type: 'pie'; segments: { label: string; value: number }[] }
          | {
              type: 'bar' | 'area' | 'line';
              categories: string[];
              series: {
                name: string;
                data: { label: string; value: number }[];
              }[];
              xLabel?: string | undefined;
              yLabel?: string | undefined;
            };
      }
    | {
        type: 'section';
        children: (
          | { type: 'markdown'; markdown: string }
          | {
              type: 'text';
              content: string;
              style?: 'plain' | 'bold' | 'muted' | undefined;
            }
          | { type: 'image'; url: string; alt?: string | undefined }
          | { type: 'divider' }
          | { type: 'link'; url: string; label: string }
          | {
              type: 'fields';
              children: { type: 'field'; label: string; value: string }[];
            }
          | {
              type: 'table';
              headers: string[];
              rows: string[][];
              align?: ('left' | 'center' | 'right')[] | undefined;
              caption?: string | undefined;
              pageSize?: number | undefined;
            }
          | {
              type: 'chart';
              title: string;
              chart:
                | { type: 'pie'; segments: { label: string; value: number }[] }
                | {
                    type: 'bar' | 'area' | 'line';
                    categories: string[];
                    series: {
                      name: string;
                      data: { label: string; value: number }[];
                    }[];
                    xLabel?: string | undefined;
                    yLabel?: string | undefined;
                  };
            }
        )[];
      }
    | {
        type: 'card';
        title?: string | undefined;
        subtitle?: string | undefined;
        imageUrl?: string | undefined;
        children: (
          | { type: 'markdown'; markdown: string }
          | {
              type: 'text';
              content: string;
              style?: 'plain' | 'bold' | 'muted' | undefined;
            }
          | { type: 'image'; url: string; alt?: string | undefined }
          | { type: 'divider' }
          | { type: 'link'; url: string; label: string }
          | {
              type: 'fields';
              children: { type: 'field'; label: string; value: string }[];
            }
          | {
              type: 'table';
              headers: string[];
              rows: string[][];
              align?: ('left' | 'center' | 'right')[] | undefined;
              caption?: string | undefined;
              pageSize?: number | undefined;
            }
          | {
              type: 'chart';
              title: string;
              chart:
                | { type: 'pie'; segments: { label: string; value: number }[] }
                | {
                    type: 'bar' | 'area' | 'line';
                    categories: string[];
                    series: {
                      name: string;
                      data: { label: string; value: number }[];
                    }[];
                    xLabel?: string | undefined;
                    yLabel?: string | undefined;
                  };
            }
          | {
              type: 'section';
              children: (
                | { type: 'markdown'; markdown: string }
                | {
                    type: 'text';
                    content: string;
                    style?: 'plain' | 'bold' | 'muted' | undefined;
                  }
                | { type: 'image'; url: string; alt?: string | undefined }
                | { type: 'divider' }
                | { type: 'link'; url: string; label: string }
                | {
                    type: 'fields';
                    children: { type: 'field'; label: string; value: string }[];
                  }
                | {
                    type: 'table';
                    headers: string[];
                    rows: string[][];
                    align?: ('left' | 'center' | 'right')[] | undefined;
                    caption?: string | undefined;
                    pageSize?: number | undefined;
                  }
                | {
                    type: 'chart';
                    title: string;
                    chart:
                      | {
                          type: 'pie';
                          segments: { label: string; value: number }[];
                        }
                      | {
                          type: 'bar' | 'area' | 'line';
                          categories: string[];
                          series: {
                            name: string;
                            data: { label: string; value: number }[];
                          }[];
                          xLabel?: string | undefined;
                          yLabel?: string | undefined;
                        };
                  }
              )[];
            }
        )[];
      }
  )[];
  altText?: string | undefined;
  attachments?: { fileId: string }[] | undefined;
  replyMessageId?: string | undefined;
  ephemeralTargetUserId?: string | undefined;
};

export let mapDashboardInstanceChatsMessagesCreateBody =
  mtMap.object<DashboardInstanceChatsMessagesCreateBody>({
    channelId: mtMap.objectField('channel_id', mtMap.passthrough()),
    threadId: mtMap.objectField('thread_id', mtMap.passthrough()),
    parts: mtMap.objectField(
      'parts',
      mtMap.array(
        mtMap.union([
          mtMap.unionOption(
            'object',
            mtMap.object({
              type: mtMap.objectField('type', mtMap.passthrough()),
              markdown: mtMap.objectField('markdown', mtMap.passthrough()),
              content: mtMap.objectField('content', mtMap.passthrough()),
              style: mtMap.objectField('style', mtMap.passthrough()),
              url: mtMap.objectField('url', mtMap.passthrough()),
              alt: mtMap.objectField('alt', mtMap.passthrough()),
              label: mtMap.objectField('label', mtMap.passthrough()),
              children: mtMap.objectField(
                'children',
                mtMap.array(
                  mtMap.union([
                    mtMap.unionOption(
                      'object',
                      mtMap.object({
                        type: mtMap.objectField('type', mtMap.passthrough()),
                        markdown: mtMap.objectField(
                          'markdown',
                          mtMap.passthrough()
                        ),
                        content: mtMap.objectField(
                          'content',
                          mtMap.passthrough()
                        ),
                        style: mtMap.objectField('style', mtMap.passthrough()),
                        url: mtMap.objectField('url', mtMap.passthrough()),
                        alt: mtMap.objectField('alt', mtMap.passthrough()),
                        label: mtMap.objectField('label', mtMap.passthrough()),
                        children: mtMap.objectField(
                          'children',
                          mtMap.array(
                            mtMap.union([
                              mtMap.unionOption(
                                'object',
                                mtMap.object({
                                  type: mtMap.objectField(
                                    'type',
                                    mtMap.passthrough()
                                  ),
                                  markdown: mtMap.objectField(
                                    'markdown',
                                    mtMap.passthrough()
                                  ),
                                  content: mtMap.objectField(
                                    'content',
                                    mtMap.passthrough()
                                  ),
                                  style: mtMap.objectField(
                                    'style',
                                    mtMap.passthrough()
                                  ),
                                  url: mtMap.objectField(
                                    'url',
                                    mtMap.passthrough()
                                  ),
                                  alt: mtMap.objectField(
                                    'alt',
                                    mtMap.passthrough()
                                  ),
                                  label: mtMap.objectField(
                                    'label',
                                    mtMap.passthrough()
                                  ),
                                  children: mtMap.objectField(
                                    'children',
                                    mtMap.array(
                                      mtMap.object({
                                        type: mtMap.objectField(
                                          'type',
                                          mtMap.passthrough()
                                        ),
                                        label: mtMap.objectField(
                                          'label',
                                          mtMap.passthrough()
                                        ),
                                        value: mtMap.objectField(
                                          'value',
                                          mtMap.passthrough()
                                        )
                                      })
                                    )
                                  ),
                                  headers: mtMap.objectField(
                                    'headers',
                                    mtMap.array(mtMap.passthrough())
                                  ),
                                  rows: mtMap.objectField(
                                    'rows',
                                    mtMap.array(
                                      mtMap.array(mtMap.passthrough())
                                    )
                                  ),
                                  align: mtMap.objectField(
                                    'align',
                                    mtMap.array(mtMap.passthrough())
                                  ),
                                  caption: mtMap.objectField(
                                    'caption',
                                    mtMap.passthrough()
                                  ),
                                  pageSize: mtMap.objectField(
                                    'pageSize',
                                    mtMap.passthrough()
                                  ),
                                  title: mtMap.objectField(
                                    'title',
                                    mtMap.passthrough()
                                  ),
                                  chart: mtMap.objectField(
                                    'chart',
                                    mtMap.union([
                                      mtMap.unionOption(
                                        'object',
                                        mtMap.object({
                                          type: mtMap.objectField(
                                            'type',
                                            mtMap.passthrough()
                                          ),
                                          segments: mtMap.objectField(
                                            'segments',
                                            mtMap.array(
                                              mtMap.object({
                                                label: mtMap.objectField(
                                                  'label',
                                                  mtMap.passthrough()
                                                ),
                                                value: mtMap.objectField(
                                                  'value',
                                                  mtMap.passthrough()
                                                )
                                              })
                                            )
                                          ),
                                          categories: mtMap.objectField(
                                            'categories',
                                            mtMap.array(mtMap.passthrough())
                                          ),
                                          series: mtMap.objectField(
                                            'series',
                                            mtMap.array(
                                              mtMap.object({
                                                name: mtMap.objectField(
                                                  'name',
                                                  mtMap.passthrough()
                                                ),
                                                data: mtMap.objectField(
                                                  'data',
                                                  mtMap.array(
                                                    mtMap.object({
                                                      label: mtMap.objectField(
                                                        'label',
                                                        mtMap.passthrough()
                                                      ),
                                                      value: mtMap.objectField(
                                                        'value',
                                                        mtMap.passthrough()
                                                      )
                                                    })
                                                  )
                                                )
                                              })
                                            )
                                          ),
                                          xLabel: mtMap.objectField(
                                            'xLabel',
                                            mtMap.passthrough()
                                          ),
                                          yLabel: mtMap.objectField(
                                            'yLabel',
                                            mtMap.passthrough()
                                          )
                                        })
                                      )
                                    ])
                                  )
                                })
                              )
                            ])
                          )
                        ),
                        headers: mtMap.objectField(
                          'headers',
                          mtMap.array(mtMap.passthrough())
                        ),
                        rows: mtMap.objectField(
                          'rows',
                          mtMap.array(mtMap.array(mtMap.passthrough()))
                        ),
                        align: mtMap.objectField(
                          'align',
                          mtMap.array(mtMap.passthrough())
                        ),
                        caption: mtMap.objectField(
                          'caption',
                          mtMap.passthrough()
                        ),
                        pageSize: mtMap.objectField(
                          'pageSize',
                          mtMap.passthrough()
                        ),
                        title: mtMap.objectField('title', mtMap.passthrough()),
                        chart: mtMap.objectField(
                          'chart',
                          mtMap.union([
                            mtMap.unionOption(
                              'object',
                              mtMap.object({
                                type: mtMap.objectField(
                                  'type',
                                  mtMap.passthrough()
                                ),
                                segments: mtMap.objectField(
                                  'segments',
                                  mtMap.array(
                                    mtMap.object({
                                      label: mtMap.objectField(
                                        'label',
                                        mtMap.passthrough()
                                      ),
                                      value: mtMap.objectField(
                                        'value',
                                        mtMap.passthrough()
                                      )
                                    })
                                  )
                                ),
                                categories: mtMap.objectField(
                                  'categories',
                                  mtMap.array(mtMap.passthrough())
                                ),
                                series: mtMap.objectField(
                                  'series',
                                  mtMap.array(
                                    mtMap.object({
                                      name: mtMap.objectField(
                                        'name',
                                        mtMap.passthrough()
                                      ),
                                      data: mtMap.objectField(
                                        'data',
                                        mtMap.array(
                                          mtMap.object({
                                            label: mtMap.objectField(
                                              'label',
                                              mtMap.passthrough()
                                            ),
                                            value: mtMap.objectField(
                                              'value',
                                              mtMap.passthrough()
                                            )
                                          })
                                        )
                                      )
                                    })
                                  )
                                ),
                                xLabel: mtMap.objectField(
                                  'xLabel',
                                  mtMap.passthrough()
                                ),
                                yLabel: mtMap.objectField(
                                  'yLabel',
                                  mtMap.passthrough()
                                )
                              })
                            )
                          ])
                        )
                      })
                    )
                  ])
                )
              ),
              headers: mtMap.objectField(
                'headers',
                mtMap.array(mtMap.passthrough())
              ),
              rows: mtMap.objectField(
                'rows',
                mtMap.array(mtMap.array(mtMap.passthrough()))
              ),
              align: mtMap.objectField(
                'align',
                mtMap.array(mtMap.passthrough())
              ),
              caption: mtMap.objectField('caption', mtMap.passthrough()),
              pageSize: mtMap.objectField('pageSize', mtMap.passthrough()),
              title: mtMap.objectField('title', mtMap.passthrough()),
              chart: mtMap.objectField(
                'chart',
                mtMap.union([
                  mtMap.unionOption(
                    'object',
                    mtMap.object({
                      type: mtMap.objectField('type', mtMap.passthrough()),
                      segments: mtMap.objectField(
                        'segments',
                        mtMap.array(
                          mtMap.object({
                            label: mtMap.objectField(
                              'label',
                              mtMap.passthrough()
                            ),
                            value: mtMap.objectField(
                              'value',
                              mtMap.passthrough()
                            )
                          })
                        )
                      ),
                      categories: mtMap.objectField(
                        'categories',
                        mtMap.array(mtMap.passthrough())
                      ),
                      series: mtMap.objectField(
                        'series',
                        mtMap.array(
                          mtMap.object({
                            name: mtMap.objectField(
                              'name',
                              mtMap.passthrough()
                            ),
                            data: mtMap.objectField(
                              'data',
                              mtMap.array(
                                mtMap.object({
                                  label: mtMap.objectField(
                                    'label',
                                    mtMap.passthrough()
                                  ),
                                  value: mtMap.objectField(
                                    'value',
                                    mtMap.passthrough()
                                  )
                                })
                              )
                            )
                          })
                        )
                      ),
                      xLabel: mtMap.objectField('xLabel', mtMap.passthrough()),
                      yLabel: mtMap.objectField('yLabel', mtMap.passthrough())
                    })
                  )
                ])
              ),
              subtitle: mtMap.objectField('subtitle', mtMap.passthrough()),
              imageUrl: mtMap.objectField('imageUrl', mtMap.passthrough())
            })
          )
        ])
      )
    ),
    altText: mtMap.objectField('alt_text', mtMap.passthrough()),
    attachments: mtMap.objectField(
      'attachments',
      mtMap.array(
        mtMap.object({
          fileId: mtMap.objectField('file_id', mtMap.passthrough())
        })
      )
    ),
    replyMessageId: mtMap.objectField('reply_message_id', mtMap.passthrough()),
    ephemeralTargetUserId: mtMap.objectField(
      'ephemeral_target_user_id',
      mtMap.passthrough()
    )
  });

