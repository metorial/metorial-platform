package resources

import (
	"fmt"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/mem"
)

func CheckMemoryUsage(minFreeMemoryMB uint64) (bool, error) {
	vmStat, err := mem.VirtualMemory()
	if err != nil {
		return false, fmt.Errorf("failed to get memory info: %w", err)
	}

	availableMB := vmStat.Available / 1024 / 1024
	if availableMB < minFreeMemoryMB {
		return false, nil
	}

	return true, nil
}

func CheckCPUUsage(maxCPUUsage float64) (bool, error) {
	// Check CPU usage over 1 second
	cpuPercent, err := cpu.Percent(time.Second, false)
	if err != nil {
		return false, fmt.Errorf("failed to get CPU usage: %w", err)
	}

	currentCPU := cpuPercent[0]
	if currentCPU > maxCPUUsage {
		return false, nil
	}

	return true, nil
}
