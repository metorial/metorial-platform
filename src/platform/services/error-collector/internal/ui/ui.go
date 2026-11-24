package ui

import (
	"bytes"
	"crypto/sha256"
	"embed"
	"encoding/base64"
	"encoding/json"
	"errors"
	"html/template"
	"io"
	"strings"
)

//go:embed *.html app.css portal.js report.js logo.svg
var files embed.FS

var pages = template.Must(template.ParseFS(files, "*.html"))

// The live page only loads these; report.js only runs inside an exported report.html.
var assetTypes = map[string]string{
	"app.css":   "text/css; charset=utf-8",
	"portal.js": "text/javascript; charset=utf-8",
	"logo.svg":  "image/svg+xml",
}

var ErrUnknownAsset = errors.New("unknown asset")

type reportPage struct {
	Icon   template.URL
	CSP    string
	CSS    template.CSS
	Script template.HTML
	Data   template.JS
}

// Page is the live download page. It reads report.json only to count what a download would contain.
func Page() ([]byte, error) {
	var out bytes.Buffer
	if err := pages.ExecuteTemplate(&out, "portal.html", nil); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

// Asset returns one of the live page's assets and its content type.
func Asset(name string) ([]byte, string, error) {
	contentType, known := assetTypes[name]
	if !known {
		return nil, "", ErrUnknownAsset
	}
	body, err := files.ReadFile(name)
	if err != nil {
		return nil, "", ErrUnknownAsset
	}
	return body, contentType, nil
}

// WriteStaticPage writes the report viewer with its assets and the report inlined, so it opens from
// disk without a server. Its policy blocks every request, so viewing it never leaves the machine.
func WriteStaticPage(w io.Writer, report any) error {
	css, err := files.ReadFile("app.css")
	if err != nil {
		return err
	}
	script, err := files.ReadFile("report.js")
	if err != nil {
		return err
	}
	logo, err := files.ReadFile("logo.svg")
	if err != nil {
		return err
	}
	// encoding/json escapes <, > and &, so the data can't close its script element.
	data, err := json.Marshal(report)
	if err != nil {
		return err
	}

	logoURL := "data:image/svg+xml;base64," + base64.StdEncoding.EncodeToString(logo)
	scriptHash := sha256.Sum256(script)

	return pages.ExecuteTemplate(w, "report.html", reportPage{
		Icon: template.URL(logoURL),
		CSP: "default-src 'none'; script-src 'sha256-" + base64.StdEncoding.EncodeToString(scriptHash[:]) +
			"'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'",
		CSS:    template.CSS(strings.ReplaceAll(string(css), "url('logo.svg')", "url('"+logoURL+"')")),
		Script: template.HTML("<script>" + string(script) + "</script>"),
		Data:   template.JS(data),
	})
}
