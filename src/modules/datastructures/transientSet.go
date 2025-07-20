package datastructures

import "time"

type TransientSet[T struct{}] struct {
	elements map[T]struct{}
	maxAge   time.Duration
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
	s.elements[element] = struct{}{}
}

func (s *TransientSet[T]) Contains(element T) bool {
	_, exists := s.elements[element]
	return exists
}

func (s *TransientSet[T]) Remove(element T) {
	delete(s.elements, element)
}

func (s *TransientSet[T]) monitor() {
	for {
		time.Sleep(s.maxAge)
		s.elements = make(map[T]struct{}) // Clear the set after maxAge seconds
	}
}
