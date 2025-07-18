package datastructures

import "time"

type TransientMap[K comparable, V any] struct {
	elements map[K]V
	maxAge   time.Duration
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
	m.elements[key] = value
}

func (m *TransientMap[K, V]) Get(key K) (V, bool) {
	value, exists := m.elements[key]
	return value, exists
}

func (m *TransientMap[K, V]) Remove(key K) {
	delete(m.elements, key)
}

func (m *TransientMap[K, V]) monitor() {
	for {
		time.Sleep(m.maxAge)
		m.elements = make(map[K]V) // Clear the map after maxAge seconds
	}
}
