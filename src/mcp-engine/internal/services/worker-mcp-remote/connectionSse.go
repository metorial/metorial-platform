package remote

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"

	"github.com/google/uuid"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	remotePb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/remote"
	"github.com/metorial/metorial/mcp-engine/pkg/addr"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	"github.com/metorial/metorial/mcp-engine/pkg/util"
	"github.com/tmaxmax/go-sse"
)

type ConnectionSSE struct {
	sendEndpoint string

	req  *http.Request
	conn *sse.Connection

	ctx    context.Context
	cancel context.CancelCauseFunc

	wg sync.WaitGroup
}

func NewConnectionSSE(ctx context.Context, config *remotePb.RunConfig) (*ConnectionSSE, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, config.Server.ServerUri, http.NoBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request for SSE endpoint: %w", err)
	}

	conn := sse.DefaultClient.NewConnection(req)

	ctx, cancel := context.WithCancelCause(ctx)

	res := &ConnectionSSE{
		req:  req,
		conn: conn,

		ctx:    ctx,
		cancel: cancel,
	}

	res.wg.Add(1)
	doneOnce := &sync.Once{}
	cancelOnce := &sync.Once{}

	go func() {
		err := conn.Connect()
		if err != nil {
			doneOnce.Do(func() {
				res.wg.Done()
			})

			cancelOnce.Do(func() {
				res.cancel(fmt.Errorf("failed to connect to SSE endpoint: %w", err))
			})

			return
		}
	}()

	unsubscribe := conn.SubscribeEvent("endpoint", func(event sse.Event) {
		defer doneOnce.Do(func() {
			res.wg.Done()
		})

		if event.Data == "" {
			cancelOnce.Do(func() {
				res.cancel(fmt.Errorf("server did not respond with a valid SSE endpoint"))
			})

			return
		}

		uri := event.Data

		if !strings.HasPrefix(uri, "http") {
			newURI, err := addr.ReplaceURIPath(req.URL.String(), uri)
			if err == nil {
				uri = newURI
			}
		}

		res.sendEndpoint = uri

	})

	go func() {
		defer unsubscribe()
		res.wg.Wait()
	}()

	if res.sendEndpoint == "" {
		return nil, fmt.Errorf("server did not respond with a valid SSE endpoint")
	}

	res.wg.Wait()

	if res.ctx.Err() != nil {
		return nil, fmt.Errorf("context cancelled: %w", res.ctx.Err())
	}

	return res, nil
}

func (c *ConnectionSSE) Send(msg *mcpPb.McpMessageRaw) error {
	c.wg.Wait()

	if c.sendEndpoint == "" {
		return fmt.Errorf("send endpoint is not set")
	}

	req, err := http.NewRequestWithContext(c.ctx, http.MethodPost, c.sendEndpoint, strings.NewReader(string(msg.Message)))
	if err != nil {
		return fmt.Errorf("failed to create request for sending data: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send data: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to send data, server responded with status code: %d", resp.StatusCode)
	}

	return nil
}

func (c *ConnectionSSE) Subscribe(cb MessageReceiver) {
	c.conn.SubscribeMessages(func(e sse.Event) {
		msg, err := mcp.ParseMCPMessage(util.Must(uuid.NewV7()).String(), e.Data)
		if err != nil {
			cb(&remotePb.RunResponse{
				Type: &remotePb.RunResponse_Output{
					Output: &remotePb.RunResponseOutput{
						McpOutput: &mcpPb.McpOutput{
							OutputType: mcpPb.McpOutput_remote,
							Uuid:       util.Must(uuid.NewV7()).String(),
							Lines:      []string{e.Data},
						},
					},
				},
			})
			return
		}

		cb(&remotePb.RunResponse{
			Type: &remotePb.RunResponse_McpMessage{
				McpMessage: &remotePb.RunResponseMcpMessage{
					Message: msg.ToPbRawMessage(),
				},
			},
		})
	})
}

func (c *ConnectionSSE) Close() error {
	if c.cancel != nil {
		c.cancel(nil)
		c.cancel = nil
	}

	c.req = nil
	c.conn = nil

	return nil
}

func (c *ConnectionSSE) Context() context.Context {
	if c.ctx == nil {
		return context.Background()
	}

	return c.ctx
}
