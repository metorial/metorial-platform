package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

type DeploymentFile struct {
	Kind     string `json:"kind"`
	Encoding string `json:"encoding"`
	Content  string `json:"content"`
}

type DeploymentRequest struct {
	EntryPointURL string                    `json:"entryPointUrl"`
	EnvVars       map[string]string         `json:"envVars"`
	Permissions   map[string][]string       `json:"permissions"`
	Assets        map[string]DeploymentFile `json:"assets"`
}

type DeploymentMeta struct {
	ID          string              `json:"id"`
	EntryPoint  string              `json:"entryPoint"`
	EnvVars     map[string]string   `json:"envVars"`
	Permissions map[string][]string `json:"permissions"`
	Port        int                 `json:"port"`
}

type DeployManager struct {
	baseDir      string
	runningProcs map[string]*runningProcess
	mu           sync.RWMutex
	portCounter  int
	portMu       sync.Mutex
}

type runningProcess struct {
	cmd          *exec.Cmd
	cancel       context.CancelFunc
	port         int
	restartCount int
	lastRestart  time.Time
	lastActivity time.Time
	stopTimer    *time.Timer
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func NewDeployManager(baseDir string) *DeployManager {
	dm := &DeployManager{
		baseDir:      baseDir,
		runningProcs: make(map[string]*runningProcess),
		portCounter:  8000,
	}

	// Restore existing deployments on startup
	dm.restoreDeployments()

	return dm
}

func (dm *DeployManager) getNextPort() int {
	dm.portMu.Lock()
	defer dm.portMu.Unlock()
	dm.portCounter++
	return dm.portCounter
}

func (dm *DeployManager) restoreDeployments() {
	entries, err := os.ReadDir(dm.baseDir)
	if err != nil {
		log.Printf("Failed to read deployments directory: %v", err)
		return
	}

	deploymentCount := 0
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		deploymentID := entry.Name()
		metaPath := filepath.Join(dm.baseDir, deploymentID, ".meta.json")

		if _, err := os.Stat(metaPath); err == nil {
			deploymentCount++
		}
	}

	if deploymentCount > 0 {
		log.Printf("Found %d deployment(s), will start on demand", deploymentCount)
	}
}

func (dm *DeployManager) CreateDeployment(req DeploymentRequest) (string, error) {
	deploymentID := uuid.New().String()
	deployDir := filepath.Join(dm.baseDir, deploymentID)

	if err := os.MkdirAll(deployDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create deployment directory: %w", err)
	}

	// Write files
	for path, file := range req.Assets {
		if file.Kind != "file" {
			continue
		}

		fullPath := filepath.Join(deployDir, path)
		dir := filepath.Dir(fullPath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return "", fmt.Errorf("failed to create directory: %w", err)
		}
		if err := os.WriteFile(fullPath, []byte(file.Content), 0644); err != nil {
			return "", fmt.Errorf("failed to write file: %w", err)
		}
	}

	// Assign port and create metadata
	port := dm.getNextPort()
	meta := DeploymentMeta{
		ID:          deploymentID,
		EntryPoint:  req.EntryPointURL,
		EnvVars:     req.EnvVars,
		Permissions: req.Permissions,
		Port:        port,
	}

	// Save metadata
	metaData, _ := json.MarshalIndent(meta, "", "  ")
	metaPath := filepath.Join(deployDir, ".meta.json")
	if err := os.WriteFile(metaPath, metaData, 0644); err != nil {
		return "", fmt.Errorf("failed to write metadata: %w", err)
	}

	// Start the deployment
	go dm.startDeployment(deploymentID, &meta, deployDir)

	return deploymentID, nil
}

