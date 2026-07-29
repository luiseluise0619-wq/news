from schemas import PaperSchema
from ai_analyzer import analyze_paper
import datetime
import os

# Ensure we have a valid dummy key or use a mock if we want to actually call the API
# For this test we will just check if the module compiles and runs structurally.
# Actually we can't reliably hit OpenAI API without the user's real key or paying.
# We'll use a mocked API or just inspect the code structure.

print("Analyzer module loaded successfully.")
