package util

func Must[T any](value T, err error) T {
	if err != nil {
		panic(err)
	}

	return value
}

func MustOrFallback[T any](fallback T) func(value T, err error) T {
	return func(value T, err error) T {
		if err != nil {
			return fallback
		}

		return value
	}
}
