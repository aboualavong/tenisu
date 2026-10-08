#!/usr/bin/env bash
set -euo pipefail

# Create Cloud SQL PostgreSQL and deploy the API and its database setup job to Cloud Run.

readonly SERVICE_NAME="tenisu-api"
readonly JOB_NAME="tenisu-db-setup"
readonly REPOSITORY_NAME="tenisu"
readonly SQL_INSTANCE_NAME="tenisu-postgres"
readonly DATABASE_NAME="tenisu"
# Keep the original user and secret for setup so existing table ownership is preserved.
readonly SETUP_DATABASE_USER="tenisu_app"
readonly RUNTIME_DATABASE_USER="tenisu_api"
readonly SETUP_SERVICE_ACCOUNT="tenisu-setup"
readonly RUNTIME_SERVICE_ACCOUNT="tenisu-runtime"
readonly SETUP_PASSWORD_SECRET="tenisu-database-password"
readonly RUNTIME_PASSWORD_SECRET="tenisu-runtime-database-password"
readonly PLAYER_KEY_SECRET="tenisu-player-write-api-key"
readonly REGION="${GCP_REGION:-europe-west1}"

cd "$(dirname "${BASH_SOURCE[0]}")/.."

command -v gcloud >/dev/null || { echo "gcloud is required." >&2; exit 1; }
command -v openssl >/dev/null || { echo "openssl is required." >&2; exit 1; }

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
if [[ -z "$PROJECT_ID" || "$PROJECT_ID" == "(unset)" ]]; then
  echo "Set the project first with: gcloud config set project PROJECT_ID" >&2
  exit 1
fi

if [[ -z "$(gcloud auth list --project="$PROJECT_ID" --filter=status:ACTIVE --format='value(account)')" ]]; then
  echo "No active gcloud account. Run: gcloud auth login" >&2
  exit 1
fi

gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  compute.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  --project="$PROJECT_ID"

ensure_secret() {
  local secret_name="$1"
  if ! gcloud secrets describe "$secret_name" --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud secrets create "$secret_name" \
      --project="$PROJECT_ID" \
      --replication-policy=automatic
  fi
}

retry_iam_command() {
  local attempt=0
  until "$@"; do
    attempt=$((attempt + 1))
    if (( attempt >= 6 )); then
      return 1
    fi
    sleep 10
  done
}

if ! gcloud sql instances describe "$SQL_INSTANCE_NAME" \
  --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud sql instances create "$SQL_INSTANCE_NAME" \
    --project="$PROJECT_ID" \
    --database-version=POSTGRES_16 \
    --edition=ENTERPRISE \
    --tier=db-f1-micro \
    --region="$REGION" \
    --storage-type=HDD \
    --storage-size=10 \
    --no-storage-auto-increase \
    --no-backup \
    --availability-type=ZONAL \
    --assign-ip \
    --no-deletion-protection
fi

# Resume an existing instance before running database setup.
gcloud sql instances patch "$SQL_INSTANCE_NAME" \
  --project="$PROJECT_ID" --activation-policy=ALWAYS --quiet

if ! gcloud sql databases describe "$DATABASE_NAME" \
  --instance="$SQL_INSTANCE_NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud sql databases create "$DATABASE_NAME" \
    --instance="$SQL_INSTANCE_NAME" --project="$PROJECT_ID"
fi

INSTANCE_CONNECTION_NAME="$(gcloud sql instances describe "$SQL_INSTANCE_NAME" \
  --project="$PROJECT_ID" --format='value(connectionName)')"

ensure_secret "$SETUP_PASSWORD_SECRET"
ensure_secret "$PLAYER_KEY_SECRET"
ensure_secret "$RUNTIME_PASSWORD_SECRET"

DATABASE_PASSWORD=""
if [[ -z "$(gcloud secrets versions list "$SETUP_PASSWORD_SECRET" --project="$PROJECT_ID" \
  --filter='state=ENABLED' --format='value(name)')" ]]; then
  DATABASE_PASSWORD="$(openssl rand -hex 32)"
  printf '%s' "$DATABASE_PASSWORD" | gcloud secrets versions add "$SETUP_PASSWORD_SECRET" \
    --project="$PROJECT_ID" --data-file=-
