package doctor

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type fakeClock struct {
	mu   sync.Mutex
	time time.Time
}

func newFakeClock() *fakeClock {
	return &fakeClock{time: time.Date(2026, 11, 17, 10, 0, 0, 0, time.UTC)}
}

func (c *fakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.time
}

func (c *fakeClock) Advance(duration time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.time = c.time.Add(duration)
}

func pointer(value string) *string { return &value }

func newTestDoctor(t *testing.T, options Options, checks ...Check) *Doctor {
	t.Helper()

	if options.Component == "" {
		options.Component = "test"
	}
	if options.Instance == "" {
		options.Instance = "test-0"
	}

	doctor := New(options)
	if err := doctor.Register(checks...); err != nil {
		t.Fatal(err)
	}
	return doctor
}

func passing(id string) Check {
	return Check{
		ID: id, Title: id, Category: CategoryRuntime, Severity: SeverityCritical,
		Run: func(ctx context.Context, r *Result) error { return nil },
	}
}

func failing(id string) Check {
	check := passing(id)
	check.Run = func(ctx context.Context, r *Result) error {
		r.Fail("broken", nil, nil)
		return nil
	}
	return check
}

func run(t *testing.T, doctor *Doctor, fresh bool) *Report {
	t.Helper()

	report, err := doctor.Run(context.Background(), fresh)
	if err != nil {
		t.Fatal(err)
	}
	return report
}

func byID(report *Report) map[string]CheckResult {
	results := map[string]CheckResult{}
	for _, check := range report.Checks {
		results[check.ID] = check
	}
	return results
}

func TestReportIdentityAndOrder(t *testing.T) {
	doctor := newTestDoctor(t, Options{
		Component:      "gateway",
		Instance:       "gateway-7",
		ReleaseVersion: pointer("2026.11.1"),
		BuildVersion:   pointer("abc123"),
		Channel:        pointer(""),
		PublicURL:      pointer("https://metorial.example.com"),
		Fingerprints:   map[string]string{"database": "f00"},
	}, passing("b.second"), passing("a.first"), passing("c.third"))

	report := run(t, doctor, false)

	if report.Doctor != 1 || report.Component != "gateway" || report.Instance != "gateway-7" {
		t.Fatalf("identity: %+v", report)
	}
	if *report.ReleaseVersion != "2026.11.1" || *report.BuildVersion != "abc123" || report.Channel != nil {
		t.Fatalf("versions: %v %v %v", report.ReleaseVersion, report.BuildVersion, report.Channel)
	}
	if report.Fingerprints["database"] != "f00" || len(report.RunID) != 12 || report.Cached {
		t.Fatalf("report: %+v", report)
	}

	ids := []string{report.Checks[0].ID, report.Checks[1].ID, report.Checks[2].ID}
	if ids[0] != "b.second" || ids[1] != "a.first" || ids[2] != "c.third" {
		t.Fatalf("order = %v", ids)
	}

	encoded, _ := json.Marshal(report)
	if _, err := ParseReport(encoded); err != nil {
		t.Fatalf("own report does not validate: %v", err)
	}
}

func TestIdentityFromEnvironment(t *testing.T) {
	t.Setenv("METORIAL_RELEASE_VERSION", "2026.11.2")
	t.Setenv("METORIAL_VERSION", " def456 ")
	t.Setenv("METORIAL_RELEASE_CHANNEL", "")

	report := run(t, newTestDoctor(t, Options{}), false)

	if report.ReleaseVersion == nil || *report.ReleaseVersion != "2026.11.2" {
		t.Fatalf("releaseVersion = %v", report.ReleaseVersion)
	}
	if report.BuildVersion == nil || *report.BuildVersion != "def456" {
		t.Fatalf("buildVersion = %v", report.BuildVersion)
	}
	if report.Channel != nil {
		t.Fatalf("channel = %v", *report.Channel)
	}
}

