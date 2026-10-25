# Azure deployment

## Prepared architecture

The prepared deployment uses Azure Container Apps Consumption for a public frontend and a private API, with a single Container Apps environment. The frontend's Nginx server reverse-proxies `/api/*` and API documentation requests over the environment's internal network, so the API does not need public ingress. Container images are published to GHCR; no Azure Container Registry is provisioned.

The API database is SQLite. The Bicep template creates a Standard LRS StorageV2 account and a 1 GiB SMB Azure Files share, mounts it at `/app/data`, and sets `DB_FILE=/app/data/app.db`. The API is constrained to one replica and single active revision, and `DB_ENABLE_WAL=false` avoids SQLite WAL sidecar files on a network-mounted share. The Docker Compose configuration uses a named volume and the same rollback-journal setting.

**SQLite/Azure Files is intended only for this low-traffic rehearsal.** A single writer and one active replica are required; the SMB-backed filesystem adds latency and does not provide database-service guarantees. This is not a highly available or production-grade database design. Back up the share before testing destructive operations and keep a separate copy of data that must survive resource-group deletion. Move to a managed relational database or another supported persistence design before scaling or relying on production data.

The Container Apps environment sends container logs to a Log Analytics workspace with 30-day retention. Both apps use scale-to-zero and at most one replica to avoid idle compute charges. Azure Files, Log Analytics ingestion, Container Apps resource usage, and network egress can still incur charges.

## GitHub Actions

- `ci.yml` runs API and frontend dependency audits, lint/build/tests, and Chromium E2E on GitHub-hosted Ubuntu. The E2E job installs the Playwright-managed Chromium build on the runner.
- `build-and-publish.yml` builds immutable `sha-<full-commit-hash>` API and frontend images only after the CI workflow succeeds for a push to `main`.
- `deploy.yml` is manual-only, restricted to the `main` branch, uses Azure OIDC, and targets a `production` GitHub Environment. Configure that Environment with required reviewers before enabling deployment.

Before a deployment is possible, a repository administrator must:

1. Create a dedicated resource group in the agreed region and confirm provider registration, quota, policy, and permission availability.
2. Configure an Entra workload identity federated credential for this repository's `production` GitHub Environment.
3. Grant that identity **Contributor only on the dedicated resource group**. No role assignment is created by the Bicep template. A separate administrator must create the group and grant access; subscription-wide Contributor is not needed by the workflow.
4. Add these GitHub repository **variables** (not client secrets): `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `AZURE_LOCATION`, and `AZURE_APP_PREFIX`.
5. Set the two GHCR packages (`<repository>-api` and `<repository>-frontend`) to public so Container Apps can pull the images without registry credentials. Confirm this visibility decision before publishing images.

The workflow does not store an Azure client secret. Container Apps uses the Storage account key to mount Azure Files; the key is obtained during the Bicep deployment and is not emitted as a deployment output or GitHub variable. The storage account is dedicated to this share to limit the key's data scope. Resource-group Contributor can retrieve resource keys, so keep the deployment identity and resource group narrowly scoped.

Microsoft currently documents Azure Files SMB managed-identity authentication for Container Apps as a preview. It requires enabling SMB identity authentication on the storage account and assigning the environment identity the **Storage File Data SMB MI Admin** role at storage-account scope (`roleAssignments/write`). The template uses the supported account-key mount instead; switching to managed identity would require explicit IAM approval and deployment validation.

## Dependency security

The API and frontend production dependency audit checks are configured in CI. Compatible upgrades removed the reported production advisories and the API build-tool glob-matcher advisory. Three moderate development-only advisories remain in the Tailwind CSS 3/PostCSS toolchain; npm only offers a fix by moving to Tailwind CSS 4, a breaking major upgrade that is intentionally not applied without a migration and visual regression review. CI fails on high or critical findings.

The existing repository tracks PEM private-key material at `api/ca.key`. It is not used by the application and is excluded from the API Docker build context, but it remains in Git history. Treat it as exposed: do not push or deploy until its owner confirms it is disposable or rotates it and arranges appropriate history cleanup.

## Deployment commands

The following commands are **instructions only**; they have not been run. Review the exact subscription, resource group, region, image tag, costs, and access requirements and obtain approval before running provisioning commands or configuring repository settings.

Read-only Azure account inspection:

```sh
az login
az account show --output table
az account list --output table
```

After the resource group, OIDC identity, required GitHub variables, GHCR package visibility, and protected `production` Environment are approved and configured, publish an image pair from `main` and dispatch deployment with the matching SHA tag:

```sh
gh run list --workflow "Build and publish container images"
gh workflow run deploy.yml --ref main --field image_tag=sha-<full-40-character-commit-hash>
```

The deploy workflow creates the Container Apps environment, workspace, storage account/share, API, and frontend in the dedicated group. The workflow summary reports the public frontend URL and internal API ingress. Post-deployment checks exercise frontend health, the product endpoint, cart creation, a persisted cart read, and item removal.

## Verification, recovery, and teardown

Before serving real data, test create/update/remove and persistence through an API revision restart, and arrange regular backups of the Azure Files share. The automated smoke test confirms persistence across requests but does not prove persistence across an Azure restart or backup recovery.

To remove a deployment, first export any data that must be retained. Then, after confirming the resource group contains only this rehearsal's resources, an authorized operator can remove the whole group:

```sh
az group delete --name <dedicated-resource-group> --yes --no-wait
```

Resource-group deletion also deletes the SQLite share, logs, and all other resources in that group.
