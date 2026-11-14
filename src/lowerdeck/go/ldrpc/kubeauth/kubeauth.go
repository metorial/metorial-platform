// Package kubeauth authenticates callers by their Kubernetes ServiceAccount token, using the
// TokenReview API with an expected audience. It plugs into ldrpc.ServerOptions.Authenticate and
// works as plain net/http middleware.
package kubeauth

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc"
)

const (
	InClusterTokenFile = "/var/run/secrets/kubernetes.io/serviceaccount/token"
	InClusterCAFile    = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
	DefaultCacheTTL    = time.Minute

	podNameExtra       = "authentication.kubernetes.io/pod-name"
	podUIDExtra        = "authentication.kubernetes.io/pod-uid"
	serviceAccountUser = "system:serviceaccount:"
	maxCacheEntries    = 10_000
	reviewTimeout      = 10 * time.Second
)

type Identity struct {
	Namespace      string
	ServiceAccount string
	// PodName and PodUID are set for pod-bound tokens (projected volumes, or TokenRequest
	// with a Pod bound object).
	PodName string
	PodUID  string
}

func (id *Identity) String() string {
	s := id.Namespace + "/" + id.ServiceAccount
	if id.PodName != "" {
		s += " (pod " + id.PodName + ")"
	}
	return s
}

type Config struct {
	// Audiences the token must be valid for. Required, so tokens for the API server itself
	// (or another service) are rejected.
	Audiences []string

	// APIServer defaults to https://$KUBERNETES_SERVICE_HOST:$KUBERNETES_SERVICE_PORT.
	APIServer string

	// TokenFile authenticates the TokenReview call. It needs system:auth-delegator. Defaults to
	// the in-cluster ServiceAccount token; re-read when it changes.
	TokenFile string

	// CAFile verifies the API server. Defaults to the in-cluster CA when APIServer is also
	// defaulted, and to the system roots otherwise.
	CAFile string

	// Allowed, when non-empty, rejects every other ServiceAccount with 403.
	Allowed Allowlist

	// CacheTTL bounds how long a successful review is reused; the token's own expiry bounds it
	// further. Defaults to DefaultCacheTTL.
	CacheTTL time.Duration

	HTTPClient *http.Client
}

type Verifier struct {
	cfg    Config
	http   *http.Client
	token  *tokenFile
	now    func() time.Time
	mu     sync.Mutex
	cached map[[sha256.Size]byte]cacheEntry
}

type cacheEntry struct {
	identity *Identity
	expires  time.Time
}

func New(cfg Config) (*Verifier, error) {
	if len(cfg.Audiences) == 0 {
		return nil, errors.New("kubeauth: at least one audience is required")
	}
	if cfg.CacheTTL == 0 {
		cfg.CacheTTL = DefaultCacheTTL
	}

	inCluster := cfg.APIServer == ""
	if inCluster {
		host, port := os.Getenv("KUBERNETES_SERVICE_HOST"), os.Getenv("KUBERNETES_SERVICE_PORT")
		if host == "" || port == "" {
			return nil, errors.New("kubeauth: APIServer is not set and KUBERNETES_SERVICE_HOST/PORT are missing")
		}
		cfg.APIServer = "https://" + net.JoinHostPort(host, port)
	}
	cfg.APIServer = strings.TrimSuffix(cfg.APIServer, "/")

	if cfg.TokenFile == "" {
		cfg.TokenFile = InClusterTokenFile
	}
	if cfg.CAFile == "" && inCluster {
		cfg.CAFile = InClusterCAFile
	}

	client := cfg.HTTPClient
	if client == nil {
		tlsConfig := &tls.Config{MinVersion: tls.VersionTLS12}
		if cfg.CAFile != "" {
			pem, err := os.ReadFile(cfg.CAFile)
			if err != nil {
				return nil, fmt.Errorf("kubeauth: read CA file: %w", err)
			}
			pool := x509.NewCertPool()
			if !pool.AppendCertsFromPEM(pem) {
				return nil, fmt.Errorf("kubeauth: no certificates in %s", cfg.CAFile)
			}
			tlsConfig.RootCAs = pool
		}
		transport := http.DefaultTransport.(*http.Transport).Clone()
		transport.TLSClientConfig = tlsConfig
		client = &http.Client{Transport: transport, Timeout: reviewTimeout}
	}

	return &Verifier{
		cfg:    cfg,
		http:   client,
		token:  &tokenFile{path: cfg.TokenFile},
		now:    time.Now,
		cached: map[[sha256.Size]byte]cacheEntry{},
	}, nil
}

