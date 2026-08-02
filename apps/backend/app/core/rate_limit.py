from slowapi import Limiter
from slowapi.util import get_remote_address

# Global rate limiter to be imported by main.py and individual routers
limiter = Limiter(key_func=get_remote_address)