###############################################################
# ASM — Infraestructura como Código (Terraform)
# Provisiona una VM en AWS EC2 para entorno de producción
###############################################################

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.7.0"
}

provider "aws" {
  region = var.aws_region
}

# ── Security Group ───────────────────────────────────────────
resource "aws_security_group" "asm_sg" {
  name        = "asm-sg"
  description = "ASM — reglas de firewall"

  # HTTP
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SSH — solo desde IP de gestión
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.admin_cidr]
  }

  # Salida irrestricta
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "asm-security-group", Project = "ASM" }
}

# ── EC2 Instance ─────────────────────────────────────────────
resource "aws_instance" "asm_server" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.asm_sg.id]

  root_block_device {
    volume_type = "gp3"
    volume_size = 30
    encrypted   = true
  }

  user_data = templatefile("${path.module}/user_data.sh.tpl", {
    docker_compose_version = "2.27.0"
  })

  tags = {
    Name        = "asm-server"
    Project     = "ASM"
    Environment = "production"
    ManagedBy   = "Terraform"
  }
}

# ── Elastic IP ───────────────────────────────────────────────
resource "aws_eip" "asm_eip" {
  instance = aws_instance.asm_server.id
  domain   = "vpc"
  tags     = { Name = "asm-eip", Project = "ASM" }
}
