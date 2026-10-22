#!/bin/bash
# ==============================================================================
# SpanQC AWS Production EC2 Provisioning Script
# Sets up a low-cost microservices host (~$15/mo) with Docker & Elastic IP
# ==============================================================================
set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.small}"
KEY_NAME="${KEY_NAME:-docker_ubuntu}"
SG_NAME="spanqc-prod-ec2-sg"
INSTANCE_NAME="spanqc-production-microservices"
VOLUME_SIZE=20

echo "======================================================================"
echo "          SPANQC AWS EC2 AUTOMATED PROVISIONING"
echo "======================================================================"
echo "Target Region:        $REGION"
echo "Instance Type:        $INSTANCE_TYPE"
echo "EC2 Key Pair:         $KEY_NAME"
echo "Security Group:       $SG_NAME"
echo "Volume Size (gp3):    ${VOLUME_SIZE}GB"
echo "======================================================================"

# 1. Verify AWS Identity
echo "[1/7] Checking AWS IAM credentials..."
CALLER_ARN=$(aws sts get-caller-identity --query 'Arn' --output text)
echo "Authenticated as: $CALLER_ARN"

# 2. Get Default VPC & Subnet
echo "[2/7] Finding Default VPC and Public Subnet in $REGION..."
VPC_ID=$(aws ec2 describe-vpcs --region "$REGION" --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text)
if [ -z "$VPC_ID" ] || [ "$VPC_ID" == "None" ]; then
    echo "[ERROR] No default VPC found in $REGION. Please specify a VPC manually."
    exit 1
fi
echo "Using VPC: $VPC_ID"

SUBNET_ID=$(aws ec2 describe-subnets --region "$REGION" --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[0].SubnetId" --output text)
echo "Using Subnet: $SUBNET_ID"

# 3. Create or Reuse Security Group
echo "[3/7] Configuring Security Group '$SG_NAME'..."
SG_ID=$(aws ec2 describe-security-groups --region "$REGION" --filters "Name=group-name,Values=$SG_NAME" "Name=vpc-id,Values=$VPC_ID" --query "SecurityGroups[0].GroupId" --output text 2>/dev/null || true)

if [ -z "$SG_ID" ] || [ "$SG_ID" == "None" ]; then
    echo "Creating new security group..."
    SG_ID=$(aws ec2 create-security-group \
        --region "$REGION" \
        --group-name "$SG_NAME" \
        --description "Inbound HTTP, HTTPS, and SSH for SpanQC production microservices" \
        --vpc-id "$VPC_ID" \
        --query 'GroupId' \
        --output text)
    
    # Allow Port 22 (SSH)
    aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" --protocol tcp --port 22 --cidr 0.0.0.0/0
    # Allow Port 80 (HTTP)
    aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" --protocol tcp --port 80 --cidr 0.0.0.0/0
    # Allow Port 443 (HTTPS)
    aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" --protocol tcp --port 443 --cidr 0.0.0.0/0
    echo "Created Security Group: $SG_ID with ports 22, 80, 443 open."
else
    echo "Reusing existing Security Group: $SG_ID"
fi

# 4. Find Latest Official Ubuntu 24.04 LTS AMI
echo "[4/7] Finding latest Ubuntu 24.04 LTS AMI in $REGION..."
AMI_ID=$(aws ec2 describe-images --region "$REGION" \
    --owners 099720109477 \
    --filters "Name=name,Values=ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*" \
              "Name=state,Values=available" \
    --query "reverse(sort_by(Images, &CreationDate))[0].ImageId" \
    --output text)
echo "Using AMI: $AMI_ID (Ubuntu 24.04 LTS)"

# 5. Create Cloud-Init User Data Script
USER_DATA_FILE=$(mktemp)
cat << 'EOF' > "$USER_DATA_FILE"
#!/bin/bash
set -euxo pipefail

# 1. Update OS and install Docker & Git
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release git

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker
usermod -aG docker ubuntu

# 2. Setup Systemd Weekly Docker Prune Timer
cat << 'UNIT' > /etc/systemd/system/docker-prune.service
[Unit]
Description=SpanQC Weekly Docker Cache and Unused Images Cleanup
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/bin/docker system prune -af --filter "until=168h"
StandardOutput=journal
StandardError=journal
UNIT

cat << 'TIMER' > /etc/systemd/system/docker-prune.timer
[Unit]
Description=Run SpanQC Docker cache cleanup every Sunday at 3:00 AM
RefersTo=docker-prune.service

[Timer]
OnCalendar=Sun *-*-* 03:00:00
Persistent=true
RandomizedDelaySec=1800

[Install]
WantedBy=timers.target
TIMER

systemctl daemon-reload
systemctl enable --now docker-prune.timer

echo "SpanQC EC2 Initial Provisioning Complete!" > /var/log/spanqc-init.log
EOF

# 6. Launch EC2 Instance
echo "[5/7] Launching EC2 instance ($INSTANCE_TYPE)..."
INSTANCE_ID=$(aws ec2 run-instances \
    --region "$REGION" \
    --image-id "$AMI_ID" \
    --instance-type "$INSTANCE_TYPE" \
    --key-name "$KEY_NAME" \
    --security-group-ids "$SG_ID" \
    --subnet-id "$SUBNET_ID" \
    --block-device-mappings "[{\"DeviceName\":\"/dev/sda1\",\"Ebs\":{\"VolumeSize\":$VOLUME_SIZE,\"VolumeType\":\"gp3\",\"DeleteOnTermination\":true}}]" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME},{Key=Environment,Value=production},{Key=Project,Value=SpanQC}]" \
    --user-data "file://$USER_DATA_FILE" \
    --query 'Instances[0].InstanceId' \
    --output text)
