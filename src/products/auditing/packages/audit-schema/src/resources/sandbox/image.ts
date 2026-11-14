import { v } from '@lowerdeck/validation';
import { resource } from '../../_lib/resource';

export let sandboxImageAuditResource = resource({
  name: 'sandbox_image',
  payload: v.typedAny<{
    id: string;
    name: string | null;
  }>('sandbox_image'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});

export let sandboxImageBuildAuditResource = resource({
  name: 'sandbox_image_build',
  payload: v.typedAny<{
    id: string;
    imageId: string;
    status: string;
  }>('sandbox_image_build'),
  presenter: undefined,
  actions: {
    create: true,
    cancel: true
  }
});
