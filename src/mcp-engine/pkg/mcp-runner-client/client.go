package mcp_runner_client

import (
	"context"
	"fmt"

	runnerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/runner"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type McpRunnerClient struct {
	conn   *grpc.ClientConn
	client runnerPb.McpRunnerClient

	healthStopped chan struct{}
}

func NewMcpRunnerClient(address string) (*McpRunnerClient, error) {
	conn, err := grpc.NewClient(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}

	client := runnerPb.NewMcpRunnerClient(conn)

	res := &McpRunnerClient{
		conn:          conn,
		client:        client,
		healthStopped: make(chan struct{}),
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
	<-c.healthStopped
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

	defer func() {
		if c.healthStopped != nil {
			close(c.healthStopped)
		}
	}()

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
