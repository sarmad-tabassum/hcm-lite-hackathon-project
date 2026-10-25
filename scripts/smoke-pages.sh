#!/bin/bash
# Smoke test: every page compiles (200) + lint clean
cd /home/z/my-project
nohup npm run dev > /tmp/next-dev.log 2>&1 &
SRV=$!
for i in $(seq 1 40); do
  sleep 2
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login --max-time 5)
  if [ "$code" = "200" ]; then echo "server ready (try $i)"; break; fi
done
for p in /login /login/admin /login/hr /login/employee /signup /setup /pending /dashboard /portal /employees /attendance /leave /payroll /org /assistant /audit /settings; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$p" --max-time 30)
  echo "$p -> $code"
done
kill $SRV 2>/dev/null
sleep 1
pkill -f "next-server" 2>/dev/null
echo "---- lint ----"
npx eslint src --no-error-on-unmatched-pattern 2>&1 | tail -5
echo "lint exit: $?"