func TestOutcomesResolutionAndRedaction(t *testing.T) {
	resolution := &Resolution{Summary: "Grant kms:Encrypt", Steps: []string{"Edit the key policy"}}

	doctor := newTestDoctor(t, Options{},
		Check{
			ID: "kms.encrypt", Title: "KMS", Category: CategorySecurity, Severity: SeverityCritical,
			Target: "postgres://app:hunter2@db/core", Resolution: resolution,
			Run: func(ctx context.Context, r *Result) error {
				r.Fail("denied for https://kms.local/?token=abc", nil, map[string]any{"password": "hunter2", "region": "eu-west-1"})
				return nil
			},
		},
		Check{
			ID: "kms.pass", Title: "KMS", Category: CategorySecurity, Severity: SeverityCritical, Resolution: resolution,
			Run: func(ctx context.Context, r *Result) error {
				r.Pass("", nil)
				return nil
			},
		},
		Check{
			ID: "kms.warn", Title: "KMS", Category: CategorySecurity, Severity: SeverityWarning, Resolution: resolution,
			Run: func(ctx context.Context, r *Result) error {
				r.Warn("slow", &Resolution{Summary: "Own resolution"}, nil)
				return nil
			},
		},
		Check{
			ID: "kms.error", Title: "KMS", Category: CategorySecurity, Severity: SeverityCritical,
			Run: func(ctx context.Context, r *Result) error {
				return codedError{"KMSInvalidStateException"}
			},
		},
		Check{
			ID: "kms.panic", Title: "KMS", Category: CategorySecurity, Severity: SeverityCritical,
			Run: func(ctx context.Context, r *Result) error {
				panic("kaboom")
			},
		},
	)

	results := byID(run(t, doctor, false))

	failed := results["kms.encrypt"]
	if failed.Status != StatusFail || failed.Message != "denied for https://kms.local/?token=***" {
		t.Fatalf("fail: %+v", failed)
	}
	if *failed.Target != "postgres://app:***@db/core" || failed.Details["password"] != "***" {
		t.Fatalf("redaction: %v %v", *failed.Target, failed.Details)
	}
	if failed.Resolution != resolution {
		t.Fatalf("definition resolution not applied")
	}

	if passed := results["kms.pass"]; passed.Status != StatusPass || passed.Message != "OK" || passed.Resolution != nil {
		t.Fatalf("pass: %+v", passed)
	}

	if warned := results["kms.warn"]; warned.Resolution.Summary != "Own resolution" {
		t.Fatalf("warn resolution: %+v", warned.Resolution)
	}

	errored := results["kms.error"]
	errorDetails := errored.Details["error"].(map[string]any)
	if errored.Status != StatusError || errorDetails["kind"] != "invalid_state" {
		t.Fatalf("error: %+v", errored)
	}
	if errored.Resolution == nil || errored.Resolution.Summary != ErrorKindHints[KindInvalidState] {
		t.Fatalf("error resolution: %+v", errored.Resolution)
	}

	if panicked := results["kms.panic"]; panicked.Status != StatusError {
		t.Fatalf("panic: %+v", panicked)
	}
}

func TestTimeoutIgnoresLateWrites(t *testing.T) {
	released := make(chan struct{})

	doctor := newTestDoctor(t, Options{}, Check{
		ID: "slow", Title: "Slow", Category: CategoryRuntime, Severity: SeverityWarning, Timeout: 20 * time.Millisecond,
		Run: func(ctx context.Context, r *Result) error {
			<-released
			r.Pass("too late", nil)
			return nil
		},
	})

	result := run(t, doctor, false).Checks[0]
	close(released)

	if result.Status != StatusTimeout || result.Message != "Timed out after 20ms." {
		t.Fatalf("result: %+v", result)
	}
}

