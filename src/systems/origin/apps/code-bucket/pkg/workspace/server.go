package workspace

import (
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"html"
)

// Server handles serving the embedded VSCode workspace
type Server struct {
	fileSystem    fs.FS
	editorApiUrl  string
}

// NewServer creates a new workspace server
func NewServer(editorApiUrl string) (*Server, error) {
	distFS, err := GetDistFS()
	if err != nil {
		return nil, fmt.Errorf("failed to get dist filesystem: %w", err)
	}

	return &Server{
		fileSystem:   distFS,
		editorApiUrl: editorApiUrl,
	}, nil
}

// ServeHTTP implements http.Handler
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/")
	if path == "" {
		path = "index.html"
	}

	// Security: prevent directory traversal
	cleanPath := filepath.Clean(path)
	if strings.Contains(cleanPath, "..") {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	// Try to read the file
	data, err := fs.ReadFile(s.fileSystem, cleanPath)
	if err != nil {
		// If file not found and it doesn't have an extension, try adding .html
		if !strings.Contains(cleanPath, ".") {
			htmlPath := cleanPath + ".html"
			data, err = fs.ReadFile(s.fileSystem, htmlPath)
			if err == nil {
				cleanPath = htmlPath
			}
		}

		// If still not found, serve index.html for SPA routing
		if err != nil {
			data, err = fs.ReadFile(s.fileSystem, "index.html")
			if err != nil {
				http.Error(w, "File not found", http.StatusNotFound)
				return
			}
			cleanPath = "index.html"
		}
	}

	// Replace placeholders in index.html
	if cleanPath == "index.html" {
		content := strings.ReplaceAll(string(data), "{{CODE_BUCKET_EDITOR_API_URL}}", html.EscapeString(s.editorApiUrl))
		data = []byte(content)
	}

	// Set content type based on file extension
	contentType := getContentType(cleanPath)
	w.Header().Set("Content-Type", contentType)

	// Add caching headers for static assets
	if strings.Contains(cleanPath, "assets/") || strings.Contains(cleanPath, "vscode/") {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	}

	w.WriteHeader(http.StatusOK)
	w.Write(data)
}

// Start starts the workspace server on the specified address
func (s *Server) Start(address string) error {
	log.Printf("Workspace server starting on %s\n", address)
	return http.ListenAndServe(address, s)
}

func getContentType(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".html":
		return "text/html; charset=utf-8"
	case ".css":
		return "text/css; charset=utf-8"
	case ".js", ".mjs":
		return "application/javascript; charset=utf-8"
	case ".json":
		return "application/json; charset=utf-8"
	case ".wasm":
		return "application/wasm"
	case ".svg":
		return "image/svg+xml"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".ico":
		return "image/x-icon"
	case ".ttf":
		return "font/ttf"
	case ".woff":
		return "font/woff"
	case ".woff2":
		return "font/woff2"
	default:
		return "application/octet-stream"
	}
}
