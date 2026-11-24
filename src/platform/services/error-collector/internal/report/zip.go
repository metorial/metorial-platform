package report

import (
	"archive/zip"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/ui"
)

type issuesFile struct {
	Bucket  string      `json:"bucket"`
	Buckets []time.Time `json:"buckets"`
	Issues  []Issue     `json:"issues"`
}

func (r *Report) FileName() string {
	parts := []string{"metorial-error-report"}
	if r.Manifest.Installation != "" {
		parts = append(parts, r.Manifest.Installation)
	}
	parts = append(parts, r.Manifest.Window.From.Format("20060102")+"_"+r.Manifest.Window.To.Format("20060102"))
	return strings.Join(parts, "-") + ".zip"
}

// WriteZip streams the archive; nothing is buffered on disk.
func (r *Report) WriteZip(w io.Writer) error {
	archive := zip.NewWriter(w)
	modified := r.Manifest.GeneratedAt

	files := []struct {
		name  string
		write func(io.Writer) error
	}{
		{"README.txt", r.writeReadme},
		{"report.html", func(w io.Writer) error { return ui.WriteStaticPage(w, r) }},
		{"manifest.json", func(w io.Writer) error { return writeJSON(w, r.Manifest) }},
		{"issues.json", func(w io.Writer) error {
			return writeJSON(w, issuesFile{Bucket: r.Manifest.Window.Bucket, Buckets: r.Manifest.Window.Buckets, Issues: r.Issues})
		}},
		{"summary.csv", r.WriteCSV},
	}

	for _, file := range files {
		entry, err := archive.CreateHeader(&zip.FileHeader{Name: file.name, Method: zip.Deflate, Modified: modified})
		if err != nil {
			return err
		}
		if err := file.write(entry); err != nil {
			return fmt.Errorf("write %s: %w", file.name, err)
		}
	}
	return archive.Close()
}

func writeJSON(w io.Writer, value any) error {
	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ")
	return encoder.Encode(value)
}

func (r *Report) WriteCSV(w io.Writer) error {
	writer := csv.NewWriter(w)
	header := []string{
		"hash", "component", "level", "type", "value", "culprit", "count_in_window", "total_count",
		"first_seen", "last_seen", "latest_release", "integration", "error_code", "step",
	}
	if err := writer.Write(header); err != nil {
		return err
	}

	for _, item := range r.Issues {
		latestRelease := ""
		if len(item.Releases) > 0 {
			latestRelease = item.Releases[0].Release
		}
		var sample struct {
			Tags map[string]string `json:"tags"`
		}
		_ = json.Unmarshal(item.LatestSample, &sample)

		err := writer.Write([]string{
			item.Hash,
			item.Component,
			item.Level,
			csvSafe(item.Type),
			csvSafe(item.Value),
			csvSafe(item.Culprit),
			strconv.FormatInt(item.WindowCount, 10),
			strconv.FormatInt(item.TotalCount, 10),
			item.FirstSeen.Format(time.RFC3339),
			item.LastSeen.Format(time.RFC3339),
			csvSafe(latestRelease),
			csvSafe(sample.Tags["integration"]),
			csvSafe(sample.Tags["error_code"]),
			csvSafe(sample.Tags["step"]),
		})
		if err != nil {
			return err
		}
	}

	writer.Flush()
	return writer.Error()
}

// csvSafe keeps spreadsheet programs from evaluating error messages as formulas.
func csvSafe(value string) string {
	if value != "" && strings.ContainsRune("=+-@\t\r", rune(value[0])) {
		return "'" + value
	}
	return value
}

func (r *Report) writeReadme(w io.Writer) error {
	manifest := r.Manifest
	component := "all components"
	if manifest.Component != "" {
		component = "the " + manifest.Component + " component"
	}

	_, err := fmt.Fprintf(w, `Metorial error report
=====================

Generated:  %s
Window:     %s to %s (%d days, %s buckets)
Covers:     %s
Issues:     %d included, %d occurrences in the window

This archive contains aggregated errors collected inside this installation by the error collector.
Nothing was sent anywhere; the archive leaves the installation only if you send it.

Files
-----

report.html    The errors with charts, stack traces and releases. Opens in any browser; it loads
               nothing from the network.
manifest.json  Window, totals per component, releases seen, retention and versions.
issues.json    One entry per error group: counts, occurrences over time, releases, and the first
               and latest sample event.
summary.csv    One row per error group, to review before sending the archive.

What was removed before anything was stored
-------------------------------------------

Requests, users, breadcrumbs, extra data, local variables and source lines are never stored.
Error messages are scrubbed: credentials, tokens, keys, email addresses, public IP addresses and
URL query strings are replaced with placeholders. Tags are limited to where an error happened
(component, queue, route, method, status, handler, boot step, and for failed builds, deployments
and integration calls: integration, error code, provider and step).

Failed builds, deployments and integration calls also keep their details (the integration and
version, ids of the build or deployment, error code and message, timings) and up to 50 of their
last log lines, scrubbed the same way.

Open report.html or review summary.csv if you want to check the contents before sending the file.
`,
		manifest.GeneratedAt.Format(time.RFC3339),
		manifest.Window.From.Format(time.RFC3339),
		manifest.Window.To.Format(time.RFC3339),
		manifest.Window.Days,
		manifest.Window.Bucket,
		component,
		manifest.Totals.IssuesIncluded,
		manifest.Totals.Occurrences,
	)
	return err
}
