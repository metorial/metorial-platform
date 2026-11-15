package auth_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/auth"
)

type vectorToken struct {
	Name   string `json:"name"`
	Token  string `json:"token"`
	Claims struct {
		FunctionVersionID string `json:"functionVersionId"`
		PayloadSHA256     string `json:"payloadSha256"`
	} `json:"claims"`
	Expect struct {
		Valid bool   `json:"valid"`
		Error string `json:"error"`
	} `json:"expect"`
	PayloadJSON   *string `json:"payloadJson"`
	ExpectPayload string  `json:"expectPayload"`
	BindGrant     string  `json:"bindGrant"`
	ExpectBinding string  `json:"expectBinding"`
}

type vectorFile struct {
	Now              int64           `json:"now"`
	KeySet           json.RawMessage `json:"keySet"`
	Grants           []vectorToken   `json:"grants"`
	InvocationTokens []vectorToken   `json:"invocationTokens"`
	PayloadHashes    []struct {
		PayloadJSON string `json:"payloadJson"`
		SHA256      string `json:"sha256"`
	} `json:"payloadHashes"`
}

const podVersionID = "fnv_01JD8X3333DDDD"

// The shared vectors, run through the supervisor's full decision: pod version, payload
// hash, grant binding and replay cache on top of the token checks.
func TestSharedVectors(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("..", "..", "..", "..", "packages", "egress", "testdata", "vectors.json"))
	if err != nil {
		t.Fatal(err)
	}
	var vectors vectorFile
	if err := json.Unmarshal(data, &vectors); err != nil {
		t.Fatal(err)
	}
	keys, err := egress.ParseKeySet(vectors.KeySet)
	if err != nil {
		t.Fatal(err)
	}

	grants := map[string]string{}
	for _, g := range vectors.Grants {
		grants[g.Name] = g.Token
	}
	payloads := map[string]string{}
	for _, p := range vectors.PayloadHashes {
		payloads[p.SHA256] = p.PayloadJSON
	}

	now := time.Unix(vectors.Now, 0)
	for _, v := range vectors.InvocationTokens {
		t.Run(v.Name, func(t *testing.T) {
			payload, ok := payloads[v.Claims.PayloadSHA256]
			if v.PayloadJSON != nil {
				payload, ok = *v.PayloadJSON, true
			}
			if !ok && v.Expect.Valid {
				t.Skip("no payload with this hash in the vectors")
			}

			grantName := v.BindGrant
			if grantName == "" {
				grantName = "function-grant-full"
			}

			verifier := &auth.Verifier{Keys: keys, VersionID: podVersionID, Replay: auth.NewReplayCache(0, nil), Now: func() time.Time { return now }}
			_, r := verifier.Verify(auth.Invocation{
				VersionID:       podVersionID,
				PayloadJSON:     payload,
				InvocationToken: v.Token,
				EgressGrant:     grants[grantName],
			})

			want := ""
			switch {
			case !v.Expect.Valid:
				want = "token_" + v.Expect.Error
			case v.Claims.FunctionVersionID != podVersionID:
				want = "token_version_mismatch"
			case v.ExpectPayload == string(egress.ErrPayloadHash):
				want = "payload_mismatch"
			case v.ExpectBinding == string(egress.ErrBinding):
				want = "grant_binding_mismatch"
			}

			if want == "" {
				if r != nil {
					t.Fatalf("expected success, got %v", r)
				}
				return
			}
			expectReason(t, r, want)
		})
	}
}
