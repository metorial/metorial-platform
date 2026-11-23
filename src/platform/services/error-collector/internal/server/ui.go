package server

import (
	"embed"
	"net/http"
	"path"
	"strings"
)

//go:embed ui
var uiFiles embed.FS

const assetsPath = BasePath + "/assets/"

var assetTypes = map[string]string{
	".css": "text/css; charset=utf-8",
	".js":  "text/javascript; charset=utf-8",
	".svg": "image/svg+xml",
}

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
	body, err := uiFiles.ReadFile("ui/index.html")
	if err != nil {
		http.Error(w, "the page is missing from this build", http.StatusInternalServerError)
		return
	}

	setHeaders(w, "text/html; charset=utf-8")
	_, _ = w.Write(body)
}

func serveAsset(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("file")
	contentType, known := assetTypes[path.Ext(name)]
	if !known || name == "index.html" {
		http.NotFound(w, r)
		return
	}

	body, err := uiFiles.ReadFile("ui/" + name)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	setHeaders(w, contentType)
	_, _ = w.Write(body)
}
