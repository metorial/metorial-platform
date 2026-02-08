package store

import (
	"github.com/metorial/metorial/services/log/internal/entries"
	"go.mongodb.org/mongo-driver/mongo"
)

type StoreTypeRegistry struct {
	types map[string]*LogStore

	storageBackend StorageBackend
	db             *mongo.Database
}

func NewStoreTypeRegistry(entryTypeRegistry *entries.EntryTypeRegistry, storageBackend StorageBackend, db *mongo.Database) *StoreTypeRegistry {
	types := make(map[string]*LogStore)

	for _, entryType := range entryTypeRegistry.GetAll() {
		store := NewLogStore(entryType, storageBackend, db)
		types[entryType.GetTypeName()] = store
	}

	return &StoreTypeRegistry{
		storageBackend: storageBackend,
		db:             db,
		types:          types,
	}
}

func (r *StoreTypeRegistry) Get(typeName string) (*LogStore, bool) {
	et, exists := r.types[typeName]
	return et, exists
}

func (r *StoreTypeRegistry) Stop() {
	for _, store := range r.types {
		store.queue.Stop()
	}
}
