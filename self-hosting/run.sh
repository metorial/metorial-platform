#!/bin/bash

# Metorial - Complete Self-Hosting Script
# This script builds frontends, starts backend services, and serves the applications

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "\n${CYAN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}\n"
}

print_step() {
    echo -e "${BLUE}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

# Display usage information
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Complete self-hosting solution for Metorial - builds frontends, starts backend, and serves applications.

This script will:
  1. Build the Dashboard and MCP Inspector frontends
  2. Start all backend services using Docker Compose
  3. Serve the frontend applications using a simple web server

OPTIONS:
    -h, --host HOST          The hostname for your deployment (required)
                            Example: localhost, mydomain.com, or 192.168.1.100
    
    -s, --secret SECRET     Secret key for encryption and auth (required)
                            Generate one with: openssl rand -hex 32
    
    -e, --env ENV           Environment (default: production)
                            Options: development, production
    
    --email-host HOST       Email SMTP host (optional)
    --email-port PORT       Email SMTP port (optional, default: 587)
    --email-secure BOOL     Email SMTP secure (optional, default: true)
    --email-user USER       Email SMTP username (optional)
    --email-pass PASS       Email SMTP password (optional)
    --email-from EMAIL      Email from address (optional)
    --email-from-name NAME  Email from name (optional, default: Metorial)
    
    --skip-build            Skip frontend build (use existing build)
    --skip-backend          Skip backend startup (only build frontend)
    --skip-serve            Skip starting web servers (only build and start backend)
    
    --stop                  Stop all services (backend and web servers)
    --logs                  Show logs from backend services
    --status                Show status of all services
    
    --help                  Display this help message

EXAMPLES:
    # Complete setup with minimal configuration
    $0 --host localhost --secret \$(openssl rand -hex 32)
    
    # Production setup with custom domain
    $0 --host mydomain.com --secret \$(openssl rand -hex 32) --env production
    
    # With email configuration
    $0 --host mydomain.com --secret mysecret123 \\
       --email-host smtp.gmail.com --email-user user@gmail.com \\
       --email-pass "app-password" --email-from user@gmail.com
    
    # Only build frontend (skip backend)
    $0 --host localhost --secret dummy --skip-backend
    
    # Stop all services
    $0 --stop
    
    # View backend logs
    $0 --logs
    
    # Check service status
    $0 --status

ENVIRONMENT VARIABLES:
    You can also set configuration via environment variables:
    export METORIAL_HOST=localhost
    export METORIAL_SECRET=\$(openssl rand -hex 32)
    $0

EOF
    exit 0
}

# Parse command line arguments
METORIAL_HOST="${METORIAL_HOST:-}"
METORIAL_SECRET="${METORIAL_SECRET:-}"
METORIAL_BUILD_ENV="production"
EMAIL_HOST="${EMAIL_HOST:-}"
EMAIL_PORT="${EMAIL_PORT:-587}"
EMAIL_SECURE="${EMAIL_SECURE:-true}"
EMAIL_USER="${EMAIL_USER:-}"
EMAIL_PASS="${EMAIL_PASS:-}"
EMAIL_FROM="${EMAIL_FROM:-}"
EMAIL_FROM_NAME="${EMAIL_FROM_NAME:-Metorial}"
SKIP_BUILD=false
SKIP_BACKEND=false
SKIP_SERVE=false
ACTION="deploy"

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--host)
            METORIAL_HOST="$2"
            shift 2
            ;;
        -s|--secret)
            METORIAL_SECRET="$2"
            shift 2
            ;;
        -e|--env)
            METORIAL_BUILD_ENV="$2"
            shift 2
            ;;
        --email-host)
            EMAIL_HOST="$2"
            shift 2
            ;;
        --email-port)
            EMAIL_PORT="$2"
            shift 2
            ;;
        --email-secure)
            EMAIL_SECURE="$2"
            shift 2
            ;;
        --email-user)
            EMAIL_USER="$2"
            shift 2
            ;;
        --email-pass)
            EMAIL_PASS="$2"
            shift 2
            ;;
        --email-from)
            EMAIL_FROM="$2"
            shift 2
            ;;
        --email-from-name)
            EMAIL_FROM_NAME="$2"
            shift 2
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-backend)
            SKIP_BACKEND=true
            shift
            ;;
        --skip-serve)
            SKIP_SERVE=true
            shift
            ;;
        --stop)
            ACTION="stop"
            shift
            ;;
        --logs)
            ACTION="logs"
            shift
            ;;
        --status)
            ACTION="status"
            shift
            ;;
        --help)
            usage
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Project paths
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
ENV_FILE="$SCRIPT_DIR/.env"
PIDS_FILE="$SCRIPT_DIR/.server_pids"

