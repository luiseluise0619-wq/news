import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai")
    LLM_API_KEY = os.getenv("LLM_API_KEY", "")
    LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
    DB_URL = os.getenv("DB_URL", "sqlite:///./research_brief.db")
    FETCH_PAPERS_DAYS = int(os.getenv("FETCH_PAPERS_DAYS", "7"))

config = Config()
