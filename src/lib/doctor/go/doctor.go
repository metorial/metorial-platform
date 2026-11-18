package doctor

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

const (
	DefaultConcurrency      = 4
	DefaultTimeout          = 5 * time.Second
	DefaultRunBudget        = 12 * time.Second
	DefaultCacheTTL         = 30 * time.Second
	DefaultFreshMinInterval = 10 * time.Second
)

var processStartedAt = time.Now()

type Check struct {
	ID          string
	Title       string
	Category    Category
	Severity    Severity
	Target      string
	Timeout     time.Duration
	MinInterval time.Duration
	DependsOn   []string
	Resolution  *Resolution

	// Run reports its outcome through r. Returning without one passes the check; returning an
	// error marks it as error and classifies the error with DescribeError.
	Run func(ctx context.Context, r *Result) error
}

type Options struct {
	Component string
	Instance  string

	// Nil reads METORIAL_RELEASE_VERSION, METORIAL_VERSION and METORIAL_RELEASE_CHANNEL.
	ReleaseVersion *string
	BuildVersion   *string
	Channel        *string
	PublicURL      *string

	Fingerprints     map[string]string
	Concurrency      int
	Timeout          time.Duration
	RunBudget        time.Duration
	CacheTTL         time.Duration
	FreshMinInterval time.Duration
	Now              func() time.Time
}

type outcome struct {
	status     Status
	message    string
	resolution *Resolution
	details    map[string]any
}

type Result struct {
	mu         sync.Mutex
	outcome    *outcome
	frozen     bool
	dependency func(id string) *CheckResult
}

func (r *Result) record(value outcome) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if !r.frozen {
		r.outcome = &value
	}
}

func (r *Result) Pass(message string, details map[string]any) {
	if message == "" {
		message = "OK"
	}
	r.record(outcome{status: StatusPass, message: message, details: details})
}

func (r *Result) Warn(message string, resolution *Resolution, details map[string]any) {
	r.record(outcome{status: StatusWarn, message: message, resolution: resolution, details: details})
}

func (r *Result) Fail(message string, resolution *Resolution, details map[string]any) {
	r.record(outcome{status: StatusFail, message: message, resolution: resolution, details: details})
}

func (r *Result) Skip(reason string, details map[string]any) {
	r.record(outcome{status: StatusSkip, message: reason, details: details})
}

// Dependency returns the result of a check listed in DependsOn.
func (r *Result) Dependency(id string) *CheckResult {
	if r.dependency == nil {
		return nil
	}
	return r.dependency(id)
}

func (r *Result) finish() *outcome {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.frozen = true
	return r.outcome
}

type stored struct {
	result     CheckResult
	producedAt time.Time
}

type flight struct {
	done       chan struct{}
	report     *Report
	finishedAt time.Time
	err        error
}

type Doctor struct {
	options Options
	now     func() time.Time

	releaseVersion *string
	buildVersion   *string
	channel        *string

	mu           sync.Mutex
	checks       []*Check
	byID         map[string]*Check
	inflight     *flight
	last         *Report
	lastFinished time.Time

	previousMu sync.Mutex
	previous   map[string]stored
}

func New(options Options) *Doctor {
	if options.Instance == "" {
		options.Instance = envValue("HOSTNAME")
	}
	if options.Instance == "" {
		options.Instance, _ = os.Hostname()
	}
	if options.Concurrency <= 0 {
		options.Concurrency = DefaultConcurrency
	}
	if options.Timeout <= 0 {
		options.Timeout = DefaultTimeout
	}
	if options.RunBudget <= 0 {
		options.RunBudget = DefaultRunBudget
	}
	if options.CacheTTL <= 0 {
		options.CacheTTL = DefaultCacheTTL
	}
	if options.FreshMinInterval <= 0 {
		options.FreshMinInterval = DefaultFreshMinInterval
	}

	now := options.Now
	if now == nil {
		now = time.Now
	}

	return &Doctor{
		options:        options,
		now:            now,
		releaseVersion: identityValue(options.ReleaseVersion, "METORIAL_RELEASE_VERSION"),
		buildVersion:   identityValue(options.BuildVersion, "METORIAL_VERSION"),
		channel:        identityValue(options.Channel, "METORIAL_RELEASE_CHANNEL"),
		byID:           map[string]*Check{},
		previous:       map[string]stored{},
	}
}