# Find repository root
REPO_ROOT="$SCRIPT_DIR"
while [ ! -d "$REPO_ROOT/src/frontend/apps/dashboard" ] && [ "$REPO_ROOT" != "/" ]; do
    REPO_ROOT="$(dirname "$REPO_ROOT")"
done

if [ "$REPO_ROOT" = "/" ]; then
    print_error "Could not find repository root with src/frontend/apps/dashboard"
    exit 1
fi

FRONTEND_DIR="$REPO_ROOT/src/frontend/apps/dashboard"
BUILD_OUTPUT_DIR="$FRONTEND_DIR/dist"
INSPECTOR_DIR="$REPO_ROOT/vendor/mcp-inspector"
INSPECTOR_BUILD_OUTPUT_DIR="$INSPECTOR_DIR/dist"
SELF_HOSTING_DIR="$REPO_ROOT/self-hosting"
FINAL_OUTPUT_DIR="$SELF_HOSTING_DIR/output/dashboard"
FINAL_INSPECTOR_OUTPUT_DIR="$SELF_HOSTING_DIR/output/inspector"

# Handle stop action
if [ "$ACTION" = "stop" ]; then
    print_header "STOPPING ALL SERVICES"
    
    # Stop web servers
    if [ -f "$PIDS_FILE" ]; then
        print_step "Stopping web servers..."
        while IFS= read -r pid; do
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid" 2>/dev/null || true
            fi
        done < "$PIDS_FILE"
        rm -f "$PIDS_FILE"
        print_success "Web servers stopped"
    fi
    
    # Stop Docker services
    if [ -f "$COMPOSE_FILE" ]; then
        print_step "Stopping backend services..."
        docker compose -f "$COMPOSE_FILE" down
        print_success "Backend services stopped"
    fi
    
    print_success "All services stopped"
    exit 0
fi

# Handle logs action
if [ "$ACTION" = "logs" ]; then
    print_step "Showing backend logs (press Ctrl+C to exit)..."
    if [ -f "$COMPOSE_FILE" ]; then
        docker compose -f "$COMPOSE_FILE" logs -f
    else
        print_error "docker-compose.yml not found"
        exit 1
    fi
    exit 0
fi

# Handle status action
if [ "$ACTION" = "status" ]; then
    print_header "SERVICE STATUS"
    
    # Check backend services
    if [ -f "$COMPOSE_FILE" ]; then
        print_step "Backend services:"
        docker compose -f "$COMPOSE_FILE" ps
    fi
    
    # Check web servers
    echo ""
    print_step "Web servers:"
    if [ -f "$PIDS_FILE" ]; then
        while IFS= read -r pid; do
            if kill -0 "$pid" 2>/dev/null; then
                print_success "Process $pid is running"
            else
                print_warning "Process $pid is not running"
            fi
        done < "$PIDS_FILE"
    else
        print_warning "No web server PIDs found"
    fi
    
    exit 0
fi

# Validate required parameters for deployment
if [ -z "$METORIAL_HOST" ]; then
    print_error "Host is required!"
    echo ""
    echo "Please provide a host using one of these methods:"
    echo "  1. Command line: $0 --host localhost --secret YOUR_SECRET"
    echo "  2. Environment variable: export METORIAL_HOST=localhost"
    echo ""
    echo "Use --help for more information"
    exit 1
fi

if [ -z "$METORIAL_SECRET" ] && [ "$SKIP_BACKEND" = false ]; then
    print_error "Secret is required!"
    echo ""
    echo "Please provide a secret key using one of these methods:"
    echo "  1. Command line: $0 --host localhost --secret \$(openssl rand -hex 32)"
    echo "  2. Environment variable: export METORIAL_SECRET=\$(openssl rand -hex 32)"
    echo ""
    echo "You can generate a secure secret with: openssl rand -hex 32"
    echo ""
    echo "Use --help for more information"
    exit 1