else
  DATABASE_PASSWORD="$(gcloud secrets versions access latest \
    --secret="$SETUP_PASSWORD_SECRET" --project="$PROJECT_ID")"
fi

if [[ -z "$(gcloud sql users list --instance="$SQL_INSTANCE_NAME" --project="$PROJECT_ID" \
  --filter="name=$SETUP_DATABASE_USER" --format='value(name)')" ]]; then
  gcloud sql users create "$SETUP_DATABASE_USER" \
    --instance="$SQL_INSTANCE_NAME" --project="$PROJECT_ID" \
    --password="$DATABASE_PASSWORD"
else
  gcloud sql users set-password "$SETUP_DATABASE_USER" \
    --instance="$SQL_INSTANCE_NAME" --project="$PROJECT_ID" \
    --password="$DATABASE_PASSWORD"
fi
unset DATABASE_PASSWORD

# Create the runtime PostgreSQL role through SQL in the setup job. Cloud SQL's
# default user creation grants cloudsqlsuperuser, which the API must not have.
if [[ -z "$(gcloud secrets versions list "$RUNTIME_PASSWORD_SECRET" --project="$PROJECT_ID" \
  --filter='state=ENABLED' --format='value(name)')" ]]; then
  openssl rand -hex 32 | tr -d '\n' | gcloud secrets versions add "$RUNTIME_PASSWORD_SECRET" \
    --project="$PROJECT_ID" --data-file=-
fi

if [[ -z "$(gcloud secrets versions list "$PLAYER_KEY_SECRET" --project="$PROJECT_ID" \
  --filter='state=ENABLED' --format='value(name)')" ]]; then
  openssl rand -hex 32 | tr -d '\n' | gcloud secrets versions add "$PLAYER_KEY_SECRET" \
    --project="$PROJECT_ID" --data-file=-
fi

if ! gcloud artifacts repositories describe "$REPOSITORY_NAME" \
  --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$REPOSITORY_NAME" \
    --location="$REGION" \
    --repository-format=docker \
    --description="Tenisu API container images" \
    --project="$PROJECT_ID"
fi

for service_account in "$RUNTIME_SERVICE_ACCOUNT" "$SETUP_SERVICE_ACCOUNT"; do
  if ! gcloud iam service-accounts describe \
    "$service_account@$PROJECT_ID.iam.gserviceaccount.com" \
    --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$service_account" \
      --display-name="Tenisu $service_account" --project="$PROJECT_ID"
  fi
done

BUILD_SERVICE_ACCOUNT="$(gcloud builds get-default-service-account \
  --region="$REGION" --project="$PROJECT_ID" \
  --format='value(serviceAccountEmail)')"
BUILD_SERVICE_ACCOUNT="${BUILD_SERVICE_ACCOUNT##*/serviceAccounts/}"
if [[ -z "$BUILD_SERVICE_ACCOUNT" ]]; then
  echo "Could not determine the Cloud Build service account." >&2
  exit 1
fi

BUILD_SOURCE_BUCKET="$PROJECT_ID-tenisu-build-source"
if ! gcloud storage buckets describe "gs://$BUILD_SOURCE_BUCKET" \
  --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$BUILD_SOURCE_BUCKET" \
    --location="$REGION" \
    --project="$PROJECT_ID" \
    --uniform-bucket-level-access \
    --public-access-prevention \
    --soft-delete-duration=0
fi

gcloud storage buckets add-iam-policy-binding "gs://$BUILD_SOURCE_BUCKET" \
  --member="serviceAccount:$BUILD_SERVICE_ACCOUNT" \
  --role=roles/storage.objectViewer \
  --project="$PROJECT_ID" >/dev/null

gcloud artifacts repositories add-iam-policy-binding "$REPOSITORY_NAME" \
  --location="$REGION" \
  --member="serviceAccount:$BUILD_SERVICE_ACCOUNT" \
  --role=roles/artifactregistry.writer \
  --project="$PROJECT_ID" >/dev/null

retry_iam_command gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$BUILD_SERVICE_ACCOUNT" \
  --role=roles/logging.logWriter >/dev/null

