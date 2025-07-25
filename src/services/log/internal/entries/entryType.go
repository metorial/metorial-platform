package entries

import "time"

type EntryTypeInstance interface {
	ExtractLightRecord() (map[string]any, error)
}

type EntryType interface {
	GetTypeName() string
	GetCleanupDuration() time.Duration

	ParsePayload(payloadJSON string) (EntryTypeInstance, error)
	GetFilterFields() []FilterField
}

type FilterField struct {
	Name string
}