fi

# Validate environment
if [[ ! "$METORIAL_BUILD_ENV" =~ ^(development|production)$ ]]; then
    print_error "Invalid environment: $METORIAL_BUILD_ENV"
    echo "Valid options: development, production"
    exit 1
fi

# Set source to OSS (always)
METORIAL_SOURCE_TYPE="oss"
IS_ENTERPRISE="false"

# Set protocol based on environment
PROTOCOL="http"
if [ "$METORIAL_BUILD_ENV" = "production" ]; then
    PROTOCOL="https"
fi

print_header "METORIAL SELF-HOSTING DEPLOYMENT"

print_info "Configuration:"
echo "  Host:        $METORIAL_HOST"
echo "  Environment: $METORIAL_BUILD_ENV"
echo "  Source:      $METORIAL_SOURCE_TYPE"
echo "  Protocol:    $PROTOCOL"
if [ -n "$METORIAL_SECRET" ]; then
    echo "  Secret:      ${METORIAL_SECRET:0:10}... (hidden)"
fi
if [ -n "$EMAIL_HOST" ]; then
    echo "  Email Host:  $EMAIL_HOST"
fi
echo ""

print_info "Actions:"
echo "  Build Frontend:  $([ "$SKIP_BUILD" = true ] && echo "❌ Skipped" || echo "✅ Enabled")"
echo "  Start Backend:   $([ "$SKIP_BACKEND" = true ] && echo "❌ Skipped" || echo "✅ Enabled")"
echo "  Serve Frontend:  $([ "$SKIP_SERVE" = true ] && echo "❌ Skipped" || echo "✅ Enabled")"
echo ""

#############################################
# STEP 1: BUILD FRONTENDS
#############################################

