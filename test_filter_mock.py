from schemas import PaperSchema
from filter import filter_and_score_papers
import datetime

today = datetime.date.today()
old_date = today - datetime.timedelta(days=10)

papers = [
    PaperSchema(title="Paper 1", authors="A", published_date=today, abstract="novel method state-of-the-art", url="url1", doi="doi1", source="arXiv", category="AI", code_url="github"),
    PaperSchema(title="Paper 1", authors="A", published_date=today, abstract="novel method state-of-the-art", url="url1", doi="doi1", source="arXiv", category="AI"), # Duplicate
    PaperSchema(title="Paper 2", authors="B", published_date=today, abstract="short", url="url2", source="arXiv", category="AI"),
    PaperSchema(title="Paper 3", authors="C", published_date=old_date, abstract="old paper", url="url3", source="arXiv", category="AI"), # Old
]

filtered = filter_and_score_papers(papers)
print(f"Count: {len(filtered)}")
for p in filtered:
    print(f"{p.title} - Score: {p.score}")