func (dm *DeployManager) startDeployment(deploymentID string, meta *DeploymentMeta, deployDir string) {
	const maxRestarts = 5
	const restartBackoff = 2 * time.Second

	// Check if we should restart
	dm.mu.Lock()
	if proc, exists := dm.runningProcs[deploymentID]; exists {
		// Kill the old process first
		if proc.cancel != nil {
			proc.cancel()
		}
		if proc.cmd != nil && proc.cmd.Process != nil {
			proc.cmd.Process.Kill()
		}

		if proc.restartCount >= maxRestarts {
			log.Printf("Deployment %s exceeded max restarts (%d), marking as failed", deploymentID, maxRestarts)
			delete(dm.runningProcs, deploymentID)
			dm.mu.Unlock()
			return
		}

		// Enforce backoff
		timeSinceLastRestart := time.Since(proc.lastRestart)
		if timeSinceLastRestart < restartBackoff {
			sleepDuration := restartBackoff - timeSinceLastRestart
			log.Printf("Deployment %s restart backoff: waiting %v before restart", deploymentID, sleepDuration)
			dm.mu.Unlock()
			time.Sleep(sleepDuration)
			dm.mu.Lock()
		}

		proc.restartCount++
		proc.lastRestart = time.Now()
		dm.mu.Unlock()
	} else {
		dm.mu.Unlock()
	}

	// Assign a new port for this restart
	port := dm.getNextPort()
	meta.Port = port

	// Build deno command with permissions
	args := []string{"run", "--node-modules-dir=auto"}

	// Network permissions
	if netPerms, ok := meta.Permissions["net"]; ok {
		if len(netPerms) == 1 && netPerms[0] == "*" {
			args = append(args, "--allow-net")
		} else {
			args = append(args, fmt.Sprintf("--allow-net=%s", strings.Join(netPerms, ",")))
		}
	}

	// Read permissions - only the deployment directory
	args = append(args, fmt.Sprintf("--allow-read=%s", deployDir))

	// Write permissions - allow writing to deployment directory for node_modules
	args = append(args, fmt.Sprintf("--allow-write=%s", deployDir))

	// Environment variable permissions
	args = append(args, "--allow-env")

	// Entry point - since cmd.Dir is set to deployDir, use relative path
	entryPoint := meta.EntryPoint

	// Strip any leading slash to ensure it's relative
	entryPoint = strings.TrimPrefix(entryPoint, "/")

	log.Printf("DEBUG deployment %s: entryPoint: %s (relative to deployDir: %s)", deploymentID, entryPoint, deployDir)

	args = append(args, entryPoint)
	args = append(args, entryPoint)

	ctx, cancel := context.WithCancel(context.Background())
	cmd := exec.CommandContext(ctx, "deno", args...)
	cmd.Dir = deployDir

	// Set environment variables
	cmd.Env = os.Environ()
	cmd.Env = append(cmd.Env, fmt.Sprintf("PORT=%d", port))
	for key, value := range meta.EnvVars {
		cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%s", key, value))
	}

	log.Printf("DEBUG deployment %s: Setting PORT env var to %d", deploymentID, port)

	// Capture stderr to see why it's crashing
	stderr, err := cmd.StderrPipe()
	if err != nil {
		log.Printf("Failed to get stderr for deployment %s: %v", deploymentID, err)
		cancel()
		return
	}

	// Capture stdout
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		log.Printf("Failed to get stdout for deployment %s: %v", deploymentID, err)
		cancel()
		return
	}

	// Start the process
	if err := cmd.Start(); err != nil {
		log.Printf("Failed to start deployment %s: %v", deploymentID, err)
		cancel()
		return
	}

	log.Printf("Started deployment %s on port %d (restart count: %d)", deploymentID, meta.Port, func() int {
		dm.mu.RLock()
		defer dm.mu.RUnlock()
		if proc, ok := dm.runningProcs[deploymentID]; ok {
			return proc.restartCount
		}
		return 0
	}())

	// Track running process
	dm.mu.Lock()
	if _, exists := dm.runningProcs[deploymentID]; !exists {
		dm.runningProcs[deploymentID] = &runningProcess{
			cmd:          cmd,
			cancel:       cancel,
			port:         meta.Port,
			restartCount: 0,
			lastRestart:  time.Now(),
		}
	} else {
		dm.runningProcs[deploymentID].cmd = cmd
		dm.runningProcs[deploymentID].cancel = cancel
	}
	dm.mu.Unlock()

	// Monitor output in goroutines - with limited buffering to see crash reasons
	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := stderr.Read(buf)
			if err != nil {
				break
			}
			if n > 0 {
				log.Printf("[%s stderr] %s", deploymentID[:8], string(buf[:n]))
			}
		}
	}()

	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := stdout.Read(buf)
			if err != nil {
				break
			}
			if n > 0 {
				log.Printf("[%s stdout] %s", deploymentID[:8], string(buf[:n]))
			}
		}
	}()

	// Wait for process and restart if it crashes
	go func() {
		err := cmd.Wait()

		dm.mu.Lock()
		proc, exists := dm.runningProcs[deploymentID]
		if !exists {
			dm.mu.Unlock()
			return
		}

		restartCount := proc.restartCount
		dm.mu.Unlock()

		if err != nil {
			log.Printf("Deployment %s exited with error (restart %d/%d): %v", deploymentID, restartCount, maxRestarts, err)
		} else {
			log.Printf("Deployment %s exited normally (restart %d/%d)", deploymentID, restartCount, maxRestarts)
		}

		// Check if deployment still exists, if so, restart it
		if _, err := os.Stat(filepath.Join(deployDir, ".meta.json")); err == nil {
			if restartCount < maxRestarts {
				log.Printf("Deployment %s crashed, restarting...", deploymentID)
				dm.startDeployment(deploymentID, meta, deployDir)
			} else {
				log.Printf("Deployment %s exceeded max restarts, giving up", deploymentID)
				dm.mu.Lock()
				delete(dm.runningProcs, deploymentID)
				dm.mu.Unlock()
			}
		}
	}()
}

