package addr

import (
	"fmt"
	"net/url"
	"strings"
)

func ReplaceURIPath(uriStr, newPathAndQuery string) (string, error) {
	parsedURI, err := url.Parse(uriStr)
	if err != nil {
		return "", fmt.Errorf("invalid URI: %w", err)
	}

	path, rawQuery, _ := strings.Cut(newPathAndQuery, "?")

	parsedURI.Path = path
	parsedURI.RawQuery = rawQuery

	return parsedURI.String(), nil
}
