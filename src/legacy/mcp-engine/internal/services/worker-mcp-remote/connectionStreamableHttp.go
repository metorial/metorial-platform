package remote

import (
	"bufio"
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
	ssrfProtection "github.com/metorial/metorial/modules/ssrf-protection"
	"github.com/metorial/metorial/modules/util"
)

type ConnectionStreamableHTTP struct {
	endpoint        string
	context         context.Context
	cancel          context.CancelCauseFunc
	config          *remotePb.RunConfigRemote
	extraOutputChan chan *remotePb.RunResponse
	sendMutex       sync.Mutex
	mutex           sync.Mutex
	sessionMutex    sync.RWMutex
	sessionID       string
	subscribers     []MessageReceiver
	subscriberMutex sync.RWMutex
	httpClient      *http.Client
}

func NewConnectionStreamableHTTP(ctx context.Context, config *remotePb.RunConfigRemote) (*ConnectionStreamableHTTP, error) {
	err := ssrfProtection.ValidateURL(config.Server.ServerUri)
	if err != nil {
		return nil, fmt.Errorf("server URI validation failed: %w", err)
	}

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

	finalUrl := uri.String()
	ctx, cancel := context.WithCancelCause(ctx)

	conn := &ConnectionStreamableHTTP{
		endpoint:        finalUrl,
		context:         ctx,
		cancel:          cancel,
		config:          config,
		extraOutputChan: make(chan *remotePb.RunResponse, 10),
		subscribers:     make([]MessageReceiver, 0),
		httpClient:      ssrfProtection.CreateSecureHTTPClient(),
	}

	return conn, nil
}

func (c *ConnectionStreamableHTTP) getSessionID() string {
	c.sessionMutex.RLock()
	defer c.sessionMutex.RUnlock()
	return c.sessionID
}

func (c *ConnectionStreamableHTTP) setSessionID(sessionID string) {
	c.sessionMutex.Lock()
	defer c.sessionMutex.Unlock()
	c.sessionID = sessionID
}

func (c *ConnectionStreamableHTTP) createRequest(ctx context.Context, method string, body io.Reader) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.endpoint, body)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", "Metorial MCP Engine (https://metorial.com)")

	sessionID := c.getSessionID()
	if sessionID != "" {
		req.Header.Set("Mcp-Session-Id", sessionID)
	}

	if c.config.Arguments.Headers != nil {
		for k, v := range c.config.Arguments.Headers {
			if ignoreHeaders[strings.ToLower(k)] {
				continue
			}
			if strings.Contains(k, "Sec-WebSocket") {
				continue // Ignore WebSocket headers
			}
			req.Header.Set(k, v)
		}
	}

	return req, nil
}

func (c *ConnectionStreamableHTTP) Send(msg *mcpPb.McpMessageRaw) error {
	return c.SendString(msg.Message)
}

func (c *ConnectionStreamableHTTP) SendControl(msg string) error {
	return c.SendString(msg)
}

func (c *ConnectionStreamableHTTP) SendString(msg string) error {
	c.sendMutex.Lock()
	defer c.sendMutex.Unlock()

	select {
	case <-c.context.Done():
		return fmt.Errorf("connection has ended")
	default:
	}

	req, err := c.createRequest(c.context, http.MethodPost, strings.NewReader(msg))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send data: %w", err)
	}

	// Extract session ID from response if present
	if sessionID := resp.Header.Get("Mcp-Session-Id"); sessionID != "" {
		c.setSessionID(sessionID)
	}

	// Handle different response types based on status code and content type
	contentType := resp.Header.Get("Content-Type")

	// Handle 404 - session expired, need to reinitialize
	if resp.StatusCode == http.StatusNotFound && c.getSessionID() != "" {
		body, _ := util.ReadAll(resp.Body)
		resp.Body.Close()
		bodyString := ""
		if body != nil {
			bodyString = string(body)
		}

		// Clear the session ID
		c.setSessionID("")

		c.notifySubscribers(&remotePb.RunResponse{
			Type: &remotePb.RunResponse_Output{
				Output: &remotePb.RunResponseOutput{
					McpOutput: &mcpPb.McpOutput{
						OutputType: mcpPb.McpOutput_remote,
						Uuid:       util.Must(uuid.NewV7()).String(),
						Lines:      []string{"Session expired (HTTP 404). Please reinitialize the connection.", bodyString},
					},
				},
			},
		})
		return fmt.Errorf("session expired, received HTTP 404")
	}

	// Handle error responses
	if resp.StatusCode >= 400 {
		body, _ := util.ReadAll(resp.Body)
		resp.Body.Close()
		bodyString := ""
		if body != nil {
			bodyString = string(body)
		}
		c.notifySubscribers(&remotePb.RunResponse{
			Type: &remotePb.RunResponse_Output{
				Output: &remotePb.RunResponseOutput{
					McpOutput: &mcpPb.McpOutput{
						OutputType: mcpPb.McpOutput_remote,
						Uuid:       util.Must(uuid.NewV7()).String(),
						Lines:      []string{fmt.Sprintf("Server responded with an error code %d", resp.StatusCode), bodyString},
					},
				},
			},
		})
		return fmt.Errorf("server responded with status code: %d", resp.StatusCode)
	}

	// Handle 202 Accepted (for notifications and responses)
	if resp.StatusCode == http.StatusAccepted {
		resp.Body.Close()
		return nil
	}

	// Handle SSE stream response
	if strings.Contains(contentType, "text/event-stream") {
		// Don't close the body here - pass it to the goroutine to handle
		go c.handleSSEStream(resp.Body)
		return nil
	}

	// Handle JSON response
	if strings.Contains(contentType, "application/json") {
		body, err := util.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return fmt.Errorf("failed to read response body: %w", err)
		}

		c.processMessage(string(body))
		return nil
	}

	// Unknown content type - close and return
	resp.Body.Close()
	return nil
}

