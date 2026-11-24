package server

import (
	"net/http"
	"strings"

	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/ui"
)

const assetsPath = BasePath + "/assets/"

// IsUIPath reports whether the path is part of the page itself rather than a report. The page has
// to load before the database is ready so it can say that the collector is still starting.
func IsUIPath(urlPath string) bool {
	return urlPath == BasePath || urlPath == BasePath+"/" || strings.HasPrefix(urlPath, assetsPath)
}

// UIHandler serves the page and its assets. The page reads report.json itself.
func UIHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET "+BasePath, servePage)
	mux.HandleFunc("GET "+BasePath+"/{$}", servePage)
	mux.HandleFunc("GET "+assetsPath+"{file}", serveAsset)
	return mux
}

func servePage(w http.ResponseWriter, r *http.Request) {
	body, err := ui.Page()
	if err != nil {
		http.Error(w, "the page could not be rendered", http.StatusInternalServerError)
		return
	}

	setHeaders(w, "text/html; charset=utf-8")
	_, _ = w.Write(body)
}

func serveAsset(w http.ResponseWriter, r *http.Request) {
	body, contentType, err := ui.Asset(r.PathValue("file"))
	if err != nil {
		http.NotFound(w, r)
		return
	}

	setHeaders(w, contentType)
	_, _ = w.Write(body)
}
