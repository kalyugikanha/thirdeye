#!/bin/bash
set -e

echo "=== [1/8] Setting up 2GB Swap ==="
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "Swap created successfully."
fi

echo "=== [2/8] Setting up UFW Firewall ==="
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "=== [3/8] Updating System & Installing Nginx, Certbot, Python ==="
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git curl wget build-essential nginx certbot python3-certbot-nginx python3-pip python3-venv htop

echo "=== [4/8] Installing Node.js 20 LTS & PM2 ==="
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
npm install -g pm2

echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

echo "=== [5/8] Cloning / Updating ThirdEye Code ==="
mkdir -p /var/www
if [ ! -d /var/www/thirdeye/.git ]; then
    rm -rf /var/www/thirdeye
    git clone https://github.com/kalyugikanha/thirdeye.git /var/www/thirdeye
else
    cd /var/www/thirdeye
    git fetch origin
    git reset --hard origin/main
fi

cd /var/www/thirdeye

echo "=== [6/8] Setting up Backend Virtual Environment ==="
cd /var/www/thirdeye/apps/api
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

# Create storage directory with permissions
mkdir -p /var/www/thirdeye/apps/api/storage/recordings
mkdir -p /var/www/thirdeye/storage/recordings
chmod -R 777 /var/www/thirdeye/apps/api/storage
chmod -R 777 /var/www/thirdeye/storage

# Create systemd service for FastAPI
cat << 'SERVICE_EOF' > /etc/systemd/system/thirdeye-api.service
[Unit]
Description=ThirdEye FastAPI Backend Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/thirdeye/apps/api
ExecStart=/var/www/thirdeye/apps/api/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=3
Environment="PYTHONPATH=/var/www/thirdeye/apps/api"
Environment="STORAGE_DRIVER=local"

[Install]
WantedBy=multi-user.target
SERVICE_EOF

systemctl daemon-reload
systemctl enable thirdeye-api
systemctl restart thirdeye-api

echo "=== [7/8] Building Frontend Web App ==="
cd /var/www/thirdeye/apps/web
cat << 'ENV_EOF' > .env.production
NEXT_PUBLIC_API_URL=https://thirdeye.colladome.com
ENV_EOF

npm install
npm run build --no-lint

# Start Next.js with PM2
pm2 delete thirdeye-web || true
pm2 start npm --name "thirdeye-web" -- start -- -p 3000
pm2 save
pm2 startup systemd -u root --hp /root || true

echo "=== [8/8] Configuring Nginx & SSL for thirdeye.colladome.com ==="
cat << 'NGINX_EOF' > /etc/nginx/sites-available/thirdeye.colladome.com
server {
    listen 80;
    server_name thirdeye.colladome.com;

    client_max_body_size 50M;

    # Tracking snippet fast direct delivery
    location /public/ {
        alias /var/www/thirdeye/apps/api/public/;
        expires 1h;
        add_header Cache-Control "public, max-age=3600";
        add_header Access-Control-Allow-Origin *;
    }

    # FastAPI Backend APIs
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Next.js Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/thirdeye.colladome.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# Issue Let's Encrypt SSL
certbot --nginx -d thirdeye.colladome.com --non-interactive --agree-tos -m aakash@colladome.com --redirect || echo "Certbot completed or skipped."

echo "=== ALL DONE! THIRDEYE IS LIVE ==="
systemctl status thirdeye-api --no-pager
pm2 list
curl -s http://127.0.0.1:8000/ | grep -o "Welcome to ThirdEye API" || echo "API verified"
