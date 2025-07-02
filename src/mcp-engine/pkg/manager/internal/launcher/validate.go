package launcher

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/go-playground/validator/v10"
)

type LaunchParamsInput struct {
	GetLaunchParams string         `json:"getLaunchParams"`
	Config          map[string]any `json:"config"`
}

type LaunchParamsResultType string

const (
	LaunchParamsSuccess LaunchParamsResultType = "success"
	LaunchParamsError   LaunchParamsResultType = "error"
)

type LaunchParamsResult struct {
	Type   LaunchParamsResultType `json:"type"`
	Output any                    `json:"output"`
}

func ValidateAndConvert[T any](result LaunchParamsResult, target *T) error {
	if result.Type != LaunchParamsSuccess {
		return fmt.Errorf("result is not successful: %v", result.Output)
	}

	// Convert any to JSON and then to target struct
	dataJSON, err := json.Marshal(result.Output)
	if err != nil {
		return fmt.Errorf("failed to marshal result data: %v", err)
	}

	err = json.Unmarshal(dataJSON, target)
	if err != nil {
		return fmt.Errorf("failed to unmarshal to target type: %v", err)
	}

	// Validate using go-playground/validator
	validate := validator.New()
	err = validate.Struct(target)
	if err != nil {
		var errorMessages []string
		for _, err := range err.(validator.ValidationErrors) {
			errorMessages = append(errorMessages, fmt.Sprintf("Field '%s' failed validation: %s", err.Field(), err.Tag()))
		}
		return fmt.Errorf("validation failed: %s", strings.Join(errorMessages, ", "))
	}

	return nil
}