for service_account in "$RUNTIME_SERVICE_ACCOUNT" "$SETUP_SERVICE_ACCOUNT"; do
  retry_iam_command gcloud artifacts repositories add-iam-policy-binding "$REPOSITORY_NAME" \
    --location="$REGION" \
    --member="serviceAccount:$service_account@$PROJECT_ID.iam.gserviceaccount.com" \
    --role=roles/artifactregistry.reader --project="$PROJECT_ID" >/dev/null
  retry_iam_command gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$service_account@$PROJECT_ID.iam.gserviceaccount.com" \
    --role=roles/cloudsql.client >/dev/null
done

for secret_name in "$RUNTIME_PASSWORD_SECRET" "$PLAYER_KEY_SECRET"; do
  retry_iam_command gcloud secrets add-iam-policy-binding "$secret_name" \
    --member="serviceAccount:$RUNTIME_SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com" \
    --role=roles/secretmanager.secretAccessor --project="$PROJECT_ID" >/dev/null
done
for secret_name in "$SETUP_PASSWORD_SECRET" "$RUNTIME_PASSWORD_SECRET"; do
  retry_iam_command gcloud secrets add-iam-policy-binding "$secret_name" \
    --member="serviceAccount:$SETUP_SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com" \
    --role=roles/secretmanager.secretAccessor --project="$PROJECT_ID" >/dev/null
done

IMAGE_TAG="$(git rev-parse --short HEAD)-$(date -u +%Y%m%d%H%M%S)"
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY_NAME/api:$IMAGE_TAG"
gcloud builds submit . \
  --region="$REGION" \
  --gcs-source-staging-dir="gs://$BUILD_SOURCE_BUCKET/source" \
  --tag="$IMAGE" \
  --project="$PROJECT_ID"

gcloud run jobs deploy "$JOB_NAME" \
  --image="$IMAGE" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --service-account="$SETUP_SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com" \
  --command=npm \
  --args=run,db:setup:cloud \
  --set-cloudsql-instances="$INSTANCE_CONNECTION_NAME" \
  --tasks=1 \
  --max-retries=1 \
  --task-timeout=5m \
  --set-env-vars="CLOUD_SQL_CONNECTION_NAME=$INSTANCE_CONNECTION_NAME,DATABASE_USER=$SETUP_DATABASE_USER,DATABASE_NAME=$DATABASE_NAME,DATABASE_POOL_SIZE=2" \
  --set-secrets="DATABASE_PASSWORD=$SETUP_PASSWORD_SECRET:latest,RUNTIME_DATABASE_PASSWORD=$RUNTIME_PASSWORD_SECRET:latest"

gcloud run jobs execute "$JOB_NAME" \
  --region="$REGION" --project="$PROJECT_ID" --wait

gcloud run deploy "$SERVICE_NAME" \
  --image="$IMAGE" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --platform=managed \
  --allow-unauthenticated \
  --service-account="$RUNTIME_SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com" \
  --set-cloudsql-instances="$INSTANCE_CONNECTION_NAME" \
  --port=3000 \
  --cpu=1 \
  --memory=512Mi \
  --scaling=auto \
  --min=0 \
  --max=1 \
  --concurrency=80 \
  --set-env-vars="CLOUD_SQL_CONNECTION_NAME=$INSTANCE_CONNECTION_NAME,DATABASE_USER=$RUNTIME_DATABASE_USER,DATABASE_NAME=$DATABASE_NAME,DATABASE_POOL_SIZE=2" \
  --set-secrets="DATABASE_PASSWORD=$RUNTIME_PASSWORD_SECRET:latest,PLAYER_WRITE_API_KEY=$PLAYER_KEY_SECRET:latest"

# Migrate the old deployment: its runtime identity could read the setup secret.
if [[ -n "$(gcloud secrets get-iam-policy "$SETUP_PASSWORD_SECRET" \
  --project="$PROJECT_ID" --flatten='bindings[].members' \
  --filter="bindings.role:roles/secretmanager.secretAccessor AND bindings.members:serviceAccount:$RUNTIME_SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com" \
  --format='value(bindings.members)')" ]]; then
  gcloud secrets remove-iam-policy-binding "$SETUP_PASSWORD_SECRET" \
    --member="serviceAccount:$RUNTIME_SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com" \
    --role=roles/secretmanager.secretAccessor --project="$PROJECT_ID" >/dev/null
fi

gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" --project="$PROJECT_ID" \
  --format='value(status.url)'
