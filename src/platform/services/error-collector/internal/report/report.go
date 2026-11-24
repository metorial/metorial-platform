package report

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/aggregate"
	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/issue"
	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/store"
)

const (
	SchemaVersion       = 1
	DefaultDays         = 30
	DefaultLimit        = 500
	MaxLimit            = 2000
	releasesPerIssue    = 20
	releaseHistory      = 50
	maxInstallationName = 64
)

var ErrInvalidWindow = errors.New("invalid report window")

type Source interface {
	Groups(ctx context.Context, q store.Query) ([]store.GroupRecord, error)
	GroupSeries(ctx context.Context, q store.Query, groupIDs []int64) ([]store.Point, error)
	ComponentSeries(ctx context.Context, q store.Query) ([]store.Point, error)
	Releases(ctx context.Context, groupIDs []int64, perGroup int) ([]store.ReleaseRecord, error)
	ReleaseHistory(ctx context.Context, limit int) ([]store.ReleaseSummary, error)
	Stats(ctx context.Context) (store.Stats, error)
}

type Options struct {
	Now             time.Time
	Days            int
	Component       string
	Limit           int
	HourlyRetention time.Duration
	Retention       time.Duration
	Installation    string
	Version         string
}

type Report struct {
	Manifest Manifest `json:"manifest"`
	Issues   []Issue  `json:"issues"`
}

type Manifest struct {
	SchemaVersion        int                `json:"schema_version"`
	GeneratedAt          time.Time          `json:"generated_at"`
	Installation         string             `json:"installation,omitempty"`
	CollectorVersion     string             `json:"collector_version,omitempty"`
	GroupingVersion      int                `json:"grouping_version"`
	StorageSchemaVersion int                `json:"storage_schema_version"`
	Window               Window             `json:"window"`
	Component            string             `json:"component,omitempty"`
	Retention            Retention          `json:"retention"`
	Totals               Totals             `json:"totals"`
	Components           []ComponentSummary `json:"components"`
	Releases             []ReleaseSummary   `json:"releases"`
}

type ReleaseSummary struct {
	Release   string    `json:"release"`
	FirstSeen time.Time `json:"first_seen"`
	LastSeen  time.Time `json:"last_seen"`
}

type Window struct {
	From    time.Time   `json:"from"`
	To      time.Time   `json:"to"`
	Days    int         `json:"days"`
	Bucket  string      `json:"bucket"`
	Buckets []time.Time `json:"buckets"`
}

type Retention struct {
	HourlyDays int `json:"hourly_days"`
	Days       int `json:"days"`
}

type Totals struct {
	Occurrences         int64 `json:"occurrences"`
	IssuesIncluded      int   `json:"issues_included"`
	Truncated           bool  `json:"truncated"`
	OverflowOccurrences int64 `json:"overflow_occurrences"`
	StoredGroups        int64 `json:"stored_groups"`
}

type ComponentSummary struct {
	Component   string   `json:"component"`
	Occurrences int64    `json:"occurrences"`
	Releases    []string `json:"releases"`
	Series      []int64  `json:"series"`
}

type Issue struct {
	ID              int64           `json:"id"`
	Hash            string          `json:"hash"`
	GroupingVersion int             `json:"grouping_version"`
	Component       string          `json:"component"`
	Level           string          `json:"level"`
	Type            string          `json:"type"`
	Value           string          `json:"value"`
	Culprit         string          `json:"culprit"`
	Overflow        bool            `json:"overflow,omitempty"`
	FirstSeen       time.Time       `json:"first_seen"`
	LastSeen        time.Time       `json:"last_seen"`
	TotalCount      int64           `json:"total_count"`
	WindowCount     int64           `json:"window_count"`
	Releases        []Release       `json:"releases"`
	Series          []int64         `json:"series"`
	FirstSample     json.RawMessage `json:"first_sample"`
	LatestSample    json.RawMessage `json:"latest_sample"`
}

