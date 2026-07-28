# ScapeLeap GCE remote development

## Architecture

1. Develop on the `scapeleap-dev` Compute Engine VM through an IAP-only SSH tunnel.
2. Push a branch to the private GitHub repository with its VM-scoped deploy key.
3. GitHub Actions checks out the immutable pushed commit, runs tests and type checks, builds the web app, and uploads
   `apps/web/build/client` as an artifact named with the commit SHA.

The VM has an external address for package and GitHub egress, but its custom VPC has no public ingress rule. SSH is
allowed only from Google's IAP TCP forwarding range. Web and API ports are reached through `connect.sh`.

## Fixed resources

- GCP project: `project-f76e7635-e511-4c7e-995`
- Region/zone: `asia-east1` / `asia-east1-a` (Taiwan)
- Instance: `scapeleap-dev`
- Machine: `e2-standard-4`
- Disk: 100 GB balanced persistent disk
- Network/subnet: `scapeleap-dev-net` / `scapeleap-dev-tw`

## Connect

```bash
infra/gcloud/remote-dev/connect.sh
```

The tunnel exposes the remote services locally:

- Web: `http://127.0.0.1:3000`
- Admin: `http://127.0.0.1:3001`
- API: `http://127.0.0.1:8000`
- Floor-plan ML: `http://127.0.0.1:8090`

## Develop and build

On the VM:

```bash
cd ~/scape-leap/formscape-app
pnpm dev:local
```

Push the branch only after local checks:

```bash
pnpm --filter=web test
pnpm --filter=web check:types
git push origin HEAD
```

The `Formscape web build` workflow then produces a commit-addressed artifact in GitHub Actions. Builds never use an
uncommitted VM worktree.

## Cost control

Stop the VM when it is not in use:

```bash
gcloud compute instances stop scapeleap-dev \
  --project=project-f76e7635-e511-4c7e-995 \
  --zone=asia-east1-a
```

Start it again before connecting:

```bash
gcloud compute instances start scapeleap-dev \
  --project=project-f76e7635-e511-4c7e-995 \
  --zone=asia-east1-a
```
