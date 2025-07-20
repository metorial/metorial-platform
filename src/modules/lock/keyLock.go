package lock

import (
	"sync"
)

type refMutex struct {
	mu   sync.Mutex
	refs int
}

type KeyLock struct {
	mu    sync.Mutex
	locks map[string]*refMutex
}

func NewKeyLock() *KeyLock {
	return &KeyLock{
		locks: make(map[string]*refMutex),
	}
}

func (kl *KeyLock) Lock(key string) {
	kl.mu.Lock()
	rm, exists := kl.locks[key]
	if !exists {
		rm = &refMutex{}
		kl.locks[key] = rm
	}
	rm.refs++
	kl.mu.Unlock()

	rm.mu.Lock()
}

func (kl *KeyLock) Unlock(key string) {
	kl.mu.Lock()
	rm, exists := kl.locks[key]
	if !exists {
		kl.mu.Unlock()
		panic("unlock of unacquired key")
	}

	rm.refs--
	shouldDelete := rm.refs == 0
	kl.mu.Unlock()

	rm.mu.Unlock()

	if shouldDelete {
		kl.mu.Lock()
		// double-check refs in case another goroutine acquired the lock again
		if rm.refs == 0 {
			delete(kl.locks, key)
		}
		kl.mu.Unlock()
	}
}
