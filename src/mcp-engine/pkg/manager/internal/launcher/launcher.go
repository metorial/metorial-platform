package launcher

import (
	"fmt"
)

func GetTypedLaunchParams[T any](input LaunchParamsInput) (T, error) {
	var zero T
	result := runLaunchParamsFunction(input)

	if result.Type != LaunchParamsSuccess {
		return zero, fmt.Errorf("launch params execution failed: %v", result.Output)
	}

	var target T
	err := ValidateAndConvert(result, &target)
	if err != nil {
		return zero, err
	}

	return target, nil
}

func GetRawResult(input LaunchParamsInput) (map[string]any, error) {
	result := runLaunchParamsFunction(input)

	if result.Type != LaunchParamsSuccess {
		return nil, fmt.Errorf("launch params execution failed: %v", result.Output)
	}

	if rawMap, ok := result.Output.(map[string]any); ok {
		return rawMap, nil
	}

	return nil, fmt.Errorf("result is not a map[string]any")
}
