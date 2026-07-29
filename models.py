from sqlalchemy import Column, Integer, String, Date, Text, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
import datetime
from database import Base

class Paper(Base):
    __tablename__ = "papers"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    authors = Column(String)  # comma separated or json
    published_date = Column(Date, index=True)
    abstract = Column(Text)
    url = Column(String)
    doi = Column(String, index=True, nullable=True)
    source = Column(String)
    category = Column(String, index=True)
    pdf_url = Column(String, nullable=True)
    code_url = Column(String, nullable=True)
    dataset_url = Column(String, nullable=True)

    score = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    summary = relationship("PaperSummary", back_populates="paper", uselist=False)


class PaperSummary(Base):
    __tablename__ = "paper_summaries"

    id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("papers.id"), unique=True)

    one_line_summary = Column(String)
    problem = Column(Text)
    method = Column(Text)
    results = Column(Text)
    novelty = Column(Text)
    limitations = Column(Text)
    practical_application = Column(Text)
    importance = Column(Text)
    related_fields = Column(String)
    importance_score = Column(Float)
    reading_level = Column(String)

    # Relationship
    paper = relationship("Paper", back_populates="summary")
    daily_brief_associations = relationship("DailyBriefPaper", back_populates="summary")


class DailyBrief(Base):
    __tablename__ = "daily_briefs"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, index=True, unique=True)
    takeaway = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    papers = relationship("DailyBriefPaper", back_populates="brief")
    trends = relationship("Trend", back_populates="brief")


class DailyBriefPaper(Base):
    __tablename__ = "daily_brief_papers"

    id = Column(Integer, primary_key=True, index=True)
    brief_id = Column(Integer, ForeignKey("daily_briefs.id"))
    summary_id = Column(Integer, ForeignKey("paper_summaries.id"))
    rank = Column(Integer)  # 1 to 10
    is_top_3 = Column(Integer, default=0) # 0 or 1 for boolean

    brief = relationship("DailyBrief", back_populates="papers")
    summary = relationship("PaperSummary", back_populates="daily_brief_associations")


class Trend(Base):
    __tablename__ = "trends"

    id = Column(Integer, primary_key=True, index=True)
    brief_id = Column(Integer, ForeignKey("daily_briefs.id"))
    content = Column(String)

    brief = relationship("DailyBrief", back_populates="trends")
