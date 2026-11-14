// Package supervisor is the entrypoint process of function images: it fetches the bundle,
// runs the Node worker, verifies and dispatches invocations, captures logs and carries the
// worker's egress tunnels to the gateway (PLAN.md 7.6, 7.7, 8.4).
package supervisor

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/metorial/metorial-platform/src/lib/rpc/go"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/rpc/functionruntimerpc"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/auth"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/gateway"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/protocol"
)

const (
	crashWindow        = 5 * time.Minute
	maxCrashesInWindow = 5
	maxRestartDelay    = 5 * time.Second
)

type phase int

const (
	phaseBooting phase = iota
	phaseReady
	phaseBootFailed
	phaseFailed
	phaseGateFailed
)

func (p phase) String() string {
	return [...]string{"booting", "ready", "boot_failed", "failed", "policy_gate_failed"}[p]
}

type outcome struct {
	payload json.RawMessage
	crashed string
}

type request struct {
	id           string
	invocationID string
	grant        string
	worker       *worker

	ctx    context.Context
	cancel context.CancelFunc

	outcome chan outcome
	logs    logBuffer
	tunnels map[net.Conn]struct{}
	done    bool
}

type Supervisor struct {
	cfg      *Config
	log      *slog.Logger
	out      *stdoutLog
	verifier *auth.Verifier
	gateway  *gateway.Client

	socketDir  string
	socketPath string
	listener   net.Listener
	exclusive  chan struct{}

	mu        sync.Mutex
	phase     phase
	bootError string
	worker    *worker
	workerSeq int64
	changed   chan struct{}
	requests  map[string]*request
	crashes   []time.Time
	stopping  bool
}

func New(cfg *Config, stdout io.Writer) (*Supervisor, error) {
	if stdout == nil {
		stdout = os.Stdout
	}
	out := &stdoutLog{w: stdout}

	gw, err := gateway.New(cfg.GatewayAddr, cfg.GatewayServerName, cfg.CAFile)
	if err != nil {
		return nil, err
	}

	s := &Supervisor{
		cfg: cfg,
		log: slog.New(slog.NewJSONHandler(out, nil)).With("functionVersionId", cfg.VersionID),
		out: out,
		verifier: &auth.Verifier{
			Keys:      auth.NewFileKeys(cfg.KeysFile),
			VersionID: cfg.VersionID,
			Replay:    auth.NewReplayCache(0, nil),
		},
		gateway:  gw,
		changed:  make(chan struct{}),
		requests: map[string]*request{},
	}
	if cfg.Mode == ModeExclusive {
		s.exclusive = make(chan struct{}, 1)
	}
	return s, nil
}

func (s *Supervisor) Logger() *slog.Logger {
	return s.log
}

// StartWorker opens the tunnel socket and starts the first worker. The bundle must already
// be unpacked.
func (s *Supervisor) StartWorker() error {
	dir, err := os.MkdirTemp(s.cfg.SocketDir, "metorial-supervisor-")
	if err != nil {
		return err
	}
	if err := os.Chmod(dir, 0o700); err != nil {
		return err
	}
	s.socketDir = dir
	s.socketPath = filepath.Join(dir, "tunnel.sock")

	listener, err := net.Listen("unix", s.socketPath)
	if err != nil {
		return err
	}
	s.listener = listener
	go s.serveTunnels(listener)

	return s.startWorker()
}

func (s *Supervisor) startWorker() error {
	s.mu.Lock()
	if s.stopping {
		s.mu.Unlock()
		return nil
	}
	s.workerSeq++
	id := s.workerSeq
	s.mu.Unlock()

	started := time.Now()
	w, err := s.spawnWorker(id)
	if err != nil {
		s.log.Error("worker failed to start", "error", err)
		s.recordCrash()
		return err
	}
	s.log.Info("worker started", "workerId", id, "pid", w.cmd.Process.Pid, "spawnMs", time.Since(started).Milliseconds())

	s.mu.Lock()
	s.worker = w
	s.mu.Unlock()
	return nil
}

