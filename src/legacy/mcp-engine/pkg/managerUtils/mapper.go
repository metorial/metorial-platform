package managerUtils

import (
	"encoding/json"
	"log"
	"os"
)

var managerAddressMapping map[string]string

func GetManagerAddressMapping() map[string]string {
	if managerAddressMapping == nil {
		envMapping := os.Getenv("MANAGER_ADDRESS_MAPPING")
		if envMapping == "" {
			managerAddressMapping = make(map[string]string)
		} else {
			managerAddressMapping = make(map[string]string)
			err := json.Unmarshal([]byte(envMapping), &managerAddressMapping)
			if err != nil {
				log.Fatalf("Failed to parse MANAGER_ADDRESS_MAPPING: %v", err)
			}
		}
	}
	return managerAddressMapping
}

func GetManagerAddress(address string) string {
	mapping := GetManagerAddressMapping()
	if mappedAddress, ok := mapping[address]; ok {
		return mappedAddress
	}
	return address
}
