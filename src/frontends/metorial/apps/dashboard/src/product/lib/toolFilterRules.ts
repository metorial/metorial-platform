import type { DashboardInstanceSessionTemplatesProvidersCreateBody } from '@metorial/dashboard-sdk';
import { toToolFilterRules, type ToolSelection } from '@metorial/tool-selection';

type SdkToolFilters = NonNullable<
  DashboardInstanceSessionTemplatesProvidersCreateBody['toolFilters']
>;

export type SdkToolFilterRule = Exclude<SdkToolFilters, unknown[]>;

/**
 * Filter rules for a tool selection, or `null` when tools are unrestricted. Preserved
 * custom rules are kept verbatim from a filter the API returned, so they already match
 * one of the SDK rule shapes.
 */
export let toSdkToolFilterRules = (selection: ToolSelection) =>
  toToolFilterRules(selection) as SdkToolFilterRule[] | null;
