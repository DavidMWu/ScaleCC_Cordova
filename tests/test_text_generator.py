import unittest
from scale_av_cc import textGenerator


class TestTextGenerator(unittest.TestCase):
    def test_get_token_valid_types(self):
        token_types = ["verb", "adverb", "preposition", "adjective", "noun", "conjunction"]
        for token_type in token_types:
            token = textGenerator.get_token(token_type)
            expected_list = getattr(textGenerator, f"{token_type.upper()}S")
            self.assertIn(token, expected_list)

    def test_get_token_invalid_type_raises(self):
        with self.assertRaises(ValueError):
            textGenerator.get_token("nonexistent_type")

    def test_get_sentence(self):
        sentence = textGenerator.get_sentence()
        self.assertIsInstance(sentence, str)
        self.assertTrue(len(sentence) > 0)
        self.assertTrue(sentence.endswith("."))
        self.assertTrue(sentence[0].isupper())

    def test_build_paragraph(self):
        paragraph = textGenerator.build_paragraph()
        self.assertIsInstance(paragraph, str)
        self.assertTrue(len(paragraph) > 0)
        self.assertTrue(paragraph.endswith("."))

    def test_build_entry(self):
        entry = textGenerator.build_entry()
        self.assertIsInstance(entry, str)
        self.assertTrue(len(entry) > 0)
        paragraphs = entry.split("\n\n")
        self.assertGreaterEqual(len(paragraphs), 1)
        for p in paragraphs:
            self.assertTrue(len(p) > 0)


if __name__ == "__main__":
    unittest.main()
