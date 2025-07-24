package datastructures

import (
	"sync"
	"time"
)

type TransientMap[K comparable, V any] struct {
	elements map[K]V
	maxAge   time.Duration
	mu       sync.RWMutex
}

func NewTransientMap[K comparable, V any](maxAge time.Duration) *TransientMap[K, V] {
	res := &TransientMap[K, V]{
		elements: make(map[K]V),
		maxAge:   maxAge,
	}

	go res.monitor()

	return res
}

func (m *TransientMap[K, V]) Set(key K, value V) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.elements[key] = value
}

func (m *TransientMap[K, V]) Get(key K) (V, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	value, exists := m.elements[key]
	return value, exists
}

func (m *TransientMap[K, V]) Remove(key K) {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.elements, key)
}

func (m *TransientMap[K, V]) monitor() {
	for {
		time.Sleep(m.maxAge)
		m.mu.Lock()
		m.elements = make(map[K]V) // Clear the map after maxAge seconds
		m.mu.Unlock()
	}
}
