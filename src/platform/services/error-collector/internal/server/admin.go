package server

import (
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/report"
)

const (
	BasePath = "/system/errors"
	// The gateway forwards the installation's name so the archive says where it came from.
	InstallationHeader = "X-Metorial-Installation"
)

var pageHeaders = map[string]string{
	"Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
	"Cache-Control":           "no-store",
	"X-Content-Type-Options":  "nosniff",
	"Referrer-Policy":         "no-referrer",
}

type AdminOptions struct {
	Source          report.Source
	HourlyRetention time.Duration
	Retention       time.Duration
	Version         string
	Now             func() time.Time
	Logger          *log.Logger
}

// Admin serves the reports. It has no authentication of its own: only the gateway, which checks
// /system access, can reach its port.
type Admin struct {
	options AdminOptions
}

func NewAdmin(options AdminOptions) *Admin {
	if options.Now == nil {
		options.Now = time.Now
	}
	if options.Logger == nil {
		options.Logger = log.Default()
	}
	return &Admin{options: options}
}

func (a *Admin) Handler() http.Handler {
	mux := http.NewServeMux()
	ui := UIHandler()
	mux.Handle("GET "+BasePath, ui)
	mux.Handle("GET "+BasePath+"/{$}", ui)
	mux.Handle("GET "+assetsPath, ui)
	mux.HandleFunc("GET "+BasePath+"/report.zip", a.zip)
	mux.HandleFunc("GET "+BasePath+"/report.json", a.json)
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, BasePath, http.StatusFound)
	})
	return mux
}

func (a *Admin) build(w http.ResponseWriter, r *http.Request) (*report.Report, bool) {
	query := r.URL.Query()
	options := report.Options{
		Now:             a.options.Now(),
		Component:       query.Get("component"),
		HourlyRetention: a.options.HourlyRetention,
		Retention:       a.options.Retention,
		Installation:    r.Header.Get(InstallationHeader),
		Version:         a.options.Version,
	}

	for _, entry := range []struct {
		target *int
		key    string
	}{{&options.Days, "days"}, {&options.Limit, "limit"}} {
		raw := query.Get(entry.key)
		if raw == "" {
			continue
		}
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 {
			http.Error(w, entry.key+" must be a positive integer", http.StatusBadRequest)
			return nil, false
		}
		*entry.target = parsed
	}

	built, err := report.Build(r.Context(), a.options.Source, options)
	if errors.Is(err, report.ErrInvalidWindow) {
		maxDays := int(a.options.Retention / (24 * time.Hour))
		http.Error(w, "days must be between 1 and "+strconv.Itoa(maxDays), http.StatusBadRequest)
		return nil, false
	}
	if err != nil {
		a.options.Logger.Printf("building error report failed: %v", err)
		http.Error(w, "the report could not be built; check the error collector's logs", http.StatusServiceUnavailable)
		return nil, false
	}
	return built, true
}

func (a *Admin) zip(w http.ResponseWriter, r *http.Request) {
	built, ok := a.build(w, r)
	if !ok {
		return
	}

	setHeaders(w, "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="`+built.FileName()+`"`)
	if err := built.WriteZip(w); err != nil {
		a.options.Logger.Printf("streaming error report failed: %v", err)
	}
}

func (a *Admin) json(w http.ResponseWriter, r *http.Request) {
	built, ok := a.build(w, r)
	if !ok {
		return
	}

	setHeaders(w, "application/json")
	writeJSON(w, http.StatusOK, built)
}

func setHeaders(w http.ResponseWriter, contentType string) {
	for key, value := range pageHeaders {
		w.Header().Set(key, value)
	}
	w.Header().Set("Content-Type", contentType)
}
