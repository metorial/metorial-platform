package addr

import (
	"fmt"
	"net/url"
)

func ReplaceURIPath(uriStr, newPath string) (string, error) {
	parsedURI, err := url.Parse(uriStr)
	if err != nil {
		return "", fmt.Errorf("invalid URI: %w", err)
	}

	parsedURI.Path = newPath

	return parsedURI.String(), nil
}
