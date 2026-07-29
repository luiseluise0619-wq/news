import urllib.request
import feedparser
import datetime
from schemas import PaperSchema
from typing import List

# arXiv categories mapped to our fields
ARXIV_CATEGORIES = {
    "cs.AI": "Artificial Intelligence",
    "cs.LG": "Machine Learning",
    "cs.CL": "Natural Language Processing",
    "cs.CV": "Computer Vision",
    "cs.SE": "Software Engineering",
    "cs.RO": "Robotics",
    "cs.CR": "Cybersecurity",
}

def fetch_arxiv_papers(max_results: int = 100) -> List[PaperSchema]:
    """Fetches latest papers from arXiv for specific categories."""
    papers = []

    # We will query all categories we care about
    search_query = "+OR+".join([f"cat:{cat}" for cat in ARXIV_CATEGORIES.keys()])

    url = f"http://export.arxiv.org/api/query?search_query={search_query}&sortBy=submittedDate&sortOrder=descending&max_results={max_results}"

    try:
        response = urllib.request.urlopen(url)
        feed = feedparser.parse(response)

        for entry in feed.entries:
            title = entry.title.replace('\n', ' ').strip()
            abstract = entry.summary.replace('\n', ' ').strip()
            authors = ", ".join(author.name for author in entry.authors)

            # published date is usually like 2024-03-22T18:00:15Z
            try:
                published_datetime = datetime.datetime.strptime(entry.published, "%Y-%m-%dT%H:%M:%SZ")
                published_date = published_datetime.date()
            except Exception:
                published_date = datetime.date.today()

            # Determine primary category
            primary_cat = entry.arxiv_primary_category['term'] if 'arxiv_primary_category' in entry else "cs.AI"
            category_name = ARXIV_CATEGORIES.get(primary_cat, "Artificial Intelligence")

            # Links
            url_link = entry.link
            pdf_url = None
            doi = None
            for link in entry.links:
                if link.rel == 'alternate':
                    url_link = link.href
                elif link.title == 'pdf':
                    pdf_url = link.href

            if 'arxiv_doi' in entry:
                doi = entry.arxiv_doi

            papers.append(PaperSchema(
                title=title,
                authors=authors,
                published_date=published_date,
                abstract=abstract,
                url=url_link,
                doi=doi,
                source="arXiv",
                category=category_name,
                pdf_url=pdf_url
            ))

    except Exception as e:
        print(f"Error fetching from arXiv: {e}")

    return papers

from openalex_collector import fetch_openalex_papers

def collect_all_papers() -> List[PaperSchema]:
    arxiv_papers = fetch_arxiv_papers(100)
    openalex_papers = fetch_openalex_papers(50)
    return arxiv_papers + openalex_papers

if __name__ == "__main__":
    print("Fetching arXiv...")
    arxiv = fetch_arxiv_papers(5)
    print(f"arXiv count: {len(arxiv)}")
    print("Fetching OpenAlex...")
    openalex = fetch_openalex_papers(5)
    print(f"OpenAlex count: {len(openalex)}")
