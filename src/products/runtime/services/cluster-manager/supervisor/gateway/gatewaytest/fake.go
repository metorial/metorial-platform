// Package gatewaytest is an h2c stand-in for the egress gateway's tunnel front end. It
// verifies grants like the gateway but only understands host rules, and it resolves names
// from a fixed table so tests can point "public" hostnames at local servers.
package gatewaytest

import (
	"encoding/json"
	"io"
	"net"
	"net/http"
	"slices"
	"strconv"
	"sync"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress/policy"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/gateway"
)

type Observation struct {
	Kind    string
	GrantID string
	Host    string
	Port    int
	Allowed bool
	Reason  string
}

type Fake struct {
	Addr  string
	Keys  egress.Keys
	Hosts map[string][]string

	listener net.Listener
	server   *http.Server

	mu           sync.Mutex
	observations []Observation
	resolved     map[string]map[string]string
	open         int
}

func New(keys egress.Keys, hosts map[string][]string) *Fake {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		panic(err)
	}

	f := &Fake{Addr: listener.Addr().String(), Keys: keys, Hosts: hosts, listener: listener, resolved: map[string]map[string]string{}}

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/resolve", f.resolve)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })

	protocols := new(http.Protocols)
	protocols.SetUnencryptedHTTP2(true)
	f.server = &http.Server{
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodConnect {
				f.connect(w, r)
				return
			}
			mux.ServeHTTP(w, r)
		}),
		Protocols:         protocols,
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() { _ = f.server.Serve(listener) }()
	return f
}

func (f *Fake) Close() {
	_ = f.server.Close()
}

func (f *Fake) Observations() []Observation {
	f.mu.Lock()
	defer f.mu.Unlock()
	return slices.Clone(f.observations)
}

func (f *Fake) OpenTunnels() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.open
}

func (f *Fake) observe(o Observation) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.observations = append(f.observations, o)
}

func (f *Fake) grant(r *http.Request) (*egress.Grant, bool) {
	g, err := egress.VerifyGrant(r.Header.Get(gateway.GrantHeader), f.Keys, time.Now())
	return g, err == nil
}

func allowed(g *egress.Grant, host string, port int) bool {
	if g.AllowAll {
		return true
	}
	if g.Policy == nil {
		return false
	}
	for _, rule := range g.Policy.Hosts {
		if policy.MatchHost(rule.Pattern, host) && (len(rule.Ports) == 0 || slices.Contains(rule.Ports, port)) {
			return true
		}
	}
	return false
}

func (f *Fake) resolve(w http.ResponseWriter, r *http.Request) {
	g, ok := f.grant(r)
	if !ok {
		w.WriteHeader(http.StatusProxyAuthRequired)
		return
	}

	host := r.URL.Query().Get("host")
	addresses := []string{}
	if allowed(g, host, 0) || f.allowedOnAnyPort(g, host) {
		addresses = append(addresses, f.Hosts[host]...)
	}

	f.mu.Lock()
	if f.resolved[g.ID] == nil {
		f.resolved[g.ID] = map[string]string{}
	}
	for _, addr := range addresses {
		f.resolved[g.ID][addr] = host
	}
	f.mu.Unlock()

	f.observe(Observation{Kind: "resolve", GrantID: g.ID, Host: host, Allowed: len(addresses) > 0})
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"addresses": addresses})
}

func (f *Fake) allowedOnAnyPort(g *egress.Grant, host string) bool {
	if g.Policy == nil {
		return false
	}
	for _, rule := range g.Policy.Hosts {
		if policy.MatchHost(rule.Pattern, host) {
			return true
		}
	}
	return false
}

func (f *Fake) connect(w http.ResponseWriter, r *http.Request) {
	g, ok := f.grant(r)
	if !ok {
		w.WriteHeader(http.StatusProxyAuthRequired)
		return
	}

	host, portText, err := net.SplitHostPort(r.Host)
	port, portErr := strconv.Atoi(portText)
	if err != nil || portErr != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	name := host
	if net.ParseIP(host) != nil {
		f.mu.Lock()
		if resolvedName, ok := f.resolved[g.ID][host]; ok {
			name = resolvedName
		}
		f.mu.Unlock()
	}

	addresses := f.Hosts[name]
	if net.ParseIP(host) != nil {
		addresses = []string{host}
	}

	obs := Observation{Kind: "connect", GrantID: g.ID, Host: name, Port: port}
	if !allowed(g, name, port) {
		obs.Reason = "policy"
		f.observe(obs)
		w.Header().Set(gateway.ReasonHeader, "policy")
		w.WriteHeader(http.StatusForbidden)
		return
	}
	if len(addresses) == 0 {
		obs.Reason = "no_address"
		f.observe(obs)
		w.Header().Set(gateway.ReasonHeader, "no_address")
		w.WriteHeader(http.StatusForbidden)
		return
	}

	upstream, err := net.DialTimeout("tcp", net.JoinHostPort(addresses[0], portText), 5*time.Second)
	if err != nil {
		obs.Reason = "dial_failed"
		f.observe(obs)
		w.WriteHeader(http.StatusBadGateway)
		return
	}
	defer upstream.Close()

	obs.Allowed = true
	f.observe(obs)

	f.mu.Lock()
	f.open++
	f.mu.Unlock()
	defer func() {
		f.mu.Lock()
		f.open--
		f.mu.Unlock()
	}()

	w.WriteHeader(http.StatusOK)
	rc := http.NewResponseController(w)
	_ = rc.Flush()

	go func() {
		_, _ = io.Copy(upstream, r.Body)
		if tcp, ok := upstream.(*net.TCPConn); ok {
			_ = tcp.CloseWrite()
		}
	}()
	go func() {
		<-r.Context().Done()
		_ = upstream.Close()
	}()

	buf := make([]byte, 32<<10)
	for {
		n, err := upstream.Read(buf)
		if n > 0 {
			if _, werr := w.Write(buf[:n]); werr != nil {
				return
			}
			_ = rc.Flush()
		}
		if err != nil {
			return
		}
	}
}
