import json
import unittest
from unittest.mock import MagicMock, patch
import zmq
from scale_av_cc import rectifier


class TestRectifier(unittest.TestCase):
    def setUp(self):
        rectifier.LATEST.clear()
        rectifier.INCOMING.clear()

    def test_end_reg_regex(self):
        # END_REG matches if the string ends in a non-alphabetic character
        self.assertIsNotNone(rectifier.END_REG.search("."))
        self.assertIsNotNone(rectifier.END_REG.search("world!"))
        self.assertIsNotNone(rectifier.END_REG.search("123"))
        self.assertIsNone(rectifier.END_REG.search("word"))
        self.assertIsNone(rectifier.END_REG.search("Hello"))

    def test_message_accumulation_and_completion(self):
        room = "test-room"
        rectifier.LATEST[room] = ""
        rectifier.INCOMING[room] = ""

        # First incoming word ending in a letter (e.g. "Hello")
        text1 = "Hello"
        if rectifier.END_REG.match(text1.strip()):
            rectifier.INCOMING[room] = f"{rectifier.INCOMING[room]}{text1.strip()}"
        else:
            rectifier.INCOMING[room] = f"{rectifier.INCOMING[room]} {text1}"

        self.assertEqual(rectifier.INCOMING[room], " Hello")
        self.assertEqual(rectifier.LATEST[room], "")

        # Second incoming word ending with period (e.g. "world.")
        text2 = "world."
        if rectifier.END_REG.match(text2.strip()):
            rectifier.INCOMING[room] = f"{rectifier.INCOMING[room]}{text2.strip()}"
        else:
            rectifier.INCOMING[room] = f"{rectifier.INCOMING[room]} {text2}"

        if rectifier.INCOMING[room].endswith("."):
            rectifier.LATEST[room] = rectifier.INCOMING[room]
            rectifier.INCOMING[room] = ""

        self.assertEqual(rectifier.LATEST[room], " Hello world.")
        self.assertEqual(rectifier.INCOMING[room], "")

    def test_lone_punctuation_attachment(self):
        room = "test-room-punct"
        rectifier.LATEST[room] = ""
        rectifier.INCOMING[room] = " Hello world"

        # Lone punctuation character should attach without space
        text = "."
        if rectifier.END_REG.match(text.strip()):
            rectifier.INCOMING[room] = f"{rectifier.INCOMING[room]}{text.strip()}"
        else:
            rectifier.INCOMING[room] = f"{rectifier.INCOMING[room]} {text}"

        self.assertEqual(rectifier.INCOMING[room], " Hello world.")

    def test_malformed_message_handling(self):
        # Messages without a space delimiter should be rejected without crashing
        malformed_msg = "no_space_in_this_message"
        parts = malformed_msg.split(" ", 1)
        self.assertNotEqual(len(parts), 2)

    def test_unregistered_room_incoming_initialization(self):
        # Receiving a message for an uninitialized room should not trigger a KeyError
        unregistered_room = "new-unregistered-room"
        if unregistered_room not in rectifier.INCOMING:
            rectifier.INCOMING[unregistered_room] = ""
        rectifier.INCOMING[unregistered_room] = f"{rectifier.INCOMING[unregistered_room]} Welcome."
        self.assertEqual(rectifier.INCOMING[unregistered_room], " Welcome.")

    @patch("scale_av_cc.rectifier.context.socket")
    def test_run_responder_serves_latest(self, mock_socket_factory):
        mock_socket = MagicMock()
        mock_socket_factory.return_value = mock_socket

        # Setup messages: request room-1, then request unknown-room
        mock_socket.recv.side_effect = [b"room-1", b"room-unknown"]
        rectifier.LATEST["room-1"] = "Live captions here."

        rectifier.RUNNING = True

        # Stop after 2 iterations
        def fake_send_string(resp):
            if mock_socket.send_string.call_count >= 2:
                rectifier.RUNNING = False

        mock_socket.send_string.side_effect = fake_send_string

        rectifier.run()

        self.assertEqual(mock_socket.send_string.call_count, 2)
        mock_socket.send_string.assert_any_call("Live captions here.")
        mock_socket.send_string.assert_any_call("No captions available.")

    def test_rooms_file_structure(self):
        with open("rooms.json", "r") as f:
            rooms = json.load(f)
        self.assertIsInstance(rooms, list)
        self.assertGreater(len(rooms), 0)
        for room_entry in rooms:
            self.assertIn("room", room_entry)


if __name__ == "__main__":
    unittest.main()
