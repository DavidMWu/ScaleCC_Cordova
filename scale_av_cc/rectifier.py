import re
import json
import logging
import threading
from .constants import REQUEST_ADDRESS, PUBLISH_ADDRESS

import zmq

logging.getLogger().setLevel(logging.DEBUG)
logging.info("Logging system initialized!")

LOGGER = logging.getLogger(__name__)

RUNNING = True
LATEST = {}
INCOMING = {}
END_REG = re.compile(r"[^a-zA-Z]$")

context = zmq.Context()


def run():
    """ Run the thread accepting connections """
    LOGGER.info("Binding requests to: %s", REQUEST_ADDRESS)
    socket = context.socket(zmq.REP)
    socket.bind(REQUEST_ADDRESS)
    while RUNNING:
        message = socket.recv().decode()
        LOGGER.debug("Received message: %s", message)
        socket.send_string(LATEST.get(message, "No captions available."))


def loop(rooms):
    """ Run the main loop """
    global RUNNING
    global LATEST
    socket = context.socket(zmq.SUB)
    logging.info("Binding publish to: %s", PUBLISH_ADDRESS)
    socket.bind(PUBLISH_ADDRESS)
    while True:
        for room in rooms:
            name = room.get("room", "--unknown--")
            if name in LATEST:
                continue
            try:
                logging.info("Subscribing to '%s'", name)
                socket.setsockopt_string(zmq.SUBSCRIBE, name)
                LATEST[name] = ""
                INCOMING[name] = ""
            except zmq.ZMQError:
                logging.warning("Failed to subscribe '%s'", name)
        latest = socket.recv_string()
        parts = latest.split(" ", 1)
        if len(parts) != 2:
            LOGGER.warning("Malformed message received: %s", latest)
            continue
        room, text = parts
        if room not in INCOMING:
            INCOMING[room] = ""
        INCOMING[room] = f"{INCOMING[room]}{text.strip()}" if END_REG.match(text.strip()) else  f"{INCOMING[room]} {text}"
        if INCOMING[room].endswith("."):
            LATEST[room] = INCOMING[room]
            INCOMING[room] = ""
            print(f"[DEBUG] {room} {LATEST[room]}")


def main():
    """ Main function. Hi Lewis!!! """
    with open("rooms.json", "r") as file_handle:
        rooms = json.load(file_handle)
    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    # Build a socket subscribed to all channels
    loop(rooms)


if __name__ == "__main__":
    main()
