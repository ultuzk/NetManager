#!/bin/bash
cd /root/test
pkill -f "uvicorn" 2>/dev/null
sleep 1
nohup python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
echo "Backend started PID: $!"
