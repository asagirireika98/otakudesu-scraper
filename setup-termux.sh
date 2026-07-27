#!/data/data/com.termux/files/usr/bin/bash

echo "=== Otakudesu Bot Termux Setup ==="

pkg update -y && pkg upgrade -y
pkg install -y nodejs-lts npm git

npm install -g pm2

if [ ! -d "otakudesu-scraper" ]; then
  git clone https://github.com/asagirireika98/otakudesu-scraper.git
fi

cd otakudesu-scraper

git pull

npm install

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo ""
  echo "=== Edit .env dan isi semua variable ==="
  echo "nano .env"
  echo ""
  echo "Variable yang WAJIB diisi:"
  echo "  GH_PAT                  - GitHub Personal Access Token"
  echo "  GIST_ID                 - ID Gist (874047cb9237951aca2bb5befa3e791f)"
  echo "  DISCORD_BOT_TOKEN       - Token bot dari Discord Developer Portal"
  echo "  DISCORD_CLIENT_ID       - Application ID dari General Information"
  echo ""
  echo "Variable OPSIONAL:"
  echo "  DISCORD_GUILD_ID        - ID server (biar command cepet propagate)"
  echo "  DISCORD_NOTIFY_CHANNEL_ID - Channel untuk notif episode baru"
  echo "  DISCORD_WEBHOOK_URL     - Webhook URL (untuk scraper notification)"
  echo ""
  exit 0
fi

# Validate required vars
source .env
missing=()
[ -z "$GH_PAT" ] && missing+=("GH_PAT")
[ -z "$GIST_ID" ] && missing+=("GIST_ID")
[ -z "$DISCORD_BOT_TOKEN" ] && missing+=("DISCORD_BOT_TOKEN")
[ -z "$DISCORD_CLIENT_ID" ] && missing+=("DISCORD_CLIENT_ID")

if [ ${#missing[@]} -gt 0 ]; then
  echo ""
  echo "=== ERROR: Missing required variables ==="
  for v in "${missing[@]}"; do
    echo "  - $v"
  done
  echo ""
  echo "Edit .env: nano .env"
  exit 1
fi

pm2 delete otakudesu-bot 2>/dev/null
pm2 start "npm run bot" --name otakudesu-bot
pm2 save

pm2 startup 2>/dev/null

echo ""
echo "=== Bot running! ==="
echo "  pm2 status       - cek status"
echo "  pm2 logs         - lihat log"
echo "  pm2 restart all  - restart bot"
echo "  pm2 stop all     - stop bot"
echo ""
