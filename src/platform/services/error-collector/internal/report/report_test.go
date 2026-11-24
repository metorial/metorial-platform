package report

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/aggregate"
	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/store"
)

var now = time.Date(2026, 11, 20, 12, 30, 0, 0, time.UTC)

type fakeSource struct {
	lastQuery store.Query
}

func (f *fakeSource) Groups(_ context.Context, q store.Query) ([]store.GroupRecord, error) {
	f.lastQuery = q
	return []store.GroupRecord{
		{
			ID: 2, Hash: aggregate.OverflowHash("worker"), Component: "worker", Level: "error",
			Type: aggregate.OverflowType, FirstSeen: now.Add(-time.Hour), LastSeen: now, TotalCount: 4, WindowCount: 4,
		},
		{
			ID: 1, Hash: "abc", GroupingVersion: 1, Component: "worker", Level: "error", Type: "Error",
			Value: "=HYPERLINK(\"x\")", Culprit: "run (main.mjs)", FirstSeen: now.Add(-48 * time.Hour),
			LastSeen: now.Add(-time.Hour), TotalCount: 10, WindowCount: 7,
			LatestSample: json.RawMessage(`{"level":"error"}`),
		},
	}, nil
}

func (f *fakeSource) GroupSeries(_ context.Context, q store.Query, ids []int64) ([]store.Point, error) {
	return []store.Point{
		{GroupID: 1, At: now.Add(-time.Hour).Truncate(time.Hour), Count: 5},
		{GroupID: 1, At: now.Truncate(time.Hour), Count: 2},
		{GroupID: 2, At: now.Truncate(time.Hour), Count: 4},
	}, nil
}

func (f *fakeSource) ComponentSeries(_ context.Context, q store.Query) ([]store.Point, error) {
	return []store.Point{
		{Component: "worker", At: now.Add(-time.Hour).Truncate(time.Hour), Count: 5},
		{Component: "worker", At: now.Truncate(time.Hour), Count: 6},
		{Component: "core-api", At: now.Truncate(time.Hour), Count: 3},
	}, nil
}

func (f *fakeSource) Releases(_ context.Context, ids []int64, perGroup int) ([]store.ReleaseRecord, error) {
	return []store.ReleaseRecord{{GroupID: 1, Release: "2026.11.1", Count: 7, FirstSeen: now, LastSeen: now}}, nil
}

func (f *fakeSource) ReleaseHistory(context.Context, int) ([]store.ReleaseSummary, error) {
	return []store.ReleaseSummary{
		{Release: "2026.11.1", FirstSeen: now.Add(-72 * time.Hour), LastSeen: now.Add(-24 * time.Hour)},
		{Release: "2026.11.2", FirstSeen: now.Add(-20 * time.Hour), LastSeen: now},
	}, nil
}

func (f *fakeSource) Stats(context.Context) (store.Stats, error) {
	return store.Stats{Groups: 12}, nil
}

func options(days int) Options {
	return Options{
		Now:             now,
		Days:            days,
		HourlyRetention: 14 * 24 * time.Hour,
		Retention:       180 * 24 * time.Hour,
		Installation:    "metorial.acme/prod",
		Version:         "1.2.3",
	}
}

func TestBuildChoosesBucketsAndTotals(t *testing.T) {
	source := &fakeSource{}
	built, err := Build(context.Background(), source, options(1))
	if err != nil {
		t.Fatal(err)
	}

	window := built.Manifest.Window
	if window.Bucket != "hour" || len(window.Buckets) != 25 || source.lastQuery.Bucket != store.Hourly {
		t.Fatalf("window = %s with %d buckets", window.Bucket, len(window.Buckets))
	}
	if built.Manifest.Totals.Occurrences != 14 || built.Manifest.Totals.OverflowOccurrences != 4 || built.Manifest.Totals.StoredGroups != 12 {
		t.Errorf("totals = %+v", built.Manifest.Totals)
	}
	if built.Manifest.Installation != "metorial.acmeprod" {
		t.Errorf("installation = %q", built.Manifest.Installation)
	}

	issue := built.Issues[1]
	if issue.Series[len(issue.Series)-1] != 2 || issue.Series[len(issue.Series)-2] != 5 {
		t.Errorf("series tail = %v", issue.Series[len(issue.Series)-3:])
	}
	if string(built.Issues[0].FirstSample) != "null" || len(issue.Releases) != 1 {
		t.Errorf("samples/releases not filled: %+v", built.Issues[0])
	}
	if built.Manifest.Components[0].Component != "worker" || built.Manifest.Components[0].Releases[0] != "2026.11.1" {
		t.Errorf("components = %+v", built.Manifest.Components)
	}
	if !built.Issues[0].Overflow || issue.Overflow {
		t.Errorf("overflow flags = %v, %v", built.Issues[0].Overflow, issue.Overflow)
	}
	if releases := built.Manifest.Releases; len(releases) != 2 || releases[1].Release != "2026.11.2" {
		t.Errorf("release history = %+v", releases)
	}

	built, err = Build(context.Background(), source, options(30))
	if err != nil {
		t.Fatal(err)
	}
	if built.Manifest.Window.Bucket != "day" || len(built.Manifest.Window.Buckets) != 31 {
		t.Errorf("30 day window = %s with %d buckets", built.Manifest.Window.Bucket, len(built.Manifest.Window.Buckets))
	}

	if _, err := Build(context.Background(), source, options(181)); err != ErrInvalidWindow {
		t.Errorf("window beyond retention error = %v", err)
	}
}

func TestZipContents(t *testing.T) {
	built, err := Build(context.Background(), &fakeSource{}, options(7))
	if err != nil {
		t.Fatal(err)
	}
	if name := built.FileName(); name != "metorial-error-report-metorial.acmeprod-20261113_20261120.zip" {
		t.Errorf("file name = %q", name)
	}

	var archive bytes.Buffer
	if err := built.WriteZip(&archive); err != nil {
		t.Fatal(err)
	}
	reader, err := zip.NewReader(bytes.NewReader(archive.Bytes()), int64(archive.Len()))
	if err != nil {
		t.Fatal(err)
	}

	files := map[string][]byte{}
	for _, file := range reader.File {
		opened, err := file.Open()
		if err != nil {
			t.Fatal(err)
		}
		files[file.Name], _ = io.ReadAll(opened)
		_ = opened.Close()
	}

	for _, name := range []string{"README.txt", "report.html", "manifest.json", "issues.json", "summary.csv"} {
		if len(files[name]) == 0 {
			t.Errorf("%s is missing or empty", name)
		}
	}

	page := string(files["report.html"])
	if !strings.Contains(page, `id="report-data"`) || !strings.Contains(page, `"run (main.mjs)"`) {
		t.Error("report.html does not embed the report")
	}

	var issues issuesFile
	if err := json.Unmarshal(files["issues.json"], &issues); err != nil || len(issues.Issues) != 2 || len(issues.Buckets) != 169 {
		t.Errorf("issues.json = %d issues, %d buckets, %v", len(issues.Issues), len(issues.Buckets), err)
	}

	rows, err := csv.NewReader(bytes.NewReader(files["summary.csv"])).ReadAll()
	if err != nil || len(rows) != 3 {
		t.Fatalf("summary.csv rows = %d, %v", len(rows), err)
	}
	if !strings.HasPrefix(rows[2][4], "'=") {
		t.Errorf("formula not neutralized: %q", rows[2][4])
	}
}
