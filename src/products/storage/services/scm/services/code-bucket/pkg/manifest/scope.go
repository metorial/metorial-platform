package manifest

import (
	"fmt"
	"strings"
)

// Scope is the part of the repository Metorial manages. Dirs match the directory and
// everything below it, Files match exactly, and Globs match segment by segment where
// "*" matches any run of characters within one segment.
type Scope struct {
	Dirs  []string `json:"dirs"`
	Files []string `json:"files"`
	Globs []string `json:"globs"`
}

func (s Scope) Validate() error {
	for _, dir := range s.Dirs {
		if err := ValidatePath(dir); err != nil {
			return fmt.Errorf("scope dir: %w", err)
		}
	}
	for _, file := range s.Files {
		if err := ValidatePath(file); err != nil {
			return fmt.Errorf("scope file: %w", err)
		}
	}
	for _, glob := range s.Globs {
		if err := ValidatePath(glob); err != nil {
			return fmt.Errorf("scope glob: %w", err)
		}
	}

	return nil
}

// Contains never matches .git, .gitattributes or .gitmodules segments, whatever the
// scope says, so scope deletes can't touch repository metadata.
func (s Scope) Contains(p string) bool {
	if p == "" || hasGitReservedSegment(p) {
		return false
	}

	for _, file := range s.Files {
		if p == file {
			return true
		}
	}
	for _, dir := range s.Dirs {
		if strings.HasPrefix(p, dir+"/") {
			return true
		}
	}
	for _, glob := range s.Globs {
		if matchGlob(glob, p) {
			return true
		}
	}

	return false
}

func matchGlob(glob, p string) bool {
	globSegments := strings.Split(glob, "/")
	pathSegments := strings.Split(p, "/")
	if len(globSegments) != len(pathSegments) {
		return false
	}

	for i := range globSegments {
		if !matchSegment(globSegments[i], pathSegments[i]) {
			return false
		}
	}

	return true
}

func matchSegment(pattern, segment string) bool {
	parts := strings.Split(pattern, "*")
	if len(parts) == 1 {
		return pattern == segment
	}

	if !strings.HasPrefix(segment, parts[0]) {
		return false
	}
	segment = segment[len(parts[0]):]

	last := parts[len(parts)-1]
	for _, part := range parts[1 : len(parts)-1] {
		at := strings.Index(segment, part)
		if at < 0 {
			return false
		}
		segment = segment[at+len(part):]
	}

	return len(segment) >= len(last) && strings.HasSuffix(segment, last)
}
