import time
from typing import Optional, Dict, Any
import httpx
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.memolet import User

class ClerkAuthService:
    def __init__(self):
        self._jwks_cache: Optional[Dict[str, Any]] = None
        self._jwks_fetched_at: float = 0.0
        self._cache_ttl: float = 3600.0 # 1 hour
        self.jwks_url = settings.CLERK_JWKS_URL or "https://fine-ladybug-8955.clerk.accounts.dev/.well-known/jwks.json"
        self.secret_key = settings.CLERK_SECRET_KEY

    def get_jwks(self, force_refresh: bool = False) -> Dict[str, Any]:
        """Fetch and cache Clerk JWKS keys."""
        now = time.time()
        if not force_refresh and self._jwks_cache and (now - self._jwks_fetched_at < self._cache_ttl):
            return self._jwks_cache

        try:
            with httpx.Client(verify=False, timeout=10.0) as client:
                resp = client.get(self.jwks_url)
                if resp.status_code == 200:
                    self._jwks_cache = resp.json()
                    self._jwks_fetched_at = now
                    return self._jwks_cache
        except Exception as e:
            print(f"[ClerkAuth] Error fetching JWKS from {self.jwks_url}: {e}")
            if self._jwks_cache:
                return self._jwks_cache

        return {"keys": []}

    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify Clerk session token using direct PEM Public Key or JWKS RS256."""
        # 1. Try instant decoding with PEM public key if configured
        clerk_pem = getattr(settings, "CLERK_PEM_PUBLIC_KEY", None)
        if clerk_pem:
            try:
                # Clean up any escaped newlines if passed in .env
                pem_key = clerk_pem.replace("\\n", "\n").strip('\"\'')
                payload = jwt.decode(
                    token,
                    pem_key,
                    algorithms=["RS256"],
                    options={"verify_aud": False}
                )
                return payload
            except Exception:
                pass

        # 2. Fall back to JWKS decoding
        try:
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get("kid")
            alg = unverified_header.get("alg", "RS256")

            if alg != "RS256" or not kid:
                return None

            jwks = self.get_jwks()
            rsa_key = None
            for key in jwks.get("keys", []):
                if key.get("kid") == kid:
                    rsa_key = {
                        "kty": key.get("kty"),
                        "kid": key.get("kid"),
                        "use": key.get("use"),
                        "n": key.get("n"),
                        "e": key.get("e"),
                    }
                    break

            if not rsa_key:
                # Refresh JWKS once in case key was rotated
                jwks = self.get_jwks(force_refresh=True)
                for key in jwks.get("keys", []):
                    if key.get("kid") == kid:
                        rsa_key = {
                            "kty": key.get("kty"),
                            "kid": key.get("kid"),
                            "use": key.get("use"),
                            "n": key.get("n"),
                            "e": key.get("e"),
                        }
                        break

            if not rsa_key:
                return None

            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=["RS256"],
                options={"verify_aud": False}
            )
            return payload
        except JWTError as e:
            print(f"[ClerkAuth] JWT verification error: {e}")
            return None
        except Exception as e:
            print(f"[ClerkAuth] Unexpected error decoding token: {e}")
            return None

    def fetch_user_details(self, clerk_user_id: str) -> Optional[Dict[str, Any]]:
        """Fetch user profile details from Clerk Backend API."""
        if not self.secret_key:
            return None

        try:
            headers = {"Authorization": f"Bearer {self.secret_key}"}
            with httpx.Client(verify=False, timeout=10.0) as client:
                resp = client.get(f"https://api.clerk.com/v1/users/{clerk_user_id}", headers=headers)
                if resp.status_code == 200:
                    return resp.json()
        except Exception as e:
            print(f"[ClerkAuth] Failed to fetch user {clerk_user_id} from Clerk API: {e}")

        return None

    def get_or_sync_user(self, db: Session, clerk_user_id: str, claims: Optional[Dict[str, Any]] = None) -> User:
        """Find existing user by clerk_user_id or auto-provision a new User in PostgreSQL."""
        # 1. Lookup by clerk_user_id
        user = db.query(User).filter(User.clerk_user_id == clerk_user_id).first()
        if user:
            return user

        # 2. Fetch full profile from Clerk REST API
        profile = self.fetch_user_details(clerk_user_id)
        email = None
        username = None
        auth_provider = "clerk"

        if profile:
            # Extract primary email
            email_addresses = profile.get("email_addresses", [])
            if email_addresses:
                email = email_addresses[0].get("email_address")

            # Extract username or fall back to first_name/email prefix
            username = profile.get("username")
            if not username and profile.get("first_name"):
                username = profile.get("first_name")
            if not username and email:
                username = email.split("@")[0]

            # Extract auth provider (e.g. google, github, email)
            external_accounts = profile.get("external_accounts", [])
            if external_accounts:
                auth_provider = external_accounts[0].get("provider", "oauth")
        elif claims:
            email = claims.get("email")
            username = claims.get("username") or clerk_user_id

        if not username:
            username = f"user_{clerk_user_id[:8]}"

        # 3. Check if a local user already exists with this email or username to link
        if email:
            existing_by_email = db.query(User).filter(User.email == email).first()
            if existing_by_email:
                existing_by_email.clerk_user_id = clerk_user_id
                existing_by_email.auth_provider = auth_provider
                db.commit()
                db.refresh(existing_by_email)
                return existing_by_email

        existing_by_username = db.query(User).filter(User.username == username).first()
        if existing_by_username and not existing_by_username.clerk_user_id:
            existing_by_username.clerk_user_id = clerk_user_id
            existing_by_username.email = email or existing_by_username.email
            existing_by_username.auth_provider = auth_provider
            db.commit()
            db.refresh(existing_by_username)
            return existing_by_username

        # If username collision with another clerk user, make it unique
        if existing_by_username and existing_by_username.clerk_user_id != clerk_user_id:
            username = f"{username}_{clerk_user_id[:6]}"

        # 4. Create brand new User
        new_user = User(
            clerk_user_id=clerk_user_id,
            email=email,
            username=username,
            auth_provider=auth_provider,
            hashed_password=""
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user

clerk_auth_service = ClerkAuthService()
