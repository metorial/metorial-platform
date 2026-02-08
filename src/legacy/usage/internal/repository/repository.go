package repository

import "sync"

type Repository struct {
	usageCache map[string]*UsageRecord
	cacheMutex sync.RWMutex

	store UsageStore
}

func NewRepository(store UsageStore) *Repository {
	res := &Repository{
		usageCache: make(map[string]*UsageRecord),
		store:      store,
	}

	res.startBatchProcessor()

	return res
}
