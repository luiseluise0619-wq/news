from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import uvicorn
from apscheduler.schedulers.background import BackgroundScheduler
from pipeline import run_daily_pipeline
from fastapi import Request, Depends, Query
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from datetime import date
from database import engine, Base, get_db
from models import DailyBrief, Paper, PaperSummary, DailyBriefPaper

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Daily Research Brief")
app.mount("/static", StaticFiles(directory="templates"), name="static") # For any potential static files
templates = Jinja2Templates(directory="templates")

# Configure Scheduler
scheduler = BackgroundScheduler()
# Run daily at 06:00 AM
scheduler.add_job(run_daily_pipeline, 'cron', hour=6, minute=0)

@app.on_event("startup")
def start_scheduler():
    scheduler.start()
    print("Scheduler started.")
    print("Scheduled Jobs:")
    for job in scheduler.get_jobs():
        print(f" - {job.name} next run at: {job.next_run_time}")

@app.on_event("shutdown")
def stop_scheduler():
    scheduler.shutdown()
    print("Scheduler stopped.")

# --- ROUTES ---

@app.get("/")
def read_root(request: Request, date_param: str = Query(None, alias="date"), db: Session = Depends(get_db)):
    """Homepage showing today's or a specific day's Daily Brief."""

    if date_param:
        try:
            target_date = date.fromisoformat(date_param)
            brief = db.query(DailyBrief).filter(DailyBrief.date == target_date).first()
        except ValueError:
            brief = None
    else:
        brief = db.query(DailyBrief).order_by(DailyBrief.date.desc()).first()

    if not brief:
        return templates.TemplateResponse(request=request, name="index.html", context={"brief": None, "top_3": [], "other_papers": [], "trends": []})

    trends = brief.trends

    # Get all papers in this brief, ordered by rank
    brief_papers = db.query(DailyBriefPaper).filter(DailyBriefPaper.brief_id == brief.id).order_by(DailyBriefPaper.rank).all()

    top_3 = [bp.summary.paper for bp in brief_papers if bp.is_top_3 == 1]
    other_papers = [bp.summary.paper for bp in brief_papers if bp.is_top_3 == 0]

    return templates.TemplateResponse(request=request, name="index.html", context={
        "brief": brief,
        "top_3": top_3,
        "other_papers": other_papers,
        "trends": trends
    })

@app.get("/archive")
def read_archive(request: Request, db: Session = Depends(get_db)):
    """List of past briefs."""
    briefs = db.query(DailyBrief).order_by(DailyBrief.date.desc()).all()
    return templates.TemplateResponse(request=request, name="archive.html", context={"briefs": briefs})

@app.get("/search")
def search_papers(request: Request, q: str = Query(None), db: Session = Depends(get_db)):
    """Search for papers."""
    papers = []
    if q:
        search_term = f"%{q}%"
        papers = db.query(Paper).filter(
            (Paper.title.ilike(search_term)) |
            (Paper.authors.ilike(search_term)) |
            (Paper.category.ilike(search_term))
        ).all()

    return templates.TemplateResponse(request=request, name="search.html", context={"papers": papers, "query": q})

@app.get("/paper/{paper_id}")
def read_paper(request: Request, paper_id: int, db: Session = Depends(get_db)):
    """Detailed view of a paper and its summary."""
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    return templates.TemplateResponse(request=request, name="detail.html", context={"paper": paper})

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
