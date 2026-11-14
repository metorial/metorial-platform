package supervisor

import (
	"encoding/json"
	"fmt"
	"time"
)

// Failures the worker can't report itself use the launcher's { statusCode, body } envelope,
// so function-bay's parseInvocationPayload maps them like handler errors.
func errorEnvelope(statusCode int, code, message string) json.RawMessage {
	out, _ := json.Marshal(map[string]any{
		"statusCode": statusCode,
		"body":       map[string]any{"error": map[string]any{"code": code, "message": message}},
	})
	return out
}

func timeoutEnvelope(timeout time.Duration) json.RawMessage {
	return errorEnvelope(504, "function_bay.timeout", fmt.Sprintf("Function timed out after %s", timeout.Round(time.Millisecond)))
}

func crashEnvelope(reason string) json.RawMessage {
	message := "Function process exited unexpectedly"
	if reason != "" {
		message += ": " + reason
	}
	return errorEnvelope(500, "function_bay.crash", message)
}

func bootErrorEnvelope(reason string) json.RawMessage {
	message := "Function threw an error during initialization"
	if reason != "" {
		message += ": " + reason
	}
	return errorEnvelope(500, "function_bay.boot_error", message)
}

func responseTooLargeEnvelope(size int) json.RawMessage {
	return errorEnvelope(500, "function_bay.response_too_large", fmt.Sprintf("Function response of %d bytes exceeds the %d byte limit", size, MaxPayloadBytes))
}
