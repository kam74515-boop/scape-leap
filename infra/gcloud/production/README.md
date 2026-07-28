# museart.cloud production deployment

The Taiwan GCE instance serves the static React Router build through Caddy.
The Node API and PostgreSQL 16 are both bound to loopback-only interfaces.
PostgreSQL stores business documents as indexed JSONB and also hosts users,
sessions, roles, reset tokens, portal shares, and immutable audit events.
`pgvector` is enabled for future semantic search and AI retrieval.

`scapeleap-deploy.timer` polls the private GitHub branch every two minutes. A
new revision is installed only after locked dependency installation, tests,
type checks, and the production build all pass. The final static release is
switched atomically.

Rerun the installer after changing Caddy or systemd files so the versioned
infrastructure configuration is copied into `/etc` and revalidated.

## Install on the GCE instance

```bash
sudo infra/gcloud/production/install.sh
```

The first run migrates the existing SQLite business documents into PostgreSQL,
creates an owner account, and prints its one-time bootstrap password. The owner
must change this password after the first login.

Public self-signup is disabled until SMTP/email verification is configured.
Owners create team accounts from `/admin`; every generated temporary password
must be changed at first login.

Public traffic only reaches Caddy on ports 80/443. PostgreSQL and the application
API are not exposed publicly. A compressed PostgreSQL backup runs daily and is
retained for 14 days in `/srv/scapeleap/backups`.

## Operations

```bash
sudo systemctl status caddy postgresql scapeleap-api scapeleap-backup.timer scapeleap-deploy.timer
sudo systemctl start scapeleap-deploy.service
sudo systemctl start scapeleap-backup.service
sudo journalctl -u scapeleap-deploy.service -n 200 --no-pager
sudo journalctl -u scapeleap-api.service -n 100 --no-pager
```
