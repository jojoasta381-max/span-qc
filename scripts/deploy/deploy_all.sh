#!/bin/bash
# ==============================================================================
# SpanQC Complete IaC Orchestrator (Terraform + Ansible)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "======================================================================"
echo "          SPANQC AUTOMATED INFRASTRUCTURE & DEPLOYMENT"
echo "======================================================================"

# 1. Check Prerequisites
command -v terraform >/dev/null 2>&1 || { echo "[ERROR] Terraform is required but not installed."; exit 1; }
command -v ansible-playbook >/dev/null 2>&1 || { echo "[ERROR] Ansible is required but not installed."; exit 1; }

# 2. Extract local Anthropic API Key if available
ANTHROPIC_KEY=""
if [ -f "$ROOT_DIR/spanqc_core/.env" ]; then
  ANTHROPIC_KEY=$(grep '^ANTHROPIC_API_KEY=' "$ROOT_DIR/spanqc_core/.env" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
fi

# 3. Terraform Provisioning
echo "[1/3] Provisioning AWS Infrastructure with Terraform..."
cd "$ROOT_DIR/infra/terraform"
terraform init -upgrade
terraform apply -auto-approve

PUBLIC_IP=$(terraform output -raw public_ip)
echo "Infrastructure provisioned! Elastic IP: $PUBLIC_IP"

# 4. Ansible Configuration & Microservice Deployment
echo "[2/3] Configuring Host & Deploying Microservices with Ansible..."
cd "$ROOT_DIR/infra/ansible"

# Ensure host key checking doesn't prompt
export ANSIF_HOST_KEY_CHECKING=False

ansible-playbook -i inventory.ini playbook.yml \
  --extra-vars "anthropic_api_key=${ANTHROPIC_KEY}"

# 5. Final Live Status
echo "[3/3] Deployment Verification Complete!"
echo "======================================================================"
echo "          SPANQC IS LIVE IN PRODUCTION!"
echo "======================================================================"
echo "Website URL:      http://$PUBLIC_IP"
echo "SSH Access:       ssh -i ~/.ssh/id_ed25519 ubuntu@$PUBLIC_IP"
echo "EC2 Region:       ap-south-1"
echo "Stack:            Next.js 16 Web + Python FastAPI Core (Docker Compose)"
echo "Weekly Cleanup:   Active via systemd (docker-prune.timer)"
echo "======================================================================"
