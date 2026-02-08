package murmur3

func PickByHashIndex(data []byte, numItems int) int {
	if numItems <= 0 {
		return -1 // Invalid number of items
	}

	hash := Murmur3_32(data, 0)
	index := hash % uint32(numItems)

	return int(index)
}

func PickByHash[T any](data []byte, items []T) (T, bool) {
	if len(items) == 0 {
		var zero T
		return zero, false // No items to pick from
	}

	index := PickByHashIndex(data, len(items))
	if index < 0 || index >= len(items) {
		var zero T
		return zero, false // Invalid index
	}

	return items[index], true
}