func (d *Doctor) Register(checks ...Check) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	seen := make(map[string]struct{}, len(checks))
	for _, check := range checks {
		if !checkIDPattern.MatchString(check.ID) {
			return fmt.Errorf("invalid doctor check id %q", check.ID)
		}
		if _, exists := d.byID[check.ID]; exists {
			return fmt.Errorf("duplicate doctor check id %q", check.ID)
		}
		if _, exists := seen[check.ID]; exists {
			return fmt.Errorf("duplicate doctor check id %q", check.ID)
		}
		if check.Run == nil {
			return fmt.Errorf("doctor check %q has no Run function", check.ID)
		}

		seen[check.ID] = struct{}{}
	}

	for _, check := range checks {
		d.checks = append(d.checks, &check)
		d.byID[check.ID] = &check
	}

	return nil
}

// Run returns the current report. Concurrent callers share one run, and recent reports are served
// from the cache (see spec/README.md, "Debouncing"). The run itself is detached from ctx: when
// ctx ends, only this caller stops waiting.
func (d *Doctor) Run(ctx context.Context, fresh bool) (*Report, error) {
	d.mu.Lock()

	if d.inflight == nil && d.last != nil {
		maxAge := d.options.CacheTTL
		if fresh {
			maxAge = d.options.FreshMinInterval
		}
		if d.now().Sub(d.lastFinished) < maxAge {
			report := d.served(d.last, d.lastFinished, true)
			d.mu.Unlock()
			return report, nil
		}
	}

	if d.inflight == nil {
		d.inflight = &flight{done: make(chan struct{})}
		go d.produce(context.WithoutCancel(ctx), d.inflight)
	}
	current := d.inflight
	d.mu.Unlock()

	select {
	case <-current.done:
		if current.err != nil {
			return nil, current.err
		}
		return d.served(current.report, current.finishedAt, false), nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (d *Doctor) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", http.MethodGet)
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}

		fresh := r.URL.Query().Get("fresh")
		report, err := d.Run(r.Context(), fresh == "1" || fresh == "true")

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Metorial-Doctor", "1")
		w.Header().Set("Cache-Control", "no-store")

		if err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": DescribeError(err).Message})
			return
		}

		_ = json.NewEncoder(w).Encode(report)
	})
}

func (d *Doctor) served(report *Report, finishedAt time.Time, cached bool) *Report {
	copied := *report
	copied.Checks = append([]CheckResult(nil), report.Checks...)
	copied.Cached = cached
	copied.AgeMs = max(0, d.now().Sub(finishedAt).Milliseconds())
	return &copied
}

func (d *Doctor) produce(ctx context.Context, current *flight) {
	defer func() {
		if recovered := recover(); recovered != nil {
			current.err = fmt.Errorf("doctor run panicked: %v", recovered)
		}

		d.mu.Lock()
		if current.err == nil {
			d.last = current.report
			d.lastFinished = current.finishedAt
		}
		d.inflight = nil
		d.mu.Unlock()

		close(current.done)
	}()

	d.mu.Lock()
	checks := append([]*Check(nil), d.checks...)
	d.mu.Unlock()

	startedAt := d.now()
	results := d.runChecks(ctx, checks, startedAt.Add(d.options.RunBudget))
	finishedAt := d.now()

	current.finishedAt = finishedAt
	current.report = &Report{
		Doctor:           ProtocolVersion,
		Component:        d.options.Component,
		Instance:         d.options.Instance,
		ReleaseVersion:   d.releaseVersion,
		BuildVersion:     d.buildVersion,
		Channel:          d.channel,
		PublicURL:        nonEmpty(d.options.PublicURL),
		Fingerprints:     maps.Clone(d.options.Fingerprints),
		ProcessStartedAt: formatTime(processStartedAt),
		StartedAt:        formatTime(startedAt),
		GeneratedAt:      formatTime(finishedAt),
		DurationMs:       max(0, finishedAt.Sub(startedAt).Milliseconds()),
		RunID:            randomRunID(),
		Checks:           results,
	}
}

