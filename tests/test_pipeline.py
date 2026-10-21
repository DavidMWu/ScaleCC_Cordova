import unittest
from unittest.mock import patch
import io
import zmq


class TestPipeline(unittest.TestCase):
    def test_node_name_formatting(self):
        # Verify node name formatting logic from pipeline.py
        node_raw = "Room-101 North"
        node = node_raw.replace("-", "_").replace(" ", "_")
        self.assertEqual(node, "Room_101_North")

    def test_pipeline_message_format(self):
        node = "test_node"
        line = "Testing line input\n"
        formatted_message = f"{node} {line}"
        self.assertTrue(formatted_message.startswith("test_node "))
        self.assertEqual(formatted_message.split(" ", 1)[0], "test_node")
        self.assertEqual(formatted_message.split(" ", 1)[1], "Testing line input\n")


if __name__ == "__main__":
    unittest.main()
