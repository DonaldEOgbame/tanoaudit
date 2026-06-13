"""Config + crypto with planted issues."""
import hashlib
import ssl


def hash_password(pw):
    # PLANTED: security/weak-crypto
    return hashlib.md5(pw.encode()).hexdigest()


def make_context():
    ctx = ssl.create_default_context()
    # PLANTED: security/insecure-tls
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


# PLANTED: security/overly-permissive-cors
CORS_ALLOW_ORIGINS = ["*"]
