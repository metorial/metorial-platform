package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/store"
)

var adminNow = time.Date(2026, 11, 20, 14, 30, 0, 0, time.UTC)

type adminSource struct {
	lastQuery store.Query
}

func (s *adminSource) Groups(_ context.Context, q store.Query) ([]store.GroupRecord, error) {
	s.lastQuery = q
	return []store.GroupRecord{{
		ID:              1,
		Hash:            "abc",
		GroupingVersion: 1,
		Component:       "worker",
		Level:           "error",
		Type:            "TimeoutError",
		Value:           "Job timed out",
		FirstSeen:       adminNow.Add(-2 * time.Hour),
		LastSeen:        adminNow,
		TotalCount:      3,
		WindowCount:     3,
	}}, nil
}

func (s *adminSource) GroupSeries(context.Context, store.Query, []int64) ([]store.Point, error) {
	return []store.Point{{GroupID: 1, At: adminNow.Truncate(time.Hour), Count: 3}}, nil
}

func (s *adminSource) ComponentSeries(context.Context, store.Query) ([]store.Point, error) {
	return []store.Point{{Component: "worker", At: adminNow.Truncate(time.Hour), Count: 3}}, nil
}

func (s *adminSource) Releases(context.Context, []int64, int) ([]store.ReleaseRecord, error) {
	return nil, nil
}

func (s *adminSource) ReleaseHistory(context.Context, int) ([]store.ReleaseSummary, error) {
	return []store.ReleaseSummary{{Release: "2026.11.2", FirstSeen: adminNow.Add(-time.Hour), LastSeen: adminNow}}, nil
}

func (s *adminSource) Stats(context.Context) (store.Stats, error) {
	return store.Stats{Groups: 1}, nil
}

func newAdmin(source *adminSource) http.Handler {
	return NewAdmin(AdminOptions{
		Source:          source,
		HourlyRetention: 14 * 24 * time.Hour,
		Retention:       180 * 24 * time.Hour,
		Version:         "test",
		Now:             func() time.Time { return adminNow },
	}).Handler()
}

func get(handler http.Handler, target string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, target, nil))
	return recorder
}

func TestAdminServesPageAndAssets(t *testing.T) {
	handler := newAdmin(&adminSource{})

	for _, entry := range []struct {
		path        string
		contentType string
		contains    string
	}{
		{"/system/errors", "text/html", `<script src="/system/errors/assets/app.js"`},
		{"/system/errors/", "text/html", "Error Reports"},
		{"/system/errors/assets/app.js", "text/javascript", "report.${kind}"},
		{"/system/errors/assets/app.css", "text/css", "--bg"},
		{"/system/errors/assets/logo.svg", "image/svg+xml", "<svg"},
	} {
		response := get(handler, entry.path)
		if response.Code != http.StatusOK {
			t.Fatalf("%s: status %d", entry.path, response.Code)
		}
		if !strings.HasPrefix(response.Header().Get("Content-Type"), entry.contentType) {
			t.Fatalf("%s: content type %q", entry.path, response.Header().Get("Content-Type"))
		}
		if !strings.Contains(response.Body.String(), entry.contains) {
			t.Fatalf("%s: body does not contain %q", entry.path, entry.contains)
		}

		csp := response.Header().Get("Content-Security-Policy")
		if !strings.Contains(csp, "script-src 'self'") || strings.Contains(csp, "unsafe-eval") {
			t.Fatalf("%s: unexpected CSP %q", entry.path, csp)
		}
		if response.Header().Get("X-Content-Type-Options") != "nosniff" {
			t.Fatalf("%s: missing nosniff", entry.path)
		}
	}
}

func TestAdminRejectsUnknownAssets(t *testing.T) {
	handler := newAdmin(&adminSource{})

	for _, path := range []string{
		"/system/errors/assets/index.html",
		"/system/errors/assets/missing.js",
		"/system/errors/assets/app.go",
		"/system/errors/assets/..%2fui.go",
	} {
		if response := get(handler, path); response.Code != http.StatusNotFound {
			t.Fatalf("%s: status %d, want 404", path, response.Code)
		}
	}
}

func TestAdminReportJSON(t *testing.T) {
	source := &adminSource{}
	handler := newAdmin(source)

	response := get(handler, "/system/errors/report.json?days=7&component=worker")
	if response.Code != http.StatusOK {
		t.Fatalf("status %d: %s", response.Code, response.Body.String())
	}
	if source.lastQuery.Component != "worker" || source.lastQuery.Bucket != store.Hourly {
		t.Fatalf("unexpected query %+v", source.lastQuery)
	}

	var body struct {
		Manifest struct {
			Window   struct{ Days int }
			Releases []struct{ Release string }
		}
		Issues []struct{ Type string }
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Manifest.Window.Days != 7 || len(body.Issues) != 1 || body.Issues[0].Type != "TimeoutError" {
		t.Fatalf("unexpected report %+v", body)
	}
	if len(body.Manifest.Releases) != 1 || body.Manifest.Releases[0].Release != "2026.11.2" {
		t.Fatalf("unexpected releases %+v", body.Manifest.Releases)
	}
}

func TestAdminRejectsInvalidWindow(t *testing.T) {
	handler := newAdmin(&adminSource{})

	response := get(handler, "/system/errors/report.json?days=365")
	if response.Code != http.StatusBadRequest || !strings.Contains(response.Body.String(), "between 1 and 180") {
		t.Fatalf("status %d: %s", response.Code, response.Body.String())
	}
}

func TestIsUIPath(t *testing.T) {
	for path, want := range map[string]bool{
		"/system/errors":               true,
		"/system/errors/":              true,
		"/system/errors/assets/app.js": true,
		"/system/errors/report.json":   false,
		"/system/errors/report.zip":    false,
		"/system/errorsx":              false,
	} {
		if got := IsUIPath(path); got != want {
			t.Fatalf("IsUIPath(%q) = %v, want %v", path, got, want)
		}
	}
}
