export type Target = string | 0 | 1;

export type Field = string | [string, Target] | [string, Target, Descriptor];

export type Branch = [number, Descriptor];

export type PatternId = 5 | 6 | 7 | 8;

export type Descriptor =
  | 0
  | 4
  | 5
  | 6
  | 8
  | [1, Field[]]
  | [2, Descriptor]
  | [3, Branch[]]
  | [7, Descriptor];

export interface MapperOptions {
  dateDefaults?: boolean;
  patterns?: boolean | readonly PatternId[];
  onPattern?: (id: PatternId) => void;
}
