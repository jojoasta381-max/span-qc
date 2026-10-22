output "instance_id" {
  description = "EC2 Instance ID"
  value       = aws_instance.app_server.id
}

output "public_ip" {
  description = "Static Elastic Public IP address of SpanQC"
  value       = aws_eip.app_eip.public_ip
}

output "website_url" {
  description = "Direct HTTP website URL"
  value       = "http://${aws_eip.app_eip.public_ip}"
}

output "ssh_command" {
  description = "SSH Command to connect to the instance"
  value       = "ssh -i ${replace(pathexpand(var.public_key_path), ".pub", "")} ubuntu@${aws_eip.app_eip.public_ip}"
}

output "vpc_id" {
  description = "Dedicated VPC ID"
  value       = aws_vpc.main.id
}
