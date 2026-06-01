import asyncio
import websockets

async def test_ws():
    uri = "ws://localhost:8000/api/ws/live"
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected successfully!")
            await websocket.close()
    except Exception as e:
        print(f"Failed: {e}")

asyncio.run(test_ws())
