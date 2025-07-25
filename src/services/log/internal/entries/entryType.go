package entries

type EntryTypeInstance interface {
	ExtractLightRecord() (map[string]any, error)
}

type EntryType interface {
	GetTypeName() string

	ParsePayload(payloadJSON string) (EntryTypeInstance, error)
	GetFilterFields() []FilterField
}

type FilterField struct {
	Name string
}
