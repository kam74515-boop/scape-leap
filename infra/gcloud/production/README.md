# museart.cloud production deployment

The Taiwan GCE instance serves the static React Router build through Caddy and
keeps the SQLite mock API bound to `127.0.0.1:8000`.

`scapeleap-deploy.timer` polls the private GitHub branch every two minutes. A
new revision is installed only after locked dependency installation, tests,
type checks, and the production build all pass. The final static release is
switched atomically.

## Install on the GCE instance

```bash
sudo infra/gcloud/production/install.sh
```

The first run prints a generated preview username and password. Only the hash is
stored on the server in `/etc/scapeleap/production.env`.

## Operations

```bash
sudo systemctl status caddy scapeleap-api scapeleap-deploy.timer
sudo systemctl start scapeleap-deploy.service
sudo journalctl -u scapeleap-deploy.service -n 200 --no-pager
sudo journalctl -u scapeleap-api.service -n 100 --no-pager
```