var (
	errUnauthorized = ldrpc.UnauthorizedError()
	errForbidden    = ldrpc.ForbiddenError()
	errUnavailable  = ldrpc.NewError(503, "service_unavailable", "Authentication is temporarily unavailable.")
)

// Verify reviews a bearer token. Failures are *ldrpc.Error values: 401 for a rejected token,
// 403 for a ServiceAccount outside Allowed, 503 when the API server can't be reached.
func (v *Verifier) Verify(ctx context.Context, token string) (*Identity, error) {
	if token == "" {
		return nil, errUnauthorized
	}

	key := sha256.Sum256([]byte(token))
	now := v.now()

	v.mu.Lock()
	entry, ok := v.cached[key]
	v.mu.Unlock()

	identity := entry.identity
	if !ok || !now.Before(entry.expires) {
		var err error
		identity, err = v.review(ctx, token)
		if err != nil {
			return nil, err
		}
		v.store(key, identity, now, tokenExpiry(token))
	}

	if len(v.cfg.Allowed) > 0 && !v.cfg.Allowed.Allows(identity) {
		return nil, errForbidden
	}
	return identity, nil
}

func (v *Verifier) store(key [sha256.Size]byte, identity *Identity, now, tokenExpires time.Time) {
	expires := now.Add(v.cfg.CacheTTL)
	if !tokenExpires.IsZero() && tokenExpires.Before(expires) {
		expires = tokenExpires
	}
	if !now.Before(expires) {
		return
	}

	v.mu.Lock()
	defer v.mu.Unlock()

	if len(v.cached) >= maxCacheEntries {
		for k, e := range v.cached {
			if !now.Before(e.expires) {
				delete(v.cached, k)
			}
		}
		if len(v.cached) >= maxCacheEntries {
			clear(v.cached)
		}
	}
	v.cached[key] = cacheEntry{identity: identity, expires: expires}
}

type tokenReview struct {
	APIVersion string            `json:"apiVersion"`
	Kind       string            `json:"kind"`
	Spec       tokenReviewSpec   `json:"spec"`
	Status     tokenReviewStatus `json:"status"`
}

type tokenReviewSpec struct {
	Token     string   `json:"token"`
	Audiences []string `json:"audiences"`
}

type tokenReviewStatus struct {
	Authenticated bool     `json:"authenticated"`
	Audiences     []string `json:"audiences"`
	Error         string   `json:"error"`
	User          struct {
		Username string              `json:"username"`
		Extra    map[string][]string `json:"extra"`
	} `json:"user"`
}

