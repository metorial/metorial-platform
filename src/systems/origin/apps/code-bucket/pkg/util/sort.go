package util

import (
	"sort"
)

func copySlice[T any](slice []T) []T {
	if slice == nil {
		return nil
	}
	copied := make([]T, len(slice))
	copy(copied, slice)
	return copied
}

func Sort[T any](slice []T, less func(a, b T) bool) []T {
	if slice == nil {
		return nil
	}

	copied := copySlice(slice)

	sort.Slice(copied, func(i, j int) bool {
		return less(copied[i], copied[j])
	})

	return copied
}
