package supervisor

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"net"
	"sync"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/gateway"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/protocol"
)

const (
	tunnelHeaderTimeout = 10 * time.Second
	tunnelRejectLinger  = 5 * time.Second
)

func (s *Supervisor) serveTunnels(l net.Listener) {
	for {
		conn, err := l.Accept()
		if err != nil {
			if errors.Is(err, net.ErrClosed) {
				return
			}
			s.log.Warn("tunnel accept failed", "error", err)
			time.Sleep(50 * time.Millisecond)
			continue
		}
		go s.handleTunnel(conn)
	}
}

func (s *Supervisor) handleTunnel(conn net.Conn) {
	defer conn.Close()

	_ = conn.SetReadDeadline(time.Now().Add(tunnelHeaderTimeout))
	reader := bufio.NewReader(conn)
	header, err := protocol.Read(reader)
	if err != nil || header.Type != protocol.TypeTunnel {
		return
	}
	_ = conn.SetReadDeadline(time.Time{})

	req := s.attachTunnel(header.RequestID, conn)
	if req == nil {
		s.rejectTunnel(conn, nil, header, &protocol.Error{Code: "ECONNREFUSED", Message: "egress denied: no active invocation for this connection", Reason: "no_request"})
		return
	}
	defer s.detachTunnel(req, conn)

	upstream, err := s.gateway.Dial(req.ctx, req.grant, header.Host, header.Port)
	if err != nil {
		s.log.Info("egress tunnel refused", "requestId", req.id, "invocationId", req.invocationID, "host", header.Host, "port", header.Port, "error", err)
		s.rejectTunnel(conn, req.worker, header, tunnelError(header, err))
		return
	}
	defer upstream.Close()

	if header.TunnelID != "" {
		_ = req.worker.send(&protocol.Frame{Type: protocol.TypeTunnelReady, TunnelID: header.TunnelID})
	}

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		_, _ = io.Copy(upstream, reader)
		_ = upstream.CloseWrite()
	}()
	go func() {
		defer wg.Done()
		_, _ = io.Copy(conn, upstream)
		if unix, ok := conn.(*net.UnixConn); ok {
			_ = unix.CloseWrite()
		}
	}()

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-req.ctx.Done():
		_ = conn.Close()
		_ = upstream.Close()
		<-done
	}
}

// attachTunnel registers conn on the request so finishing the request closes it.
func (s *Supervisor) attachTunnel(requestID string, conn net.Conn) *request {
	s.mu.Lock()
	defer s.mu.Unlock()

	req := s.requests[requestID]
	if req == nil || req.done {
		return nil
	}
	req.tunnels[conn] = struct{}{}
	return req
}

func (s *Supervisor) detachTunnel(req *request, conn net.Conn) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if req.tunnels != nil {
		delete(req.tunnels, conn)
	}
}

// rejectTunnel reports the failure on the control channel and leaves the connection open
// until the worker closes it, so the worker surfaces the error instead of a bare reset.
func (s *Supervisor) rejectTunnel(conn net.Conn, w *worker, header *protocol.Frame, cause *protocol.Error) {
	if w == nil {
		s.mu.Lock()
		w = s.worker
		s.mu.Unlock()
	}
	if w != nil && header.TunnelID != "" {
		_ = w.send(&protocol.Frame{Type: protocol.TypeTunnelError, TunnelID: header.TunnelID, Error: cause})
	}

	_ = conn.SetReadDeadline(time.Now().Add(tunnelRejectLinger))
	_, _ = io.Copy(io.Discard, conn)
}

func tunnelError(header *protocol.Frame, err error) *protocol.Error {
	target := net.JoinHostPort(header.Host, fmt.Sprint(header.Port))

	var dialErr *gateway.DialError
	if !errors.As(err, &dialErr) || dialErr.Err != nil {
		return &protocol.Error{Code: "ECONNREFUSED", Reason: "gateway_unavailable", Message: fmt.Sprintf("connect %s: egress gateway unavailable", target)}
	}

	reason := dialErr.Reason
	switch dialErr.Status {
	case 407:
		reason = "grant_rejected"
	case 400:
		reason = "bad_target"
	case 502:
		reason = "upstream_unreachable"
	}
	if reason == "" {
		reason = "denied"
	}

	message := fmt.Sprintf("connect %s: egress denied (%s)", target, reason)
	if dialErr.Status == 502 {
		message = fmt.Sprintf("connect %s: upstream unreachable", target)
	}
	return &protocol.Error{Code: "ECONNREFUSED", Status: dialErr.Status, Reason: reason, Message: message}
}
