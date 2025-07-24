package datastructures

import "sync"

type Set[T struct{} | string] struct {
	elements map[T]struct{}
	mu       sync.RWMutex
}

func NewSet[T struct{} | string]() *Set[T] {
	res := &Set[T]{
		elements: make(map[T]struct{}),
	}

	return res
}

func (s *Set[T]) Add(element T) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.elements[element] = struct{}{}
}

func (s *Set[T]) Contains(element T) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	_, exists := s.elements[element]
	return exists
}

func (s *Set[T]) Remove(element T) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.elements, element)
}
