package datastructures

import (
	"sync"
	"time"
)

type TransientSet[T struct{}] struct {
	elements map[T]struct{}
	maxAge   time.Duration
	mu       sync.RWMutex
}

func NewTransientSet[T struct{}](maxAge time.Duration) *TransientSet[T] {
	res := &TransientSet[T]{
		elements: make(map[T]struct{}),
		maxAge:   maxAge,
	}

	go res.monitor()

	return res
}

func (s *TransientSet[T]) Add(element T) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.elements[element] = struct{}{}
}

func (s *TransientSet[T]) Contains(element T) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	_, exists := s.elements[element]
	return exists
}

func (s *TransientSet[T]) Remove(element T) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.elements, element)
}

func (s *TransientSet[T]) monitor() {
	for {
		time.Sleep(s.maxAge)

		s.mu.Lock()
		s.elements = make(map[T]struct{}) // Clear the set after maxAge seconds
		s.mu.Unlock()
	}
}