func (dm *DeployManager) GetDeploymentPort(deploymentID string) (int, bool) {
	dm.mu.RLock()
	proc, ok := dm.runningProcs[deploymentID]
	dm.mu.RUnlock()

	if !ok {
		return 0, false
	}

	// Update last activity time
	dm.mu.Lock()
	proc.lastActivity = time.Now()

	// Reset the stop timer
	if proc.stopTimer != nil {
		proc.stopTimer.Stop()
	}
	proc.stopTimer = time.AfterFunc(5*time.Minute, func() {
		dm.stopDeployment(deploymentID)
	})
	dm.mu.Unlock()

	return proc.port, true
}

func (dm *DeployManager) stopDeployment(deploymentID string) {
	dm.mu.Lock()
	proc, exists := dm.runningProcs[deploymentID]
	if !exists {
		dm.mu.Unlock()
		return
	}

	// Check if there was recent activity (race condition protection)
	if time.Since(proc.lastActivity) < 5*time.Minute {
		dm.mu.Unlock()
		return
	}

	log.Printf("Deployment %s: stopping due to inactivity", deploymentID)

	// Stop the timer
	if proc.stopTimer != nil {
		proc.stopTimer.Stop()
	}

	// Kill the process
	if proc.cancel != nil {
		proc.cancel()
	}
	if proc.cmd != nil && proc.cmd.Process != nil {
		proc.cmd.Process.Kill()
	}

	// Remove from running processes
	delete(dm.runningProcs, deploymentID)
	dm.mu.Unlock()
}

func (dm *DeployManager) ensureDeploymentRunning(deploymentID string) error {
	dm.mu.RLock()
	_, exists := dm.runningProcs[deploymentID]
	dm.mu.RUnlock()

	if exists {
		// Already running, just update activity
		dm.GetDeploymentPort(deploymentID)
		return nil
	}

	// Need to start it
	deployDir := filepath.Join(dm.baseDir, deploymentID)
	metaPath := filepath.Join(deployDir, ".meta.json")

	data, err := os.ReadFile(metaPath)
	if err != nil {
		return fmt.Errorf("deployment not found")
	}

	var meta DeploymentMeta
	if err := json.Unmarshal(data, &meta); err != nil {
		return fmt.Errorf("invalid deployment metadata")
	}

	log.Printf("Deployment %s: starting on demand", deploymentID)

	// Start the deployment
	go dm.startDeployment(deploymentID, &meta, deployDir)

	// Wait a bit for it to start
	time.Sleep(500 * time.Millisecond)

	return nil
}

