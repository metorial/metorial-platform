import { Checkbox, Flex, OptionToggle, Text, theme } from '@metorial/ui';
import { useMemo, useState } from 'react';

type ScopePermissionMode = 'allow' | 'reject' | 'mixed';
type ScopeSectionId = 'read' | 'write' | 'dangerous';

export type ScopePickerScope = {
  id?: string;
  scope: string;
  name?: string | null;
  description?: string | null;
};

let dangerousScopeKeywords = [
  'admin',
  'delete',
  'remove',
  'destroy',
  'danger',
  'manage',
  'owner',
  'root',
  'full_access',
  'full-access',
  'full access'
];

let readOnlyScopeKeywords = [
  'read',
  'readonly',
  'read_only',
  'read-only',
  'view',
  'list',
  'get'
];

let getScopeSearchValue = (scope: ScopePickerScope) =>
  [scope.id, scope.scope, scope.name].filter(Boolean).join(' ').toLowerCase();

let getScopeSectionId = (scope: ScopePickerScope): ScopeSectionId => {
  let searchValue = getScopeSearchValue(scope);

  if (dangerousScopeKeywords.some(keyword => searchValue.includes(keyword))) {
    return 'dangerous';
  }

  if (readOnlyScopeKeywords.some(keyword => searchValue.includes(keyword))) {
    return 'read';
  }

  return 'write';
};

export let ScopePicker = ({
  scopes,
  selectedScopes,
  onSelectedScopesChange,
  disabled
}: {
  scopes: ScopePickerScope[];
  selectedScopes: string[];
  onSelectedScopesChange: (scopes: string[]) => void;
  disabled?: boolean;
}) => {
  let [sectionModeOverrides, setSectionModeOverrides] = useState<
    Partial<Record<ScopeSectionId, ScopePermissionMode>>
  >({});
  let normalizedScopes = useMemo(() => {
    let seen = new Set<string>();
    return scopes.filter(scope => {
      if (seen.has(scope.scope)) return false;
      seen.add(scope.scope);
      return true;
    });
  }, [scopes]);
  let scopeSections = useMemo(
    () =>
      [
        { id: 'read', title: 'Read-Only Scopes', scopes: [] },
        { id: 'write', title: 'Write/Custom Scopes', scopes: [] },
        { id: 'dangerous', title: 'Dangerous Scopes', scopes: [] }
      ].map(section => ({
        ...section,
        scopes: normalizedScopes.filter(scope => getScopeSectionId(scope) === section.id)
      })) as { id: ScopeSectionId; title: string; scopes: ScopePickerScope[] }[],
    [normalizedScopes]
  );
  let selectedScopeSet = new Set(selectedScopes);

  let updateSelectedScopes = (nextScopes: string[]) => {
    let allowedScopes = new Set(normalizedScopes.map(scope => scope.scope));
    onSelectedScopesChange(nextScopes.filter(scope => allowedScopes.has(scope)));
  };

  let setScopeChecked = (scope: string, checked: boolean) => {
    let selectedScope = normalizedScopes.find(s => s.scope === scope);
    if (!selectedScope) return;

    let sectionId = getScopeSectionId(selectedScope);
    setSectionModeOverrides(prev => ({ ...prev, [sectionId]: undefined }));

    let nextScopes = checked
      ? [...new Set([...selectedScopes, scope])]
      : selectedScopes.filter(selectedScope => selectedScope !== scope);

    updateSelectedScopes(nextScopes);
  };

  let getSectionMode = (sectionScopes: ScopePickerScope[]): ScopePermissionMode => {
    if (sectionScopes.length === 0) return 'reject';

    let selectedCount = sectionScopes.filter(scope =>
      selectedScopeSet.has(scope.scope)
    ).length;

    if (selectedCount === 0) return 'reject';
    if (selectedCount === sectionScopes.length) return 'allow';
    return 'mixed';
  };

  let setSectionMode = (
    sectionId: ScopeSectionId,
    sectionScopes: ScopePickerScope[],
    mode: ScopePermissionMode
  ) => {
    if (sectionScopes.length === 0) return;
    if (mode === 'mixed') {
      setSectionModeOverrides(prev => ({ ...prev, [sectionId]: 'mixed' }));
      return;
    }

    setSectionModeOverrides(prev => ({ ...prev, [sectionId]: undefined }));

    let sectionScopeSet = new Set(sectionScopes.map(scope => scope.scope));
    updateSelectedScopes(
      mode === 'allow'
        ? [...new Set([...selectedScopes, ...sectionScopes.map(scope => scope.scope)])]
        : selectedScopes.filter(scope => !sectionScopeSet.has(scope))
    );
  };

  if (normalizedScopes.length === 0) return null;

  return (
    <div
      style={{
        marginRight: -20,
        paddingRight: 20
      }}
    >
      <Flex direction="column" gap={12}>
        {scopeSections
          .filter(section => section.scopes.length > 0)
          .map(section => (
            <div key={section.id} style={{ padding: '6px 0 8px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(120px, 1fr) auto',
                  gap: 10,
                  alignItems: 'center'
                }}
              >
                <Text size="2" style={{ fontWeight: 600, lineHeight: 1.2 }}>
                  {section.title} ({section.scopes.length})
                </Text>
                <OptionToggle
                  size="1"
                  value={sectionModeOverrides[section.id] ?? getSectionMode(section.scopes)}
                  disabled={disabled}
                  onChange={value => {
                    if (value !== 'allow' && value !== 'reject' && value !== 'mixed') {
                      return;
                    }

                    setSectionMode(section.id, section.scopes, value);
                  }}
                  items={[
                    { id: 'allow', label: 'Allow' },
                    { id: 'reject', label: 'Reject' },
                    { id: 'mixed', label: 'Mixed' }
                  ]}
                />
              </div>

              <Flex direction="column" gap={0} style={{ marginTop: 12 }}>
                {section.scopes.map((scope, idx) => (
                  <div
                    key={scope.id ?? scope.scope}
                    style={{
                      padding: '9px 2px',
                      borderBottom:
                        idx === section.scopes.length - 1
                          ? 'none'
                          : `1px solid ${theme.colors.gray200}`
                    }}
                  >
                    <Checkbox
                      checked={selectedScopeSet.has(scope.scope)}
                      disabled={disabled}
                      onCheckedChange={checked => setScopeChecked(scope.scope, !!checked)}
                      label={
                        <Flex direction="column" gap={2}>
                          <Text size="2" weight="medium">
                            {scope.name ?? scope.scope}
                          </Text>
                          {scope.description ? (
                            <Text size="1" color="gray600">
                              {scope.description}
                            </Text>
                          ) : null}
                        </Flex>
                      }
                    />
                  </div>
                ))}
              </Flex>
            </div>
          ))}
      </Flex>
    </div>
  );
};
