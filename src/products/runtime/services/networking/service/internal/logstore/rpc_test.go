package logstore

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/lib/rpc/go"
	"github.com/metorial/metorial-platform/src/lib/rpc/go/kubeauth"
	"github.com/metorial/metorial-platform/src/products/runtime/services/networking/service/rpc/networklogsrpc"
)

func newRPCServer(t *testing.T, store *Store, auth Auth) string {
	t.Helper()
	handler, err := RPCHandler(&Service{Store: store, Logger: slog.New(slog.DiscardHandler)}, auth, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	return server.URL
}

func rpcClient(t *testing.T, baseURL string, opts ldrpc.ClientOptions) *networklogsrpc.Client {
	t.Helper()
	opts.DisableRetry = true
	opts.Timeout = 5 * time.Second
	client, err := networklogsrpc.NewClient(baseURL+"/rpc", opts)
	if err != nil {
		t.Fatal(err)
	}
	return client
}

func ptr[T any](value T) *T {
	return &value
}

func sampleIngest(batchID string) *networklogsrpc.ObservationIngestManyInput {
	return &networklogsrpc.ObservationIngestManyInput{
		BatchID:           batchID,
		GatewayInstanceID: "gw-1",
		Observations: []networklogsrpc.Observation{
			{
				BucketStart: bucket, TenantID: "ten_1", FunctionID: "fn_1", EnclaveID: ptr("enc_1"),
				Hostname: "example.com", IP: "93.184.216.34", Port: 443,
				Decision: networklogsrpc.DecisionAllowed, Source: networklogsrpc.SourceKnative,
				Count: 4, FirstSeenAt: bucket, LastSeenAt: bucket.Add(time.Minute),
			},
			{
				BucketStart: bucket, TenantID: "ten_1", FunctionID: "fn_1",
				Hostname: "169.254.169.254", IP: "169.254.169.254", Port: 80,
				Decision: networklogsrpc.DecisionDenied, Source: networklogsrpc.SourceLambda,
				Count: 1, FirstSeenAt: bucket, LastSeenAt: bucket,
			},
		},
	}
}

func TestRPCWithHMAC(t *testing.T) {
	store := openTestStore(t, testConfig(t))
	baseURL := newRPCServer(t, store, Auth{HMACSecret: "secret"})
	client := rpcClient(t, baseURL, ldrpc.ClientOptions{HMACToken: "secret"})
	ctx := context.Background()

	out, err := client.ObservationIngestMany(ctx, sampleIngest("gw-1:1"))
	if err != nil || !out.Inserted {
		t.Fatalf("ingest %+v %v", out, err)
	}
	out, err = client.ObservationIngestMany(ctx, sampleIngest("gw-1:1"))
	if err != nil || out.Inserted {
		t.Fatalf("replay %+v %v", out, err)
	}

	all, err := client.ObservationList(ctx, &networklogsrpc.ObservationListInput{TenantID: "ten_1"})
	if err != nil || len(all.Records) != 2 {
		t.Fatalf("list %+v %v", all, err)
	}

	denied, err := client.ObservationList(ctx, &networklogsrpc.ObservationListInput{TenantID: "ten_1", Decision: ptr(networklogsrpc.DecisionDenied)})
	if err != nil || len(denied.Records) != 1 {
		t.Fatalf("denied %+v %v", denied, err)
	}
	record := denied.Records[0]
	if record.Source != networklogsrpc.SourceLambda || record.EnclaveID != nil || record.BuildRunID != nil || record.Port != 80 {
		t.Fatalf("denied record %+v", record)
	}

	if _, err := client.ObservationList(ctx, &networklogsrpc.ObservationListInput{TenantID: "ten_1", IntervalMinutes: ptr[int64](45)}); !isStatus(err, 400) {
		t.Fatalf("interval error %v", err)
	}

	bad := sampleIngest("gw-1:2")
	bad.Observations[0].FunctionID = ""
	if _, err := client.ObservationIngestMany(ctx, bad); !isStatus(err, 400) {
		t.Fatalf("invalid observation error %v", err)
	}

	wrong := rpcClient(t, baseURL, ldrpc.ClientOptions{HMACToken: "other"})
	if _, err := wrong.ObservationList(ctx, &networklogsrpc.ObservationListInput{TenantID: "ten_1"}); !isStatus(err, 401) {
		t.Fatalf("wrong secret error %v", err)
	}
	unsigned := rpcClient(t, baseURL, ldrpc.ClientOptions{})
	if _, err := unsigned.ObservationList(ctx, &networklogsrpc.ObservationListInput{TenantID: "ten_1"}); !isStatus(err, 401) {
		t.Fatalf("unsigned error %v", err)
	}

	response, err := http.Get(baseURL + "/healthz")
	if err != nil || response.StatusCode != http.StatusOK {
		t.Fatalf("healthz %v %v", response, err)
	}
	_ = response.Body.Close()
}

func TestRPCWithKubeAuthRestrictsMethodsByServiceAccount(t *testing.T) {
	store := openTestStore(t, testConfig(t))

	tokens := map[string]string{
		"gateway-token":   "system:serviceaccount:metorial:metorial-egress-gateway",
		"functions-token": "system:serviceaccount:metorial:metorial-functions",
		"stranger-token":  "system:serviceaccount:metorial-runtime-functions:default",
	}
	apiServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var review struct {
			Spec struct {
				Token     string   `json:"token"`
				Audiences []string `json:"audiences"`
			} `json:"spec"`
		}
		_ = json.NewDecoder(r.Body).Decode(&review)

		status := map[string]any{"authenticated": false}
		if username, ok := tokens[review.Spec.Token]; ok && len(review.Spec.Audiences) == 1 && review.Spec.Audiences[0] == "metorial-network-logs" {
			status = map[string]any{"authenticated": true, "audiences": review.Spec.Audiences, "user": map[string]any{"username": username}}
		}
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]any{"status": status})
	}))
	t.Cleanup(apiServer.Close)

	reviewerToken := filepath.Join(t.TempDir(), "token")
	if err := os.WriteFile(reviewerToken, []byte("reviewer"), 0o600); err != nil {
		t.Fatal(err)
	}

	ingest, _ := kubeauth.ParseAllowlist("metorial/metorial-egress-gateway")
	list, _ := kubeauth.ParseAllowlist("metorial/metorial-functions")
	verifier, err := kubeauth.New(kubeauth.Config{
		Audiences: []string{"metorial-network-logs"},
		APIServer: apiServer.URL,
		TokenFile: reviewerToken,
		Allowed:   append(append(kubeauth.Allowlist{}, ingest...), list...),
	})
	if err != nil {
		t.Fatal(err)
	}
	baseURL := newRPCServer(t, store, Auth{Kube: verifier, IngestAccounts: ingest, ListAccounts: list})

	as := func(token string) *networklogsrpc.Client {
		path := filepath.Join(t.TempDir(), "sa-token")
		if err := os.WriteFile(path, []byte(token), 0o600); err != nil {
			t.Fatal(err)
		}
		return rpcClient(t, baseURL, ldrpc.ClientOptions{HeaderFunc: kubeauth.TokenFileHeader(path)})
	}
	gateway, functions, stranger, invalid := as("gateway-token"), as("functions-token"), as("stranger-token"), as("forged")
	ctx := context.Background()
	listInput := &networklogsrpc.ObservationListInput{TenantID: "ten_1"}

	if _, err := gateway.ObservationIngestMany(ctx, sampleIngest("gw:1")); err != nil {
		t.Fatalf("gateway ingest: %v", err)
	}
	if _, err := gateway.ObservationList(ctx, listInput); !isStatus(err, 403) {
		t.Fatalf("gateway list: %v", err)
	}
	if out, err := functions.ObservationList(ctx, listInput); err != nil || len(out.Records) != 2 {
		t.Fatalf("functions list: %+v %v", out, err)
	}
	if _, err := functions.ObservationIngestMany(ctx, sampleIngest("gw:2")); !isStatus(err, 403) {
		t.Fatalf("functions ingest: %v", err)
	}
	if _, err := stranger.ObservationList(ctx, listInput); !isStatus(err, 403) {
		t.Fatalf("stranger list: %v", err)
	}
	if _, err := invalid.ObservationIngestMany(ctx, sampleIngest("gw:3")); !isStatus(err, 401) {
		t.Fatalf("invalid token: %v", err)
	}
}

