package addr

import (
	"net"
	"strconv"
)

func ExtractPort(address string) (int, error) {
	_, portStr, err := net.SplitHostPort(address)
	if err != nil {
		// Try to prepend a dummy host if only port is given
		address = "host" + address
		_, portStr, err = net.SplitHostPort(address)
		if err != nil {
			return 0, err
		}
	}

	port, err := strconv.Atoi(portStr)
	if err != nil {
		return 0, err
	}

	return port, nil
}
