package mcp_runner_client

import (
	"context"
	"fmt"

	runnerPb "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/runner"
	grpc_util "github.com/metorial/metorial/mcp-broker/pkg/grpc-util"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type McpRunnerClient struct {
	conn   *grpc.ClientConn
	client runnerPb.McpRunnerClient
}

func NewMcpRunnerClient(address string) (*McpRunnerClient, error) {
	conn, err := grpc.NewClient(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}

	client := runnerPb.NewMcpRunnerClient(conn)

	res := &McpRunnerClient{
		conn:   conn,
		client: client,
	}

	return res, nil
}

func (c *McpRunnerClient) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

func (c *McpRunnerClient) Wait() {
	grpc_util.WaitForConnectionClose(c.conn)
}

func (c *McpRunnerClient) GetRunnerInfo() (*runnerPb.RunnerInfoResponse, error) {
	if c.client == nil {
		return nil, fmt.Errorf("McpRunnerClient is not initialized")
	}

	return c.client.GetRunnerInfo(context.Background(), &runnerPb.RunnerInfoRequest{})
}

func (c *McpRunnerClient) StreamRunnerHealth(onHealthUpdate func(*runnerPb.RunnerHealthResponse)) error {
	if c.client == nil {
		return fmt.Errorf("McpRunnerClient is not initialized")
	}

	stream, err := c.client.StreamRunnerHealth(context.Background(), &runnerPb.RunnerHealthRequest{})
	if err != nil {
		return err
	}

	for {
		resp, err := stream.Recv()
		if err != nil {
			return err
		}

		onHealthUpdate(resp)
	}
}

func (c *McpRunnerClient) StreamMcpRun(config *runnerPb.RunConfig) (*Run, error) {
	if c.client == nil {
		return nil, fmt.Errorf("McpRunnerClient is not initialized")
	}

	return NewRun(config, c.client), nil
}