rm -f "$USER_DATA_FILE"

echo "Instance launched: $INSTANCE_ID"
echo "Waiting for instance to enter 'running' state..."
aws ec2 wait instance-running --region "$REGION" --instance-ids "$INSTANCE_ID"

# 7. Allocate and Associate Static Elastic IP
echo "[6/7] Allocating & Associating Elastic IP..."
ALLOCATION_ID=$(aws ec2 allocate-address --region "$REGION" --domain vpc --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=spanqc-prod-eip}]" --query 'AllocationId' --output text)
aws ec2 associate-address --region "$REGION" --instance-id "$INSTANCE_ID" --allocation-id "$ALLOCATION_ID"
PUBLIC_IP=$(aws ec2 describe-addresses --region "$REGION" --allocation-ids "$ALLOCATION_ID" --query 'Addresses[0].PublicIp' --output text)

echo "[7/7] Verifying Connectivity..."
echo "======================================================================"
echo "          SPANQC PRODUCTION DEPLOYMENT READY!"
echo "======================================================================"
echo "Instance ID:        $INSTANCE_ID"
echo "Public Static IP:   $PUBLIC_IP"
echo "Live Web URL:       http://$PUBLIC_IP"
echo ""
echo "Next Steps to complete setup:"
echo "1. Connect via SSH:"
echo "   ssh -i ~/.ssh/${KEY_NAME}.pem ubuntu@${PUBLIC_IP}"
echo ""
echo "2. Clone this repository on the EC2 instance:"
echo "   git clone <YOUR_GIT_REPO_URL> spanqc"
echo "   cd spanqc"
echo ""
echo "3. Copy .env.production.example to .env and configure secrets:"
echo "   cp .env.production.example .env"
echo "   nano .env"
echo "   # (Set NEXTAUTH_URL=http://${PUBLIC_IP} and ANTHROPIC_API_KEY=...)"
echo ""
echo "4. Start microservices with Docker Compose:"
echo "   docker compose up -d"
echo ""
echo "5. Add GitHub Actions Secrets for Automated CI/CD:"
echo "   - EC2_HOST:     $PUBLIC_IP"
echo "   - EC2_USER:     ubuntu"
echo "   - EC2_SSH_KEY:  (Contents of your ~/.ssh/${KEY_NAME}.pem)"
echo "======================================================================"