type entry struct {
	check  *Check
	done   chan struct{}
	result CheckResult
}

func (d *Doctor) runChecks(ctx context.Context, checks []*Check, deadline time.Time) []CheckResult {
	entries := make(map[string]*entry, len(checks))
	for _, check := range checks {
		entries[check.ID] = &entry{check: check, done: make(chan struct{})}
	}

	cyclic := findCycles(checks, entries)
	slots := make(chan struct{}, d.options.Concurrency)

	settled := func(id string) *CheckResult {
		item, ok := entries[id]
		if !ok {
			return nil
		}
		select {
		case <-item.done:
			result := item.result
			return &result
		default:
			return nil
		}
	}

	var wg sync.WaitGroup
	for _, check := range checks {
		wg.Add(1)
		go func(item *entry) {
			defer wg.Done()
			defer close(item.done)
			item.result = d.evaluate(ctx, item.check, entries, cyclic, slots, settled, deadline)
		}(entries[check.ID])
	}
	wg.Wait()

	results := make([]CheckResult, len(checks))
	for index, check := range checks {
		results[index] = entries[check.ID].result
	}
	return results
}

func (d *Doctor) evaluate(
	ctx context.Context,
	check *Check,
	entries map[string]*entry,
	cyclic map[string][]string,
	slots chan struct{},
	settled func(string) *CheckResult,
	deadline time.Time,
) CheckResult {
	if cycle, ok := cyclic[check.ID]; ok {
		return d.result(check, outcome{
			status:  StatusError,
			message: fmt.Sprintf("Dependency cycle: %s.", strings.Join(cycle, " → ")),
		}, 0)
	}

	var unknown []string
	for _, id := range check.DependsOn {
		if _, ok := entries[id]; !ok {
			unknown = append(unknown, id)
		}
	}
	if len(unknown) > 0 {
		return d.result(check, outcome{
			status:  StatusError,
			message: fmt.Sprintf("Unknown dependency: %s.", strings.Join(unknown, ", ")),
		}, 0)
	}

	var failed []string
	for _, id := range check.DependsOn {
		dependency := entries[id]
		<-dependency.done
		if !dependency.result.Status.Passing() {
			failed = append(failed, id)
		}
	}
	if len(failed) > 0 {
		dependsOn := make([]any, len(failed))
		for index, id := range failed {
			dependsOn[index] = id
		}
		return d.result(check, outcome{
			status:  StatusSkip,
			message: fmt.Sprintf("Skipped because %s did not pass.", strings.Join(failed, ", ")),
			details: map[string]any{"dependsOn": dependsOn},
		}, 0)
	}

	if check.MinInterval > 0 {
		d.previousMu.Lock()
		previous, ok := d.previous[check.ID]
		d.previousMu.Unlock()

		if ok && d.now().Sub(previous.producedAt) < check.MinInterval {
			result := previous.result
			cachedAt := formatTime(previous.producedAt)
			result.CachedAt = &cachedAt
			return result
		}
	}

	slots <- struct{}{}
	result := d.execute(ctx, check, settled, deadline)
	<-slots

	d.previousMu.Lock()
	d.previous[check.ID] = stored{result: result, producedAt: d.now()}
	d.previousMu.Unlock()

	return result
}

