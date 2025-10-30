import {
  AttachRolePolicyCommand,
  CreateRoleCommand,
  GetRoleCommand,
  PutRolePolicyCommand
} from '@aws-sdk/client-iam';
import { delay } from '@metorial/delay';
import { awsIam } from './aws';

export let ensureRoleRaw = async (
  roleName: string,
  assumePolicy: any,
  policies: string[],
  inlinePolicies?: Record<string, any>
) => {
  try {
    return await awsIam.send(new GetRoleCommand({ RoleName: roleName }));
  } catch (err: any) {
    if (!err.name.includes('NoSuchEntity')) throw err;

    await awsIam.send(
      new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: JSON.stringify(assumePolicy)
      })
    );

    // Attach managed policies
    for (let policy of policies) {
      await awsIam.send(
        new AttachRolePolicyCommand({
          RoleName: roleName,
          PolicyArn: policy
        })
      );
    }

    // Add inline policies
    if (inlinePolicies) {
      for (let [policyName, policyDocument] of Object.entries(inlinePolicies)) {
        await awsIam.send(
          new PutRolePolicyCommand({
            RoleName: roleName,
            PolicyName: policyName,
            PolicyDocument: JSON.stringify(policyDocument)
          })
        );
      }
    }

    await delay(5000);

    return await awsIam.send(new GetRoleCommand({ RoleName: roleName }));
  }
};

let rolePromiseCache = new Map<string, ReturnType<typeof ensureRoleRaw>>();

export let ensureRole = async (
  roleName: string,
  assumePolicy: any,
  policies: string[],
  inlinePolicies?: Record<string, any>
) => {
  let promise = rolePromiseCache.get(roleName);

  if (!promise) {
    promise = ensureRoleRaw(roleName, assumePolicy, policies, inlinePolicies);
    rolePromiseCache.set(roleName, promise);
  }

  return await promise;
};
