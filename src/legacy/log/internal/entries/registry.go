package entries

type EntryTypeRegistry struct {
	types map[string]EntryType
}

func (r *EntryTypeRegistry) Register(entryType EntryType) {
	r.types[entryType.GetTypeName()] = entryType
}

func (r *EntryTypeRegistry) Get(typeName string) (EntryType, bool) {
	et, exists := r.types[typeName]
	return et, exists
}

func (r *EntryTypeRegistry) GetAll() []EntryType {
	types := make([]EntryType, 0, len(r.types))
	for _, et := range r.types {
		types = append(types, et)
	}
	return types
}

var DefaultEntryTypeRegistry = &EntryTypeRegistry{
	types: map[string]EntryType{
		"api_request": ApiRequestEntryType,
	},
}
