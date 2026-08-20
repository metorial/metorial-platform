import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCallbacksDestinationsConsumeSigningSecretReceiptBody = {
  receiptToken: string;
};

export type DashboardInstanceCallbacksDestinationsSecretConsumptionOutput = {
  object: 'callback.secret_consumption';
  auditCorrelationId: string;
  value: string;
};

export let mapDashboardInstanceCallbacksDestinationsConsumeSigningSecretReceiptBody =
  mtMap.object<DashboardInstanceCallbacksDestinationsConsumeSigningSecretReceiptBody>({
    receiptToken: mtMap.objectField('receipt_token', mtMap.passthrough())
  });

export let mapDashboardInstanceCallbacksDestinationsSecretConsumptionOutput =
  mtMap.object<DashboardInstanceCallbacksDestinationsSecretConsumptionOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    auditCorrelationId: mtMap.objectField('audit_correlation_id', mtMap.passthrough()),
    value: mtMap.objectField('value', mtMap.passthrough())
  });
