package logstore

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/metorial/metorial-platform/src/lib/rpc/go"
	"github.com/metorial/metorial-platform/src/lib/rpc/go/kubeauth"
	"github.com/metorial/metorial-platform/src/products/runtime/services/networking/service/rpc/networklogsrpc"
)

const (
	MethodIngestMany = "observation:ingestMany"
	MethodList       = "observation:list"
)

type Auth struct {
	HMACSecret string

	Kube           *kubeauth.Verifier
	IngestAccounts kubeauth.Allowlist
	ListAccounts   kubeauth.Allowlist
}

// RPCHandler serves the network-logs service at /rpc, plus /healthz. With kubeauth, the
// gateway's ServiceAccount may only ingest and function-bay's may only list.
func RPCHandler(service *Service, auth Auth, logger *slog.Logger) (http.Handler, error) {
	options := ldrpc.ServerOptions{
		Path:         "/rpc",
		MaxBodyBytes: 32 << 20,
		OnError: func(_ context.Context, call *ldrpc.CallInfo, err error) {
			method := ""
			if call != nil {
				method = call.Method
			}
			logger.Warn("rpc call failed", "method", method, "error", err)
		},
	}

	switch {
	case auth.Kube != nil && auth.HMACSecret != "":
		return nil, errors.New("configure either HMAC or kubeauth, not both")
	case auth.Kube != nil:
		options.Authenticate = auth.Kube.Authenticate()
	case auth.HMACSecret != "":
		secret := auth.HMACSecret
		options.Authenticate = ldrpc.HMACAuth(func(*http.Request) (string, error) { return secret, nil })
	default:
		return nil, errors.New("network-logs RPC requires HMAC or kubeauth")
	}

	server := ldrpc.NewServer(options)
	if auth.Kube != nil {
		server.Use(kubeauth.MethodAllowlist(map[string]kubeauth.Allowlist{
			MethodIngestMany: auth.IngestAccounts,
			MethodList:       auth.ListAccounts,
		}))
	}
	networklogsrpc.Register(server, service)

	mux := http.NewServeMux()
	server.Mount(mux)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		if err := service.Store.Ping(ctx); err != nil {
			http.Error(w, "database unavailable", http.StatusServiceUnavailable)
			return
		}
		health(w, r)
	})
	return mux, nil
}
