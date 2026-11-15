package util

func Ternary[T any](condition bool, trueValue T, falseValue T) T {
	if condition {
		return trueValue
	}

	return falseValue
}
