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

// type DockerLaunchParams struct {
// 	Image       string            `json:"image" validate:"required"`
// 	Command     string            `json:"command" validate:"required"`
// 	Ports       []string          `json:"ports,omitempty"`
// 	Volumes     []string          `json:"volumes,omitempty"`
// 	Environment map[string]string `json:"environment,omitempty"`
// 	Network     string            `json:"network,omitempty"`
// }

// type DatabaseLaunchParams struct {
// 	Host     string `json:"host" validate:"required"`
// 	Port     int    `json:"port" validate:"required,min=1,max=65535"`
// 	Database string `json:"database" validate:"required"`
// 	Username string `json:"username" validate:"required"`
// 	Password string `json:"password" validate:"required"`
// 	SSLMode  string `json:"ssl_mode,omitempty"`
// }

// // Example usage functions
// func main() {
// 	// Example 1: Using raw result
// 	fmt.Println("=== Example 1: Raw Result ===")
// 	input := LaunchParamsInput{
// 		GetLaunchParams: `(config, ctx) => ({
// 			command: "echo",
// 			args: ["hello", config.message],
// 			env: {"TEST": "value", "VERBOSE": config.verbose ? "true" : "false"}
// 		})`,
// 		Config: map[string]any{
// 			"message": "Hello World",
// 			"verbose": true,
// 		},
// 	}

// 	rawResult, err := GetRawResult(input)
// 	if err != nil {
// 		fmt.Printf("Error: %v\n", err)
// 	} else {
// 		fmt.Printf("Raw result: %+v\n", rawResult)
// 	}

// 	// Example 2: Using typed conversion
// 	fmt.Println("\n=== Example 2: Typed Conversion ===")
// 	var standardParams StandardLaunchParams
// 	result := GetLaunchParams(input)
// 	err = ValidateAndConvert(result, &standardParams)
// 	if err != nil {
// 		fmt.Printf("Error: %v\n", err)
// 	} else {
// 		fmt.Printf("Typed result: %+v\n", standardParams)
// 	}

// 	// Example 3: Using generic helper
// 	fmt.Println("\n=== Example 3: Generic Helper ===")
// 	typedParams, err := GetTypedLaunchParams[StandardLaunchParams](input)
// 	if err != nil {
// 		fmt.Printf("Error: %v\n", err)
// 	} else {
// 		fmt.Printf("Generic typed result: %+v\n", typedParams)
// 	}

// 	// Example 4: Docker configuration
// 	fmt.Println("\n=== Example 4: Docker Configuration ===")
// 	dockerInput := LaunchParamsInput{
// 		GetLaunchParams: `(config, ctx) => ({
// 			image: config.image,
// 			command: config.command,
// 			ports: [config.port + ":80"],
// 			volumes: [config.dataDir + ":/data"],
// 			environment: {"NODE_ENV": config.env},
// 			network: config.network
// 		})`,
// 		Config: map[string]any{
// 			"image":   "nginx:latest",
// 			"command": "nginx -g 'daemon off;'",
// 			"port":    "8080",
// 			"dataDir": "/var/www",
// 			"env":     "production",
// 			"network": "bridge",
// 		},
// 	}

// 	dockerParams, err := GetTypedLaunchParams[DockerLaunchParams](dockerInput)
// 	if err != nil {
// 		fmt.Printf("Error: %v\n", err)
// 	} else {
// 		fmt.Printf("Docker params: %+v\n", dockerParams)
// 	}

// 	// Example 5: Using reflection to inspect result structure
// 	fmt.Println("\n=== Example 5: Dynamic Inspection ===")
// 	result = GetLaunchParams(input)
// 	if result.Type == LaunchParamsSuccess {
// 		inspectResult(result.Output)
// 	}
// }

// // Helper function to dynamically inspect the structure of the result
// func inspectResult(data any) {
// 	fmt.Printf("Type: %T\n", data)

// 	val := reflect.ValueOf(data)
// 	if val.Kind() == reflect.Map {
// 		fmt.Println("Fields:")
// 		for _, key := range val.MapKeys() {
// 			value := val.MapIndex(key)
// 			fmt.Printf("  %v: %v (type: %T)\n", key.Interface(), value.Interface(), value.Interface())
// 		}
// 	}
// }
