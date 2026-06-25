package util

func Find[T any](slice []T, predicate func(T) bool) (T, bool) {
	var zero T

	for _, item := range slice {
		if predicate(item) {
			return item, true
		}
	}

	return zero, false
}

func FindMax[T any](slice []T, val func(a T) int64) (T, bool) {
	if len(slice) == 0 {
		var zero T
		return zero, false
	}

	maxItem := slice[0]
	maxValue := val(maxItem)

	for _, item := range slice[1:] {
		value := val(item)
		if value > maxValue {
			maxItem = item
			maxValue = value
		}
	}

	return maxItem, true
}

func FindMin[T any](slice []T, val func(a T) int64) (T, bool) {
	if len(slice) == 0 {
		var zero T
		return zero, false
	}

	minItem := slice[0]
	minValue := val(minItem)

	for _, item := range slice[1:] {
		value := val(item)
		if value < minValue {
			minItem = item
			minValue = value
		}
	}

	return minItem, true
}
