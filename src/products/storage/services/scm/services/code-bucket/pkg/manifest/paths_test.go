package manifest

import (
	"encoding/json"
	"errors"
	"os"
	"testing"
)

type pathRuleCase struct {
	Path   string `json:"path"`
	Valid  bool   `json:"valid"`
	Reason string `json:"reason"`
}

func loadPathRules(t *testing.T) []pathRuleCase {
	t.Helper()

	raw, err := os.ReadFile("testdata/path-rules.json")
	if err != nil {
		t.Fatal(err)
	}

	var cases []pathRuleCase
	if err := json.Unmarshal(raw, &cases); err != nil {
		t.Fatal(err)
	}
	if len(cases) == 0 {
		t.Fatal("no path rule cases")
	}

	return cases
}

func TestValidatePathFixture(t *testing.T) {
	for _, tc := range loadPathRules(t) {
		name := tc.Path
		if len(name) > 60 {
			name = name[:60] + "…"
		}

		t.Run(name, func(t *testing.T) {
			err := ValidatePath(tc.Path)

			if tc.Valid {
				if err != nil {
					t.Fatalf("want valid, got %v", err)
				}
				return
			}

			var pathErr *PathError
			if !errors.As(err, &pathErr) {
				t.Fatalf("want *PathError with reason %q, got %v", tc.Reason, err)
			}
			if string(pathErr.Reason) != tc.Reason {
				t.Fatalf("reason = %q, want %q", pathErr.Reason, tc.Reason)
			}
		})
	}
}

// JSON can't carry invalid UTF-8 portably (decoders substitute U+FFFD), so these stay
// out of the shared fixture.
func TestValidatePathRejectsInvalidUTF8(t *testing.T) {
	for _, p := range []string{"a\xffb", "\xc3", "ok/\xed\xa0\x80.md"} {
		var pathErr *PathError
		if err := ValidatePath(p); !errors.As(err, &pathErr) || pathErr.Reason != PathInvalidUTF8 {
			t.Errorf("%q: got %v, want invalid_utf8", p, err)
		}
	}
}

func TestPathFixtureCoversEveryReason(t *testing.T) {
	seen := map[string]bool{}
	for _, tc := range loadPathRules(t) {
		if !tc.Valid {
			seen[tc.Reason] = true
		}
	}

	for _, reason := range []PathReason{
		PathEmpty, PathAbsolute, PathControlCharacter, PathBackslash, PathNotNFC, PathTooLong,
		PathEmptySegment, PathDotSegment, PathSegmentTooLong, PathGitDir, PathGitMetadataFile,
	} {
		if !seen[string(reason)] {
			t.Errorf("fixture has no invalid case for %q", reason)
		}
	}
}

func TestScopeContains(t *testing.T) {
	scope := Scope{
		Dirs:  []string{"plugins", "skills"},
		Files: []string{".claude-plugin/marketplace.json", "plugin.json"},
		Globs: []string{"assets/logo.*", "agents/*.md", "x/*-*/y"},
	}

	tests := []struct {
		path string
		want bool
	}{
		{"plugins/acme/SKILL.md", true},
		{"plugins/a", true},
		{"plugins", false},
		{"pluginsx/a", false},
		{"skills/qa/SKILL.md", true},
		{".claude-plugin/marketplace.json", true},
		{".claude-plugin/other.json", false},
		{"plugin.json", true},
		{"sub/plugin.json", false},
		{"assets/logo.png", true},
		{"assets/logo.", true},
		{"assets/logo", false},
		{"assets/banner.png", false},
		{"assets/x/logo.png", false},
		{"agents/reviewer.md", true},
		{"agents/.md", true},
		{"agents/notes.txt", false},
		{"agents/sub/reviewer.md", false},
		{"x/a-b/y", true},
		{"x/ab/y", false},
		{"README.md", false},
		{"docs/x.md", false},
		{"plugins/acme/.gitattributes", false},
		{"plugins/.git/config", false},
		{"plugins/acme/.GITMODULES", false},
		{"", false},
	}

	for _, tt := range tests {
		if got := scope.Contains(tt.path); got != tt.want {
			t.Errorf("Contains(%q) = %v, want %v", tt.path, got, tt.want)
		}
	}
}

func TestScopeValidate(t *testing.T) {
	tests := []struct {
		name  string
		scope Scope
		ok    bool
	}{
		{"empty", Scope{}, true},
		{"normal", Scope{Dirs: []string{"plugins"}, Files: []string{"a.json"}, Globs: []string{"assets/logo.*"}}, true},
		{"absolute dir", Scope{Dirs: []string{"/plugins"}}, false},
		{"trailing slash dir", Scope{Dirs: []string{"plugins/"}}, false},
		{"git dir", Scope{Dirs: []string{".git"}}, false},
		{"gitattributes file", Scope{Files: []string{".gitattributes"}}, false},
		{"dotdot glob", Scope{Globs: []string{"../*"}}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.scope.Validate()
			if (err == nil) != tt.ok {
				t.Fatalf("Validate() = %v, want ok=%v", err, tt.ok)
			}
		})
	}
}

func TestMatchSegment(t *testing.T) {
	tests := []struct {
		pattern, segment string
		want             bool
	}{
		{"*", "", true},
		{"*", "anything", true},
		{"a*", "a", true},
		{"*a", "ba", true},
		{"a*b*c", "abcbc", true},
		{"a*b*c", "acb", false},
		{"a*a", "a", false},
		{"**", "x", true},
		{"abc", "abc", true},
		{"abc", "abd", false},
	}

	for _, tt := range tests {
		if got := matchSegment(tt.pattern, tt.segment); got != tt.want {
			t.Errorf("matchSegment(%q, %q) = %v, want %v", tt.pattern, tt.segment, got, tt.want)
		}
	}
}
