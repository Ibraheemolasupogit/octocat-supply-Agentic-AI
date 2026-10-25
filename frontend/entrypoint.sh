#!/bin/sh
set -eu

API_HOST=${API_HOST:-api}
API_PORT=${API_PORT:-3000}
export API_HOST API_PORT

envsubst '${API_HOST} ${API_PORT}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

cat > /usr/share/nginx/html/runtime-config.js << EOF
window.RUNTIME_CONFIG = {
  API_URL: ""
};
EOF

exec nginx -g "daemon off;"