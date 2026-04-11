output "server_ip" {
  description = "IP pública del servidor ASM"
  value       = aws_eip.asm_eip.public_ip
}

output "ssh_command" {
  description = "Comando SSH para conectarse al servidor"
  value       = "ssh -i ~/.ssh/${var.key_name}.pem ubuntu@${aws_eip.asm_eip.public_ip}"
}

output "app_url" {
  description = "URL de la aplicación"
  value       = "http://${aws_eip.asm_eip.public_ip}"
}