func (s *Supervisor) Close() {
	s.mu.Lock()
	s.stopping = true
	w := s.worker
	s.mu.Unlock()

	if w != nil {
		w.killed.Store(true)
		w.kill()
		<-w.exited
	}
	if s.listener != nil {
		_ = s.listener.Close()
	}
	if s.socketDir != "" {
		_ = os.RemoveAll(s.socketDir)
	}
	s.gateway.Close()
}

func (s *Supervisor) Ready() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.phase == phaseReady || s.phase == phaseBootFailed
}

func (s *Supervisor) Phase() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.phase.String()
}

func (s *Supervisor) setPhaseLocked(p phase) {
	if s.phase == p {
		return
	}
	s.phase = p
	close(s.changed)
	s.changed = make(chan struct{})
}

func (s *Supervisor) onWorkerReady(w *worker) {
	w.mu.Lock()
	w.ready = true
	w.mu.Unlock()

	s.mu.Lock()
	defer s.mu.Unlock()
	if s.worker == w {
		s.log.Info("worker ready", "workerId", w.id)
		s.setPhaseLocked(phaseReady)
	}
}

func (s *Supervisor) onWorkerExit(w *worker) {
	reason := w.exitReason()
	crash := w.crashFrame()
	intentional := w.killed.Load()

	w.mu.Lock()
	wasReady := w.ready
	w.mu.Unlock()

	s.mu.Lock()
	if s.worker != w {
		s.mu.Unlock()
		return
	}
	s.worker = nil

	var inflight []*request
	for _, req := range s.requests {
		if req.worker == w {
			inflight = append(inflight, req)
		}
	}

	restart := false
	var delay time.Duration
	switch {
	case s.stopping:
	case !wasReady && !intentional && crash != nil && crash.Phase == protocol.PhaseBoot:
		s.bootError = crash.Message
		s.setPhaseLocked(phaseBootFailed)
		s.log.Error("function failed to initialize", "workerId", w.id, "error", crash.Message)
	case intentional:
		s.setPhaseLocked(phaseBooting)
		restart = true
	default:
		now := time.Now()
		s.crashes = append(s.crashes, now)
		recent := s.crashes[:0]
		for _, at := range s.crashes {
			if now.Sub(at) < crashWindow {
				recent = append(recent, at)
			}
		}
		s.crashes = recent

		if len(recent) >= maxCrashesInWindow {
			s.setPhaseLocked(phaseFailed)
			s.log.Error("worker keeps crashing, failing readiness", "crashes", len(recent), "error", reason)
		} else {
			s.setPhaseLocked(phaseBooting)
			restart = true
			delay = min(maxRestartDelay, 100*time.Millisecond<<(len(recent)-1))
			s.log.Error("worker crashed", "workerId", w.id, "error", reason, "restartInMs", delay.Milliseconds())
		}
	}
	s.mu.Unlock()

	for _, req := range inflight {
		req.deliver(outcome{crashed: reason})
	}

	if restart {
		time.AfterFunc(delay, func() {
			if err := s.startWorker(); err != nil {
				s.scheduleRetryAfterSpawnFailure()
			}
		})
	}
}

func (s *Supervisor) recordCrash() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.crashes = append(s.crashes, time.Now())
	if len(s.crashes) >= maxCrashesInWindow {
		s.setPhaseLocked(phaseFailed)
	}
}

func (s *Supervisor) scheduleRetryAfterSpawnFailure() {
	s.mu.Lock()
	failed := s.phase == phaseFailed || s.stopping
	s.mu.Unlock()
	if failed {
		return
	}
	time.AfterFunc(time.Second, func() {
		if err := s.startWorker(); err != nil {
			s.scheduleRetryAfterSpawnFailure()
		}
	})
}

// waitReady blocks until a worker can take the request. bootErr is set when the function
// failed to initialize, in which case every invocation answers with that error.
func (s *Supervisor) waitReady(ctx context.Context) (w *worker, bootErr string, err error) {
	for {
		s.mu.Lock()
		switch s.phase {
		case phaseReady:
			if s.worker != nil && s.worker.alive() {
				w := s.worker
				s.mu.Unlock()
				return w, "", nil
			}
		case phaseBootFailed:
			msg := s.bootError
			s.mu.Unlock()
			return nil, msg, nil
		case phaseFailed:
			s.mu.Unlock()
			return nil, "", errWorkerFailed
		case phaseGateFailed:
			s.mu.Unlock()
			return nil, "", errPolicyGateFailed
		}
		changed := s.changed
		s.mu.Unlock()

		select {
		case <-ctx.Done():
			return nil, "", ctx.Err()
		case <-changed:
		}
	}
}