func (d *Doctor) execute(
	ctx context.Context,
	check *Check,
	settled func(string) *CheckResult,
	deadline time.Time,
) CheckResult {
	started := d.now()

	timeout := check.Timeout
	if timeout <= 0 {
		timeout = d.options.Timeout
	}
	if remaining := deadline.Sub(started); remaining < timeout {
		timeout = remaining
	}
	if timeout <= 0 {
		return d.result(check, timeoutOutcome(check, 0), 0)
	}

	checkCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	result := &Result{dependency: settled}
	returned := make(chan error, 1)

	go func() {
		defer func() {
			if recovered := recover(); recovered != nil {
				returned <- fmt.Errorf("check panicked: %v", recovered)
			}
		}()
		returned <- check.Run(checkCtx, result)
	}()

	timer := time.NewTimer(timeout)
	defer timer.Stop()

	select {
	case err := <-returned:
		recorded := result.finish()
		elapsed := d.now().Sub(started)

		switch {
		case err != nil && errors.Is(err, context.DeadlineExceeded) && checkCtx.Err() != nil:
			return d.result(check, timeoutOutcome(check, timeout), elapsed)
		case err != nil:
			return d.result(check, errorOutcome(check, err), elapsed)
		case recorded != nil:
			return d.result(check, *recorded, elapsed)
		default:
			return d.result(check, outcome{status: StatusPass, message: "OK"}, elapsed)
		}
	case <-timer.C:
		result.finish()
		return d.result(check, timeoutOutcome(check, timeout), d.now().Sub(started))
	}
}

func (d *Doctor) result(check *Check, value outcome, elapsed time.Duration) CheckResult {
	resolution := value.resolution
	if resolution == nil && value.status != StatusPass && value.status != StatusSkip {
		resolution = check.Resolution
	}

	var target *string
	if check.Target != "" {
		redacted := RedactString(check.Target)
		target = &redacted
	}

	return CheckResult{
		ID:         check.ID,
		Title:      check.Title,
		Category:   check.Category,
		Target:     target,
		Status:     value.status,
		Severity:   check.Severity,
		DurationMs: max(0, elapsed.Round(time.Millisecond).Milliseconds()),
		Message:    RedactString(value.message),
		Resolution: resolution,
		Details:    RedactDetails(value.details),
	}
}

func errorOutcome(check *Check, err error) outcome {
	info := DescribeError(err)

	resolution := check.Resolution
	if resolution == nil && info.Hint != nil {
		resolution = &Resolution{Summary: *info.Hint}
	}

	return outcome{
		status:     StatusError,
		message:    info.Message,
		resolution: resolution,
		details:    map[string]any{"error": info},
	}
}

func timeoutOutcome(check *Check, timeout time.Duration) outcome {
	return outcome{
		status:     StatusTimeout,
		message:    fmt.Sprintf("Timed out after %dms.", timeout.Milliseconds()),
		resolution: check.Resolution,
		details:    map[string]any{"timeoutMs": timeout.Milliseconds()},
	}
}

func findCycles(checks []*Check, entries map[string]*entry) map[string][]string {
	cyclic := map[string][]string{}
	state := map[string]int{}
	var stack []string

	const (
		visiting = 1
		done     = 2
	)

	var visit func(id string)
	visit = func(id string) {
		switch state[id] {
		case done:
			return
		case visiting:
			start := 0
			for index, item := range stack {
				if item == id {
					start = index
				}
			}
			cycle := append(append([]string(nil), stack[start:]...), id)
			for _, member := range cycle {
				cyclic[member] = cycle
			}
			return
		}

		state[id] = visiting
		stack = append(stack, id)

		for _, dependency := range entries[id].check.DependsOn {
			if _, ok := entries[dependency]; ok {
				visit(dependency)
			}
		}

		stack = stack[:len(stack)-1]
		state[id] = done
	}

	for _, check := range checks {
		visit(check.ID)
	}

	return cyclic
}

func identityValue(value *string, env string) *string {
	if value != nil {
		return nonEmpty(value)
	}
	if fromEnv := envValue(env); fromEnv != "" {
		return &fromEnv
	}
	return nil
}

func nonEmpty(value *string) *string {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	return &trimmed
}

func envValue(name string) string {
	return strings.TrimSpace(os.Getenv(name))
}

func randomRunID() string {
	bytes := make([]byte, 6)
	_, _ = rand.Read(bytes)
	return hex.EncodeToString(bytes)
}
