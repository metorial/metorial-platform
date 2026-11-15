package ldrpc

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"runtime/debug"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	ContentType         = "application/rpc+json"
	RequestIDHeader     = "metorial-req-id"
	DefaultMaxBodyBytes = 32 << 20
)

// HandlerFunc serves one call. payload is plain JSON (the envelope is already removed); the
// returned value is encoded with Marshal.
type HandlerFunc func(ctx context.Context, payload json.RawMessage) (any, error)

type Middleware func(next HandlerFunc) HandlerFunc

// AuthenticateFunc runs once per HTTP request before any call. Its result is exposed to
// handlers as CallInfo.Auth. Returning an *Error rejects the request with that error; any
// other error becomes a 500.
type AuthenticateFunc func(r *http.Request, body []byte) (any, error)

type ServerOptions struct {
	// Path is the mount path, e.g. "/rpc". Direct calls are POST <Path>/<method>. When empty,
	// the last path segment of any request is treated as the method name.
	Path string

	Authenticate AuthenticateFunc

	MaxBodyBytes int64

	OnError func(ctx context.Context, call *CallInfo, err error)

	OnCall func(ctx context.Context, call *CallInfo, status int, duration time.Duration)
}

type CallInfo struct {
	RequestID string
	CallID    string
	Method    string
	IP        string
	Header    http.Header
	Auth      any
	Request   *http.Request
}

type callInfoKey struct{}

func CallInfoFromContext(ctx context.Context) *CallInfo {
	info, _ := ctx.Value(callInfoKey{}).(*CallInfo)
	return info
}

type Server struct {
	opts       ServerOptions
	mu         sync.RWMutex
	handlers   map[string]HandlerFunc
	middleware []Middleware
}

func NewServer(opts ServerOptions) *Server {
	if opts.MaxBodyBytes == 0 {
		opts.MaxBodyBytes = DefaultMaxBodyBytes
	}
	opts.Path = "/" + strings.Trim(opts.Path, "/")

	return &Server{opts: opts, handlers: map[string]HandlerFunc{}}
}

func normalizeMethodName(name string) string {
	return strings.ReplaceAll(name, ".", ":")
}

// Handle registers a method. Names are colon-separated paths ("bucket:get"); dots are
// accepted and normalized to colons.
func (s *Server) Handle(name string, h HandlerFunc) {
	s.mu.Lock()
	defer s.mu.Unlock()

	name = normalizeMethodName(name)
	if _, exists := s.handlers[name]; exists {
		panic(fmt.Sprintf("ldrpc: method %q registered twice", name))
	}
	s.handlers[name] = h
}

// Mount registers the server on mux at its Path, covering both batch requests (POST <Path>)
// and direct calls (POST <Path>/<method>). Registering only "<Path>/" would make ServeMux
// redirect batch requests, which clients replay as GET.
func (s *Server) Mount(mux *http.ServeMux) {
	if s.opts.Path == "/" {
		mux.Handle("/", s)
		return
	}
	mux.Handle(s.opts.Path, s)
	mux.Handle(s.opts.Path+"/", s)
}

func (s *Server) Use(mw ...Middleware) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.middleware = append(s.middleware, mw...)
}

