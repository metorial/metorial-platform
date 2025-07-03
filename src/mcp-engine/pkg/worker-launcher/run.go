package launcher

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"

	launcherPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/launcher"
)

var fileIndex int64

func runLaunchParamsFunction(input *launcherPb.LauncherConfig) (*launcherPb.RunLauncherResponse, error) {
	// Create the launcher context script
	configJSON, err := json.Marshal(input.JsonConfig)
	if err != nil {
		return &launcherPb.RunLauncherResponse{
			Type:         launcherPb.RunLauncherResponse_error,
			ErrorMessage: fmt.Sprintf("Failed to marshal config: %v", err),
		}, nil
	}

	getLaunchParamsJSON, err := json.Marshal(input.Code)
	if err != nil {
		return &launcherPb.RunLauncherResponse{
			Type:         launcherPb.RunLauncherResponse_error,
			ErrorMessage: fmt.Sprintf("Failed to marshal getLaunchParams: %v", err),
		}, nil
	}

	script := fmt.Sprintf(`
let launcherContext = (config) => ({
  args: {
    flags: (input) => {
      if (typeof input !== 'object' || input === null) {
        throw new Error('Invalid input, expected object');
      }

      if (typeof input.separator !== 'string' && input.separator !== undefined) {
        throw new Error('Invalid input.separator, expected string');
      }

      if (typeof input.args !== 'object' || input.args === null) {
        throw new Error('Invalid input.args, expected object');
      }

      let args = (Array.isArray(input.args) ? input.args : Object.entries(input.args))
        .map(arg => {
          let configValue = config[arg[1]];
          if (configValue === undefined || configValue === null || configValue === '')
            return undefined;

          return [arg[0], configValue];
        })
        .filter(Boolean);

      if (input.separator) {
        return args.map(arg => arg.join(input.separator));
      }

      return args.flatMap(arg => arg);
    }
  }
})

let config = %s;

let launcher = eval(%s);

let output = typeof launcher == 'function' ? 
  launcher(config, launcherContext(config)) : 
  launcher;

console.log(JSON.stringify({ type: 'success', data: output }));
`, string(configJSON), string(getLaunchParamsJSON))

	// Create temporary file
	tempDir := os.TempDir()
	currentIndex := atomic.AddInt64(&fileIndex, 1)
	tempFile := filepath.Join(tempDir, fmt.Sprintf("metorial-runner-launcher-%d.js", currentIndex))

	err = os.WriteFile(tempFile, []byte(script), 0644)
	if err != nil {
		return &launcherPb.RunLauncherResponse{
			Type:         launcherPb.RunLauncherResponse_error,
			ErrorMessage: fmt.Sprintf("Failed to write temp file: %v", err),
		}, nil
	}

	// Clean up temp file
	defer os.Remove(tempFile)

	// Execute with timeout using Deno
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "deno", "run",
		"--v8-flags=--max-old-space-size=20",
		fmt.Sprintf("--allow-read=%s", tempFile),
		"--deny-write",
		"--deny-env",
		"--deny-sys",
		"--deny-net",
		"--deny-run",
		"--deny-ffi",
		tempFile)

	stdout, err := cmd.Output()
	var stderr []byte
	if exitError, ok := err.(*exec.ExitError); ok {
		stderr = exitError.Stderr
	}

	stdoutStr := string(stdout)
	stderrStr := string(stderr)

	// Replace temp file path in output
	stdoutStr = strings.ReplaceAll(stdoutStr, tempFile, "metorial-launcher.js")
	stderrStr = strings.ReplaceAll(stderrStr, tempFile, "metorial-launcher.js")

	// Check if command failed
	if err != nil {
		errorOutput := strings.TrimSpace(strings.Join([]string{stdoutStr, stderrStr}, "\n"))
		return &launcherPb.RunLauncherResponse{
			Type:         launcherPb.RunLauncherResponse_error,
			ErrorMessage: errorOutput,
		}, nil
	}

	lines := strings.Split(stdoutStr, "\n")
	var lastLine string
	for i := len(lines) - 1; i >= 0; i-- {
		if strings.TrimSpace(lines[i]) != "" {
			lastLine = strings.TrimSpace(lines[i])
			break
		}
	}

	if lastLine == "" {
		return &launcherPb.RunLauncherResponse{
			Type:         launcherPb.RunLauncherResponse_error,
			ErrorMessage: fmt.Sprintf("No output from launcher script: %s\n%s", stdoutStr, stderrStr),
		}, nil
	}

	// Parse JSON response
	var response struct {
		Type string `json:"type"`
		Data any    `json:"data"`
	}

	err = json.Unmarshal([]byte(lastLine), &response)
	if err != nil {
		return &launcherPb.RunLauncherResponse{
			Type:         launcherPb.RunLauncherResponse_error,
			ErrorMessage: fmt.Sprintf("Failed to parse output from launcher script: %s\n%s", stdoutStr, stderrStr),
		}, nil
	}

	if response.Type != "success" {
		return &launcherPb.RunLauncherResponse{
			Type:         launcherPb.RunLauncherResponse_error,
			ErrorMessage: fmt.Sprintf("Launcher script returned error: %v", response.Data),
		}, nil
	}

	outputData, err := json.Marshal(response.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal output data: %v", err)
	}

	return &launcherPb.RunLauncherResponse{
		Type:       launcherPb.RunLauncherResponse_success,
		JsonOutput: string(outputData),
	}, nil
}
