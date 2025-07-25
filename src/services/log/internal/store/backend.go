package store

type StorageBackend interface {
	Store(key string, payload []byte) error
	Retrieve(key string) ([]byte, error)
	Delete(key string) error
}
