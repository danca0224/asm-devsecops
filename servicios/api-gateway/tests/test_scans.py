"""
Pruebas unitarias — Validación de dominios
"""

import re
import pytest

DOMAIN_RE = re.compile(
    r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$"
)


@pytest.mark.parametrize("domain,valid", [
    ("ejemplo.com", True),
    ("sub.ejemplo.com.co", True),
    ("gov.co", True),
    ("my-domain.org", True),
    ("", False),
    ("nodot", False),
    ("http://ejemplo.com", False),
    ("-invalid.com", False),
    ("invalid-.com", False),
    ("a" * 64 + ".com", False),
])
def test_domain_validation(domain, valid):
    assert bool(DOMAIN_RE.match(domain)) == valid