var errWorkerFailed = errors.New("worker keeps crashing")

var errPolicyGateFailed = ldrpc.NewError(503, "policy_gate_failed", "the pod's NetworkPolicy is not in force, so the function was not started")

func (r *request) deliver(o outcome) {
	select {
	case r.outcome <- o:
	default:
	}
}

func (s *Supervisor) Invoke(ctx context.Context, in *functionruntimerpc.InvokeInput) (*functionruntimerpc.InvokeOutput, error) {
	if len(in.PayloadJSON) > MaxPayloadBytes {
		return nil, ldrpc.ValidationErrors{{
			Code:    "too_big",
			Message: fmt.Sprintf("payloadJson must be at most %d UTF-8 bytes", MaxPayloadBytes),
			Path:    []string{"payloadJson"},
		}}
	}

	verified, rejection := s.verifier.Verify(auth.Invocation{
		VersionID:       in.VersionID,
		PayloadJSON:     in.PayloadJSON,
		InvocationToken: in.InvocationToken,
		EgressGrant:     in.EgressGrant,
	})
	if rejection != nil {
		s.log.Warn("invocation rejected", "reason", rejection.Reason, "detail", rejection.Detail, "ip", callerIP(ctx))
		return nil, functionruntimerpc.ErrInvocationUnauthorized(rejection.Reason)
	}

	timeout := time.Duration(in.DeadlineMs) * time.Millisecond
	if s.cfg.Timeout > 0 && s.cfg.Timeout < timeout {
		timeout = s.cfg.Timeout
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	log := s.log.With("invocationId", verified.InvocationID)

	if s.exclusive != nil {
		select {
		case s.exclusive <- struct{}{}:
			defer func() { <-s.exclusive }()
		case <-ctx.Done():
			return output(timeoutEnvelope(timeout), nil, false, false), nil
		}
	}

	var w *worker
	var req *request
	for req == nil {
		var bootErr string
		var err error
		w, bootErr, err = s.waitReady(ctx)
		switch {
		case bootErr != "":
			return output(bootErrorEnvelope(bootErr), nil, false, true), nil
		case errors.Is(err, errWorkerFailed):
			return output(crashEnvelope("the function process keeps crashing"), nil, false, false), nil
		case errors.Is(err, errPolicyGateFailed):
			return nil, err
		case err != nil:
			log.Warn("no ready worker before the deadline")
			return output(timeoutEnvelope(timeout), nil, false, false), nil
		}
		req = s.register(w, verified, in.EgressGrant)
	}
	defer s.finish(req)

	started := time.Now()
	err := w.send(&protocol.Frame{
		Type:      protocol.TypeInvoke,
		RequestID: req.id,
		Payload:   mustJSON(in.PayloadJSON),
		Context:   &protocol.InvokeContext{InvocationID: verified.InvocationID, DeadlineMs: time.Now().Add(timeout).UnixMilli()},
	})
	if err != nil {
		req.deliver(outcome{crashed: "worker unreachable: " + err.Error()})
	}

	var result outcome
	timedOut := false
	select {
	case result = <-req.outcome:
	case <-ctx.Done():
		timedOut = true
	}
	computeTime := time.Since(started)

	logs, truncated := s.finish(req)

	payload := result.payload
	switch {
	case timedOut:
		log.Warn("invocation timed out", "requestId", req.id, "mode", s.cfg.Mode, "timeoutMs", timeout.Milliseconds())
		s.abandon(w, req)
		payload = timeoutEnvelope(timeout)
	case result.crashed != "":
		payload = crashEnvelope(result.crashed)
	case len(result.payload) > MaxPayloadBytes:
		payload = responseTooLargeEnvelope(len(result.payload))
	}

	out := output(payload, logs, truncated, false)
	out.ComputeTimeMs = computeTime.Milliseconds()
	return out, nil
}

func output(payload json.RawMessage, logs []LogLine, truncated, bootError bool) *functionruntimerpc.InvokeOutput {
	lines := make([]functionruntimerpc.InvokeLogLine, len(logs))
	for i, line := range logs {
		lines[i] = functionruntimerpc.InvokeLogLine{Ts: line.Time, Stream: functionruntimerpc.InvokeLogLineStream(line.Stream), Line: line.Line}
	}
	return &functionruntimerpc.InvokeOutput{Payload: payload, Logs: lines, LogsTruncated: truncated, BootError: bootError}
}

func (s *Supervisor) abandon(w *worker, req *request) {
	if s.cfg.Mode == ModeExclusive {
		w.killed.Store(true)
		w.kill()
		return
	}
	_ = w.send(&protocol.Frame{Type: protocol.TypeCancel, RequestID: req.id})
}

func (s *Supervisor) register(w *worker, verified *auth.Verified, grant string) *request {
	ctx, cancel := context.WithCancel(context.Background())
	req := &request{
		id:           newRequestID(),
		invocationID: verified.InvocationID,
		grant:        grant,
		worker:       w,
		ctx:          ctx,
		cancel:       cancel,
		outcome:      make(chan outcome, 1),
		logs:         logBuffer{limit: MaxLogBytes},
		tunnels:      map[net.Conn]struct{}{},
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if s.worker != w || !w.alive() {
		cancel()
		return nil
	}
	s.requests[req.id] = req
	return req
}

// finish ends the request: later frames for it are ignored and all of its tunnels close.
func (s *Supervisor) finish(req *request) ([]LogLine, bool) {
	s.mu.Lock()
	if req.done {
		s.mu.Unlock()
		return nil, false
	}
	req.done = true
	delete(s.requests, req.id)
	tunnels := req.tunnels
	req.tunnels = nil
	logs, truncated := req.logs.lines, req.logs.truncated
	s.mu.Unlock()

	req.cancel()
	for conn := range tunnels {
		_ = conn.Close()
	}
	return logs, truncated
}

func (s *Supervisor) activeRequest(id string) *request {
	s.mu.Lock()
	defer s.mu.Unlock()
	req := s.requests[id]
	if req == nil || req.done {
		return nil
	}
	return req
}

func (s *Supervisor) onResult(f *protocol.Frame) {
	if req := s.activeRequest(f.RequestID); req != nil {
		req.deliver(outcome{payload: f.Payload})
	}
}

func (s *Supervisor) onLog(f *protocol.Frame) {
	line := LogLine{Time: time.UnixMilli(f.TS), Stream: f.Stream, Line: f.Line}
	if f.TS == 0 {
		line.Time = time.Now()
	}
	if line.Stream != "stderr" {
		line.Stream = "stdout"
	}

	invocationID := ""
	s.mu.Lock()
	if req := s.requests[f.RequestID]; req != nil && !req.done {
		req.logs.add(line)
		invocationID = req.invocationID
	}
	s.mu.Unlock()

	s.out.function(f.RequestID, invocationID, line)
}

func (s *Supervisor) onLookup(w *worker, f *protocol.Frame) {
	reply := &protocol.Frame{Type: protocol.TypeLookupResult, ID: f.ID}

	req := s.activeRequest(f.RequestID)
	if req == nil {
		reply.Error = &protocol.Error{Code: "ENOTFOUND", Message: "no active invocation for this lookup"}
		_ = w.send(reply)
		return
	}

	addresses, err := s.gateway.Resolve(req.ctx, req.grant, f.Hostname)
	if err != nil {
		code := "ESERVFAIL"
		var dialErr *gateway.DialError
		if errors.As(err, &dialErr) && dialErr.Status == 407 {
			code = "EREFUSED"
		}
		s.log.Warn("lookup failed", "requestId", req.id, "host", f.Hostname, "error", err)
		reply.Error = &protocol.Error{Code: code, Message: err.Error()}
	} else {
		reply.Addresses = addresses
	}
	_ = w.send(reply)
}

func newRequestID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return "req_" + hex.EncodeToString(b)
}

func mustJSON(v any) json.RawMessage {
	out, _ := json.Marshal(v)
	return out
}

func callerIP(ctx context.Context) string {
	if info := ldrpc.CallInfoFromContext(ctx); info != nil {
		return info.IP
	}
	return ""
}
