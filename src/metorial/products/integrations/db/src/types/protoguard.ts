export type ProtoGuardFamilyScore = {
  family: string;
  probability: number;
  ruleKeys: string[];
  isTriggered: boolean;
};

export type ProtoGuardToolFindingField =
  'name' | 'description' | 'input_schema' | 'output_schema';

export type ProtoGuardToolFinding = {
  ruleKey: string;
  family: string;
  issueType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  field: ProtoGuardToolFindingField;
  path: string;
  startOffset: number;
  endOffset: number;
  snippet: string;
  description: string;
};
