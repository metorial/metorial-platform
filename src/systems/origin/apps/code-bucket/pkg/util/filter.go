package util

func Filter[T any](slice []T, predicate func(T) bool) []T {
	var result []T

	for _, item := range slice {
		if predicate(item) {
			result = append(result, item)
		}
	}

	return result
}
