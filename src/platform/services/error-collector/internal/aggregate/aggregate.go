package aggregate

import (
	"sync"
	"time"

	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/issue"
)

const OverflowType = "TooManyDistinctErrors"

type ReleaseCount struct {
	Count     int64
	FirstSeen time.Time
	LastSeen  time.Time
}

// Group is everything one flush adds to a stored group. All of it is additive or min/max, so
// replicas and repeated flushes can write the same group without coordination.
type Group struct {
	Hash         string
	Component    string
	Level        string
	Type         string
	Value        string
	Culprit      string
	FirstSeen    time.Time
	LastSeen     time.Time
	Count        int64
	Hours        map[time.Time]int64
	Releases     map[string]*ReleaseCount
	FirstSample  *issue.Sample
	LatestSample *issue.Sample
}

func OverflowHash(component string) string {
	return "overflow:" + component
}

func newOverflowGroup(component string) *Group {
	return &Group{
		Hash:      OverflowHash(component),
		Component: component,
		Level:     "error",
		Type:      OverflowType,
		Value:     "Errors beyond the collector's group limit are counted here.",
		Hours:     map[time.Time]int64{},
		Releases:  map[string]*ReleaseCount{},
	}
}

// Aggregator keeps the counts between flushes. Memory is bounded by maxGroups: occurrences of new
// groups beyond it are counted in one overflow group per component.
type Aggregator struct {
	mu        sync.Mutex
	groups    map[string]*Group
	maxGroups int
}

func New(maxGroups int) *Aggregator {
	return &Aggregator{groups: map[string]*Group{}, maxGroups: maxGroups}
}

func (a *Aggregator) Add(occurrence issue.Occurrence) {
	a.mu.Lock()
	defer a.mu.Unlock()

	group := a.groupFor(occurrence)
	hour := occurrence.Timestamp.Truncate(time.Hour)

	group.Count++
	group.Hours[hour]++
	if group.FirstSeen.IsZero() || occurrence.Timestamp.Before(group.FirstSeen) {
		group.FirstSeen = occurrence.Timestamp
	}
	if occurrence.Timestamp.After(group.LastSeen) {
		group.LastSeen = occurrence.Timestamp
	}

	if group.Type == OverflowType {
		return
	}

	group.Level = occurrence.Level
	group.Value = occurrence.Value
	if occurrence.Culprit != "" {
		group.Culprit = occurrence.Culprit
	}

	if occurrence.Release != "" {
		release := group.Releases[occurrence.Release]
		if release == nil {
			release = &ReleaseCount{FirstSeen: occurrence.Timestamp}
			group.Releases[occurrence.Release] = release
		}
		release.Count++
		if occurrence.Timestamp.Before(release.FirstSeen) {
			release.FirstSeen = occurrence.Timestamp
		}
		if occurrence.Timestamp.After(release.LastSeen) {
			release.LastSeen = occurrence.Timestamp
		}
	}

	if occurrence.Sample != nil {
		if group.FirstSample == nil {
			group.FirstSample = occurrence.Sample
		}
		group.LatestSample = occurrence.Sample
	}
}

func (a *Aggregator) groupFor(occurrence issue.Occurrence) *Group {
	if group, ok := a.groups[occurrence.Hash]; ok {
		return group
	}

	if len(a.groups) >= a.maxGroups {
		hash := OverflowHash(occurrence.Component)
		if group, ok := a.groups[hash]; ok {
			return group
		}
		group := newOverflowGroup(occurrence.Component)
		a.groups[hash] = group
		return group
	}

	group := &Group{
		Hash:      occurrence.Hash,
		Component: occurrence.Component,
		Type:      occurrence.Type,
		Hours:     map[time.Time]int64{},
		Releases:  map[string]*ReleaseCount{},
	}
	a.groups[occurrence.Hash] = group
	return group
}

// Drain hands out everything collected since the last drain.
func (a *Aggregator) Drain() []*Group {
	a.mu.Lock()
	groups := a.groups
	a.groups = map[string]*Group{}
	a.mu.Unlock()

	result := make([]*Group, 0, len(groups))
	for _, group := range groups {
		result = append(result, group)
	}
	return result
}

// Restore puts back groups whose flush failed, merging them with whatever arrived meanwhile.
func (a *Aggregator) Restore(groups []*Group) {
	a.mu.Lock()
	defer a.mu.Unlock()

	for _, group := range groups {
		existing, ok := a.groups[group.Hash]
		if !ok {
			if len(a.groups) >= a.maxGroups && group.Type != OverflowType {
				existing = a.overflowFor(group.Component)
			} else {
				a.groups[group.Hash] = group
				continue
			}
		}
		Merge(existing, group)
	}
}

func (a *Aggregator) overflowFor(component string) *Group {
	hash := OverflowHash(component)
	if group, ok := a.groups[hash]; ok {
		return group
	}
	group := newOverflowGroup(component)
	a.groups[hash] = group
	return group
}

// Merge adds source into target. Samples and descriptive fields of an overflow target are kept.
func Merge(target, source *Group) {
	sourceIsNewer := source.LastSeen.After(target.LastSeen)
	sourceIsOlder := !source.FirstSeen.IsZero() && source.FirstSeen.Before(target.FirstSeen)

	target.Count += source.Count
	for hour, count := range source.Hours {
		target.Hours[hour] += count
	}
	if target.FirstSeen.IsZero() || sourceIsOlder {
		target.FirstSeen = source.FirstSeen
	}
	if sourceIsNewer {
		target.LastSeen = source.LastSeen
	}

	if target.Type == OverflowType {
		return
	}

	for name, release := range source.Releases {
		existing := target.Releases[name]
		if existing == nil {
			copied := *release
			target.Releases[name] = &copied
			continue
		}
		existing.Count += release.Count
		if release.FirstSeen.Before(existing.FirstSeen) {
			existing.FirstSeen = release.FirstSeen
		}
		if release.LastSeen.After(existing.LastSeen) {
			existing.LastSeen = release.LastSeen
		}
	}

	if source.FirstSample != nil && (target.FirstSample == nil || sourceIsOlder) {
		target.FirstSample = source.FirstSample
	}
	if source.LatestSample != nil && (target.LatestSample == nil || sourceIsNewer) {
		target.LatestSample = source.LatestSample
	}
	if sourceIsNewer {
		target.Level, target.Value = source.Level, source.Value
	}
	if target.Culprit == "" {
		target.Culprit = source.Culprit
	}
}

// AsOverflow turns a group into the overflow group of its component, keeping its counts.
func AsOverflow(group *Group) *Group {
	overflow := newOverflowGroup(group.Component)
	Merge(overflow, group)
	return overflow
}
