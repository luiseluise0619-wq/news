import urllib.request
import json
from schemas import PaperSchema
from typing import List
import datetime
# We map our extra fields to OpenAlex concepts
# Using exact search queries for OpenAlex concept display_names
OPENALEX_CONCEPTS = {
    "Digital Health": "Digital health",
    "Bioinformatics": "Bioinformatics",
    "Data Science": "Data science",
    "Healthcare / Medical AI": "Medical artificial intelligence"
}

def fetch_openalex_papers(max_results: int = 50) -> List[PaperSchema]:
    """Fetches latest papers from OpenAlex for specific concepts."""
    papers = []

    # Let's get the concept IDs first or just use concept exact match via search
    # OpenAlex API allows filtering by concept string
    # We will fetch recent works from the last 7 days that match any of these concepts

    for category_name, concept_str in OPENALEX_CONCEPTS.items():
        # Encode concept string for URL
        concept_query = urllib.parse.quote(concept_str)
        # We look for works with abstract, sorted by publication date
        url = f"https://api.openalex.org/works?filter=has_abstract:true,concepts.wikidata:Q128570|concepts.wikidata:Q207434|concepts.wikidata:Q4999933&sort=publication_date:desc&per-page={max_results // len(OPENALEX_CONCEPTS)}"
        # Actually it's better to search by concept display_name or just do a general search for the concept
        # Let's use a simpler query: search abstract/title
        url = f"https://api.openalex.org/works?filter=has_abstract:true,default.search:{concept_query}&sort=publication_date:desc&per-page={max_results // len(OPENALEX_CONCEPTS)}"

        try:
            # Adding User-Agent as a good practice for OpenAlex
            req = urllib.request.Request(url, headers={'User-Agent': 'mailto:test@example.com'})
            response = urllib.request.urlopen(req)
            data = json.loads(response.read())

            for work in data.get('results', []):
                title = work.get('title', '')

                # Reconstruct abstract from inverted index
                abstract_inverted = work.get('abstract_inverted_index')
                abstract = ""
                if abstract_inverted:
                    word_index = []
                    for word, positions in abstract_inverted.items():
                        for pos in positions:
                            word_index.append((pos, word))
                    word_index.sort(key=lambda x: x[0])
                    abstract = " ".join([x[1] for x in word_index])

                authors = ", ".join([auth.get('author', {}).get('display_name', '') for auth in work.get('authorships', [])])

                pub_date_str = work.get('publication_date')
                try:
                    published_date = datetime.datetime.strptime(pub_date_str, "%Y-%m-%d").date()
                except Exception:
                    published_date = datetime.date.today()

                doi = work.get('doi')
                url_link = work.get('id')
                if doi:
                    url_link = doi

                pdf_url = work.get('open_access', {}).get('oa_url')

                papers.append(PaperSchema(
                    title=title,
                    authors=authors,
                    published_date=published_date,
                    abstract=abstract,
                    url=url_link,
                    doi=doi,
                    source="OpenAlex",
                    category=category_name,
                    pdf_url=pdf_url
                ))

        except Exception as e:
            print(f"Error fetching from OpenAlex for {concept_str}: {e}")

    return papers