type Release struct {
	Release   string    `json:"release"`
	Count     int64     `json:"count"`
	FirstSeen time.Time `json:"first_seen"`
	LastSeen  time.Time `json:"last_seen"`
}

func (i Issue) IsOverflow() bool {
	return i.Type == aggregate.OverflowType && strings.HasPrefix(i.Hash, aggregate.OverflowHash(""))
}

// Build reads the report for the window ending now. Windows that fit the hourly retention get
// hourly series, longer ones daily series.
func Build(ctx context.Context, source Source, opts Options) (*Report, error) {
	query, window, err := plan(opts)
	if err != nil {
		return nil, err
	}

	stats, err := source.Stats(ctx)
	if err != nil {
		return nil, err
	}

	groups, err := source.Groups(ctx, query)
	if err != nil {
		return nil, err
	}

	ids := make([]int64, len(groups))
	for index, group := range groups {
		ids[index] = group.ID
	}

	points, err := source.GroupSeries(ctx, query, ids)
	if err != nil {
		return nil, err
	}
	releases, err := source.Releases(ctx, ids, releasesPerIssue)
	if err != nil {
		return nil, err
	}
	componentPoints, err := source.ComponentSeries(ctx, query)
	if err != nil {
		return nil, err
	}
	history, err := source.ReleaseHistory(ctx, releaseHistory)
	if err != nil {
		return nil, err
	}

	index := bucketIndex(window.Buckets)
	seriesByGroup := map[int64][]int64{}
	for _, point := range points {
		series := seriesByGroup[point.GroupID]
		if series == nil {
			series = make([]int64, len(window.Buckets))
			seriesByGroup[point.GroupID] = series
		}
		if position, ok := index[point.At.UTC().Unix()]; ok {
			series[position] += point.Count
		}
	}

	releasesByGroup := map[int64][]Release{}
	for _, release := range releases {
		releasesByGroup[release.GroupID] = append(releasesByGroup[release.GroupID], Release{
			Release:   release.Release,
			Count:     release.Count,
			FirstSeen: release.FirstSeen.UTC(),
			LastSeen:  release.LastSeen.UTC(),
		})
	}

	report := &Report{
		Manifest: Manifest{
			SchemaVersion:        SchemaVersion,
			GeneratedAt:          opts.Now.UTC(),
			Installation:         installationName(opts.Installation),
			CollectorVersion:     opts.Version,
			GroupingVersion:      issue.GroupingVersion,
			StorageSchemaVersion: store.SchemaVersion(),
			Window:               window,
			Component:            opts.Component,
			Retention: Retention{
				HourlyDays: int(opts.HourlyRetention / (24 * time.Hour)),
				Days:       int(opts.Retention / (24 * time.Hour)),
			},
			Totals: Totals{
				IssuesIncluded: len(groups),
				Truncated:      len(groups) >= query.Limit,
				StoredGroups:   stats.Groups,
			},
		},
		Issues: make([]Issue, 0, len(groups)),
	}

	report.Manifest.Releases = make([]ReleaseSummary, len(history))
	for index, release := range history {
		report.Manifest.Releases[index] = ReleaseSummary{
			Release:   release.Release,
			FirstSeen: release.FirstSeen.UTC(),
			LastSeen:  release.LastSeen.UTC(),
		}
	}

	componentReleases := map[string]map[string]bool{}
	for _, group := range groups {
		series := seriesByGroup[group.ID]
		if series == nil {
			series = make([]int64, len(window.Buckets))
		}
		groupReleases := releasesByGroup[group.ID]
		if groupReleases == nil {
			groupReleases = []Release{}
		}

		item := Issue{
			ID:              group.ID,
			Hash:            group.Hash,
			GroupingVersion: group.GroupingVersion,
			Component:       group.Component,
			Level:           group.Level,
			Type:            group.Type,
			Value:           group.Value,
			Culprit:         group.Culprit,
			FirstSeen:       group.FirstSeen.UTC(),
			LastSeen:        group.LastSeen.UTC(),
			TotalCount:      group.TotalCount,
			WindowCount:     group.WindowCount,
			Releases:        groupReleases,
			Series:          series,
			FirstSample:     orNull(group.FirstSample),
			LatestSample:    orNull(group.LatestSample),
		}
		item.Overflow = item.IsOverflow()
		report.Issues = append(report.Issues, item)

		if item.Overflow {
			report.Manifest.Totals.OverflowOccurrences += item.WindowCount
		}
		if componentReleases[item.Component] == nil {
			componentReleases[item.Component] = map[string]bool{}
		}
		for _, release := range item.Releases {
			componentReleases[item.Component][release.Release] = true
		}
	}

	report.Manifest.Components = componentSummaries(componentPoints, componentReleases, index, len(window.Buckets))
	for _, component := range report.Manifest.Components {
		report.Manifest.Totals.Occurrences += component.Occurrences
	}
	return report, nil
}

