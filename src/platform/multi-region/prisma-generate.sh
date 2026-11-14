#!/bin/bash

max_retries=10
attempt=1

while [ $attempt -le $max_retries ]; do
  echo "Attempt $attempt of $max_retries: Running 'bun prisma generate'..."
  
  if bun prisma generate; then
    echo "✅ Prisma generate succeeded on attempt $attempt."
    exit 0
  else
    echo "❌ Prisma generate failed on attempt $attempt."
  fi

  attempt=$((attempt + 1))
  sleep 2
done

echo "🚨 Prisma generate failed after $max_retries attempts."
exit 1
