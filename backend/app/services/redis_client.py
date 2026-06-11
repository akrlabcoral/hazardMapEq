import json
import logging
import asyncio
import uuid
from typing import AsyncGenerator, Dict, Any

from app.config import settings

try:
    import redis.asyncio as redis
except ImportError:
    redis = None

logger = logging.getLogger("hazardmap.redis")

class RedisPubSubManager:
    """
    Abstract layer for Redis Pub/Sub and Locking integration.
    Falls back to stub mode gracefully if Redis is unavailable.
    """

    def __init__(self, url: str = "redis://localhost:6379"):
        self.url = url
        self._redis = None
        self._pubsub = None
        self._is_connected = False

    async def connect(self) -> None:
        """Initialize the Redis connection pool."""
        if redis is None:
            logger.warning("[Redis] redis-py not installed. Running in Stub Mode.")
            return

        try:
            self._redis = redis.from_url(self.url, decode_responses=True)
            await self._redis.ping()
            self._pubsub = self._redis.pubsub()
            self._is_connected = True
            logger.info(f"[Redis] Successfully connected to {self.url}")
        except Exception as exc:
            logger.warning(f"[Redis] Could not connect to {self.url}: {exc}. Running in Stub Mode.")
            self._redis = None
            self._pubsub = None
            self._is_connected = False

    async def disconnect(self) -> None:
        """Close the Redis connection pool."""
        if self._pubsub:
            await self._pubsub.close()
            self._pubsub = None
        if self._is_connected and self._redis:
            await self._redis.aclose()
            self._is_connected = False
            logger.info("[Redis] Disconnected")

    async def publish(self, channel: str, message: Dict[str, Any]) -> None:
        """Publish a JSON message to a Redis channel."""
        payload = json.dumps(message)
        if not self._is_connected or not self._redis:
            logger.debug(f"[Redis Stub] PUBLISH to {channel}: {payload[:50]}...")
            return
            
        try:
            await self._redis.publish(channel, payload)
        except Exception as exc:
            logger.error(f"[Redis] Failed to publish to {channel}: {exc}")

    async def subscribe(self, channel: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Subscribe to a Redis channel and yield parsed JSON messages."""
        if not self._is_connected or not self._redis:
            logger.info(f"[Redis Stub] Subscribed to {channel} (Stub Mode - waiting forever)")
            try:
                while True:
                    await asyncio.sleep(3600)
                    yield {}
            except asyncio.CancelledError:
                raise
            
        pubsub = self._redis.pubsub()
        try:
            await pubsub.subscribe(channel)
            logger.info(f"[Redis] Subscribed to {channel}")
            async for message in pubsub.listen():
                if message['type'] == 'message':
                    try:
                        yield json.loads(message['data'])
                    except json.JSONDecodeError:
                        logger.error(f"[Redis] Invalid JSON received on {channel}")
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error(f"[Redis] Subscribe loop crashed on {channel}: {exc}")
            raise
        finally:
            await pubsub.close()

    async def acquire_lock_token(self, lock_name: str, expire_seconds: int = 60) -> str | None:
        """
        Attempt to acquire a distributed lock.
        Returns an owner token if acquired, otherwise None.
        """
        if not self._is_connected or not self._redis:
            return "stub-lock" if settings.redis_lock_fail_open else None
            
        try:
            token = uuid.uuid4().hex
            acquired = await self._redis.set(lock_name, token, nx=True, ex=expire_seconds)
            return token if acquired else None
        except Exception as exc:
            logger.error(f"[Redis] Failed to acquire lock {lock_name}: {exc}")
            return "stub-lock" if settings.redis_lock_fail_open else None

    async def acquire_lock(self, lock_name: str, expire_seconds: int = 60) -> bool:
        """Compatibility helper for callers that only need a yes/no lock."""
        return await self.acquire_lock_token(lock_name, expire_seconds) is not None

    async def release_lock(self, lock_name: str, token: str | None) -> bool:
        if not token or token == "stub-lock":
            return False
        if not self._is_connected or not self._redis:
            return False

        script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        end
        return 0
        """
        try:
            return bool(await self._redis.eval(script, 1, lock_name, token))
        except Exception as exc:
            logger.error(f"[Redis] Failed to release lock {lock_name}: {exc}")
            return False

# Global instance intended to be initialized during app startup
redis_manager = RedisPubSubManager(settings.redis_url)
