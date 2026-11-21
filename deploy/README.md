# Deploying to prism.shagato.space

Prism runs on `dev-server` in `~/prism`, as the Docker Compose project `prism`. One domain serves
everything: nginx on the host sends `/api/` and `/ws/` to the Go API (`127.0.0.1:28741`) and the
rest to the Next.js app (`127.0.0.1:28740`). The web app is built with
`NEXT_PUBLIC_API_URL=https://prism.shagato.space`.

## Update

```bash
ssh dev-server
cd ~/prism && git pull
docker compose -f deploy/docker-compose.prod.yml up -d --build
```

`backend/.env` (AI keys) and `data/isharakotha/raw/extracted` (the BdSL word list) are not in git;
copy them to the server with `scp`/`rsync`.

## nginx and TLS (one time, needs sudo)

```bash
sudo cp ~/prism/deploy/nginx/prism.shagato.space.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/prism.shagato.space.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d prism.shagato.space
```

The Cloudflare DNS record for `prism` must point at the server (`156.67.110.215`).
