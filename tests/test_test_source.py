import unittest
from unittest.mock import MagicMock, patch
from scale_av_cc import test_source


class TestTestSource(unittest.TestCase):
    def test_stream_sentence_emits_words(self):
        mock_socket = MagicMock()
        test_source.stream_sentence(mock_socket, "room-103", "Hello world test.", word_delay=0.001)

        self.assertEqual(mock_socket.send_string.call_count, 3)
        mock_socket.send_string.assert_any_call("room-103 Hello")
        mock_socket.send_string.assert_any_call("room-103 world")
        mock_socket.send_string.assert_any_call("room-103 test.")

    @patch("scale_av_cc.test_source.zmq.Context")
    @patch("scale_av_cc.test_source.get_sentence")
    def test_run_source_count_limit(self, mock_get_sentence, mock_context_cls):
        mock_context = MagicMock()
        mock_socket = MagicMock()
        mock_context_cls.return_value = mock_context
        mock_context.socket.return_value = mock_socket
        mock_get_sentence.return_value = "Sample generated sentence."

        test_source.run_source(
            address="tcp://127.0.0.1:4040",
            room="room-103",
            mode="sentence",
            interval=0.01,
            count=2
        )

        # Should send 2 sentences
        self.assertEqual(mock_socket.send_string.call_count, 2)
        mock_socket.send_string.assert_called_with("room-103 Sample generated sentence.")
        mock_socket.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
