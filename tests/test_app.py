import json
import unittest
from unittest.mock import MagicMock, patch
import zmq
from scale_av_cc.app import app


class TestApp(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_security_headers(self):
        response = self.client.get("/")
        self.assertEqual(response.headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(response.headers.get("X-Frame-Options"), "SAMEORIGIN")

    def test_index_route(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Scale Closed Captioning", response.data)

    def test_static_assets(self):
        js_resp = self.client.get("/js/index.js")
        self.assertEqual(js_resp.status_code, 200)
        self.assertIn(b"startClosedCaptioning", js_resp.data)

        css_resp = self.client.get("/css/index.css")
        self.assertEqual(css_resp.status_code, 200)

        not_found = self.client.get("/nonexistent_file.xyz")
        self.assertEqual(not_found.status_code, 404)

    def test_invalid_room_id(self):
        response = self.client.get("/room/invalid$room%20name/latest")
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data.decode())
        self.assertIn("error", data)

    @patch("scale_av_cc.app.context.socket")
    def test_get_room_latest_success(self, mock_socket_factory):
        mock_socket = MagicMock()
        mock_socket_factory.return_value = mock_socket
        mock_socket.recv_string.return_value = "Captions for Ballroom A."

        response = self.client.get("/room/ballroom-a/latest")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content_type, "application/json")

        data = json.loads(response.data.decode())
        self.assertEqual(data["room"], "ballroom-a")
        self.assertEqual(data["text"], "Captions for Ballroom A.")

        mock_socket.send_string.assert_called_once_with("ballroom-a")
        mock_socket.close.assert_called_once()

    @patch("scale_av_cc.app.context.socket")
    def test_get_room_latest_zmq_error(self, mock_socket_factory):
        mock_socket = MagicMock()
        mock_socket_factory.return_value = mock_socket
        mock_socket.recv_string.side_effect = zmq.ZMQError("Operation timed out")

        response = self.client.get("/room/room-101/latest")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content_type, "application/json")

        data = json.loads(response.data.decode())
        self.assertEqual(data["room"], "room-101")
        # Ensure raw stack trace / error is not leaked to client
        self.assertEqual(data["text"], "Captions temporarily unavailable.")

        mock_socket.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