func TestContextDeadlineCountsAsTimeout(t *testing.T) {
	doctor := newTestDoctor(t, Options{}, Check{
		ID: "slow", Title: "Slow", Category: CategoryRuntime, Severity: SeverityWarning, Timeout: 20 * time.Millisecond,
		Run: func(ctx context.Context, r *Result) error {
			<-ctx.Done()
			return ctx.Err()
		},
	})

	if status := run(t, doctor, false).Checks[0].Status; status != StatusTimeout {
		t.Fatalf("status = %s", status)
	}
}

func TestRunBudget(t *testing.T) {
	slow := Check{
		ID: "slow", Title: "Slow", Category: CategoryRuntime, Severity: SeverityWarning,
		Run: func(ctx context.Context, r *Result) error {
			<-ctx.Done()
			return nil
		},
	}

	doctor := newTestDoctor(t, Options{RunBudget: 30 * time.Millisecond}, slow)
	started := time.Now()
	report := run(t, doctor, false)

	if report.Checks[0].Status != StatusTimeout || time.Since(started) > time.Second {
		t.Fatalf("budget not enforced: %+v after %s", report.Checks[0], time.Since(started))
	}
}

func TestDependencies(t *testing.T) {
	var sawDependency atomic.Bool

	consumer := passing("db.query")
	consumer.DependsOn = []string{"db.reachable"}
	consumer.Run = func(ctx context.Context, r *Result) error {
		sawDependency.Store(r.Dependency("db.reachable") != nil)
		return nil
	}

	skipped := passing("kms.encrypt")
	skipped.DependsOn = []string{"kms.reachable"}

	unknown := passing("orphan")
	unknown.DependsOn = []string{"missing"}

	cycleA := passing("cycle.a")
	cycleA.DependsOn = []string{"cycle.b"}
	cycleB := passing("cycle.b")
	cycleB.DependsOn = []string{"cycle.a"}

	behindCycle := passing("cycle.c")
	behindCycle.DependsOn = []string{"cycle.a"}

	doctor := newTestDoctor(t, Options{},
		consumer, passing("db.reachable"), skipped, failing("kms.reachable"),
		unknown, cycleA, cycleB, behindCycle,
	)
	results := byID(run(t, doctor, false))

	if results["db.query"].Status != StatusPass || !sawDependency.Load() {
		t.Fatalf("db.query: %+v", results["db.query"])
	}

	kms := results["kms.encrypt"]
	if kms.Status != StatusSkip || kms.Details["dependsOn"].([]any)[0] != "kms.reachable" {
		t.Fatalf("kms.encrypt: %+v", kms)
	}

	if results["orphan"].Status != StatusError || results["orphan"].Message != "Unknown dependency: missing." {
		t.Fatalf("orphan: %+v", results["orphan"])
	}

	if results["cycle.a"].Status != StatusError || results["cycle.b"].Status != StatusError {
		t.Fatalf("cycle: %+v %+v", results["cycle.a"], results["cycle.b"])
	}
	if results["cycle.c"].Status != StatusSkip {
		t.Fatalf("behind cycle: %+v", results["cycle.c"])
	}
}

func TestMinIntervalReusesResult(t *testing.T) {
	clock := newFakeClock()
	var calls atomic.Int32

	check := passing("expensive")
	check.MinInterval = time.Minute
	check.Run = func(ctx context.Context, r *Result) error {
		calls.Add(1)
		return nil
	}

	doctor := newTestDoctor(t, Options{Now: clock.Now}, check)

	first := run(t, doctor, false).Checks[0]
	clock.Advance(15 * time.Second)
	second := run(t, doctor, true).Checks[0]
	clock.Advance(time.Minute)
	third := run(t, doctor, true).Checks[0]

	if calls.Load() != 2 {
		t.Fatalf("calls = %d, want 2", calls.Load())
	}
	if first.CachedAt != nil || second.CachedAt == nil || *second.CachedAt != "2026-11-17T10:00:00.000Z" || third.CachedAt != nil {
		t.Fatalf("cachedAt: %v %v %v", first.CachedAt, second.CachedAt, third.CachedAt)
	}
}

