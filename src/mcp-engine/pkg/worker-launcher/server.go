package launcher

import (
	"context"

	launcherPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/launcher"
)

type launcherServer struct {
	launcherPb.UnimplementedLauncherServer
}

func (l *launcherServer) RunLauncher(ctx context.Context, req *launcherPb.RunLauncherRequest) (*launcherPb.RunLauncherResponse, error) {
	return runLaunchParamsFunction(req.Config)
}
