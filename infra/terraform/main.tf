# ==============================================================================
# SpanQC Dedicated VPC & Network Infrastructure
# ==============================================================================

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "spanqc-prod-vpc"
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "spanqc-prod-igw"
  }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.subnet_cidr
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name = "spanqc-prod-public-subnet"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name = "spanqc-prod-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# ==============================================================================
# Security Group (SSH, HTTP, HTTPS)
# ==============================================================================

resource "aws_security_group" "app_sg" {
  name        = "spanqc-prod-app-sg"
  description = "SpanQC Inbound SSH, HTTP, and HTTPS access"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "SSH access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP web access"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS secure web access"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "spanqc-prod-sg"
  }
}

# ==============================================================================
# SSH Key Pair
# ==============================================================================

resource "aws_key_pair" "deployer" {
  key_name   = "spanqc-deployer-key"
  public_key = file(pathexpand(var.public_key_path))
}

# ==============================================================================
# Latest Ubuntu 24.04 LTS AMI Data Source
# ==============================================================================

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ==============================================================================
# EC2 Microservices Host Instance
# ==============================================================================

resource "aws_instance" "app_server" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  key_name               = aws_key_pair.deployer.key_name

  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = "gp3"
    delete_on_termination = true
    encrypted             = true

    tags = {
      Name = "spanqc-prod-root-disk"
    }
  }

  tags = {
    Name = "spanqc-prod-server"
    Role = "ApplicationHost"
  }
}

# ==============================================================================
# Elastic IP (Static Public IP)
# ==============================================================================

resource "aws_eip" "app_eip" {
  instance = aws_instance.app_server.id
  domain   = "vpc"

  tags = {
    Name = "spanqc-prod-eip"
  }

  depends_on = [aws_internet_gateway.igw]
}

# ==============================================================================
# Automatic Ansible Inventory Generation
# ==============================================================================

resource "local_file" "ansible_inventory" {
  filename        = "${path.module}/../ansible/inventory.ini"
  file_permission = "0644"
  content         = <<-EOT
[spanqc_servers]
spanqc_prod ansible_host=${aws_eip.app_eip.public_ip} ansible_user=ubuntu ansible_ssh_private_key_file=${replace(pathexpand(var.public_key_path), ".pub", "")} ansible_python_interpreter=/usr/bin/python3
EOT
}
