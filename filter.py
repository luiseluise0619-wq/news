from typing import List, Dict
from schemas import PaperSchema
from datetime import date, timedelta
import re

def deduplicate_papers(papers: List[PaperSchema]) -> List[PaperSchema]:
    """Removes duplicate papers based on DOI, URL, or Title."""
    seen_dois = set()
    seen_urls = set()
    seen_titles = set()

    unique_papers = []

    for paper in papers:
        # Standardize title for comparison
        clean_title = re.sub(r'[^a-zA-Z0-9]', '', paper.title.lower())

        is_duplicate = False

        if paper.doi and paper.doi in seen_dois:
            is_duplicate = True
        elif paper.url and paper.url in seen_urls:
            is_duplicate = True
        elif clean_title in seen_titles:
            is_duplicate = True

        if not is_duplicate:
            unique_papers.append(paper)
            if paper.doi:
                seen_dois.add(paper.doi)
            if paper.url:
                seen_urls.add(paper.url)
            seen_titles.add(clean_title)

    return unique_papers

def filter_by_date(papers: List[PaperSchema], max_days_old: int = 7) -> List[PaperSchema]:
    """Filters out papers older than max_days_old."""
    cutoff_date = date.today() - timedelta(days=max_days_old)
    return [p for p in papers if p.published_date >= cutoff_date]

def calculate_score(paper: PaperSchema) -> float:
    """Calculates a heuristic score for the paper."""
    score = 0.0

    # Base score
    score += 1.0

    # Reward presence of artifacts
    if paper.code_url:
        score += 2.0
    if paper.dataset_url:
        score += 2.0

    # Reward long, detailed abstracts (heuristic for information content)
    abstract_words = len(paper.abstract.split())
    if 100 < abstract_words < 500:
        score += 1.0

    # Keywords heuristic
    important_keywords = ["state-of-the-art", "sota", "novel", "outperforms", "dataset", "framework", "architecture"]
    abstract_lower = paper.abstract.lower()
    for kw in important_keywords:
        if kw in abstract_lower:
            score += 0.5

    return score

def filter_and_score_papers(papers: List[PaperSchema], max_days_old: int = 7, top_k: int = 10) -> List[PaperSchema]:
    """Runs the full filtering and scoring pipeline."""
    # 1. Date filter
    recent_papers = filter_by_date(papers, max_days_old)

    # 2. Deduplicate
    unique_papers = deduplicate_papers(recent_papers)

    # 3. Score
    for paper in unique_papers:
        paper.score = calculate_score(paper)

    # 4. Sort and select Top K
    unique_papers.sort(key=lambda p: p.score, reverse=True)
    return unique_papers[:top_k]
