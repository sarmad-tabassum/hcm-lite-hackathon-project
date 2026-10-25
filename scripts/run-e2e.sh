#!/bin/bash
# Run dev server + E2E role-portals test in one shot (sandbox kills bg processes between calls)
cd /home/z/my-project
nohup npm run dev > /tmp/next-dev.log 2>&1 &
SRV=$!
READY=0
for i in $(seq 1 40); do
  sleep 2
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login --max-time 5)
  if [ "$code" = "200" ]; then READY=1; echo "server ready (try $i)"; break; fi
done
if [ "$READY" != "1" ]; then echo "SERVER FAILED TO START"; tail -30 /tmp/next-dev.log; kill $SRV 2>/dev/null; exit 1; fi
node scripts/e2e-role-portals.mjs
EXIT=$?
kill $SRV 2>/dev/null
sleep 1
pkill -f "next-server" 2>/dev/null
exit $EXIT
