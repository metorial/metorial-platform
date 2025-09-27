package session

import (
	"encoding/json"
	"log"

	"github.com/google/uuid"
	mcpTypes "github.com/mark3labs/mcp-go/mcp"
	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/mcp-engine/gen/mcp-engine/remote"
	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/launcher"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	mterror "github.com/metorial/metorial/mcp-engine/pkg/mtError"
)

func processServerConfig(
	sessionId string,
	mcpClient *mcp.MCPClient,
	config *managerPb.ServerConfig,
	mcpConfig *mcpPb.McpConfig,
	db_ *db.DB,
	statefulServerInfo *managerPb.StatefulServerInfo,
) (*db.Server, *workers.WorkerConnectionInput, *mterror.MTError) {
	var workerType workers.WorkerType
	var dbType db.SessionType
	serverIdentifier := ""

	switch config.ConfigType.(type) {
	case *managerPb.ServerConfig_ContainerRunConfigWithLauncher, *managerPb.ServerConfig_ContainerRunConfigWithContainerArguments:
		workerType = workers.WorkerTypeContainer
		dbType = db.SessionTypeContainer

		if config.GetContainerRunConfigWithLauncher() != nil {
			serverIdentifier = config.GetContainerRunConfigWithLauncher().Container.DockerImage
		} else if config.GetContainerRunConfigWithContainerArguments() != nil {
			serverIdentifier = config.GetContainerRunConfigWithContainerArguments().Container.DockerImage
		}

	case *managerPb.ServerConfig_RemoteRunConfigWithLauncher, *managerPb.ServerConfig_RemoteRunConfigWithServer:
		workerType = workers.WorkerTypeRemote
		dbType = db.SessionTypeRemote

		if config.GetRemoteRunConfigWithLauncher() != nil {
			serverIdentifier = config.GetRemoteRunConfigWithLauncher().Server.ServerUri
		} else if config.GetRemoteRunConfigWithServer() != nil {
			serverIdentifier = config.GetRemoteRunConfigWithServer().Server.ServerUri
		}

	case *managerPb.ServerConfig_LambdaRunConfigWithLauncher, *managerPb.ServerConfig_LambdaRunConfigWithServer:
		workerType = workers.WorkerTypeRemote
		dbType = db.SessionTypeLambda

		if config.GetLambdaRunConfigWithLauncher() != nil {
			serverIdentifier = *config.GetLambdaRunConfigWithLauncher().Server.ProviderResourceAccessIdentifier
		} else if config.GetLambdaRunConfigWithServer() != nil {
			serverIdentifier = *config.GetLambdaRunConfigWithServer().Server.ProviderResourceAccessIdentifier
		}
	}

	if serverIdentifier == "" {
		serverIdentifier = uuid.NewString()
	}

	if mcpConfig == nil {
		mcpConfig = &mcpPb.McpConfig{
			McpVersion: mcp.DEFAULT_MCP_VERSION.String(),
		}
	}

	connectionInput := &workers.WorkerConnectionInput{
		WorkerType:   workerType,
		SessionID:    sessionId,
		ConnectionID: "",
		MCPClient:    mcpClient,
		McpConfig:    mcpConfig,
	}

	server, err := db_.EnsureServerByIdentifier(dbType, serverIdentifier)
	if err != nil {
		log.Printf("Failed to ensure server by identifier: %v\n", err)
		return nil, nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to ensure server by identifier", err)
	}

	if statefulServerInfo != nil {
		tools := make([]mcpTypes.Tool, 0)
		if statefulServerInfo.ToolsJson != "" {
			err := json.Unmarshal([]byte(statefulServerInfo.ToolsJson), &tools)
			if err != nil {
				log.Printf("Failed to unmarshal tools JSON: %v\n", err)
				return nil, nil, mterror.NewWithInnerError(mterror.InvalidRequestKind, "failed to unmarshal tools JSON", err)
			}
		}

		prompts := make([]mcpTypes.Prompt, 0)
		if statefulServerInfo.PromptsJson != "" {
			err := json.Unmarshal([]byte(statefulServerInfo.PromptsJson), &prompts)
			if err != nil {
				log.Printf("Failed to unmarshal prompts JSON: %v\n", err)
				return nil, nil, mterror.NewWithInnerError(mterror.InvalidRequestKind, "failed to unmarshal prompts JSON", err)
			}
		}

		resourceTemplates := make([]mcpTypes.ResourceTemplate, 0)
		if statefulServerInfo.ResourceTemplatesJson != "" {
			err := json.Unmarshal([]byte(statefulServerInfo.ResourceTemplatesJson), &resourceTemplates)
			if err != nil {
				log.Printf("Failed to unmarshal resources JSON: %v\n", err)
				return nil, nil, mterror.NewWithInnerError(mterror.InvalidRequestKind, "failed to unmarshal resources JSON", err)
			}
		}

		var capabilities mcp.Capabilities
		if statefulServerInfo.CapabilitiesJson != "" {
			err := json.Unmarshal([]byte(statefulServerInfo.CapabilitiesJson), &capabilities)
			if err != nil {
				log.Printf("Failed to unmarshal capabilities JSON: %v\n", err)
				return nil, nil, mterror.NewWithInnerError(mterror.InvalidRequestKind, "failed to unmarshal capabilities JSON", err)
			}
		}

		var serverInfo mcp.ParticipantInfo
		if statefulServerInfo.ServerInfoJson != "" {
			err := json.Unmarshal([]byte(statefulServerInfo.ServerInfoJson), &serverInfo)
			if err != nil {
				log.Printf("Failed to unmarshal server info JSON: %v\n", err)
				return nil, nil, mterror.NewWithInnerError(mterror.InvalidRequestKind, "failed to unmarshal server info JSON", err)
			}
		}

		var instructions *string
		if statefulServerInfo.InstructionsJson != "" {
			err := json.Unmarshal([]byte(statefulServerInfo.InstructionsJson), &instructions)
			if err != nil {
				log.Printf("Failed to unmarshal instructions JSON: %v\n", err)
				return nil, nil, mterror.NewWithInnerError(mterror.InvalidRequestKind, "failed to unmarshal instructions JSON", err)
			}
		}

		server.Tools = tools
		server.Prompts = prompts
		server.ResourceTemplates = resourceTemplates

		if server.McpServer == nil {
			server.McpServer = &mcp.MCPServer{}
		}

		server.McpServer.Info = serverInfo
		server.McpServer.Capabilities = capabilities

		if instructions != nil {
			server.McpServer.Instructions = *instructions
		}
	}

	return server, connectionInput, nil
}

