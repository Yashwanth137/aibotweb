import os
import requests
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class TavilySearchException(Exception):
    pass

def search(query: str, max_results: int = 5, api_key: str = None) -> List[Dict[str, Any]]:
    """
    Search the web using Tavily API.
    
    Args:
        query: Search query string
        max_results: Number of results to return
        api_key: Optional API key override
        
    Returns:
        List of dicts with keys: title, snippet, url, etc.
    """
    if not api_key:
        api_key = os.environ.get("TAVILY_API_KEY")

    if not api_key:
        raise TavilySearchException("TAVILY_API_KEY not set")

    url = "https://api.tavily.com/search"
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "api_key": api_key,
        "query": query,
        "search_depth": "basic",
        "max_results": max_results,
        "include_answer": False,
        "include_raw_content": False,
        "include_images": False,
    }
    
    try:
        # logger.debug(f"Tavily Search Query: {query}")
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        
        # logger.debug(f"Tavily Status Code: {response.status_code}")
        if response.status_code != 200:
             raise TavilySearchException(f"API Error: {response.status_code} - {response.text}")
             
        data = response.json()
        items = data.get("results", [])
        # logger.debug(f"Tavily Found {len(items)} results")
        
        results = []
        
        # Tavily returns { "results": [ { "title": ..., "content": ..., "url": ..., "published_date": ... } ] }
        items = data.get("results", [])
        
        for item in items:
            results.append({
                "title": item.get("title", "No Title"),
                "snippet": item.get("content", ""),
                "url": item.get("url", ""),
                "date": item.get("published_date") 
            })
            
        return results

    except requests.RequestException as e:
        raise TavilySearchException(f"Network Error: {str(e)}")
    except Exception as e:
        raise TavilySearchException(f"Unexpected Error: {str(e)}")
