variable "aws_region" {
  description = "Región AWS"
  type        = string
  default     = "us-east-1"
}

variable "ami_id" {
  description = "AMI de Ubuntu 22.04 LTS"
  type        = string
  default     = "ami-0c7217cdde317cfec"  # Ubuntu 22.04 LTS us-east-1
}

variable "instance_type" {
  description = "Tipo de instancia EC2"
  type        = string
  default     = "t3.small"
}

variable "key_name" {
  description = "Nombre del par de llaves SSH en AWS"
  type        = string
}

variable "admin_cidr" {
  description = "CIDR permitido para SSH (ej. 200.1.2.3/32)"
  type        = string
  sensitive   = true
}