func (dm *DeployManager) proxyHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	deploymentID := vars["deploymentId"]
	path := vars["path"]

	// Ensure deployment is running (start if needed)
	if err := dm.ensureDeploymentRunning(deploymentID); err != nil {
		http.Error(w, "Deployment not found", http.StatusNotFound)
		return
	}

	// port, ok := dm.GetDeploymentPort(deploymentID)
	// if !ok {
	// 	http.Error(w, "Deployment not ready", http.StatusServiceUnavailable)
	// 	return
	// }

	// Wait for deployment to be ready
	var port int
	for i := 0; i < 1000; i++ {
		var ok bool
		port, ok = dm.GetDeploymentPort(deploymentID)
		if ok {
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
	if port == 0 {
		http.Error(w, "Deployment not ready", http.StatusServiceUnavailable)
		return
	}

	// Check for WebSocket upgrade
	if websocket.IsWebSocketUpgrade(r) {
		dm.proxyWebSocket(w, r, port, path)
		return
	}

	// Regular HTTP proxy
	target := fmt.Sprintf("http://localhost:%d", port)
	targetURL, _ := url.Parse(target)

	proxy := httputil.NewSingleHostReverseProxy(targetURL)
	proxy.Director = func(req *http.Request) {
		req.URL.Scheme = targetURL.Scheme
		req.URL.Host = targetURL.Host
		req.URL.Path = "/" + path
		req.Host = targetURL.Host
	}

	proxy.ServeHTTP(w, r)
}

func (dm *DeployManager) proxyWebSocket(w http.ResponseWriter, r *http.Request, port int, path string) {
	// Build backend URL
	backendURL := fmt.Sprintf("ws://localhost:%d/%s", port, path)

	// Filter out WebSocket-specific headers that Dial will add automatically
	headers := http.Header{}
	for key, values := range r.Header {
		// Skip WebSocket handshake headers - Dial will add these
		lowerKey := strings.ToLower(key)
		if lowerKey == "upgrade" ||
			lowerKey == "connection" ||
			strings.HasPrefix(lowerKey, "sec-websocket-") {
			continue
		}
		// Copy other headers (like auth tokens, etc.)
		for _, value := range values {
			headers.Add(key, value)
		}
	}

	// Connect to backend with filtered headers
	backendConn, _, err := websocket.DefaultDialer.Dial(backendURL, headers)
	if err != nil {
		http.Error(w, "Failed to connect to backend", http.StatusBadGateway)
		return
	}
	defer backendConn.Close()

	// Upgrade client connection
	clientConn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer clientConn.Close()

	// Proxy messages bidirectionally
	errChan := make(chan error, 2)

	// Client to backend
	go func() {
		for {
			messageType, message, err := clientConn.ReadMessage()
			if err != nil {
				errChan <- err
				return
			}
			if err := backendConn.WriteMessage(messageType, message); err != nil {
				errChan <- err
				return
			}
		}
	}()

	// Backend to client
	go func() {
		for {
			messageType, message, err := backendConn.ReadMessage()
			if err != nil {
				errChan <- err
				return
			}
			if err := clientConn.WriteMessage(messageType, message); err != nil {
				errChan <- err
				return
			}
		}
	}()

	<-errChan
}

func main() {
	baseDir := os.Getenv("DEPLOY_DIR")
	if baseDir == "" {
		baseDir = "./deployments"
	}

	if err := os.MkdirAll(baseDir, 0755); err != nil {
		log.Fatalf("Failed to create base directory: %v", err)
	}

	dm := NewDeployManager(baseDir)

	r := mux.NewRouter()

	// Create deployment
	r.HandleFunc("/deployments", func(w http.ResponseWriter, r *http.Request) {
		var req DeploymentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		deploymentID, err := dm.CreateDeployment(req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]string{
			"id": deploymentID,
		})
	}).Methods("POST")

	// Get deployment status
	r.HandleFunc("/deployments/{deploymentId}", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		deploymentID := vars["deploymentId"]

		port, ok := dm.GetDeploymentPort(deploymentID)

		var status string
		var restartCount int

		if ok {
			status = "running"
			dm.mu.RLock()
			if proc, exists := dm.runningProcs[deploymentID]; exists {
				restartCount = proc.restartCount
			}
			dm.mu.RUnlock()
		} else {
			// Check if deployment exists but is not running
			deployDir := filepath.Join(dm.baseDir, deploymentID)
			if _, err := os.Stat(filepath.Join(deployDir, ".meta.json")); err == nil {
				status = "failed"
			} else {
				http.Error(w, "Deployment not found", http.StatusNotFound)
				return
			}
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"id":           deploymentID,
			"port":         port,
			"status":       status,
			"restartCount": restartCount,
		})
	}).Methods("GET")

	// Health check
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}).Methods("GET")

	// Proxy routes - must be last
	r.HandleFunc("/{deploymentId}/{path:.*}", dm.proxyHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "52000"
	}

	log.Printf("Starting Deno Deploy Service on port %s", port)
	log.Printf("Deployments directory: %s", baseDir)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
