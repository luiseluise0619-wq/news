import json
from openai import OpenAI
from pydantic import BaseModel, Field
from typing import List, Dict, Any
from config import config
from schemas import PaperSchema

client = OpenAI(api_key=config.LLM_API_KEY)

class PaperAnalysisOutput(BaseModel):
    one_line_summary: str = Field(..., description="A one-line core summary of the paper.")
    problem: str = Field(..., description="What problem does this paper solve?")
    method: str = Field(..., description="What is the core method?")
    results: str = Field(..., description="What are the main results? Include exact numbers if present.")
    novelty: str = Field(..., description="How is this different from prior work?")
    limitations: str = Field(..., description="What are the limitations?")
    practical_application: str = Field(..., description="What are the practical applications?")
    importance: str = Field(..., description="Why is this important?")
    related_fields: str = Field(..., description="Comma separated related fields.")
    importance_score: float = Field(..., description="Importance score from 0 to 10.")
    reading_level: str = Field(..., description="Recommended reading level (Beginner, Intermediate, Advanced).")

class Top3Selection(BaseModel):
    top_1_id: int
    top_2_id: int
    top_3_id: int

class TrendAnalysis(BaseModel):
    trends: List[str] = Field(..., min_length=3, max_length=3, description="List of 3 key research trends.")
    takeaway: str = Field(..., description="One sentence takeaway summarizing the day's research.")

def analyze_paper(paper: PaperSchema) -> PaperAnalysisOutput:
    """Analyzes a single paper using LLM structured output."""
    prompt = f"""
    Analyze the following research paper based on its title and abstract.

    Title: {paper.title}
    Authors: {paper.authors}
    Date: {paper.published_date}
    Category: {paper.category}

    Abstract:
    {paper.abstract}
    """

    response = client.beta.chat.completions.parse(
        model=config.LLM_MODEL,
        messages=[
            {"role": "system", "content": "You are an expert AI research scientist. Analyze the paper objectively. Preserve all numbers and facts exactly as stated. Do not hallucinate."},
            {"role": "user", "content": prompt}
        ],
        response_format=PaperAnalysisOutput,
    )

    return response.choices[0].message.parsed

def select_top_3(papers: List[PaperSchema], summaries: List[PaperAnalysisOutput]) -> Top3Selection:
    """Selects the Top 3 papers among the analyzed ones."""
    # Build a combined prompt
    descriptions = []
    for i, (paper, summary) in enumerate(zip(papers, summaries)):
        descriptions.append(f"[{i}] Title: {paper.title}\nScore: {summary.importance_score}\nSummary: {summary.one_line_summary}\nProblem: {summary.problem}")

    prompt = "Here are the top papers of the day:\n\n" + "\n\n".join(descriptions) + "\n\nSelect the indices (0-9) of the top 3 most important and impactful papers."

    response = client.beta.chat.completions.parse(
        model=config.LLM_MODEL,
        messages=[
            {"role": "system", "content": "You are a senior research director picking the top 3 most impactful papers to feature in a daily briefing."},
            {"role": "user", "content": prompt}
        ],
        response_format=Top3Selection,
    )

    return response.choices[0].message.parsed

def extract_trends(papers: List[PaperSchema], summaries: List[PaperAnalysisOutput]) -> TrendAnalysis:
    """Extracts 3 key trends and a daily takeaway."""
    descriptions = []
    for paper, summary in zip(papers, summaries):
        descriptions.append(f"Title: {paper.title}\nSummary: {summary.one_line_summary}")

    prompt = "Here are today's top papers:\n\n" + "\n\n".join(descriptions) + "\n\nIdentify exactly 3 key research trends across these papers, and write a single sentence takeaway that captures the overall direction of today's research."

    response = client.beta.chat.completions.parse(
        model=config.LLM_MODEL,
        messages=[
            {"role": "system", "content": "You are a research analyst identifying macro trends from daily paper summaries."},
            {"role": "user", "content": prompt}
        ],
        response_format=TrendAnalysis,
    )

    return response.choices[0].message.parsed
