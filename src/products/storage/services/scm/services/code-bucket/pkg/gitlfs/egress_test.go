package gitlfs

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/metorial/metorial/services/code-bucket/pkg/egress"
)

func init() {
	egress.AllowPrivateNetworks(true)
}

func TestDefaultClientRefusesNonPublicObjectURLs(t *testing.T) {
	egress.AllowPrivateNetworks(false)
	t.Cleanup(func() { egress.AllowPrivateNetworks(true) })

	internal := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("internal"))
	}))
	defer internal.Close()

	client := NewClient("https://lfs.example.com/info/lfs", "", "token", nil)
	req, err := http.NewRequest(http.MethodGet, internal.URL+"/object", nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}

	resp, err := client.http.Do(req)
	if err == nil {
		resp.Body.Close()
		t.Fatal("expected the object URL to be refused")
	}
	if !errors.Is(err, egress.ErrAddressNotAllowed) {
		t.Fatalf("request failed with %v, want the address to be refused", err)
	}
}
