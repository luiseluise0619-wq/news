from sqlalchemy.orm import Session
from datetime import date
from database import SessionLocal
from models import Paper, PaperSummary, DailyBrief, DailyBriefPaper, Trend
from collector import collect_all_papers
from filter import filter_and_score_papers
from ai_analyzer import analyze_paper, select_top_3, extract_trends

def run_daily_pipeline():
    """Runs the full pipeline to generate the Daily Brief."""
    print("Starting daily pipeline...")
    db = SessionLocal()

    try:
        today = date.today()

        # Check if today's brief already exists
        existing_brief = db.query(DailyBrief).filter(DailyBrief.date == today).first()
        if existing_brief:
            print("Daily brief for today already exists.")
            return

        # 1. Collect
        print("Collecting papers...")
        raw_papers = collect_all_papers()
        print(f"Collected {len(raw_papers)} raw papers.")

        if not raw_papers:
            print("No papers collected.")
            return

        # 2. Filter & Score (Top 10)
        print("Filtering and scoring...")
        top_10_schemas = filter_and_score_papers(raw_papers, max_days_old=7, top_k=10)
        print(f"Selected {len(top_10_schemas)} top papers.")

        if not top_10_schemas:
            print("No top papers selected.")
            return

        # 3. AI Analysis
        print("Analyzing top papers with AI...")
        summaries = []
        for p in top_10_schemas:
            summary = analyze_paper(p)
            summaries.append(summary)

        print("Selecting Top 3...")
        top_3_indices = select_top_3(top_10_schemas, summaries)
        top_3_set = {top_3_indices.top_1_id, top_3_indices.top_2_id, top_3_indices.top_3_id}

        print("Extracting Trends...")
        trends_analysis = extract_trends(top_10_schemas, summaries)

        # 4. Save to Database
        print("Saving to database...")

        # Create Daily Brief
        brief = DailyBrief(date=today, takeaway=trends_analysis.takeaway)
        db.add(brief)
        db.commit()

        # Add Trends
        for t_content in trends_analysis.trends:
            db.add(Trend(brief_id=brief.id, content=t_content))

        # Add Papers and Summaries
        for i, (p_schema, p_summary) in enumerate(zip(top_10_schemas, summaries)):
            # Check if paper already exists (by URL or DOI)
            paper_query = db.query(Paper)
            if p_schema.doi:
                existing_paper = paper_query.filter(Paper.doi == p_schema.doi).first()
            else:
                existing_paper = paper_query.filter(Paper.url == p_schema.url).first()

            if existing_paper:
                db_paper = existing_paper
            else:
                db_paper = Paper(
                    title=p_schema.title,
                    authors=p_schema.authors,
                    published_date=p_schema.published_date,
                    abstract=p_schema.abstract,
                    url=p_schema.url,
                    doi=p_schema.doi,
                    source=p_schema.source,
                    category=p_schema.category,
                    pdf_url=p_schema.pdf_url,
                    code_url=p_schema.code_url,
                    dataset_url=p_schema.dataset_url,
                    score=p_schema.score
                )
                db.add(db_paper)
                db.commit() # Commit to get ID

            # Check if summary already exists
            existing_summary = db.query(PaperSummary).filter(PaperSummary.paper_id == db_paper.id).first()
            if existing_summary:
                db_summary = existing_summary
            else:
                db_summary = PaperSummary(
                    paper_id=db_paper.id,
                    one_line_summary=p_summary.one_line_summary,
                    problem=p_summary.problem,
                    method=p_summary.method,
                    results=p_summary.results,
                    novelty=p_summary.novelty,
                    limitations=p_summary.limitations,
                    practical_application=p_summary.practical_application,
                    importance=p_summary.importance,
                    related_fields=p_summary.related_fields,
                    importance_score=p_summary.importance_score,
                    reading_level=p_summary.reading_level
                )
                db.add(db_summary)
                db.commit() # Commit to get ID

            # Associate with Daily Brief
            is_top_3 = 1 if i in top_3_set else 0
            db.add(DailyBriefPaper(
                brief_id=brief.id,
                summary_id=db_summary.id,
                rank=i+1,
                is_top_3=is_top_3
            ))

        db.commit()
        print("Pipeline finished successfully.")

    except Exception as e:
        db.rollback()
        print(f"Error in pipeline: {e}")
    finally:
        db.close()
