#!/bin/sh
# begin at the end by scheduling the shutdown
echo "sudo halt" | at now + 1450 minutes
touch /helloWorld

export MUDGATEWAY_ACCESS_KEY_ID="dummy"
export MUDGATEWAY_SECRET_ACCESS_KEY="dummy"

apt-get update
apt-get remove --purge man-db -y
apt-get install nodejs npm -y
npm install https://github.com/robjcaskey/mudgateway-proxy
node ./node_modules/mudgateway-proxy/mudgateway-proxy.js