if [ "$SKIP_BUILD" = false ]; then
    print_header "STEP 1: BUILD FRONTEND APPLICATIONS"
    
    # Check project structure
    print_step "Checking project structure..."
    if [ ! -d "$FRONTEND_DIR" ]; then
        print_error "Dashboard directory not found at: $FRONTEND_DIR"
        exit 1
    fi
    print_success "Dashboard directory found"
    
    if [ ! -d "$INSPECTOR_DIR" ]; then
        print_error "Inspector directory not found at: $INSPECTOR_DIR"
        exit 1
    fi
    print_success "Inspector directory found"
    
    # Check for Node.js
    print_step "Checking for Node.js..."
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed!"
        echo "Please install Node.js (v18 or higher recommended)"
        exit 1
    fi
    NODE_VERSION=$(node --version)
    print_success "Node.js $NODE_VERSION detected"
    
    # Check for npm
    print_step "Checking for npm..."
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed!"
        exit 1
    fi
    NPM_VERSION=$(npm --version)
    print_success "npm $NPM_VERSION detected"
    
    # Check for bun
    print_step "Checking for Bun..."
    if ! command -v bun &> /dev/null; then
        print_error "Bun is not installed!"
        echo "Please install Bun: curl -fsSL https://bun.sh/install | bash"
        exit 1
    fi
    BUN_VERSION=$(bun --version)
    print_success "Bun v$BUN_VERSION detected"
    
    # Install dashboard dependencies
    cd "$FRONTEND_DIR"
    if [ ! -d "node_modules" ]; then
        print_step "Installing dashboard dependencies..."
        if npm install; then
            print_success "Dashboard dependencies installed"
        else
            print_error "Failed to install dashboard dependencies"
            exit 1
        fi
    else
        print_info "Dashboard dependencies already installed"
    fi
    
    # Install inspector dependencies
    cd "$INSPECTOR_DIR"
    if [ ! -d "node_modules" ]; then
        print_step "Installing inspector dependencies..."
        if npm install; then
            print_success "Inspector dependencies installed"
        else
            print_error "Failed to install inspector dependencies"
            exit 1
        fi
    else
        print_info "Inspector dependencies already installed"
    fi
    
    # Run prerequisite commands at repository root
    print_header "RUNNING PREREQUISITE BUILD STEPS"
    
    cd "$REPO_ROOT"
    
    print_step "Running prisma:generate at repository root..."
    print_info "Location: $REPO_ROOT"
    echo ""
    if bun run prisma:generate; then
        echo ""
        print_success "Prisma client generated successfully"
    else
        echo ""
        print_error "Prisma generation failed!"
        print_info "Make sure your database connection is configured correctly"
        exit 1
    fi
    
    print_step "Running root build (this may take a while)..."
    print_info "Location: $REPO_ROOT"
    echo ""
    if bun run build; then
        echo ""
        print_success "Root build completed successfully"
    else
        echo ""
        print_error "Root build failed!"
        print_info "Check the error messages above for details"
        exit 1
    fi
    
    # Set environment variables for build
    export METORIAL_ENV="$METORIAL_BUILD_ENV"
    export METORIAL_SOURCE="$METORIAL_SOURCE_TYPE"
    export IS_ENTERPRISE="$IS_ENTERPRISE"
    export METORIAL_HOSTNAME="$METORIAL_HOST"
    export NODE_ENV="$METORIAL_BUILD_ENV"
    export VITE_METORIAL_ENV="$METORIAL_BUILD_ENV"
    export VITE_EXPLORER_URL="${PROTOCOL}://${METORIAL_HOST}:6050"
    export VITE_MCP_API_URL="${PROTOCOL}://${METORIAL_HOST}:4311"
    export VITE_CORE_API_URL="${PROTOCOL}://${METORIAL_HOST}:4310"
    export VITE_PRIVATE_API_URL="${PROTOCOL}://${METORIAL_HOST}:4314"
    export VITE_CODE_EDITOR_URL="${PROTOCOL}://${METORIAL_HOST}:3302"
    export VITE_CODE_BUCKET_API_URL="${PROTOCOL}://${METORIAL_HOST}:4040"
    
    # Build Dashboard
    print_step "Building dashboard application..."
    cd "$FRONTEND_DIR"
    [ -d "$BUILD_OUTPUT_DIR" ] && rm -rf "$BUILD_OUTPUT_DIR"
    
    echo ""
    if npm run frontend:build; then
        echo ""
        print_success "Dashboard built successfully"
    else
        echo ""
        print_error "Dashboard build failed!"
        print_info "Check the error messages above for details"
        exit 1
    fi
    
    # Build Inspector
    print_step "Building inspector application..."
    cd "$INSPECTOR_DIR"
    [ -d "$INSPECTOR_BUILD_OUTPUT_DIR" ] && rm -rf "$INSPECTOR_BUILD_OUTPUT_DIR"
    
    echo ""
    if npm run frontend:build; then
        echo ""
        print_success "Inspector built successfully"
    else
        echo ""
        print_error "Inspector build failed!"
        print_info "Check the error messages above for details"
        exit 1
    fi
    
    # Copy builds to output directory
    print_step "Copying builds to output directory..."
    mkdir -p "$FINAL_OUTPUT_DIR"
    mkdir -p "$FINAL_INSPECTOR_OUTPUT_DIR"
    
    if [ -d "$BUILD_OUTPUT_DIR" ] && [ "$(ls -A $BUILD_OUTPUT_DIR)" ]; then
        cp -r "$BUILD_OUTPUT_DIR"/* "$FINAL_OUTPUT_DIR/"
        print_success "Dashboard copied to output"
    else
        print_error "Dashboard build is empty"
        exit 1
    fi
    
    if [ -d "$INSPECTOR_BUILD_OUTPUT_DIR" ] && [ "$(ls -A $INSPECTOR_BUILD_OUTPUT_DIR)" ]; then
        cp -r "$INSPECTOR_BUILD_OUTPUT_DIR"/* "$FINAL_INSPECTOR_OUTPUT_DIR/"
        print_success "Inspector copied to output"
    else
        print_error "Inspector build is empty"
        exit 1
    fi
    
    DASHBOARD_SIZE=$(du -sh "$FINAL_OUTPUT_DIR" | cut -f1)
    INSPECTOR_SIZE=$(du -sh "$FINAL_INSPECTOR_OUTPUT_DIR" | cut -f1)
    print_info "Dashboard: $DASHBOARD_SIZE"
    print_info "Inspector: $INSPECTOR_SIZE"
    
else
    print_header "STEP 1: BUILD FRONTEND APPLICATIONS [SKIPPED]"
    print_warning "Using existing builds from output directory"
fi

#############################################
# STEP 2: START BACKEND SERVICES
#############################################

if [ "$SKIP_BACKEND" = false ]; then
    print_header "STEP 2: START BACKEND SERVICES"
    
    # Check for Docker
    print_step "Checking for Docker..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed!"
        echo "Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    print_success "$(docker --version)"
    
    # Check for Docker Compose
    print_step "Checking for Docker Compose..."
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available!"
        exit 1
    fi
    print_success "$(docker compose version)"
    
    # Check Docker daemon
    print_step "Checking Docker daemon..."
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running!"
        exit 1
    fi
    print_success "Docker daemon is running"
    
    # Check for docker-compose.yml
    if [ ! -f "$COMPOSE_FILE" ]; then
        print_error "docker-compose.yml not found at: $COMPOSE_FILE"
        exit 1
    fi
    
    # Create .env file
    print_step "Creating environment configuration..."
    cat > "$ENV_FILE" << EOF
# Metorial Backend Configuration
# Generated on $(date)

HOST=$METORIAL_HOST
SECRET=$METORIAL_SECRET
EMAIL_HOST=$EMAIL_HOST
EMAIL_PORT=$EMAIL_PORT
EMAIL_SECURE=$EMAIL_SECURE
EMAIL_USER=$EMAIL_USER
EMAIL_PASS=$EMAIL_PASS
EMAIL_FROM=$EMAIL_FROM
EMAIL_FROM_NAME=$EMAIL_FROM_NAME
EOF
    print_success "Environment configured"
    
    # Pull images
    print_step "Pulling Docker images (this may take a few minutes)..."
    if docker compose -f "$COMPOSE_FILE" pull 2>&1 | tee /tmp/docker_pull.log; then
        print_success "Images pulled successfully"
    else
        # Check if it's just some optional images that failed
        if grep -q "manifest unknown" /tmp/docker_pull.log; then
            print_warning "Some images could not be pulled (possibly private/unavailable)"
            print_info "Attempting to continue with available images..."
        else
            print_error "Failed to pull required images"
            cat /tmp/docker_pull.log
            exit 1
        fi
    fi
    rm -f /tmp/docker_pull.log
    
    # Start services
    print_step "Starting backend services..."
    if docker compose -f "$COMPOSE_FILE" up -d 2>&1 | tee /tmp/docker_up.log; then
        print_success "Backend services started"
    else
        print_error "Failed to start backend services"
        echo ""
        print_info "Error details:"
        cat /tmp/docker_up.log
        echo ""
        
        # Check if it's an image availability issue
        if grep -q "manifest unknown\|pull access denied" /tmp/docker_up.log; then
            print_warning "Some Docker images are not available"
            print_info "This might be because:"
            echo "  • The 'engine' image might be private or not yet published"
            echo "  • You may need to authenticate with: docker login ghcr.io"
            echo "  • Some images might not exist for your architecture"
            echo ""
            print_info "You can:"
            echo "  1. Comment out unavailable services in docker-compose.yml"
            echo "  2. Authenticate with the registry if you have access"
            echo "  3. Continue without those services (some features may not work)"
        fi
        
        rm -f /tmp/docker_up.log
        exit 1
    fi
    rm -f /tmp/docker_up.log
    
    # Wait for services
    print_step "Waiting for services to initialize..."
    sleep 5
    print_success "Services are starting up"
    
else
    print_header "STEP 2: START BACKEND SERVICES [SKIPPED]"
fi

#############################################
# STEP 3: SERVE FRONTEND APPLICATIONS
#############################################

if [ "$SKIP_SERVE" = false ]; then
    print_header "STEP 3: SERVE FRONTEND APPLICATIONS"
    
    # Check for Python
    print_step "Checking for Python..."
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
        print_success "$(python3 --version) detected"
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
        print_success "$(python --version) detected"
    else
        print_error "Python is not installed!"
        echo "Please install Python 3 to serve the applications"
        exit 1
    fi
    
    # Check if ports are available
    check_port() {
        if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
            return 1
        fi
        return 0
    }
    
    # Stop any existing servers
    if [ -f "$PIDS_FILE" ]; then
        print_step "Stopping existing web servers..."
        while IFS= read -r pid; do
            kill "$pid" 2>/dev/null || true
        done < "$PIDS_FILE"
        rm -f "$PIDS_FILE"
    fi
    
    # Start Dashboard server
    print_step "Starting dashboard server on port 3300..."
    cd "$FINAL_OUTPUT_DIR"
    $PYTHON_CMD -m http.server 3300 > /dev/null 2>&1 &
    DASHBOARD_PID=$!
    echo $DASHBOARD_PID >> "$PIDS_FILE"
    sleep 1
    
    if kill -0 $DASHBOARD_PID 2>/dev/null; then
        print_success "Dashboard server running (PID: $DASHBOARD_PID)"
    else
        print_error "Failed to start dashboard server"
        exit 1
    fi
    
    # Start Inspector server
    print_step "Starting inspector server on port 6050..."
    cd "$FINAL_INSPECTOR_OUTPUT_DIR"
    $PYTHON_CMD -m http.server 6050 > /dev/null 2>&1 &
    INSPECTOR_PID=$!
    echo $INSPECTOR_PID >> "$PIDS_FILE"
    sleep 1
    
    if kill -0 $INSPECTOR_PID 2>/dev/null; then
        print_success "Inspector server running (PID: $INSPECTOR_PID)"
    else
        print_error "Failed to start inspector server"
        exit 1
    fi
    
else
    print_header "STEP 3: SERVE FRONTEND APPLICATIONS [SKIPPED]"
fi

#############################################
# DEPLOYMENT COMPLETE
#############################################

print_header "🎉 DEPLOYMENT COMPLETE!"

echo -e "${GREEN}✓${NC} Metorial is now running on your system!"
echo ""
echo -e "${CYAN}Frontend Applications:${NC}"
echo "  • Dashboard:  ${PROTOCOL}://${METORIAL_HOST}:3300"
echo "  • Inspector:  ${PROTOCOL}://${METORIAL_HOST}:6050"
echo ""
echo -e "${CYAN}Backend API Endpoints:${NC}"
echo "  • Core API:          ${PROTOCOL}://${METORIAL_HOST}:4310"
echo "  • MCP API:           ${PROTOCOL}://${METORIAL_HOST}:4311"
echo "  • Marketplace:       ${PROTOCOL}://${METORIAL_HOST}:4312"
echo "  • OAuth:             ${PROTOCOL}://${METORIAL_HOST}:4313"
echo "  • Private API:       ${PROTOCOL}://${METORIAL_HOST}:4314"
echo "  • Portals:           ${PROTOCOL}://${METORIAL_HOST}:4315"
echo "  • Integrations API:  ${PROTOCOL}://${METORIAL_HOST}:4316"
echo "  • ID API:            ${PROTOCOL}://${METORIAL_HOST}:4321"
echo "  • MCP Engine:        ${PROTOCOL}://${METORIAL_HOST}:50050"
echo ""
echo -e "${CYAN}Database Services:${NC}"
echo "  • PostgreSQL:     localhost:35432 (user: postgres, pass: postgres)"
echo "  • MongoDB:        localhost:32707 (user: mongo, pass: mongo)"
echo "  • Redis:          localhost:36379"
echo "  • Meilisearch:    localhost:37700"
echo "  • OpenSearch:     localhost:9200 (user: admin, pass: admin)"
echo "  • MinIO:          localhost:9000 (user: minio, pass: minio123)"
echo "  • MinIO Console:  localhost:9001"
echo ""
echo -e "${CYAN}Management Commands:${NC}"
echo "  • View logs:      $0 --logs"
echo "  • Check status:   $0 --status"
echo "  • Stop all:       $0 --stop"
echo "  • Restart:        $0 --host $METORIAL_HOST --secret [SECRET]"
echo ""
echo -e "${CYAN}Data Storage:${NC}"
echo "  All persistent data is stored in: $SCRIPT_DIR/_volumes/"
echo "  To reset everything, stop services and delete this directory."
echo ""
echo -e "${YELLOW}Note:${NC} Backend services may take 1-2 minutes to fully initialize."
echo "      If you encounter errors, wait a moment and refresh your browser."
echo ""
print_info "Ready to use! Open ${PROTOCOL}://${METORIAL_HOST}:3300 in your browser."
echo ""

exit 0