func (v *Verifier) review(ctx context.Context, token string) (*Identity, error) {
	body, err := json.Marshal(tokenReview{
		APIVersion: "authentication.k8s.io/v1",
		Kind:       "TokenReview",
		Spec:       tokenReviewSpec{Token: token, Audiences: v.cfg.Audiences},
	})
	if err != nil {
		return nil, err
	}

	credentials, err := v.token.read()
	if err != nil {
		return nil, errUnavailable.WithCause(err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, v.cfg.APIServer+"/apis/authentication.k8s.io/v1/tokenreviews", bytes.NewReader(body))
	if err != nil {
		return nil, errUnavailable.WithCause(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+credentials)

	res, err := v.http.Do(req)
	if err != nil {
		return nil, errUnavailable.WithCause(err)
	}
	defer res.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return nil, errUnavailable.WithCause(err)
	}
	if res.StatusCode != http.StatusCreated && res.StatusCode != http.StatusOK {
		return nil, errUnavailable.WithCause(fmt.Errorf("kubeauth: TokenReview returned %d: %s", res.StatusCode, raw))
	}

	var review tokenReview
	if err := json.Unmarshal(raw, &review); err != nil {
		return nil, errUnavailable.WithCause(fmt.Errorf("kubeauth: decode TokenReview: %w", err))
	}

	status := review.Status
	if !status.Authenticated || !intersects(status.Audiences, v.cfg.Audiences) {
		return nil, errUnauthorized
	}

	namespace, name, ok := strings.Cut(strings.TrimPrefix(status.User.Username, serviceAccountUser), ":")
	if !strings.HasPrefix(status.User.Username, serviceAccountUser) || !ok || namespace == "" || name == "" {
		return nil, errUnauthorized
	}

	return &Identity{
		Namespace:      namespace,
		ServiceAccount: name,
		PodName:        first(status.User.Extra[podNameExtra]),
		PodUID:         first(status.User.Extra[podUIDExtra]),
	}, nil
}

// Authenticate is the ldrpc.ServerOptions.Authenticate hook. Handlers get the *Identity from
// IdentityFromContext (or ldrpc.CallInfoFromContext(ctx).Auth).
func (v *Verifier) Authenticate() ldrpc.AuthenticateFunc {
	return func(r *http.Request, body []byte) (any, error) {
		identity, err := v.Verify(r.Context(), BearerToken(r))
		if err != nil {
			return nil, err
		}
		return identity, nil
	}
}

// Middleware rejects requests without a valid token with a JSON error body and passes the
// *Identity to next through the request context.
func (v *Verifier) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		identity, err := v.Verify(r.Context(), BearerToken(r))
		if err != nil {
			rpcErr, ok := ldrpc.AsError(err)
			if !ok {
				rpcErr = ldrpc.InternalServerError()
			}
			body, _ := json.Marshal(rpcErr)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(rpcErr.Status)
			_, _ = w.Write(body)
			return
		}
		next.ServeHTTP(w, r.WithContext(WithIdentity(r.Context(), identity)))
	})
}

type identityKey struct{}

func WithIdentity(ctx context.Context, identity *Identity) context.Context {
	return context.WithValue(ctx, identityKey{}, identity)
}

// IdentityFromContext returns the caller of an ldrpc call authenticated by Authenticate, or of
// a request that went through Middleware.
func IdentityFromContext(ctx context.Context) (*Identity, bool) {
	if identity, ok := ctx.Value(identityKey{}).(*Identity); ok {
		return identity, true
	}
	if info := ldrpc.CallInfoFromContext(ctx); info != nil {
		identity, ok := info.Auth.(*Identity)
		return identity, ok
	}
	return nil, false
}

func BearerToken(r *http.Request) string {
	scheme, token, ok := strings.Cut(r.Header.Get("Authorization"), " ")
	if !ok || !strings.EqualFold(scheme, "Bearer") {
		return ""
	}
	return strings.TrimSpace(token)
}

// tokenExpiry reads the exp claim without verifying the token; TokenReview has already done
// that, and the value only shortens the cache lifetime.
func tokenExpiry(token string) time.Time {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return time.Time{}
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return time.Time{}
	}
	var claims struct {
		Exp int64 `json:"exp"`
	}
	if json.Unmarshal(payload, &claims) != nil || claims.Exp == 0 {
		return time.Time{}
	}
	return time.Unix(claims.Exp, 0)
}

func intersects(a, b []string) bool {
	for _, x := range a {
		for _, y := range b {
			if x == y {
				return true
			}
		}
	}
	return false
}

func first(values []string) string {
	if len(values) == 0 {
		return ""
	}
	return values[0]
}