func TestRPCHandlerRequiresExactlyOneAuthMode(t *testing.T) {
	if _, err := RPCHandler(&Service{}, Auth{}, slog.New(slog.DiscardHandler)); err == nil {
		t.Fatal("expected an error without auth")
	}
	verifier, err := kubeauth.New(kubeauth.Config{Audiences: []string{"a"}, APIServer: "https://127.0.0.1:1", TokenFile: "/nonexistent"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := RPCHandler(&Service{}, Auth{HMACSecret: "s", Kube: verifier}, slog.New(slog.DiscardHandler)); err == nil {
		t.Fatal("expected an error with both modes")
	}
}

func TestLegacyEndpoints(t *testing.T) {
	store := openTestStore(t, testConfig(t))
	logger := slog.New(slog.DiscardHandler)
	ingest := httptest.NewServer(LegacyIngestHandler(store, logger))
	t.Cleanup(ingest.Close)
	query := httptest.NewServer(LegacyQueryHandler(store, logger))
	t.Cleanup(query.Close)

	batch := `{"id":"deflector-a:1","deflectorInstanceId":"deflector-a","records":[{"bucketStart":"2026-11-13T10:00:00Z","tenantId":"ten_1","functionId":"fn_1","enclaveId":"enc_1","hostname":"example.com","ip":"93.184.216.34","port":443,"count":2,"firstSeenAt":"2026-11-13T10:01:00Z","lastSeenAt":"2026-11-13T10:02:00Z"}]}`
	for i, wantInserted := range []bool{true, false} {
		response, err := http.Post(ingest.URL+"/ingest", "application/json", strings.NewReader(batch))
		if err != nil {
			t.Fatal(err)
		}
		var body struct {
			OK       bool `json:"ok"`
			Inserted bool `json:"inserted"`
		}
		_ = json.NewDecoder(response.Body).Decode(&body)
		_ = response.Body.Close()
		if response.StatusCode != http.StatusOK || !body.OK || body.Inserted != wantInserted {
			t.Fatalf("attempt %d: %d %+v", i, response.StatusCode, body)
		}
	}

	if _, err := store.Ingest(context.Background(), Batch{ID: "gw:1", Records: []Record{functionRecord("denied.example", DecisionDenied)}}); err != nil {
		t.Fatal(err)
	}

	response, err := http.Get(query.URL + "/logs?tenantId=ten_1&enclaveId[]=enc_1&intervalMinutes=60")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	var logs struct {
		Records []map[string]any `json:"records"`
	}
	if err := json.NewDecoder(response.Body).Decode(&logs); err != nil {
		t.Fatal(err)
	}
	if len(logs.Records) != 1 || logs.Records[0]["hostname"] != "example.com" || logs.Records[0]["count"] != float64(2) {
		t.Fatalf("legacy logs %+v", logs.Records)
	}
	if _, ok := logs.Records[0]["decision"]; ok {
		t.Fatalf("legacy response gained fields: %+v", logs.Records[0])
	}

	for _, path := range []string{"/logs?intervalMinutes=45", "/logs?from=yesterday"} {
		response, err := http.Get(query.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		_ = response.Body.Close()
		if response.StatusCode != http.StatusBadRequest {
			t.Fatalf("%s: %d", path, response.StatusCode)
		}
	}

	response, err = http.Post(ingest.URL+"/ingest", "application/json", strings.NewReader(`{"id":"x","records":[{"tenantId":"t","functionId":"f","hostname":"h","ip":"1.1.1.1","port":0}]}`))
	if err != nil {
		t.Fatal(err)
	}
	_ = response.Body.Close()
	if response.StatusCode != http.StatusBadRequest {
		t.Fatalf("legacy port 0: %d", response.StatusCode)
	}
}

func isStatus(err error, status int) bool {
	rpcErr, ok := ldrpc.AsError(err)
	return ok && rpcErr.Status == status
}
