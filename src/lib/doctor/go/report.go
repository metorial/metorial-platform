package doctor

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"time"
)

const ProtocolVersion = 1

type Status string

const (
	StatusPass    Status = "pass"
	StatusWarn    Status = "warn"
	StatusFail    Status = "fail"
	StatusSkip    Status = "skip"
	StatusError   Status = "error"
	StatusTimeout Status = "timeout"
)

type Severity string

const (
	SeverityCritical Severity = "critical"
	SeverityWarning  Severity = "warning"
	SeverityInfo     Severity = "info"
)

type Category string

const (
	CategoryDatabase      Category = "database"
	CategoryCache         Category = "cache"
	CategoryMessaging     Category = "messaging"
	CategoryStorage       Category = "storage"
	CategoryDependency    Category = "dependency"
	CategoryExternal      Category = "external"
	CategoryConfiguration Category = "configuration"
	CategoryRuntime       Category = "runtime"
	CategorySecurity      Category = "security"
)

var (
	checkIDPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)*$`)

	validStatuses = map[Status]bool{
		StatusPass: true, StatusWarn: true, StatusFail: true,
		StatusSkip: true, StatusError: true, StatusTimeout: true,
	}

	validSeverities = map[Severity]bool{
		SeverityCritical: true, SeverityWarning: true, SeverityInfo: true,
	}

	validCategories = map[Category]bool{
		CategoryDatabase: true, CategoryCache: true, CategoryMessaging: true,
		CategoryStorage: true, CategoryDependency: true, CategoryExternal: true,
		CategoryConfiguration: true, CategoryRuntime: true, CategorySecurity: true,
	}
)

func (s Status) Failing() bool {
	return s == StatusFail || s == StatusError || s == StatusTimeout
}

func (s Status) Passing() bool {
	return s == StatusPass || s == StatusWarn
}

type Resolution struct {
	Summary string   `json:"summary"`
	Steps   []string `json:"steps"`
	Docs    *string  `json:"docs"`
}

func (r Resolution) MarshalJSON() ([]byte, error) {
	type plain Resolution
	if r.Steps == nil {
		r.Steps = []string{}
	}
	return json.Marshal(plain(r))
}

type CheckResult struct {
	ID         string         `json:"id"`
	Title      string         `json:"title"`
	Category   Category       `json:"category"`
	Target     *string        `json:"target"`
	Status     Status         `json:"status"`
	Severity   Severity       `json:"severity"`
	DurationMs int64          `json:"durationMs"`
	Message    string         `json:"message"`
	Resolution *Resolution    `json:"resolution"`
	Details    map[string]any `json:"details"`
	CachedAt   *string        `json:"cachedAt"`
}

type Report struct {
	Doctor           int               `json:"doctor"`
	Component        string            `json:"component"`
	Instance         string            `json:"instance"`
	ReleaseVersion   *string           `json:"releaseVersion"`
	BuildVersion     *string           `json:"buildVersion"`
	Channel          *string           `json:"channel"`
	PublicURL        *string           `json:"publicUrl"`
	Fingerprints     map[string]string `json:"fingerprints"`
	ProcessStartedAt string            `json:"processStartedAt"`
	StartedAt        string            `json:"startedAt"`
	GeneratedAt      string            `json:"generatedAt"`
	DurationMs       int64             `json:"durationMs"`
	RunID            string            `json:"runId"`
	Cached           bool              `json:"cached"`
	AgeMs            int64             `json:"ageMs"`
	Checks           []CheckResult     `json:"checks"`
}

func (r Report) MarshalJSON() ([]byte, error) {
	type plain Report
	if r.Fingerprints == nil {
		r.Fingerprints = map[string]string{}
	}
	if r.Checks == nil {
		r.Checks = []CheckResult{}
	}
	return json.Marshal(plain(r))
}

func ParseReport(data []byte) (*Report, error) {
	var report Report
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("invalid doctor report: %w", err)
	}

	if err := report.Validate(); err != nil {
		return nil, err
	}

	if report.Fingerprints == nil {
		report.Fingerprints = map[string]string{}
	}
	if report.Checks == nil {
		report.Checks = []CheckResult{}
	}

	return &report, nil
}

func (r *Report) Validate() error {
	var problems []error
	problem := func(format string, args ...any) {
		problems = append(problems, fmt.Errorf(format, args...))
	}

	if r.Doctor != ProtocolVersion {
		problem("doctor: unsupported protocol version %d", r.Doctor)
	}
	if r.Component == "" {
		problem("component: required")
	}
	if r.Instance == "" {
		problem("instance: required")
	}
	if r.RunID == "" {
		problem("runId: required")
	}
	for name, value := range map[string]string{
		"processStartedAt": r.ProcessStartedAt,
		"startedAt":        r.StartedAt,
		"generatedAt":      r.GeneratedAt,
	} {
		if !validTimestamp(value) {
			problem("%s: invalid timestamp %q", name, value)
		}
	}
	if r.DurationMs < 0 {
		problem("durationMs: must be >= 0")
	}
	if r.AgeMs < 0 {
		problem("ageMs: must be >= 0")
	}

	for index, check := range r.Checks {
		if !checkIDPattern.MatchString(check.ID) {
			problem("checks.%d.id: invalid id %q", index, check.ID)
		}
		if !validCategories[check.Category] {
			problem("checks.%d.category: invalid category %q", index, check.Category)
		}
		if !validStatuses[check.Status] {
			problem("checks.%d.status: invalid status %q", index, check.Status)
		}
		if !validSeverities[check.Severity] {
			problem("checks.%d.severity: invalid severity %q", index, check.Severity)
		}
		if check.DurationMs < 0 {
			problem("checks.%d.durationMs: must be >= 0", index)
		}
		if check.CachedAt != nil && !validTimestamp(*check.CachedAt) {
			problem("checks.%d.cachedAt: invalid timestamp %q", index, *check.CachedAt)
		}
	}

	if len(problems) > 0 {
		return fmt.Errorf("invalid doctor report: %w", errors.Join(problems...))
	}

	return nil
}

func validTimestamp(value string) bool {
	_, err := time.Parse(time.RFC3339Nano, value)
	return err == nil
}

func formatTime(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z")
}
