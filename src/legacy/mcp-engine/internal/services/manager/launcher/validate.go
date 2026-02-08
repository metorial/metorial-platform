package launcher

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/go-playground/validator/v10"
	launcherPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/launcher"
)

func ValidateAndConvert[T any](result *launcherPb.RunLauncherResponse, target *T) error {
	if result.Type != launcherPb.RunLauncherResponse_success {
		return fmt.Errorf("result is not successful: %v", result.ErrorMessage)
	}

	if result.JsonOutput == "" {
		return fmt.Errorf("launch did not return any JSON output")
	}

	err := json.Unmarshal([]byte(result.JsonOutput), target)
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
