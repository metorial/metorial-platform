package session

import (
	"log"

	"github.com/google/uuid"
	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/launcher"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	mterror "github.com/metorial/metorial/mcp-engine/pkg/mt-error"
)

func processServerConfig(sessionId string, mcpClient *mcp.MCPClient, config *managerPb.ServerConfig, mcpConfig *mcpPb.McpConfig, db_ *db.DB) (*db.Server, *workers.WorkerConnectionInput, *mterror.MTError) {
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
		connectionInput.RemoteRunConfig, err = launcher.GetRemoteLaunchParams(config.GetRemoteRunConfigWithLauncher())
		if err != nil {
			return mterror.NewWithCodeAndInnerError(mterror.InvalidRequestKind, "failed_to_get_launch_params", err.Error(), err)
		}
	} else if config.GetRemoteRunConfigWithServer() != nil {
		connectionInput.RemoteRunConfig = config.GetRemoteRunConfigWithServer()
	} else {
		return mterror.New(mterror.InvalidRequestKind, "session must have a valid run config")
	}

	return nil
}
