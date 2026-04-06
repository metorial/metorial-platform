package util

func Map[I any, O any](input []I, mapFunc func(I) O) []O {
	if input == nil {
		return nil
	}
	output := make([]O, len(input))
	for i, item := range input {
		output[i] = mapFunc(item)
	}
	return output
}
