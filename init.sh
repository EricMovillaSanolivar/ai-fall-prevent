#!/bin/bash

# Go to app directory
cd /app

# Execute server in background
echo "Executing server"

gunicorn -b 0.0.0.0:8889 server:app

# Keep alive (DEV ONLY)
# tail -f /dev/null