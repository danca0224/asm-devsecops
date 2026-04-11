#!/usr/bin/env bash
# ============================================================
# ASM — Script de análisis de superficie de ataque
# Uso: bash validar_subdominioModtimeout.sh <dominio>
#
# NOTA: Este script es el motor de análisis OSINT.
#       Coloca aquí tu script original de validación.
#       El worker-scanner lo ejecuta automáticamente.
# ============================================================

set -euo pipefail

DOMINIO="${1:-}"
if [[ -z "$DOMINIO" ]]; then
    echo "Uso: $0 <dominio>"
    exit 1
fi

OUTPUT_CSV="reporte_validado_${DOMINIO}.csv"
TIMEOUT_CMD="timeout"

echo "Iniciando análisis de: $DOMINIO"
echo "Subdominio,A,Estado,Puertos abiertos,Estado Certificado,Correo,Versiones TLS soportadas,Riesgos de cifrado,version servidor,Exposicion de puertos" > "$OUTPUT_CSV"

# ── Función: resolver IP ─────────────────────────────────────
resolver_ip() {
    local sub="$1"
    local ip
    ip=$(dig +short A "$sub" 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
    echo "${ip:-}"
}

# ── Función: verificar SSL ───────────────────────────────────
verificar_ssl() {
    local sub="$1"
    local result
    result=$( (echo | $TIMEOUT_CMD 5 openssl s_client -connect "${sub}:443" -servername "$sub" 2>/dev/null) || echo "")
    if echo "$result" | grep -q "Verify return code: 0"; then
        echo "Válido"
    elif echo "$result" | grep -q "certificate has expired"; then
        echo "Vencido"
    elif [[ -z "$result" ]]; then
        echo "Sin SSL"
    else
        echo "Inválido"
    fi
}

# ── Función: verificar puertos ───────────────────────────────
verificar_puertos() {
    local sub="$1"
    local ports
    ports=$(nmap -p 21,22,23,25,80,443,3306,3389,5432,5900,6379,8080,8443,27017 \
        --open -T4 --host-timeout 30s -oG - "$sub" 2>/dev/null \
        | grep "Ports:" | grep -oP '\d+/open' | cut -d'/' -f1 | tr '\n' ',' | sed 's/,$//')
    echo "${ports:-}"
}

# ── Función: verificar correo ────────────────────────────────
verificar_correo() {
    local domain="$1"
    local spf dkim dmarc result=""
    spf=$(dig +short TXT "$domain" 2>/dev/null | grep -i "v=spf" | head -1)
    dmarc=$(dig +short TXT "_dmarc.${domain}" 2>/dev/null | grep -i "v=DMARC" | head -1)
    if [[ -z "$spf" ]] && [[ -z "$dmarc" ]]; then
        result="SPF/DMARC ausentes"
    elif [[ -z "$spf" ]]; then
        result="SPF ausente"
    elif [[ -z "$dmarc" ]]; then
        result="DMARC ausente"
    else
        result="Configurado"
    fi
    echo "$result"
}

# ── Función: obtener TLS ─────────────────────────────────────
verificar_tls() {
    local sub="$1"
    local versions=""
    for proto in tls1 tls1_1 tls1_2 tls1_3; do
        if (echo | $TIMEOUT_CMD 3 openssl s_client -connect "${sub}:443" -"$proto" 2>/dev/null | grep -q "Cipher is"); then
            versions="${versions}${proto} "
        fi
    done
    echo "${versions:-No TLS}"
}

# ── Función: obtener server header ───────────────────────────
obtener_servidor() {
    local sub="$1"
    local server
    server=$($TIMEOUT_CMD 5 curl -sk -I "https://${sub}" 2>/dev/null | grep -i "^server:" | head -1 | cut -d' ' -f2- | tr -d '\r')
    if [[ -z "$server" ]]; then
        server=$($TIMEOUT_CMD 5 curl -sk -I "http://${sub}" 2>/dev/null | grep -i "^server:" | head -1 | cut -d' ' -f2- | tr -d '\r')
    fi
    echo "${server:-No identificado}"
}

# ── Enumeración de subdominios ───────────────────────────────
echo "Enumerando subdominios de $DOMINIO..."
SUBDOMINIOS=()

# Usar prefijos comunes
PREFIJOS=("www" "mail" "ftp" "vpn" "api" "dev" "staging" "admin" "portal" "webmail" "ns1" "ns2" "smtp" "pop" "imap" "app" "mobile" "cdn" "static" "help" "support" "blog" "docs" "test" "demo")

for prefix in "${PREFIJOS[@]}"; do
    sub="${prefix}.${DOMINIO}"
    ip=$(resolver_ip "$sub")
    if [[ -n "$ip" ]]; then
        SUBDOMINIOS+=("$sub")
    fi
done

# Agregar dominio base
SUBDOMINIOS+=("$DOMINIO")

# ── Análisis por subdominio ──────────────────────────────────
for sub in "${SUBDOMINIOS[@]}"; do
    echo "  Analizando: $sub"
    ip=$(resolver_ip "$sub")
    estado="Huérfano"
    [[ -n "$ip" ]] && estado="Activo"

    ssl=$(verificar_ssl "$sub")
    puertos=$(verificar_puertos "$sub")
    correo=$(verificar_correo "$DOMINIO")
    tls=$(verificar_tls "$sub")
    servidor=$(obtener_servidor "$sub")

    # Exposición de puertos (clasificación simple)
    exposicion=""
    if [[ -n "$puertos" ]]; then
        if echo "$puertos" | grep -qE "(22|23|3389|5900|5432|3306|6379|27017)"; then
            exposicion="Crítico"
        elif echo "$puertos" | grep -qE "(21|25|8080|8443)"; then
            exposicion="Alto"
        else
            exposicion="Bajo"
        fi
    fi

    # Riesgos de cifrado
    riesgos=""
    if echo "$tls" | grep -qiE "tls1_0|tls1_1|tls1 "; then
        riesgos="TLS obsoleto"
    fi

    # Escribir fila
    printf '"%s","%s","%s","%s","%s","%s","%s","%s","%s","%s"\n' \
        "$sub" "$ip" "$estado" "$puertos" "$ssl" "$correo" "$tls" "$riesgos" "$servidor" "$exposicion" \
        >> "$OUTPUT_CSV"
done

echo "Análisis completado. CSV generado: $OUTPUT_CSV"
