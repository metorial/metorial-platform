package gateway

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
)

const (
	GrantHeader  = "metorial-egress-grant"
	ReasonHeader = "metorial-egress-reason"
)

type TunnelServer struct {
	Core        *Core
	IdleTimeout time.Duration
}

func (s *TunnelServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodConnect {
		s.connect(w, r)
		return
	}

	switch {
	case r.Method == http.MethodGet && r.URL.Path == "/healthz":
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	case r.Method == http.MethodGet && r.URL.Path == "/v1/resolve":
		s.resolve(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (s *TunnelServer) connect(w http.ResponseWriter, r *http.Request) {
	if r.ProtoMajor != 2 {
		w.WriteHeader(http.StatusHTTPVersionNotSupported)
		return
	}

	grant, err := s.Core.VerifyGrant(FrontEndTunnel, r.Header.Get(GrantHeader))
	if err != nil {
		w.WriteHeader(http.StatusProxyAuthRequired)
		return
	}

	target, err := ParseTarget(r.Host)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	upstream, err := s.Core.Connect(r.Context(), FrontEndTunnel, grant, target)
	if err != nil {
		writeConnectError(w, err)
		return
	}
	defer upstream.Close()

	controller := http.NewResponseController(w)
	w.WriteHeader(http.StatusOK)
	if err := controller.Flush(); err != nil {
		return
	}

	metrics := s.Core.metrics()
	metrics.OpenConnections.WithLabelValues(string(FrontEndTunnel)).Inc()
	defer metrics.OpenConnections.WithLabelValues(string(FrontEndTunnel)).Dec()

	relay(upstream.Conn, clientSide{
		reader: r.Body,
		writer: w,
		flush:  func() { _ = controller.Flush() },
		close:  func() { _ = r.Body.Close() },
	}, relayLimits{
		idle:     s.IdleTimeout,
		deadline: grant.Expiry().Add(egress.ClockSkew),
	}, byteCounters(metrics, FrontEndTunnel))
}

func (s *TunnelServer) resolve(w http.ResponseWriter, r *http.Request) {
	grant, err := s.Core.VerifyGrant(FrontEndTunnel, r.Header.Get(GrantHeader))
	if err != nil {
		w.WriteHeader(http.StatusProxyAuthRequired)
		return
	}

	host := r.URL.Query().Get("host")
	if host == "" || len(host) > 253 {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	addrs, err := s.Core.Resolve(r.Context(), grant, host)
	if err != nil {
		w.WriteHeader(http.StatusBadGateway)
		return
	}

	response := struct {
		Addresses []string `json:"addresses"`
	}{Addresses: make([]string, 0, len(addrs))}
	for _, addr := range addrs {
		response.Addresses = append(response.Addresses, addr.String())
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(response)
}

func writeConnectError(w http.ResponseWriter, err error) {
	var denied *DeniedError
	if errors.As(err, &denied) {
		w.Header().Set(ReasonHeader, string(denied.Reason))
		w.WriteHeader(http.StatusForbidden)
		return
	}
	w.WriteHeader(http.StatusBadGateway)
}

func byteCounters(metrics *Metrics, frontEnd FrontEnd) relayCounters {
	upstream := metrics.Bytes.WithLabelValues(string(frontEnd), "upstream")
	downstream := metrics.Bytes.WithLabelValues(string(frontEnd), "downstream")
	return relayCounters{
		upstream:   func(n int) { upstream.Add(float64(n)) },
		downstream: func(n int) { downstream.Add(float64(n)) },
	}
}
