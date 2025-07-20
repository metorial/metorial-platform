package remote

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"

	"github.com/google/uuid"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	remotePb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/remote"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	"github.com/metorial/metorial/modules/addr"
	"github.com/metorial/metorial/modules/util"
	"github.com/tmaxmax/go-sse"
)

type ConnectionSSE struct {
	sendEndpoint string

	req  *http.Request
	conn *sse.Connection

	context context.Context
	cancel  context.CancelCauseFunc

	extraOutputChan chan *remotePb.RunResponse

	wg    sync.WaitGroup
	mutex sync.Mutex
}

func NewConnectionSSE(ctx context.Context, config *remotePb.RunConfig) (*ConnectionSSE, error) {
	uri, err := url.Parse(config.Server.ServerUri)
	if err != nil {
		return nil, fmt.Errorf("failed to parse server URI: %w", err)
	}

	if config.Arguments.Query != nil {
		q := uri.Query()

		for k, v := range config.Arguments.Query {
			q.Set(k, v)
		}

		uri.RawQuery = q.Encode()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, uri.String(), http.NoBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request for SSE endpoint: %w", err)
	}

	if config.Arguments.Headers != nil {
		for k, v := range config.Arguments.Headers {
			req.Header.Set(k, v)
		}
	}

	conn := sse.DefaultClient.NewConnection(req)

	ctx, cancel := context.WithCancelCause(ctx)

	res := &ConnectionSSE{
		req:  req,
		conn: conn,

		context: ctx,
		cancel:  cancel,

		extraOutputChan: make(chan *remotePb.RunResponse, 10),
	}

	res.wg.Add(1)
	doneOnce := &sync.Once{}
	cancelOnce := &sync.Once{}

	go func() {
		err := conn.Connect()

		cancelOnce.Do(func() {
			res.mutex.Lock()
			defer res.mutex.Unlock()

			if res.cancel != nil {
				if err != nil && err != context.Canceled && err != io.EOF {
					res.cancel(fmt.Errorf("failed to connect to SSE endpoint: %w", err))
				} else {
					res.cancel(nil)
				}

				res.cancel = nil
			}

			res.conn = nil
			res.req = nil

			if res.extraOutputChan != nil {
				close(res.extraOutputChan)
				res.extraOutputChan = nil
			}
		})

		doneOnce.Do(func() {
			res.mutex.Lock()
			defer res.mutex.Unlock()

			res.wg.Done()
		})
	}()

	unsubscribe := conn.SubscribeEvent("endpoint", func(event sse.Event) {
		defer doneOnce.Do(func() {
			res.wg.Done()
		})

		if event.Data == "" {
			cancelOnce.Do(func() {
				if res.cancel != nil {
					res.mutex.Lock()
					defer res.mutex.Unlock()

					res.cancel(fmt.Errorf("server did not respond with a valid SSE endpoint"))
				}
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

	defer unsubscribe()

	res.wg.Wait()

	if res.context.Err() != nil {
		return nil, context.Cause(res.context)
	}

	if res.sendEndpoint == "" {
		return nil, fmt.Errorf("server did not respond with a valid SSE endpoint")
	}

	return res, nil
}

func (c *ConnectionSSE) Send(msg *mcpPb.McpMessageRaw) error {
	return c.SendString(msg.Message)
}

func (c *ConnectionSSE) SendString(msg string) error {
	c.wg.Wait()

	if c.conn == nil {
		return fmt.Errorf("connection has ended")
	}

	if c.sendEndpoint == "" {
		return fmt.Errorf("send endpoint is not set")
	}

	req, err := http.NewRequestWithContext(c.context, http.MethodPost, c.sendEndpoint, strings.NewReader(msg))
	if err != nil {
		return fmt.Errorf("failed to create request for sending data: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "*/*")
	req.Header.Set("User-Agent", "Metorial MCP Engine (https://metorial.com)")

	resp, err := http.DefaultClient.Do(req)

	if err != nil {
		return fmt.Errorf("failed to send data: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 || resp.StatusCode < 200 {
		body, _ := util.ReadAll(resp.Body)
		bodyString := ""
		if body != nil {
			bodyString = string(body)
		}

		c.extraOutputChan <- &remotePb.RunResponse{
			Type: &remotePb.RunResponse_Output{
				Output: &remotePb.RunResponseOutput{
					McpOutput: &mcpPb.McpOutput{
						OutputType: mcpPb.McpOutput_remote,
						Uuid:       util.Must(uuid.NewV7()).String(),
						Lines:      []string{fmt.Sprintf("Server responded with an error code %d", resp.StatusCode), bodyString},
					},
				},
			},
		}

		return fmt.Errorf("failed to send data, server responded with status code: %d", resp.StatusCode)
	}

	return nil
}

func (c *ConnectionSSE) Subscribe(cb MessageReceiver) {
	c.conn.SubscribeToAll(func(e sse.Event) {
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
					Message: msg.ToPbMessage(),
				},
			},
		})
	})

	go func() {
		for {
			select {
			case <-c.context.Done():
				return
			case resp := <-c.extraOutputChan:
				cb(resp)
			}
		}
	}()
}

func (c *ConnectionSSE) Close() error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if c.cancel != nil {
		c.cancel(nil)
		c.cancel = nil
	}

	c.req = nil
	c.conn = nil

	return nil
}

func (c *ConnectionSSE) Context() context.Context {
	if c.context == nil {
		return context.Background()
	}

	return c.context
}

func (c *ConnectionSSE) Done() <-chan struct{} {
	if c.context == nil {
		return nil
	}

	return c.context.Done()
}

func (c *ConnectionSSE) Wait() error {
	<-c.context.Done()

	if c.context.Err() != nil {
		return c.context.Err()
	}

	return nil
}
