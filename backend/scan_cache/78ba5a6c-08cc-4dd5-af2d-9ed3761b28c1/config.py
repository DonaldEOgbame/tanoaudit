"""Config + crypto with planted issues."""
import hashlib
import ssl


def hash_password(pw):
    return hashlib.md5(pw.encode()).hexdigest()


def make_context():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


CORS_ALLOW_ORIGINS = ["*"]
