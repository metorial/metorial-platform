package util

func MapWithError[I any, O any](input []I, mapFunc func(I) (O, error)) ([]O, error) {
	if input == nil {
		return nil, nil
	}
	output := make([]O, len(input))
	for i, item := range input {
		result, err := mapFunc(item)
		if err != nil {
			return nil, err
		}
		output[i] = result
	}
	return output, nil
}
