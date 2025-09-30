package addr

import (
	"net"
	"strconv"
)

func ExtractPortAndHost(address string) (string, int, error) {
	host, portStr, err := net.SplitHostPort(address)

	if err != nil {
		// Try to prepend a dummy host if only port is given
		address = "host" + address
		_, portStr, err = net.SplitHostPort(address)
		if err != nil {
			return "", 0, err
		}
	}

	port, err := strconv.Atoi(portStr)
	if err != nil {
		return "", 0, err
	}

	return host, port, nil
}

func ExtractPort(address string) (int, error) {
	port, err := strconv.Atoi(address)
	if err == nil {
		// If the address is just a port number, return it directly
		return port, nil
	}

	_, port, err = ExtractPortAndHost(address)
	if err != nil {
		return 0, err
	}

	return port, nil
}
