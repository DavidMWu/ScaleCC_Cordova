""" Evil Diary Generator

Generate my evil diary entries using MAD-libs! BWAHAHAHAHAHA suffer my EVIL puns too!
"""
import random
import re
import datetime

VERBS = ["slithered", "schemed", "construed", "vaporized", "hammered", "perturbed", "packed", "engineered", "extorted",
         "broke", "lamented", "harnessed", "exploded", "concussed", "capsized", "created", "fought", "failed",
         "succeeded", "destroyed", "threatened", "gifted", "garnered", "granted", "torched", "welded", "quacked",
         "dealt", "demolished", "devastated", "ate", "cartwheeled", "catapulted", "danced", "ducked", "monologued",
         "yeet-ed"]

ADVERBS = ["quickly", "quietly", "vehemently", "haphazardly", "happily", "evilly", "pompously", "proudly", "foolishly",
           "rudely", "slowly"]

PREPOSITIONS = ["into", "around", "through", "within", "up", ""]

ADJECTIVES = ["blue", "suspicious", "pretentious", "purple", "massive", "angry", "determined", "pink", "voluminous",
              "luminous", "unhappy", "piercing", "downtrodden"]

NOUNS = ["the Lab", "graduate assistants", "robots", "the Kraken", "Thor", "Ferb", "tree", "tacos", "toothpaste",
         "Omaha", "toaster", "behemoth", "satellite", "keyboard", "circuits", "code", "submarine", "sailboat", "bird",
         "airplane", "bolts"]

CONJUNCTIONS = ["and", "or", "but"]

MAD_LIB = "{verb} {adverb} {preposition} {adjective} {noun} {conjunction} {noun} {verb} {adverb}."
PATTERN = re.compile(r"\{([a-z]+)}")


TOKEN_MAP = {
    "verb": VERBS,
    "adverb": ADVERBS,
    "preposition": PREPOSITIONS,
    "adjective": ADJECTIVES,
    "noun": NOUNS,
    "conjunction": CONJUNCTIONS,
}


def get_token(token_type):
    """ Get a token of a given type"""
    token_key = token_type.lower()
    if token_key not in TOKEN_MAP:
        raise ValueError(f"Unknown token type: {token_type}")
    listing = TOKEN_MAP[token_key]
    return random.choice(listing)


def get_sentence():
    """ Gets a sentence filled in and ready to go. """
    sentence = MAD_LIB
    matches = PATTERN.findall(sentence)

    # Find replacements
    previous = None
    replacements = []
    for capture in matches:
        randomize = get_token(capture)
        if capture == "noun" and previous == "adjective" and randomize.lower().startswith("the"):
            replacements[-1] = "the" + replacements[-1]
            replacements.append(randomize.lower().replace("the ", "").capitalize())
        elif not previous:
            replacements.append(randomize.capitalize())
        else:
            replacements.append(randomize)
        previous = capture
    while PATTERN.search(sentence):
        sentence = PATTERN.sub(replacements.pop(0), sentence, 1)
    return sentence


def build_paragraph():
    """ Builds a paragraph """
    return " ".join([get_sentence() for _ in range(0, random.randint(1, 8))])


def build_entry():
    """ Builds a paragraph entry """
    return "\n\n".join([build_paragraph() for _ in range(0, random.randint(1, 3))])