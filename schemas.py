from pydantic import BaseModel, HttpUrl, Field
from typing import Optional, List
from datetime import date

class PaperSchema(BaseModel):
    title: str
    authors: str
    published_date: date
    abstract: str
    url: str
    doi: Optional[str] = None
    source: str
    category: str
    pdf_url: Optional[str] = None
    code_url: Optional[str] = None
    dataset_url: Optional[str] = None

    score: float = 0.0
