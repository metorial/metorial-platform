export let resolveSlateDeploymentConfig = (d: {
  manifest: PrismaJson.SlateJson;
  defaultMemorySizeMb: number;
  defaultTimeoutSeconds: number;
}) => ({
  memorySizeMb: d.defaultMemorySizeMb,
  timeoutSeconds: d.manifest.timeout ?? d.defaultTimeoutSeconds
});
