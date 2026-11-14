package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"k8s.io/client-go/rest"

	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc"
	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc/kubeauth"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/access"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/metrics"
)

const (
	ListenerControl = "control"
	ListenerPod     = "pod"
)

type reviewFlag struct{}

// NewVerifier builds a kubeauth verifier that reviews tokens through a cluster's rest config, so
// the same code path works in-cluster, from a kubeconfig, and against a separate functions
// cluster. kubeauth always sends a bearer token from a file; the transport drops it and lets the
// rest config authenticate instead.
func NewVerifier(cfg *rest.Config, audience string, allowed kubeauth.Allowlist, tempDir string) (*kubeauth.Verifier, error) {
	transport, err := rest.TransportFor(cfg)
	if err != nil {
		return nil, err
	}

	placeholder := filepath.Join(tempDir, "kubeauth-placeholder-token")
	if err := os.WriteFile(placeholder, []byte("unused"), 0o600); err != nil {
		return nil, err
	}

	return kubeauth.New(kubeauth.Config{
		Audiences: []string{audience},
		APIServer: cfg.Host,
		TokenFile: placeholder,
		Allowed:   allowed,
		HTTPClient: &http.Client{
			Timeout:   10 * time.Second,
			Transport: restAuth{next: transport},
		},
	})
}

type restAuth struct {
	next http.RoundTripper
}

func (t restAuth) RoundTrip(r *http.Request) (*http.Response, error) {
	if flag, ok := r.Context().Value(reviewFlag{}).(*bool); ok {
		*flag = true
	}
	r = r.Clone(r.Context())
	r.Header.Del("Authorization")
	return t.next.RoundTrip(r)
}

type Authenticator struct {
	verifiers []*kubeauth.Verifier
	listener  string
	metrics   *metrics.Metrics
}

// NewAuthenticator tries each verifier in turn; with a separate functions cluster, pod tokens may
// come from either cluster.
func NewAuthenticator(listener string, m *metrics.Metrics, verifiers ...*kubeauth.Verifier) *Authenticator {
	return &Authenticator{verifiers: verifiers, listener: listener, metrics: m}
}

func (a *Authenticator) Verify(ctx context.Context, token string) (*kubeauth.Identity, error) {
	start := time.Now()
	reviewed := false
	ctx = context.WithValue(ctx, reviewFlag{}, &reviewed)

	var lastErr error
	for _, v := range a.verifiers {
		identity, err := v.Verify(ctx, token)
		if err == nil {
			a.observe(start, reviewed)
			return identity, nil
		}
		if lastErr == nil || errorStatus(err) != http.StatusUnauthorized {
			lastErr = err
		}
	}

	a.observe(start, reviewed)
	a.Fail(failureReason(lastErr))
	return nil, lastErr
}

func (a *Authenticator) observe(start time.Time, reviewed bool) {
	a.metrics.TokenReviewDuration.Observe(time.Since(start).Seconds())
	result := "hit"
	if reviewed {
		result = "miss"
	}
	a.metrics.TokenReviewCache.WithLabelValues(result).Inc()
}

func (a *Authenticator) Fail(reason string) {
	a.metrics.AuthFailures.WithLabelValues(a.listener, reason).Inc()
}

func errorStatus(err error) int {
	if e, ok := ldrpc.AsError(err); ok {
		return e.Status
	}
	return http.StatusInternalServerError
}

func failureReason(err error) string {
	switch errorStatus(err) {
	case http.StatusUnauthorized:
		return "invalid_token"
	case http.StatusForbidden:
		return "service_account_not_allowed"
	case http.StatusServiceUnavailable:
		return "tokenreview_unavailable"
	default:
		return "error"
	}
}

type ControlCaller struct {
	Identity *kubeauth.Identity
	Caller   access.Caller
}

// ControlAuth authenticates control-API requests and maps the ServiceAccount to a caller.
type ControlAuth struct {
	auth      *Authenticator
	functions kubeauth.ServiceAccount
	build     kubeauth.ServiceAccount
	insecure  bool
}

func NewControlAuth(a *Authenticator, platformNamespace, functionsSA, buildSA string, insecure bool) *ControlAuth {
	return &ControlAuth{
		auth:      a,
		functions: kubeauth.ServiceAccount{Namespace: platformNamespace, Name: functionsSA},
		build:     kubeauth.ServiceAccount{Namespace: platformNamespace, Name: buildSA},
		insecure:  insecure,
	}
}

func (c *ControlAuth) Allowlist() kubeauth.Allowlist {
	return kubeauth.Allowlist{c.functions, c.build}
}

func (c *ControlAuth) Caller(identity *kubeauth.Identity) (access.Caller, bool) {
	switch {
	case identity == nil:
		return "", false
	case identity.Namespace == c.functions.Namespace && identity.ServiceAccount == c.functions.Name:
		return access.CallerFunctions, true
	case identity.Namespace == c.build.Namespace && identity.ServiceAccount == c.build.Name:
		return access.CallerBuild, true
	default:
		return "", false
	}
}

func (c *ControlAuth) Authenticate() ldrpc.AuthenticateFunc {
	return func(r *http.Request, _ []byte) (any, error) {
		if c.insecure {
			return &ControlCaller{Caller: access.CallerInsecure}, nil
		}
		identity, err := c.auth.Verify(r.Context(), kubeauth.BearerToken(r))
		if err != nil {
			return nil, err
		}
		caller, ok := c.Caller(identity)
		if !ok {
			c.auth.Fail("service_account_not_allowed")
			return nil, ldrpc.ForbiddenError()
		}
		return &ControlCaller{Identity: identity, Caller: caller}, nil
	}
}

// Middleware enforces the per-method table in access.MethodAllowed for every call of a batch.
func (c *ControlAuth) Middleware() ldrpc.Middleware {
	return func(next ldrpc.HandlerFunc) ldrpc.HandlerFunc {
		return func(ctx context.Context, payload json.RawMessage) (any, error) {
			info := ldrpc.CallInfoFromContext(ctx)
			var caller *ControlCaller
			if info != nil {
				caller, _ = info.Auth.(*ControlCaller)
			}
			if caller == nil || !access.MethodAllowed(caller.Caller, info.Method) {
				c.auth.Fail("method_not_allowed")
				return nil, ldrpc.ForbiddenError()
			}
			return next(ctx, payload)
		}
	}
}

func CallerFromContext(ctx context.Context) (access.Caller, error) {
	info := ldrpc.CallInfoFromContext(ctx)
	if info == nil {
		return "", errors.New("no call info")
	}
	caller, ok := info.Auth.(*ControlCaller)
	if !ok {
		return "", fmt.Errorf("unauthenticated call")
	}
	return caller.Caller, nil
}
