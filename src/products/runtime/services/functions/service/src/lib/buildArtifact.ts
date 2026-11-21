import { storage } from '../storage';

export type BuildArtifactRef = { bucket: string; storageKey: string };

export let readBuildArtifact = async (artifact: BuildArtifactRef) =>
  (await storage.getObject(artifact.bucket, artifact.storageKey)).data;

export let copyBuildArtifact = async (
  artifact: BuildArtifactRef,
  target: { bucket: string; key: string }
) => await storage.copyObject(target.bucket, target.key, artifact.bucket, artifact.storageKey);
