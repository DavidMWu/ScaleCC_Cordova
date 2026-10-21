import argparse
import logging
import sys
import time
import zmq
from .constants import PUBLISH_ADDRESS
from .textGenerator import get_sentence

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
LOGGER = logging.getLogger(__name__)


def stream_sentence(socket, room, sentence, word_delay=0.2):
    """
    Simulates speech-to-text by streaming sentence words one by one,
    finishing with the terminal punctuation so rectifier aggregates it.
    """
    words = sentence.split()
    for i, word in enumerate(words):
        msg = f"{room} {word}"
        socket.send_string(msg)
        LOGGER.debug("Sent: %s", msg)
        if i < len(words) - 1:
            time.sleep(word_delay)


def run_source(address=None, room="test", mode="stream", interval=2.0, word_delay=0.2, count=0):
    """
    Main loop emitting test captions.
    """
    if address is None:
        address = PUBLISH_ADDRESS.replace("0.0.0.0", "127.0.0.1")

    context = zmq.Context()
    socket = context.socket(zmq.PUB)
    LOGGER.info("Connecting test source to %s for room '%s'...", address, room)
    socket.connect(address)
    # ZMQ connection warmup delay
    time.sleep(0.5)

    sent = 0
    try:
        while count == 0 or sent < count:
            sentence = get_sentence()
            LOGGER.info("[%s] Emitting: %s", room, sentence)
            if mode == "stream":
                stream_sentence(socket, room, sentence, word_delay=word_delay)
            else:
                socket.send_string(f"{room} {sentence}")
            sent += 1
            if count == 0 or sent < count:
                time.sleep(interval)
    except KeyboardInterrupt:
        LOGGER.info("Test source stopped by user.")
    finally:
        socket.close()
        context.term()


def main():
    parser = argparse.ArgumentParser(description="Test caption source for Scale Closed Captions")
    parser.add_argument("--room", default="test", help="Target room (e.g. test, ballroom-de)")
    parser.add_argument("--address", default=None, help="ZMQ Publish address")
    parser.add_argument(
        "--mode",
        choices=["stream", "sentence"],
        default="stream",
        help="Stream word-by-word or full sentence at once"
    )
    parser.add_argument("--interval", type=float, default=2.0, help="Delay between sentences in seconds")
    parser.add_argument("--word-delay", type=float, default=0.2, help="Delay between words in stream mode")
    parser.add_argument("--count", type=int, default=0, help="Number of sentences to emit (0 for continuous loop)")

    args = parser.parse_args()
    run_source(
        address=args.address,
        room=args.room,
        mode=args.mode,
        interval=args.interval,
        word_delay=args.word_delay,
        count=args.count
    )


if __name__ == "__main__":
    main()
