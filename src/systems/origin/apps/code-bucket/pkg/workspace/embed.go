package workspace

import (
	"embed"
	"io/fs"
)

//go:embed dist
var distFS embed.FS

// GetDistFS returns the embedded filesystem containing the built workspace assets
func GetDistFS() (fs.FS, error) {
	return fs.Sub(distFS, "dist")
}