func TestConcurrencyLimit(t *testing.T) {
	var active, peak atomic.Int32

	var checks []Check
	for _, id := range []string{"c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"} {
		check := passing(id)
		check.Run = func(ctx context.Context, r *Result) error {
			current := active.Add(1)
			for {
				seen := peak.Load()
				if current <= seen || peak.CompareAndSwap(seen, current) {
					break
				}
			}
			time.Sleep(10 * time.Millisecond)
			active.Add(-1)
			return nil
		}
		checks = append(checks, check)
	}

	run(t, newTestDoctor(t, Options{Concurrency: 3}, checks...), false)

	if peak.Load() > 3 || peak.Load() == 0 {
		t.Fatalf("peak concurrency = %d, want 1..3", peak.Load())
	}
}

func TestRegisterValidation(t *testing.T) {
	doctor := New(Options{Component: "test"})

	if err := doctor.Register(passing("Bad_ID")); err == nil {
		t.Fatal("expected invalid id error")
	}
	if err := doctor.Register(passing("ok"), passing("ok")); err == nil {
		t.Fatal("expected duplicate id error")
	}
	if err := doctor.Register(Check{ID: "no-run"}); err == nil {
		t.Fatal("expected missing Run error")
	}
}

type gatedCheck struct {
	calls   atomic.Int32
	release chan struct{}
	started chan struct{}
	once    sync.Once
}

func newGatedCheck() *gatedCheck {
	return &gatedCheck{release: make(chan struct{}), started: make(chan struct{})}
}

func (g *gatedCheck) check() Check {
	check := passing("gated")
	check.Run = func(ctx context.Context, r *Result) error {
		g.calls.Add(1)
		g.once.Do(func() { close(g.started) })
		<-g.release
		if ctx.Err() != nil {
			r.Fail("cancelled", nil, nil)
		}
		return nil
	}
	return check
}

func TestDebounceConcurrentRequestsShareRun(t *testing.T) {
	gate := newGatedCheck()
	doctor := newTestDoctor(t, Options{}, gate.check())

	reports := make([]*Report, 6)
	var wg sync.WaitGroup
	for index := range reports {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			reports[index] = run(t, doctor, false)
		}(index)
	}

	<-gate.started
	time.Sleep(20 * time.Millisecond)
	close(gate.release)
	wg.Wait()

	if gate.calls.Load() != 1 {
		t.Fatalf("check ran %d times", gate.calls.Load())
	}
	for _, report := range reports {
		if report.RunID != reports[0].RunID {
			t.Fatalf("different runs: %s vs %s", report.RunID, reports[0].RunID)
		}
	}
}

func TestDebounceCacheTTL(t *testing.T) {
	clock := newFakeClock()
	var calls atomic.Int32

	check := passing("counted")
	check.Run = func(ctx context.Context, r *Result) error {
		calls.Add(1)
		return nil
	}
	doctor := newTestDoctor(t, Options{Now: clock.Now}, check)

	first := run(t, doctor, false)
	clock.Advance(20 * time.Second)
	cached := run(t, doctor, false)

	if calls.Load() != 1 || !cached.Cached || cached.AgeMs != 20_000 || cached.RunID != first.RunID {
		t.Fatalf("cached report: calls=%d %+v", calls.Load(), cached)
	}
	if first.Cached {
		t.Fatal("the original report must not be mutated")
	}

	clock.Advance(15 * time.Second)
	if expired := run(t, doctor, false); expired.Cached || calls.Load() != 2 {
		t.Fatalf("expired cache: calls=%d cached=%v", calls.Load(), expired.Cached)
	}
}

