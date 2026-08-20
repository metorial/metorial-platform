import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCallbacksInstancesConsumeReceiverPathSecretReceiptBody = {
  receiptToken: string;
};

export type DashboardInstanceCallbacksInstancesSecretConsumptionOutput = {
  object: 'callback.secret_consumption';
  auditCorrelationId: string;
  value: string;
};

export let mapDashboardInstanceCallbacksInstancesConsumeReceiverPathSecretReceiptBody =
  mtMap.object<DashboardInstanceCallbacksInstancesConsumeReceiverPathSecretReceiptBody>({
    receiptToken: mtMap.objectField('receipt_token', mtMap.passthrough())
  });

export let mapDashboardInstanceCallbacksInstancesSecretConsumptionOutput =
  mtMap.object<DashboardInstanceCallbacksInstancesSecretConsumptionOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    auditCorrelationId: mtMap.objectField('audit_correlation_id', mtMap.passthrough()),
    value: mtMap.objectField('value', mtMap.passthrough())
  });
