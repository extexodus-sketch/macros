#!/bin/bash
# Double-click to open maCros on a Mac. Keep this window open while you use the app.
cd "$(dirname "$0")"
PORT=8760
echo "maCros running at http://localhost:$PORT  (close this window to stop)"
( sleep 1; open "http://localhost:$PORT" ) &
python3 -m http.server $PORT --bind 127.0.0.1