func (c *ConnectionStreamableHTTP) handleSSEStream(body io.ReadCloser) {
	defer body.Close()

	scanner := bufio.NewScanner(body)
	var eventData strings.Builder

	for scanner.Scan() {
		line := scanner.Text()

		// Empty line indicates end of event
		if line == "" {
			if eventData.Len() > 0 {
				c.processMessage(eventData.String())
				eventData.Reset()
			}
			continue
		}

		// Parse SSE format
		if strings.HasPrefix(line, "data:") {
			data := strings.TrimPrefix(line, "data:")
			data = strings.TrimSpace(data)
			if eventData.Len() > 0 {
				eventData.WriteString("\n")
			}
			eventData.WriteString(data)
		}
		// Ignore other SSE fields like "event:", "id:", "retry:"
	}

	// Process any remaining data
	if eventData.Len() > 0 {
		c.processMessage(eventData.String())
	}

	if err := scanner.Err(); err != nil && err != io.EOF {
		c.notifySubscribers(&remotePb.RunResponse{
			Type: &remotePb.RunResponse_Output{
				Output: &remotePb.RunResponseOutput{
					McpOutput: &mcpPb.McpOutput{
						OutputType: mcpPb.McpOutput_remote,
						Uuid:       util.Must(uuid.NewV7()).String(),
						Lines:      []string{fmt.Sprintf("Error reading SSE stream: %v", err)},
					},
				},
			},
		})
	}
}

func (c *ConnectionStreamableHTTP) processMessage(data string) {
	if data == "" {
		return
	}

	msg, err := mcp.ParseMCPMessage(util.Must(uuid.NewV7()).String(), data)
	if err != nil {
		// If it's not a valid MCP message, treat it as raw output
		c.notifySubscribers(&remotePb.RunResponse{
			Type: &remotePb.RunResponse_Output{
				Output: &remotePb.RunResponseOutput{
					McpOutput: &mcpPb.McpOutput{
						OutputType: mcpPb.McpOutput_remote,
						Uuid:       util.Must(uuid.NewV7()).String(),
						Lines:      []string{data},
					},
				},
			},
		})
		return
	}

	c.notifySubscribers(&remotePb.RunResponse{
		Type: &remotePb.RunResponse_McpMessage{
			McpMessage: &remotePb.RunResponseMcpMessage{
				Message: msg.ToPbMessage(),
			},
		},
	})
}

func (c *ConnectionStreamableHTTP) notifySubscribers(resp *remotePb.RunResponse) {
	c.subscriberMutex.RLock()
	defer c.subscriberMutex.RUnlock()

	for _, subscriber := range c.subscribers {
		subscriber(resp)
	}
}

func (c *ConnectionStreamableHTTP) Subscribe(cb MessageReceiver) {
	c.subscriberMutex.Lock()
	c.subscribers = append(c.subscribers, cb)
	c.subscriberMutex.Unlock()

	// Start goroutine to forward extra output messages
	go func() {
		for {
			select {
			case <-c.context.Done():
				return
			case resp, ok := <-c.extraOutputChan:
				if !ok {
					return
				}
				cb(resp)
			}
		}
	}()
}

func (c *ConnectionStreamableHTTP) Close() error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	// If we have a session ID, try to terminate it explicitly
	sessionID := c.getSessionID()
	if sessionID != "" {
		req, err := c.createRequest(context.Background(), http.MethodDelete, nil)
		if err == nil {
			resp, err := c.httpClient.Do(req)
			if err == nil {
				resp.Body.Close()
				// Server may respond with 405 if it doesn't support explicit termination
				// which is fine according to the spec
			}
		}
		c.setSessionID("")
	}

	if c.cancel != nil {
		c.cancel(nil)
		c.cancel = nil
	}

	if c.extraOutputChan != nil {
		close(c.extraOutputChan)
		c.extraOutputChan = nil
	}

	return nil
}

func (c *ConnectionStreamableHTTP) Context() context.Context {
	if c.context == nil {
		return context.Background()
	}
	return c.context
}

func (c *ConnectionStreamableHTTP) Done() <-chan struct{} {
	if c.context == nil {
		return nil
	}
	return c.context.Done()
}

func (c *ConnectionStreamableHTTP) Wait() error {
	<-c.context.Done()
	if c.context.Err() != nil {
		return c.context.Err()
	}
	return nil
}