func (s *Server) Methods() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	names := make([]string, 0, len(s.handlers))
	for name := range s.handlers {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

type wireCall struct {
	ID      string          `json:"id"`
	Name    string          `json:"name"`
	Payload json.RawMessage `json:"payload"`
}

type batchResponse struct {
	Typename string         `json:"__typename"`
	Calls    []callResponse `json:"calls"`
}

type callResponse struct {
	Typename string `json:"__typename"`
	ID       string `json:"id"`
	Name     string `json:"name"`
	Status   int    `json:"status"`
	Result   any    `json:"result"`
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	requestID := "req_" + randomID()
	w.Header().Set(RequestIDHeader, requestID)

	if r.Method != http.MethodPost {
		writeResponse(w, http.StatusMethodNotAllowed, MethodNotAllowedError())
		return
	}

	contentType := r.Header.Get("Content-Type")
	if !strings.Contains(contentType, ContentType) && !strings.Contains(contentType, "application/json") {
		writeResponse(w, http.StatusNotAcceptable, NotAcceptableError().WithMessage("Content-Type must be application/rpc+json"))
		return
	}

	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, s.opts.MaxBodyBytes))
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			writeResponse(w, http.StatusRequestEntityTooLarge, NewError(413, "payload_too_large", "The request body is too large."))
			return
		}
		writeResponse(w, http.StatusNotAcceptable, NotAcceptableError().WithMessage("Invalid JSON"))
		return
	}

	var auth any
	if s.opts.Authenticate != nil {
		auth, err = s.opts.Authenticate(r, body)
		if err != nil {
			rpcErr, ok := AsError(err)
			if !ok {
				rpcErr = InternalServerError()
			}
			writeResponse(w, rpcErr.Status, rpcErr)
			return
		}
	}

	plain, err := Normalize(body)
	if err != nil {
		writeResponse(w, http.StatusNotAcceptable, NotAcceptableError().WithMessage("Invalid JSON"))
		return
	}

	calls, isBatch := parseBatch(plain)
	if !isBatch {
		name, ok := s.directMethodName(r)
		if !ok {
			writeResponse(w, http.StatusNotAcceptable, ValidationError("request_data", ValidationErrors{{
				Code:    "invalid_type",
				Message: "Expected a batch body ({ calls: [...] }) or a direct method route",
				Path:    []string{"calls"},
			}}))
			return
		}
		calls = []wireCall{{ID: "call_" + randomID(), Name: name, Payload: plain}}
	}

	s.mu.RLock()
	handlers := make([]HandlerFunc, len(calls))
	for i, call := range calls {
		calls[i].Name = normalizeMethodName(call.Name)
		handlers[i] = s.handlers[calls[i].Name]
		if handlers[i] == nil {
			s.mu.RUnlock()
			writeResponse(w, http.StatusNotFound, NotFoundError("handler", ""))
			return
		}
	}
	middleware := s.middleware
	s.mu.RUnlock()

	ip := clientIP(r)
	results := make([]callResponse, len(calls))

	var wg sync.WaitGroup
	for i, call := range calls {
		wg.Add(1)
		go func() {
			defer wg.Done()

			info := &CallInfo{
				RequestID: requestID,
				CallID:    call.ID,
				Method:    call.Name,
				IP:        ip,
				Header:    r.Header,
				Auth:      auth,
				Request:   r,
			}
			status, result := s.runCall(r.Context(), info, handlers[i], middleware, call.Payload)
			results[i] = callResponse{
				Typename: "rpc.response.call",
				ID:       call.ID,
				Name:     call.Name,
				Status:   status,
				Result:   result,
			}
		}()
	}
	wg.Wait()

	if !isBatch {
		writeResponse(w, results[0].Status, results[0].Result)
		return
	}

	status := http.StatusOK
	for _, res := range results {
		status = max(status, res.Status)
	}
	writeResponse(w, status, batchResponse{Typename: "rpc.response", Calls: results})
}

func (s *Server) runCall(ctx context.Context, info *CallInfo, h HandlerFunc, middleware []Middleware, payload json.RawMessage) (status int, result any) {
	start := time.Now()
	ctx = context.WithValue(ctx, callInfoKey{}, info)

	for i := len(middleware) - 1; i >= 0; i-- {
		h = middleware[i](h)
	}

	defer func() {
		if p := recover(); p != nil {
			err := fmt.Errorf("ldrpc: panic in %s: %v\n%s", info.Method, p, debug.Stack())
			if s.opts.OnError != nil {
				s.opts.OnError(ctx, info, err)
			}
			status, result = 500, InternalServerError()
		}
		if s.opts.OnCall != nil {
			s.opts.OnCall(ctx, info, status, time.Since(start))
		}
	}()

	if len(payload) == 0 {
		payload = json.RawMessage("null")
	}

	out, err := h(ctx, payload)
	if err == nil {
		return http.StatusOK, out
	}

	if rpcErr, ok := AsError(err); ok {
		if rpcErr.Status < 400 || rpcErr.Status > 599 {
			rpcErr = rpcErr.withStatus(500)
		}
		if rpcErr.Status >= 500 && s.opts.OnError != nil {
			s.opts.OnError(ctx, info, err)
		}
		return rpcErr.Status, rpcErr
	}

	var issues ValidationErrors
	if errors.As(err, &issues) {
		return 400, ValidationError("call_data", issues)
	}

	if s.opts.OnError != nil {
		s.opts.OnError(ctx, info, err)
	}
	return 500, InternalServerError()
}

