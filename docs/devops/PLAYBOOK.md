# SPANQC — DevOps & Infrastructure Engineering Playbook

> **Target Environment:** AWS `ap-south-1` (Mumbai)  
> **Production Elastic IP:** `3.109.239.116`  
> **Host Profile:** EC2 `t3.medium` (Ubuntu 24.04 LTS, 2 vCPU, 4GB RAM + 4GB Swap, 30GB gp3)  
> **Full Rendered PDF Document:** [SPANQC_DEVOPS_PLAYBOOK.pdf](file:///data/projects/uiux/docs/SPANQC_DEVOPS_PLAYBOOK.pdf)

---

## 1. Cloud & Container Architecture

SPANQC is deployed as a resilient, single-host microservices topology inside a dedicated AWS Virtual Private Cloud (VPC). The architecture cleanly isolates public web delivery, background job processing, and AI transcription / deterministic verification.

```
+---------------------------------------------------------------------------------------------------+
| AWS Cloud: Region ap-south-1 (Mumbai)                                                             |
|                                                                                                   |
|  [Internet Gateway] <===> [Elastic IP: 3.109.239.116] (HTTP :80 / HTTPS :443)                     |
|         |                                                                                         |
|  +------v--------------------------------------------------------------------------------------+  |
|  | Dedicated VPC (10.0.0.0/16) - Public Subnet (10.0.1.0/24)                                    |  |
|  | Security Group: spanqc-prod-sg (Inbound: 22, 80, 443 | Outbound: ALL)                         |  |
|  |                                                                                             |  |
|  |  +---------------------------------------------------------------------------------------+  |  |
|  |  | EC2 Instance: t3.medium (Ubuntu 24.04 LTS Noble | 2 vCPU, 4GB RAM + 4GB Swap)        |  |  |
|  |  | Host OS: UFW Firewall | Fail2ban | docker-prune.timer | Docker CE Engine 27+           |  |  |
|  |  |                                                                                       |  |  |
|  |  |  +---------------------------------------------------------------------------------+  |  |  |
|  |  |  | Docker Bridge Network: spanqc-network                                          |  |  |  |
|  |  |  |                                                                                 |  |  |  |
|  |  |  |  [spanqc-web] (Next.js 16 Standalone)          [spanqc-core] (FastAPI Microservice)|  |  |  |
|  |  |  |  - Exposed: Host 80 -> Container 3000         - Internal port 8000 (No host map) |  |  |  |
|  |  |  |  - NextAuth Session & CSRF Security            - PyMuPDF Vector Rasterizer         |  |  |  |
|  |  |  |  - In-Process QC Background Queue Worker     - Deterministic Rule Engine         |  |  |  |
|  |  |  |  - Volumes: spanqc_data, spanqc_storage        - Outbound Egress: Anthropic Claude |  |  |  |
|  |  |  |          |                                              |                       |  |  |  |
|  |  |  |          +====== REST API: http://core:8000 ===========+                       |  |  |  |
|  |  |  +---------------------------------------------------------------------------------+  |  |  |
|  |  +---------------------------------------------------------------------------------------+  |  |
|  +---------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
```

### Architectural Principles
1. **Deterministic Verification with AI Transcription:** Anthropic Claude Vision transcribes drawing metadata, pin configurations, and wire IDs; `spanqc_core/rules.py` executes 100% deterministic code-level verification without LLM hallucination.
2. **Fail-Closed Security Posture:** Missing keys, partial files, or schema corruptions yield `REVIEW` or structured errors. Never simulated, never false passes.
3. **Isolated Microservices Networking:** The Python verification engine (`spanqc-core`) has zero exposed external ports. It is reachable exclusively by the Next.js gateway via the private Docker bridge network (`http://core:8000`).
4. **Zero Overhead Data Storage:** Production utilizes high-speed SQLite on persistent Docker named volumes with WAL (Write-Ahead Logging) mode, avoiding multi-hundred dollar RDS overhead for initial high-performance throughput.

---

## 2. Tooling Matrix & Infrastructure as Code (Terraform)

| Category | Technology | Version | Role in SPANQC |
| :--- | :--- | :--- | :--- |
| **Cloud Provider** | Amazon Web Services (AWS) | `ap-south-1` | VPC, IGW, Route Tables, Security Group, EC2, Elastic IP, gp3 Storage. |
| **IaC** | Terraform | `>= 1.5.0` | Provisions all AWS networking and computing assets with dynamic inventory output. |
| **Config Management** | Ansible Core | `>= 2.15` | Configures base OS, SWAP, firewall, docker daemon, and deploys microservices. |
| **Host OS** | Ubuntu Server | `24.04 LTS` | Base operating system with hardened kernel parameters, UFW firewall, and Fail2ban. |
| **Container Engine** | Docker CE | `27.x + Compose v2`| Multi-container orchestration, volume persistence, and isolated bridge network. |
| **Frontend & API** | Next.js (Standalone) | `16.3.6` | Node.js 20 Alpine runner, reverse proxy handler, NextAuth, Prisma SQLite engine. |
| **Core QC Service** | FastAPI / Python | `3.12-slim` | Uvicorn ASGI server, PyMuPDF (fitz) rasterizer, Anthropic Claude Vision API client. |

### Step-by-Step Terraform Provisioning

```bash
# 1. Authenticate with AWS CLI
export AWS_DEFAULT_REGION="ap-south-1"
cd infra/terraform

# 2. Initialize provider plugins and validate
terraform init -upgrade
terraform validate

# 3. Plan and apply infrastructure
terraform plan -out=tfplan
terraform apply -auto-approve tfplan

# 4. View outputs
terraform output
# Elastic IP: 3.109.239.116
# Dynamic inventory automatically written to: infra/ansible/inventory.ini
```

---

## 3. Host Hardening & Configuration (Ansible)

Located in `infra/ansible/`:

- **Role: `common`**:
  - Configures **4GB swapfile** (`/swapfile`) with `vm.swappiness = 10`.
  - Sets up **UFW Firewall**: Default deny incoming, allows `22/tcp`, `80/tcp`, `443/tcp`.
  - Configures **Fail2ban** SSH jail to block brute-force attempts.
- **Role: `docker`**:
  - Installs official Docker CE and Compose plugin from upstream repositories.
  - Adds `ubuntu` user to the `docker` group.
- **Role: `maintenance`**:
  - Configures `docker-prune.timer` running every Sunday at 03:00 AM to automatically clean unused build caches and dangling images.
- **Role: `spanqc_app`**:
  - Prepares `/opt/spanqc`, syncs repository code excluding heavy local caches, templates `.env`, and builds containers.

```bash
# Test SSH connectivity
ansible -i infra/ansible/inventory.ini spanqc_servers -m ping

# Run full configuration playbook
ansible-playbook -i infra/ansible/inventory.ini infra/ansible/playbook.yml \
  --extra-vars "anthropic_api_key=$ANTHROPIC_API_KEY auth_secret=$AUTH_SECRET"

# Deploy application code updates only
ansible-playbook -i infra/ansible/inventory.ini infra/ansible/playbook.yml --tags "app,deploy"
```

---

## 4. Containerization & Docker Compose

### Multi-Stage Dockerfiles
- **`Dockerfile.web` (Next.js 16)**:
  - Multi-stage: `deps` (npm ci, prisma generate) -> `builder` (standalone build with 1GB memory limit) -> `runner` (Alpine Linux non-root `nextjs:1001`).
  - Total image size: ~180MB.
- **`Dockerfile.core` (FastAPI)**:
  - Python 3.12 slim, PyMuPDF, Anthropic SDK, non-root `spanqc:1002`.
  - Built-in healthcheck: `curl -f http://127.0.0.1:8000/health`.

### `docker-compose.yml` Summary
```yaml
services:
  web:
    container_name: spanqc-web
    build: { context: ., dockerfile: Dockerfile.web }
    ports:
      - "80:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/app/data/dev.db
      - PYTHON_SERVICE_URL=http://core:8000
    volumes:
      - spanqc_data:/app/data
      - spanqc_storage:/app/storage
    depends_on:
      core:
        condition: service_healthy
    networks:
      - spanqc-network

  core:
    container_name: spanqc-core
    build: { context: ., dockerfile: Dockerfile.core }
    networks:
      - spanqc-network
```

---

## 5. DevOps Battle-Tested Gotchas & Solutions

1. **Docker Build Context Bloat (OOM)**:
   - *Problem:* Build context sent 872MB to EC2, causing out-of-memory killed errors.
   - *Fix:* Added `infra/` and `experiments/` to `.dockerignore`. Context dropped to **30 kB**, build completed in under 45s.
2. **Next.js 16 Reverse Proxy 10MB Limit**:
   - *Problem:* Large PDF/ZIP file uploads threw `400 Bad Request: Malformed multipart form data`.
   - *Fix:* Configured `experimental: { proxyClientMaxBodySize: "100mb" }` in `next.config.ts`.
3. **Direct Host Port 80 CSRF Mismatch**:
   - *Problem:* Browsers accessing `http://3.109.239.116` were rejected by CSRF checks.
   - *Fix:* Updated `src/lib/server/auth/csrf.ts` to inspect `request.headers.get("host")`.
4. **Inter-Service Docker DNS Resolution**:
   - *Problem:* `127.0.0.1:8000` inside `spanqc-web` failed to reach `spanqc-core`.
   - *Fix:* Configured `PYTHON_SERVICE_URL=http://core:8000`. Docker's internal DNS automatically routes to the core container.
5. **Database Schema Push Inside Container**:
   - *Problem:* Prisma migrations must be applied without restarting or rebuilding the container.
   - *Fix:* Run `docker compose exec web npx prisma db push` directly against the running container.

---

## 6. Day-2 Operations & Monitoring Cheat Sheet

```bash
# View live logs
docker compose -f /opt/spanqc/docker-compose.yml logs -f web
docker compose -f /opt/spanqc/docker-compose.yml logs -f core

# Hot-deploy code update on EC2
cd /opt/spanqc
git pull origin main
docker compose build
docker compose up -d

# Safe hot SQLite backup
docker compose exec web sqlite3 /app/data/dev.db ".backup '/app/data/backup_$(date +%Y%m%d_%H%M%S).db'"
docker cp spanqc-web:/app/data/backup_*.db /home/ubuntu/backups/

# Container resource stats
docker stats --no-stream
```
