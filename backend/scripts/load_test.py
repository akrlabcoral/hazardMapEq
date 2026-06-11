import asyncio
import time
import logging
import os
import aiohttp
import websockets

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("load_test")

WS_URL = os.getenv("LOAD_TEST_WS_URL", "ws://localhost:8000/api/ws/live")
SIMULATE_URL = os.getenv("LOAD_TEST_SIMULATE_URL", "http://localhost:8000/api/simulate-earthquake")

# Track successfully connected sockets
connected_sockets = []

async def connect_client(client_id: int):
    try:
        async with websockets.connect(WS_URL, ping_interval=None) as ws:
            connected_sockets.append(ws)
            try:
                async for message in ws:
                    pass
            except websockets.exceptions.ConnectionClosed:
                pass
    except Exception as e:
        if client_id == 0:
            logger.error(f"WS connect error sample: {e}")

async def spawn_clients(count: int):
    logger.info(f"Spawning {count} websocket clients...")
    # Spawn in batches to avoid overwhelming local OS port exhaustion instantly
    batch_size = 500
    for i in range(0, count, batch_size):
        batch = range(i, min(i + batch_size, count))
        tasks = [asyncio.create_task(connect_client(cid)) for cid in batch]
        await asyncio.sleep(1) # Let the server accept connections
    
    # Wait for connections to stabilize
    await asyncio.sleep(3)
    logger.info(f"Successfully connected {len(connected_sockets)} out of {count} requested clients.")

async def trigger_burst(burst_size: int):
    logger.info(f"Triggering burst of {burst_size} simulations...")
    async with aiohttp.ClientSession() as session:
        tasks = []
        for i in range(burst_size):
            payload = {
                "latitude": 28.61, # Delhi
                "longitude": 77.23,
                "magnitude": 6.5,
                "depth": 10.0
            }
            tasks.append(session.post(SIMULATE_URL, json=payload))
        
        start = time.time()
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        end = time.time()
        
        successes = sum(1 for r in responses if getattr(r, 'status', 0) in {200, 202})
        logger.info(f"Burst complete: {successes}/{burst_size} accepted in {end - start:.2f} seconds.")
        if successes == 0 and responses:
            logger.error(f"Burst error sample: {responses[0]}")

async def main():
    target_users = [1000, 5000]
    
    for users in target_users:
        global connected_sockets
        connected_sockets = []
        
        logger.info("=" * 50)
        logger.info(f"Starting Phase: {users} Concurrent Users")
        logger.info("=" * 50)
        
        # 1. Spawn websockets
        spawn_task = asyncio.create_task(spawn_clients(users))
        await asyncio.sleep(5) # give it time to spawn before bursting
        
        # 2. Trigger Burst
        await trigger_burst(50)
        
        # Wait a bit to let RQ workers process the queue
        logger.info("Waiting 15 seconds to monitor server stability and RQ processing...")
        await asyncio.sleep(15)
        
        # Cancel clients
        spawn_task.cancel()
        for ws in connected_sockets:
            await ws.close()
            
        logger.info(f"Phase {users} complete.\n")

if __name__ == "__main__":
    asyncio.run(main())