func (s *Server) directMethodName(r *http.Request) (string, bool) {
	parts := splitPath(r.URL.Path)
	mount := splitPath(s.opts.Path)

	if len(mount) > 0 {
		if len(parts) != len(mount)+1 {
			return "", false
		}
		for i, part := range mount {
			if parts[i] != part {
				return "", false
			}
		}
	}

	if len(parts) == 0 {
		return "", false
	}

	name := strings.TrimPrefix(parts[len(parts)-1], "$")
	return normalizeMethodName(name), name != ""
}

func splitPath(p string) []string {
	var parts []string
	for part := range strings.SplitSeq(p, "/") {
		if part != "" {
			parts = append(parts, part)
		}
	}
	return parts
}

// parseBatch applies the same shape test as rpcMux: an object whose "calls" is an array of
// objects with string id and name. Anything else is a direct call payload.
func parseBatch(plain json.RawMessage) ([]wireCall, bool) {
	var body map[string]json.RawMessage
	if json.Unmarshal(plain, &body) != nil {
		return nil, false
	}

	rawCalls, ok := body["calls"]
	if !ok {
		return nil, false
	}

	var items []map[string]json.RawMessage
	if json.Unmarshal(rawCalls, &items) != nil || items == nil {
		return nil, false
	}

	calls := make([]wireCall, len(items))
	for i, item := range items {
		if item == nil {
			return nil, false
		}
		if json.Unmarshal(item["id"], &calls[i].ID) != nil || json.Unmarshal(item["name"], &calls[i].Name) != nil {
			return nil, false
		}
		calls[i].Payload = item["payload"]
	}
	return calls, true
}

func writeResponse(w http.ResponseWriter, status int, body any) {
	encoded, err := Marshal(body)
	if err != nil {
		status = 500
		encoded, _ = Marshal(InternalServerError())
	}

	if status < 100 || status > 599 {
		status = 500
	}

	w.Header().Set("Content-Type", ContentType)
	w.WriteHeader(status)
	_, _ = w.Write(encoded)
}

func clientIP(r *http.Request) string {
	for _, header := range []string{"Cf-Connecting-Ip", "X-Forwarded-For", "X-Real-Ip"} {
		if value := r.Header.Get(header); value != "" {
			first, _, _ := strings.Cut(value, ",")
			if first = strings.TrimSpace(first); first != "" {
				return first
			}
		}
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func randomID() string {
	b := make([]byte, 10)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// HMACAuth verifies the "v1" metorial-rpc-signature header against a shared secret.
func HMACAuth(token func(r *http.Request) (string, error)) AuthenticateFunc {
	return func(r *http.Request, body []byte) (any, error) {
		header := r.Header.Get(SignatureHeader)
		if header == "" {
			return nil, UnauthorizedError()
		}

		secret, err := token(r)
		if err != nil || secret == "" {
			return nil, UnauthorizedError()
		}

		if !VerifyHMAC(secret, header, r.Method, PathAndQuery(r.URL), body, time.Now(), DefaultSignatureMaxAge) {
			return nil, UnauthorizedError()
		}
		return nil, nil
	}
}

type Ed25519Caller struct {
	KeyID string
}

// Ed25519Auth verifies the "ed25519-v1" metorial-rpc-signature header. publicKey resolves
// the caller's key by id; returning an error rejects the request as unauthorized.
func Ed25519Auth(audience string, publicKey func(ctx context.Context, keyID string) (ed25519.PublicKey, error)) AuthenticateFunc {
	return func(r *http.Request, body []byte) (any, error) {
		header := r.Header.Get(SignatureHeader)
		meta, ok := ParseEd25519Signature(header)
		if !ok {
			return nil, UnauthorizedError()
		}

		key, err := publicKey(r.Context(), meta.KeyID)
		if err != nil || key == nil {
			return nil, UnauthorizedError()
		}

		if !VerifyEd25519(header, key, audience, r.Method, PathAndQuery(r.URL), r.Header.Get("Authorization"), body, time.Now(), DefaultSignatureMaxAge) {
			return nil, UnauthorizedError()
		}
		return Ed25519Caller{KeyID: meta.KeyID}, nil
	}
}
