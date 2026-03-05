#!/usr/bin/env bash

# Get the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load .env from the same directory as the script
ENV_FILE="$SCRIPT_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
  echo "Environment variables loaded from $ENV_FILE"
else
  echo ".env file not found in $SCRIPT_DIR"
  exit 1