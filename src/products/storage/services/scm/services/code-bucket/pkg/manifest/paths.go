package manifest

import (
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/unicode/norm"
)

const (
	MaxPathBytes    = 4096
	MaxSegmentBytes = 255
)

type PathReason string

const (
	PathEmpty            PathReason = "empty"
	PathAbsolute         PathReason = "absolute"
	PathInvalidUTF8      PathReason = "invalid_utf8"
	PathControlCharacter PathReason = "control_character"
	PathBackslash        PathReason = "backslash"
	PathNotNFC           PathReason = "not_nfc"
	PathTooLong          PathReason = "path_too_long"
	PathEmptySegment     PathReason = "empty_segment"
	PathDotSegment       PathReason = "dot_segment"
	PathSegmentTooLong   PathReason = "segment_too_long"
	PathGitDir           PathReason = "git_dir"
	PathGitMetadataFile  PathReason = "git_metadata_file"
)

type PathError struct {
	Path   string
	Reason PathReason
}

func (e *PathError) Error() string {
	return fmt.Sprintf("invalid path %q: %s", e.Path, e.Reason)
}

// ValidatePath applies the repository path rules shared with Metorial's pathRules.ts
// (fixture: testdata/path-rules.json). Checks run in a fixed order so both
// implementations report the same reason for a path that breaks several rules.
func ValidatePath(p string) error {
	if reason := pathReason(p); reason != "" {
		return &PathError{Path: p, Reason: reason}
	}

	return nil
}

func pathReason(p string) PathReason {
	if p == "" {
		return PathEmpty
	}
	if p[0] == '/' {
		return PathAbsolute
	}
	if !utf8.ValidString(p) {
		return PathInvalidUTF8
	}
	if strings.IndexFunc(p, unicode.IsControl) >= 0 {
		return PathControlCharacter
	}
	if strings.ContainsRune(p, '\\') {
		return PathBackslash
	}
	if !norm.NFC.IsNormalString(p) {
		return PathNotNFC
	}
	if len(p) > MaxPathBytes {
		return PathTooLong
	}

	for segment := range strings.SplitSeq(p, "/") {
		if reason := segmentReason(segment); reason != "" {
			return reason
		}
	}

	return ""
}

func segmentReason(segment string) PathReason {
	switch {
	case segment == "":
		return PathEmptySegment
	case segment == "." || segment == "..":
		return PathDotSegment
	case len(segment) > MaxSegmentBytes:
		return PathSegmentTooLong
	}

	return gitReservedSegmentReason(segment)
}

func gitReservedSegmentReason(segment string) PathReason {
	switch lower := asciiLower(segment); lower {
	case ".git":
		return PathGitDir
	case ".gitattributes", ".gitmodules":
		return PathGitMetadataFile
	}

	return ""
}

// asciiLower folds only A-Z, unlike strings.EqualFold (which also matches U+017F to "s"),
// so the TS implementation can use the same rule.
func asciiLower(s string) string {
	b := []byte(s)
	for i, c := range b {
		if 'A' <= c && c <= 'Z' {
			b[i] = c + ('a' - 'A')
		}
	}
	return string(b)
}

func hasGitReservedSegment(p string) bool {
	for segment := range strings.SplitSeq(p, "/") {
		if gitReservedSegmentReason(segment) != "" {
			return true
		}
	}

	return false
}
