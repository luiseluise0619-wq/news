import pytest
from unittest.mock import patch
from collector import collect_all_papers
from schemas import PaperSchema
import datetime

@patch("collector.fetch_arxiv_papers")
@patch("collector.fetch_openalex_papers")
def test_collect_all_papers(mock_openalex, mock_arxiv):
    today = datetime.date.today()
    mock_arxiv.return_value = [
        PaperSchema(
            title="Arxiv Paper",
            authors="Author 1",
            published_date=today,
            abstract="Abstract",
            url="url1",
            source="arXiv",
            category="AI"
        )
    ]
    mock_openalex.return_value = [
        PaperSchema(
            title="OpenAlex Paper",
            authors="Author 2",
            published_date=today,
            abstract="Abstract 2",
            url="url2",
            source="OpenAlex",
            category="Bioinformatics"
        )
    ]

    all_papers = collect_all_papers()
    assert len(all_papers) == 2

    titles = [p.title for p in all_papers]
    assert "Arxiv Paper" in titles
    assert "OpenAlex Paper" in titles
