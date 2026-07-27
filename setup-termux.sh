#!/data/data/com.termux/files/usr/bin/bash

echo "=== Otakudesu Bot Termux Setup ==="

pkg update -y && pkg upgrade -y
pkg install -y nodejs-lts npm git

npm install -g pm2

if [ ! -d "otakudesu-scraper" ]; then
  git clone https://github.com/asagirireika98/otakudesu-scraper.git
fi

cd otakudesu-scraper

npm install

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo ""
  echo "=== Edit .env dan isi token ==="
  echo "nano .env"
  echo ""
  echo "Variable yang perlu diisi:"
  echo "  DISCORD_BOT_TOKEN"
  echo "  DISCORD_CLIENT_ID"
  echo "  DISCORD_GUILD_ID (optional)"
  echo "  DISCORD_NOTIFY_CHANNEL_ID"
  echo ""
  exit 0
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
