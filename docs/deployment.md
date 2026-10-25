# Azure deployment

## Prepared architecture

The prepared deployment uses Azure Container Apps Consumption for a public frontend and a private API, with a single Container Apps environment. The frontend's Nginx server reverse-proxies `/api/*` and API documentation requests over the environment's internal network, so the API does not need public ingress. Container images are published to GHCR; no Azure Container Registry is provisioned.

The API database is SQLite. The Bicep template sets `DB_FILE=/app/data/app.db` and mounts a replica-scoped `EmptyDir` at `/app/data`; it does not mount Azure Files. The API uses one active revision and exactly one replica (`minReplicas: 1`, `maxReplicas: 1`) so it does not scale to zero. `DB_ENABLE_WAL=false` keeps SQLite in its default journal mode. The Docker Compose configuration uses a named volume and the same setting.

**SQLite on `EmptyDir` is a temporary rehearsal workaround, not durable persistence.** It avoids SQLite locking over SMB, and cart data remains available through requests and container restarts within the same replica. The database is lost if Container Apps replaces the replica, scales it in, or deploys a new revision. The minimum replica of one also means continuous idle compute charges; the prior UK South estimate was approximately **$7.80/month** for 0.25 vCPU/0.5 GiB, before credits, tax, and active-use charges. Verify current pricing before deployment. Use a managed relational database or another durable supported design before relying on production data.

The Bicep template still declares the existing StorageV2 account, Azure Files share, and Container Apps storage mapping, but the API no longer mounts that share. This change does not delete, inspect, back up, or migrate any existing share contents. The share could contain the previous SQLite database or other data; review and preserve it under separate approval before any future cleanup or migration. Data in the share is not visible to the API using the new `EmptyDir`.

The Container Apps environment sends container logs to a Log Analytics workspace with 30-day retention. The frontend retains scale-to-zero; the API remains at one replica to keep its replica-scoped database available, at ongoing compute cost. Azure Files, Log Analytics ingestion, Container Apps resource usage, and network egress can also incur charges.

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

The workflow does not store an Azure client secret. The retained Container Apps Azure Files storage mapping uses the Storage account key; the key is obtained during Bicep deployment and is not emitted as a deployment output or GitHub variable. The API does not mount this mapping after the EmptyDir change. The storage account is dedicated to the share to limit the key's data scope. Resource-group Contributor can retrieve resource keys, so keep the deployment identity and resource group narrowly scoped.

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

The deploy workflow creates the Container Apps environment, workspace, storage account/share, API, and frontend in the dedicated group. The workflow summary reports the public frontend URL and internal API ingress. Post-deployment checks exercise frontend health, the product endpoint, cart creation, a cart read, and item removal; they do not verify durability across a replica replacement or new revision.

## Verification, recovery, and teardown

Before deployment, determine whether the existing Azure Files share contains data and obtain separate approval before inspecting, exporting, or changing it. With EmptyDir, verify create/update/remove and persistence across requests and a container restart in the same replica. Do not treat this as persistence across replica replacement or a new revision. If durable data is required, stop and adopt an approved database migration plan instead.

To remove a deployment, first export any data that must be retained. Then, after confirming the resource group contains only this rehearsal's resources, an authorized operator can remove the whole group:

```sh
az group delete --name <dedicated-resource-group> --yes --no-wait
```

Resource-group deletion also deletes the SQLite share, logs, and all other resources in that group.
