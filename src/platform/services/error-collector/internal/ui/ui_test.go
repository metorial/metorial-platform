package ui

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"html"
	"regexp"
	"strings"
	"testing"
)

var (
	scriptPattern = regexp.MustCompile(`(?s)<script>(.*?)</script>`)
	dataPattern   = regexp.MustCompile(`(?s)<script type="application/json" id="report-data">(.*?)</script>`)
	cspPattern    = regexp.MustCompile(`<meta http-equiv="Content-Security-Policy" content="([^"]+)"`)
	refPattern    = regexp.MustCompile(`(?i)\b(?:src|href|action)\s*=\s*"([^"]*)"`)
	urlPattern    = regexp.MustCompile(`url\(\s*'([^']*)'`)
)

func staticPage(t *testing.T, report any) string {
	t.Helper()
	var out bytes.Buffer
	if err := WriteStaticPage(&out, report); err != nil {
		t.Fatal(err)
	}
	return out.String()
}

func TestStaticPageLoadsNothing(t *testing.T) {
	page := staticPage(t, map[string]any{"manifest": map[string]any{}})

	if strings.Contains(page, "ZgotmplZ") {
		t.Fatal("the template rejected a value")
	}

	markup := scriptPattern.ReplaceAllString(page, "")
	for _, match := range refPattern.FindAllStringSubmatch(markup, -1) {
		if !strings.HasPrefix(match[1], "data:") {
			t.Errorf("page references %q", match[1])
		}
	}
	for _, match := range urlPattern.FindAllStringSubmatch(markup, -1) {
		if !strings.HasPrefix(match[1], "data:") {
			t.Errorf("stylesheet references %q", match[1])
		}
	}
	for _, absent := range []string{"/system/", "/license", "dl-link", "<link rel=\"stylesheet\""} {
		if strings.Contains(page, absent) {
			t.Errorf("static page contains %q", absent)
		}
	}

	csp := cspPattern.FindStringSubmatch(page)
	if csp == nil {
		t.Fatal("static page has no content security policy")
	}
	policy := html.UnescapeString(csp[1])
	if !strings.HasPrefix(policy, "default-src 'none';") || strings.Contains(policy, "http") || strings.Contains(policy, "connect-src") {
		t.Errorf("policy = %q", policy)
	}

	scripts := scriptPattern.FindAllStringSubmatch(page, -1)
	if len(scripts) != 1 {
		t.Fatalf("found %d executable scripts, want 1", len(scripts))
	}
	hash := sha256.Sum256([]byte(scripts[0][1]))
	if !strings.Contains(policy, "script-src 'sha256-"+base64.StdEncoding.EncodeToString(hash[:])+"'") {
		t.Errorf("policy does not allow the inline script: %q", policy)
	}
}

func TestStaticPageEmbedsReport(t *testing.T) {
	report := map[string]any{"issues": []map[string]string{{"value": "</script><script>alert(1)</script> & <b>"}}}
	page := staticPage(t, report)

	data := dataPattern.FindStringSubmatch(page)
	if data == nil {
		t.Fatal("report data is missing")
	}
	if len(scriptPattern.FindAllString(page, -1)) != 1 {
		t.Fatal("the report data closed its script element")
	}

	var decoded struct {
		Issues []struct{ Value string }
	}
	if err := json.Unmarshal([]byte(data[1]), &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.Issues[0].Value != report["issues"].([]map[string]string)[0]["value"] {
		t.Errorf("value = %q", decoded.Issues[0].Value)
	}
}

func TestLivePageIsADownloadPortal(t *testing.T) {
	page, err := Page()
	if err != nil {
		t.Fatal(err)
	}
	body := string(page)

	for _, present := range []string{
		`<script src="/system/errors/assets/portal.js" defer></script>`,
		`<link rel="stylesheet" href="/system/errors/assets/app.css" />`,
		"These errors never leave this installation.",
		"What is removed before an error is stored",
		`id="dl-period"`,
		`id="dl-link"`,
		`href="/system/doctor"`,
	} {
		if !strings.Contains(body, present) {
			t.Errorf("live page is missing %q", present)
		}
	}
	for _, absent := range []string{"report-data", "Content-Security-Policy", "<style>", `id="search"`, `id="sheet"`} {
		if strings.Contains(body, absent) {
			t.Errorf("live page contains %q", absent)
		}
	}
}

func TestOnlyTheLivePageAssetsAreServed(t *testing.T) {
	for _, name := range []string{"app.css", "portal.js", "logo.svg"} {
		if _, _, err := Asset(name); err != nil {
			t.Errorf("%s: %v", name, err)
		}
	}
	for _, name := range []string{"report.js", "portal.html", "report.html", "partials.html", "ui.go", "../ui.go"} {
		if _, _, err := Asset(name); err != ErrUnknownAsset {
			t.Errorf("%s: error %v, want ErrUnknownAsset", name, err)
		}
	}
}
