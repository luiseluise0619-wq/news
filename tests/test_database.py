import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base
from models import Paper, PaperSummary, DailyBrief
import datetime

@pytest.fixture
def db_session():
    # Use in-memory SQLite for testing database operations
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()

def test_create_paper_and_summary(db_session):
    # Test paper creation
    new_paper = Paper(
        title="DB Test Paper",
        authors="Test Author",
        published_date=datetime.date.today(),
        abstract="Test abstract.",
        url="http://test.com",
        source="Test",
        category="AI"
    )
    db_session.add(new_paper)
    db_session.commit()

    assert new_paper.id is not None

    # Test summary creation and relationship
    new_summary = PaperSummary(
        paper_id=new_paper.id,
        one_line_summary="Short text.",
        problem="Problem",
        method="Method",
        results="Results",
        novelty="Novelty",
        limitations="None",
        practical_application="Yes",
        importance="High",
        related_fields="AI",
        importance_score=9.5,
        reading_level="Advanced"
    )
    db_session.add(new_summary)
    db_session.commit()

    assert new_summary.id is not None
    assert new_paper.summary.id == new_summary.id

def test_daily_brief_creation(db_session):
    today = datetime.date.today()
    brief = DailyBrief(date=today, takeaway="Test takeaway")
    db_session.add(brief)
    db_session.commit()

    assert brief.id is not None
    assert brief.date == today
