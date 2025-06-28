package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	mcp_runner_client "github.com/metorial/metorial/mcp-broker/pkg/mcp-runner-client"
	pb "github.com/metorial/metorial/mcp-broker/pkg/proto-mcp-runner"
)

func main() {
	address, image, cmd, args, envFlags := getConfig()

	client, err := mcp_runner_client.NewMcpRunnerClient(address)
	if err != nil {
		log.Fatalf("Failed to create MCP Runner client: %v", err)
	}

	stream, err := client.StreamMcpRun(&pb.RunConfig{
		DockerImage: image,
		Args:        args,
		EnvVars:     envFlags,
		Command:     cmd,
	})
	if err != nil {
		log.Fatalf("Failed to start MCP run stream: %v", err)
	}

	stream.AddErrorHandler(func(mrre *pb.McpRunResponseError) error {
		fmt.Printf("Error in MCP run: %s\n", mrre.ErrorMessage)
		return nil
	})

	stream.AddOutputHandler(func(mrro *pb.McpRunResponseOutput) error {
		for _, line := range mrro.Lines {
			fmt.Printf("Output: %s\n", line)
		}
		return nil
	})

	stream.AddMessageHandler(func(mrmm *pb.McpRunResponseMcpMessage) error {
		fmt.Printf("MCP Message: %s\n", mrmm.Message)
		return nil
	})

	stream.AddSenderHandler(func(run *mcp_runner_client.Run) {
		fmt.Printf("Run started with ID: %s\n", run.RemoteID)

		msg, _ := json.Marshal(map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"method":  "initialize",
			"params": map[string]interface{}{
				"protocolVersion": "2024-11-05",
				"capabilities":    map[string]interface{}{},
				"clientInfo": map[string]string{
					"name":    "Test Client",
					"version": "1.0.0",
				},
			},
		})

		run.SendMessage(string(msg))
		fmt.Printf("Sent initialization message: %s\n", msg)

		time.Sleep(100 * time.Millisecond)

		msg, _ = json.Marshal(map[string]interface{}{
			"jsonrpc": "2.0",
			"method":  "notifications/initialized",
		})

		run.SendMessage(string(msg))
		fmt.Printf("Sent initialized message: %s\n", msg)

		time.Sleep(100 * time.Millisecond)

		msg, _ = json.Marshal(map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      2,
			"method":  "tools/list",
		})

		run.SendMessage(string(msg))
		fmt.Printf("Sent list tools: %s\n", msg)
	})

	err = stream.Start()
	if err != nil {
		log.Fatalf("Failed to start MCP run: %v", err)
	}
}

func getConfig() (string, string, string, []string, map[string]string) {
	addrArg := flag.String("address", "localhost:50051", "Address for the MCP Runner to connect to")

	var envFlags []string
	var remainingArgs []string

	args := os.Args[1:] // skip program name

	// Extract --env arguments and collect remaining args
	for i := 0; i < len(args); i++ {
		if args[i] == "--env" {
			if i+1 >= len(args) {
				log.Fatalf("Missing value after --env")
			}
			envFlags = append(envFlags, args[i+1])
			i++ // skip next because it's the value
		} else {
			remainingArgs = append(remainingArgs, args[i])
		}
	}

	// Replace os.Args with filtered args so flag.Parse() works correctly
	os.Args = append([]string{os.Args[0]}, remainingArgs...)
	flag.Parse()

	address := *addrArg
	if address == "" {
		log.Fatal("Address argument is required")
	}

	// Remaining non-flag args
	otherArgs := flag.Args()
	if len(otherArgs) < 2 {
		log.Fatal("At least two positional arguments are required: image and command")
	}

	image := otherArgs[0]
	cmd := otherArgs[1]
	restArgs := otherArgs[2:]

	envVars := make(map[string]string)
	for _, env := range envFlags {
		parts := strings.SplitN(env, "=", 2)
		if len(parts) != 2 {
			log.Fatalf("Invalid env format: %q. Expected KEY=VALUE", env)
		}
		key := parts[0]
		value := parts[1]
		envVars[key] = value
	}

	return address, image, cmd, restArgs, envVars
}
