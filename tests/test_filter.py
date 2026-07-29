import pytest
import datetime
from schemas import PaperSchema
from filter import deduplicate_papers, filter_by_date, calculate_score

@pytest.fixture
def mock_papers():
    today = datetime.date.today()
    old_date = today - datetime.timedelta(days=10)

    return [
        PaperSchema(
            title="A Novel Architecture for LLMs",
            authors="John Doe",
            published_date=today,
            abstract="We present a novel architecture that achieves state-of-the-art results on several benchmarks. " * 20,
            url="http://example.com/1",
            doi="10.123/1",
            source="arXiv",
            category="Artificial Intelligence",
            code_url="http://github.com/1"
        ),
        PaperSchema(
            title="A Novel Architecture for LLMs", # Duplicate by title and doi
            authors="John Doe",
            published_date=today,
            abstract="Duplicate.",
            url="http://example.com/1-alt",
            doi="10.123/1",
            source="arXiv",
            category="Artificial Intelligence"
        ),
        PaperSchema(
            title="Old Research Paper",
            authors="Jane Smith",
            published_date=old_date,
            abstract="This is an old paper.",
            url="http://example.com/2",
            doi="10.123/2",
            source="OpenAlex",
            category="Data Science"
        ),
        PaperSchema(
            title="Short Paper",
            authors="Alice",
            published_date=today,
            abstract="Short.",
            url="http://example.com/3",
            doi="10.123/3",
            source="arXiv",
            category="Machine Learning"
        )
    ]

def test_deduplicate_papers(mock_papers):
    unique = deduplicate_papers(mock_papers)
    assert len(unique) == 3
    dois = [p.doi for p in unique]
    assert dois.count("10.123/1") == 1

def test_filter_by_date(mock_papers):
    recent = filter_by_date(mock_papers, max_days_old=7)
    assert len(recent) == 3 # 1 duplicate, 2 other new ones
    for p in recent:
        assert p.title != "Old Research Paper"

def test_calculate_score(mock_papers):
    best_paper = mock_papers[0]
    short_paper = mock_papers[3]

    score1 = calculate_score(best_paper)
    score2 = calculate_score(short_paper)

    assert score1 > score2
    # Base (1) + Code (2) + Length (1) + Keywords (1 for novel, 1 for architecture, 1 for state-of-the-art -> actually it counts per keyword found)
    # Important keywords: state-of-the-art, novel, architecture.
    assert score1 >= 4.0