func TestDebounceFreshJoinsRunningRun(t *testing.T) {
	gate := newGatedCheck()
	doctor := newTestDoctor(t, Options{}, gate.check())

	var first, fresh *Report
	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		first = run(t, doctor, false)
	}()
	<-gate.started

	go func() {
		defer wg.Done()
		fresh = run(t, doctor, true)
	}()
	time.Sleep(20 * time.Millisecond)
	close(gate.release)
	wg.Wait()

	if gate.calls.Load() != 1 || fresh.RunID != first.RunID {
		t.Fatalf("calls=%d runs %s / %s", gate.calls.Load(), first.RunID, fresh.RunID)
	}
}

func TestDebounceFreshMinInterval(t *testing.T) {
	clock := newFakeClock()
	var calls atomic.Int32

	check := passing("counted")
	check.Run = func(ctx context.Context, r *Result) error {
		calls.Add(1)
		return nil
	}
	doctor := newTestDoctor(t, Options{Now: clock.Now}, check)

	first := run(t, doctor, false)
	clock.Advance(5 * time.Second)
	recent := run(t, doctor, true)

	if calls.Load() != 1 || !recent.Cached || recent.RunID != first.RunID {
		t.Fatalf("fresh within min interval: calls=%d %+v", calls.Load(), recent)
	}

	clock.Advance(6 * time.Second)
	if forced := run(t, doctor, true); forced.Cached || calls.Load() != 2 {
		t.Fatalf("fresh after min interval: calls=%d cached=%v", calls.Load(), forced.Cached)
	}
}

func TestDebounceAbortDoesNotCancelRun(t *testing.T) {
	gate := newGatedCheck()
	doctor := newTestDoctor(t, Options{}, gate.check())

	ctx, cancel := context.WithCancel(context.Background())
	aborted := make(chan error, 1)
	go func() {
		_, err := doctor.Run(ctx, false)
		aborted <- err
	}()
	<-gate.started

	joined := make(chan *Report, 1)
	go func() { joined <- run(t, doctor, false) }()
	time.Sleep(20 * time.Millisecond)

	cancel()
	if err := <-aborted; !errors.Is(err, context.Canceled) {
		t.Fatalf("aborted caller got %v", err)
	}

	close(gate.release)
	report := <-joined

	if gate.calls.Load() != 1 || report.Checks[0].Status != StatusPass {
		t.Fatalf("calls=%d result=%+v", gate.calls.Load(), report.Checks[0])
	}
}

func TestHandler(t *testing.T) {
	doctor := newTestDoctor(t, Options{}, passing("ok"))
	server := httptest.NewServer(doctor.Handler())
	defer server.Close()

	response, err := http.Get(server.URL + "/doctor?fresh=1")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()

	if response.StatusCode != 200 || response.Header.Get("X-Metorial-Doctor") != "1" || response.Header.Get("Cache-Control") != "no-store" {
		t.Fatalf("status=%d headers=%v", response.StatusCode, response.Header)
	}

	var report Report
	if err := json.NewDecoder(response.Body).Decode(&report); err != nil || report.Checks[0].ID != "ok" {
		t.Fatalf("body: %v %+v", err, report)
	}

	post, err := http.Post(server.URL+"/doctor", "application/json", nil)
	if err != nil {
		t.Fatal(err)
	}
	post.Body.Close()

	if post.StatusCode != 405 || post.Header.Get("Allow") != "GET" {
		t.Fatalf("POST status=%d allow=%q", post.StatusCode, post.Header.Get("Allow"))
	}
}

func TestHandlerUnavailableWhenRunCannotFinish(t *testing.T) {
	gate := newGatedCheck()
	defer close(gate.release)
	doctor := newTestDoctor(t, Options{}, gate.check())

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	recorder := httptest.NewRecorder()
	doctor.Handler().ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/doctor", nil).WithContext(ctx))

	if recorder.Code != 503 || recorder.Header().Get("X-Metorial-Doctor") != "1" {
		t.Fatalf("status=%d", recorder.Code)
	}
}
