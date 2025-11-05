#!/bin/bash
set -e

echo "🐍 Python Lambda Build Image v1"
echo "================================"

# Validate environment variables
if [ -z "$ZIP_URL" ]; then
    echo "❌ ERROR: ZIP_URL not set"
    exit 1
fi

if [ -z "$S3_BUCKET" ]; then
    echo "❌ ERROR: S3_BUCKET not set"
    exit 1
fi

if [ -z "$S3_KEY" ]; then
    echo "❌ ERROR: S3_KEY not set"
    exit 1
fi

echo ""
echo "📥 Step 1: Downloading source code..."
echo "   URL: ${ZIP_URL:0:50}..."
curl -f -L "$ZIP_URL" -o source.zip || {
    echo "❌ Failed to download source ZIP"
    exit 1
}
echo "   ✅ Downloaded $(du -h source.zip | cut -f1)"

echo ""
echo "📦 Step 2: Extracting source code..."
unzip -q source.zip || {
    echo "❌ Failed to extract ZIP"
    exit 1
}
rm source.zip

let file_count=$(find . -type f | wc -l)
echo "   ✅ Extracted $file_count files"

echo ""
echo "📋 Step 3: Checking requirements.txt..."
if [ -f "requirements.txt" ]; then
    echo "   ✅ Found requirements.txt"
    echo "   Dependencies:"
    cat requirements.txt | grep -v "^#" | grep -v "^$" | sed 's/^/      /'
else
    echo "   ⚠️  No requirements.txt found, creating minimal one"
    echo "mcp>=1.0.0" > requirements.txt
fi

echo ""
echo "📥 Step 4: Installing Python dependencies..."
echo "   Using: pip install -r requirements.txt -t ."

pip install --no-cache-dir -r requirements.txt -t . || {
    echo "❌ Failed to install dependencies"
    exit 1
}

let installed_packages=$(pip list --format=freeze | wc -l)
echo "   ✅ Installed $installed_packages packages"

echo ""
echo "🧹 Step 5: Cleaning up build artifacts..."
# Remove Python cache (but keep .dist-info for package metadata!)
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true
find . -type f -name "*.pyo" -delete 2>/dev/null || true
find . -type f -name "*.pyd" -delete 2>/dev/null || true

# Remove test directories
find . -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "test" -exec rm -rf {} + 2>/dev/null || true

echo "   ✅ Cleanup complete"

echo ""
echo "📦 Step 6: Creating deployment package..."
# Create deployment ZIP with all files
zip -r -q deployment.zip . -x "*.git*" -x "deployment.zip" || {
    echo "❌ Failed to create deployment ZIP"
    exit 1
}

let zip_size_mb=$(du -m deployment.zip | cut -f1)
echo "   ✅ Created deployment.zip ($(du -h deployment.zip | cut -f1))"

# Check Lambda size limit (50MB compressed, 250MB uncompressed)
if [ $zip_size_mb -gt 50 ]; then
    echo "   ⚠️  WARNING: ZIP size > 50MB, may need Lambda layer"
fi

echo ""
echo "☁️  Step 7: Uploading to S3..."
echo "   Bucket: $S3_BUCKET"
echo "   Key: $S3_KEY"

# Check for local test mode
if [ "$LOCAL_TEST" = "true" ]; then
    echo "   ⚠️  LOCAL_TEST=true - Skipping S3 upload"
    echo "   💾 Deployment package created at: /build/deployment.zip"
    echo "   📊 Package contents:"
    unzip -l deployment.zip | head -20
else
    aws s3 cp deployment.zip "s3://$S3_BUCKET/$S3_KEY" \
        --metadata "build-image=python-lambda-build-v1,python-version=3.12" || {
        echo "❌ Failed to upload to S3"
        exit 1
    }
    
    echo "   ✅ Uploaded successfully"
    echo "   S3 URI: s3://$S3_BUCKET/$S3_KEY"
fi

echo ""
echo "================================"
echo "✅ Build complete!"
echo "================================"
echo ""
echo "📊 Build Summary:"
echo "   • Source files: $file_count"
echo "   • Installed packages: $installed_packages"
echo "   • Deployment size: $(du -h deployment.zip | cut -f1)"
echo "   • S3 location: s3://$S3_BUCKET/$S3_KEY"
echo ""

