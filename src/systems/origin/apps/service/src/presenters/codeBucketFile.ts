import type Long from 'long';

export let codeBucketFileInfoPresenter = (file: {
  path: string;
  size: Long;
  contentType: string;
  modifiedAt: Long;
}) => ({
  object: 'origin#codeBucketFileInfo',
  path: file.path,
  size: file.size.toString(),
  contentType: file.contentType,
  modifiedAt: new Date(file.modifiedAt.toNumber() * 1000)
});

export let codeBucketFileContentPresenter = (file: {
  path: string;
  size: Long;
  contentType: string;
  modifiedAt: Long;
  content: Uint8Array;
}) => ({
  object: 'origin#codeBucketFileContent',
  path: file.path,
  size: file.size.toString(),
  contentType: file.contentType,
  modifiedAt: new Date(file.modifiedAt.toNumber() * 1000),
  content: Buffer.from(file.content).toString('base64'),
  encoding: 'base64' as const
});
