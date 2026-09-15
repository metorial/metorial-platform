import { filePurposeService } from './services/filePurpose';

let ensureFilePurpose = async (d: {
  name: string;
  slug: string;
  ownerType: 'user' | 'organization' | 'instance';
  canHaveLinks: boolean;
}) =>
  await filePurposeService.upsertFilePurpose({
    input: d
  });

export let chatMessageAttachmentFilePurposeSlug = 'chat_message_attachment';

export let purposes = {
  user_image: ensureFilePurpose({
    name: 'User Image',
    slug: 'user_image',
    ownerType: 'user',
    canHaveLinks: true
  }),

  organization_image: ensureFilePurpose({
    name: 'Organization Image',
    slug: 'organization_image',
    ownerType: 'organization',
    canHaveLinks: true
  }),

  project_brand_image: ensureFilePurpose({
    name: 'Project Brand Image',
    slug: 'project_brand_image',
    ownerType: 'organization',
    canHaveLinks: true
  }),

  skill_image: ensureFilePurpose({
    name: 'Skill Image',
    slug: 'skill_image',
    ownerType: 'instance',
    canHaveLinks: true
  }),

  skill_export: ensureFilePurpose({
    name: 'Skill Export',
    slug: 'skill_export',
    ownerType: 'instance',
    canHaveLinks: true
  }),

  generic: ensureFilePurpose({
    name: 'Generic',
    slug: 'generic',
    ownerType: 'instance',
    canHaveLinks: true
  }),

  chat_message_attachment: ensureFilePurpose({
    name: 'Chat Message Attachment',
    slug: chatMessageAttachmentFilePurposeSlug,
    ownerType: 'instance',
    canHaveLinks: true
  })
};

export let purposeSlugs = Object.keys(purposes) as (keyof typeof purposes)[];
