variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Deployment environment name"
  type        = string
  default     = "production"
}

variable "instance_type" {
  description = "EC2 instance size (low cost: t3.small ~ $15/month)"
  type        = string
  default     = "t3.small"
}

variable "root_volume_size" {
  description = "Size of the gp3 root EBS volume in GB"
  type        = number
  default     = 20
}

variable "public_key_path" {
  description = "Path to the SSH public key for deployer access"
  type        = string
  default     = "~/.ssh/id_ed25519.pub"
}

variable "vpc_cidr" {
  description = "CIDR block for dedicated SpanQC VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "subnet_cidr" {
  description = "CIDR block for SpanQC public subnet"
  type        = string
  default     = "10.0.1.0/24"
}
