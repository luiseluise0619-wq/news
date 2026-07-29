import pytest
from unittest.mock import patch
from pipeline import run_daily_pipeline
from schemas import PaperSchema
from ai_analyzer import PaperAnalysisOutput, Top3Selection, TrendAnalysis
from models import DailyBrief
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base
import datetime
import pipeline

@pytest.fixture
def mock_db_session():
    # Use in-memory DB for pipeline tests
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Patch the session maker in the pipeline module
    original_session_local = pipeline.SessionLocal
    pipeline.SessionLocal = TestingSessionLocal
    yield TestingSessionLocal()
    pipeline.SessionLocal = original_session_local

@patch("pipeline.collect_all_papers")
@patch("pipeline.analyze_paper")
@patch("pipeline.select_top_3")
@patch("pipeline.extract_trends")
def test_run_daily_pipeline(mock_extract_trends, mock_select_top_3, mock_analyze_paper, mock_collect_all_papers, mock_db_session):
    today = datetime.date.today()

    # 1. Mock Data Collection
    papers = []
    for i in range(12):
        papers.append(PaperSchema(
            title=f"Paper {i}",
            authors="Test",
            published_date=today,
            abstract="Abstract " * 20,
            url=f"http://test.com/{i}",
            doi=f"10.test/{i}",
            source="arXiv",
            category="AI",
            score=float(i) # Ensure varied scores
        ))
    mock_collect_all_papers.return_value = papers

    # 2. Mock AI Analysis
    mock_analyze_paper.return_value = PaperAnalysisOutput(
        one_line_summary="Summary", problem="P", method="M", results="R",
        novelty="N", limitations="L", practical_application="PA",
        importance="I", related_fields="AI", importance_score=9.0, reading_level="B"
    )

    mock_select_top_3.return_value = Top3Selection(top_1_id=0, top_2_id=1, top_3_id=2)
    mock_extract_trends.return_value = TrendAnalysis(
        trends=["Trend 1", "Trend 2", "Trend 3"],
        takeaway="Test daily takeaway"
    )

    # 3. Run Pipeline
    run_daily_pipeline()

    # 4. Verify DB State
    brief = mock_db_session.query(DailyBrief).filter(DailyBrief.date == today).first()

    assert brief is not None
    assert brief.takeaway == "Test daily takeaway"
    assert len(brief.trends) == 3
    assert len(brief.papers) == 10

    # Check top 3 logic
    top_3_count = sum([1 for p in brief.papers if p.is_top_3 == 1])
    assert top_3_count == 3