func workerTypeToDbType(workerType workers.WorkerType) db.SessionType {
	switch workerType {
	case workers.WorkerTypeContainer:
		return db.SessionTypeContainer
	case workers.WorkerTypeRemote:
		return db.SessionTypeRemote
	default:
		return db.SessionTypeUnknown
	}
}

func runLauncherForServerConfigIfNeeded(launcher *launcher.Launcher, connectionInput *workers.WorkerConnectionInput, config *managerPb.ServerConfig) *mterror.MTError {
	var err error

	if config.GetContainerRunConfigWithLauncher() != nil {
		connectionInput.ContainerRunConfig, err = launcher.GetContainerLaunchParams(config.GetContainerRunConfigWithLauncher())
		if err != nil {
			return mterror.NewWithCodeAndInnerError(mterror.InvalidRequestKind, "failed_to_get_launch_params", err.Error(), err)
		}
	} else if config.GetContainerRunConfigWithContainerArguments() != nil {
		connectionInput.ContainerRunConfig = config.GetContainerRunConfigWithContainerArguments()
	} else if config.GetRemoteRunConfigWithLauncher() != nil {
		remoteConfig, err := launcher.GetRemoteLaunchParams(config.GetRemoteRunConfigWithLauncher())
		if err != nil {
			return mterror.NewWithCodeAndInnerError(mterror.InvalidRequestKind, "failed_to_get_launch_params", err.Error(), err)
		}
		connectionInput.RemoteRunConfig = &remote.RunConfig{
			Config: &remote.RunConfig_RemoteRunConfig{
				RemoteRunConfig: remoteConfig,
			},
		}
	} else if config.GetRemoteRunConfigWithServer() != nil {
		connectionInput.RemoteRunConfig = &remote.RunConfig{
			Config: &remote.RunConfig_RemoteRunConfig{
				RemoteRunConfig: config.GetRemoteRunConfigWithServer(),
			},
		}
	} else if config.GetLambdaRunConfigWithLauncher() != nil {
		lambdaRunConfig, err := launcher.GetLambdaLaunchParams(config.GetLambdaRunConfigWithLauncher())
		if err != nil {
			return mterror.NewWithCodeAndInnerError(mterror.InvalidRequestKind, "failed_to_get_launch_params", err.Error(), err)
		}
		connectionInput.RemoteRunConfig = &remote.RunConfig{
			Config: &remote.RunConfig_LambdaRunConfig{
				LambdaRunConfig: lambdaRunConfig,
			},
		}
	} else if config.GetLambdaRunConfigWithServer() != nil {
		connectionInput.RemoteRunConfig = &remote.RunConfig{
			Config: &remote.RunConfig_LambdaRunConfig{
				LambdaRunConfig: config.GetLambdaRunConfigWithServer(),
			},
		}
	} else {
		return mterror.New(mterror.InvalidRequestKind, "session must have a valid run config")
	}

	return nil
}
