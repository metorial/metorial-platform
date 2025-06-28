package docker

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log"
	"os/exec"
)

type ContainerHandle struct {
	ID       string
	ImageRef string
	Running  bool
	ExitCode int

	cmd     *exec.Cmd
	stdin   io.WriteCloser
	stdout  io.ReadCloser
	stderr  io.ReadCloser
	done    chan struct{}
	cancel  context.CancelFunc
	manager *ContainerManager
}

type LineHandler func(line string)

func (c *ContainerHandle) WriteToStdin(data string) error {
	select {
	case <-c.done:
		return fmt.Errorf("container %s is not running", c.ID)
	default:
		_, err := c.stdin.Write([]byte(data))
		return err
	}
}

func (c *ContainerHandle) ListenToStdout(handler LineHandler) {
	go func() {
		scanner := bufio.NewScanner(c.stdout)
		for scanner.Scan() {
			select {
			case <-c.done:
				return
			default:
				handler(scanner.Text())
			}
		}
	}()
}

func (c *ContainerHandle) ListenToStderr(handler LineHandler) {
	go func() {
		scanner := bufio.NewScanner(c.stderr)
		for scanner.Scan() {
			select {
			case <-c.done:
				return
			default:
				handler(scanner.Text())
			}
		}
	}()
}

func (c *ContainerHandle) Stop() error {
	log.Printf("Stopping container %s", c.ID)

	select {
	case <-c.done:
		return fmt.Errorf("container %s is already stopped", c.ID)
	default:
		c.cancel()

		// Cleanup is handled in the monitor method

		return nil
	}
}

func (c *ContainerHandle) IsRunning() bool {
	select {
	case <-c.done:
		return false
	default:
		return true
	}
}

func (c *ContainerHandle) Wait() error {
	<-c.done
	return nil
}

func (c *ContainerHandle) monitor() {
	err := c.cmd.Wait()

	select {
	case <-c.done:
		return
	default:
		close(c.done)

		log.Printf("Container %s has exited", c.ID)

		if err != nil {
			if exitError, ok := err.(*exec.ExitError); ok {
				c.ExitCode = exitError.ExitCode()
			} else {
				c.ExitCode = -1 // Indicate an error occurred
			}
		} else {
			c.ExitCode = 0 // Normal exit
		}

		c.Running = false

		if c.stdin != nil {
			c.stdin.Close()
		}
		if c.stdout != nil {
			c.stdout.Close()
		}
		if c.stderr != nil {
			c.stderr.Close()
		}

		c.manager.mutex.Lock()
		delete(c.manager.containers, c.ID)
		c.manager.mutex.Unlock()

		if err != nil {
			fmt.Printf("Container %s exited with error: %v\n", c.ID, err)
		}
	}
}