func plan(opts Options) (store.Query, Window, error) {
	days := opts.Days
	if days == 0 {
		days = DefaultDays
	}
	maxDays := int(opts.Retention / (24 * time.Hour))
	if days < 1 || (maxDays > 0 && days > maxDays) {
		return store.Query{}, Window{}, ErrInvalidWindow
	}

	limit := opts.Limit
	if limit <= 0 {
		limit = DefaultLimit
	}
	if limit > MaxLimit {
		limit = MaxLimit
	}

	until := opts.Now.UTC()
	since := until.Add(-time.Duration(days) * 24 * time.Hour)

	bucket, step := store.Daily, 24*time.Hour
	if time.Duration(days)*24*time.Hour <= opts.HourlyRetention {
		bucket, step = store.Hourly, time.Hour
	}

	window := Window{From: since, To: until, Days: days, Bucket: string(bucket)}
	for at := since.Truncate(step); at.Before(until); at = at.Add(step) {
		window.Buckets = append(window.Buckets, at)
	}

	query := store.Query{Since: since, Until: until, Bucket: bucket, Component: opts.Component, Limit: limit}
	return query, window, nil
}

func bucketIndex(buckets []time.Time) map[int64]int {
	index := make(map[int64]int, len(buckets))
	for position, at := range buckets {
		index[at.Unix()] = position
	}
	return index
}

func componentSummaries(points []store.Point, releases map[string]map[string]bool, index map[int64]int, buckets int) []ComponentSummary {
	byComponent := map[string]*ComponentSummary{}
	for _, point := range points {
		summary := byComponent[point.Component]
		if summary == nil {
			summary = &ComponentSummary{Component: point.Component, Series: make([]int64, buckets)}
			byComponent[point.Component] = summary
		}
		summary.Occurrences += point.Count
		if position, ok := index[point.At.UTC().Unix()]; ok {
			summary.Series[position] += point.Count
		}
	}

	result := make([]ComponentSummary, 0, len(byComponent))
	for _, summary := range byComponent {
		summary.Releases = []string{}
		for release := range releases[summary.Component] {
			summary.Releases = append(summary.Releases, release)
		}
		sort.Strings(summary.Releases)
		result = append(result, *summary)
	}

	sort.Slice(result, func(i, j int) bool {
		if result[i].Occurrences != result[j].Occurrences {
			return result[i].Occurrences > result[j].Occurrences
		}
		return result[i].Component < result[j].Component
	})
	return result
}

func orNull(value json.RawMessage) json.RawMessage {
	if len(value) == 0 {
		return json.RawMessage("null")
	}
	return value
}

func installationName(value string) string {
	var builder strings.Builder
	for _, char := range value {
		if builder.Len() >= maxInstallationName {
			break
		}
		if char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z' || char >= '0' && char <= '9' || char == '-' || char == '_' || char == '.' {
			builder.WriteRune(char)
		}
	}
	return builder.String()
}
