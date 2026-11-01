"""
NxtPak AI - Configurable Search Provider Interface
Supports live external search via Serper, Tavily, Brave, and Google Custom Search.
Provides connection testing and latency measurement without hardcoded API keys.
"""

import time
import json
import urllib.request
import urllib.parse
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger("nxtpak")


class SearchResultItem:
    def __init__(self, title: str, link: str, snippet: str):
        self.title = title
        self.link = link
        self.snippet = snippet

    def to_dict(self) -> Dict[str, str]:
        return {
            "title": self.title,
            "link": self.link,
            "snippet": self.snippet,
        }


class BaseSearchProvider(ABC):
    @abstractmethod
    def search(self, query: str, api_key: str, limit: int = 5) -> List[SearchResultItem]:
        """Perform search and return list of result items."""
        pass

    @abstractmethod
    def test_connection(self, api_key: str) -> Dict[str, Any]:
        """Test API key validity and measure round-trip latency."""
        pass


class SerperSearchProvider(BaseSearchProvider):
    def search(self, query: str, api_key: str, limit: int = 5) -> List[SearchResultItem]:
        if not api_key:
            return []
        url = "https://google.serper.dev/search"
        payload = json.dumps({"q": query, "num": limit}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "X-API-KEY": api_key,
                "Content-Type": "application/json",
                "User-Agent": "NxtPak-Search/1.0"
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=7) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                results = []
                for item in data.get("organic", [])[:limit]:
                    results.append(SearchResultItem(
                        title=item.get("title", ""),
                        link=item.get("link", ""),
                        snippet=item.get("snippet", "")
                    ))
                return results
        except Exception as e:
            logger.warning("Serper search error: %s", e)
            return []

    def test_connection(self, api_key: str) -> Dict[str, Any]:
        if not api_key:
            return {"success": False, "error": "Serper API key is missing. Enter key in Settings."}
        start = time.perf_counter()
        try:
            res = self.search("El Araby Group", api_key, limit=1)
            latency = round((time.perf_counter() - start) * 1000, 1)
            if res:
                return {"success": True, "latency_ms": latency, "provider": "serper", "message": f"Connected to Serper ({latency}ms)."}
            return {"success": False, "latency_ms": latency, "provider": "serper", "error": "Search returned 0 results. Check Serper account credits."}
        except urllib.error.HTTPError as he:
            latency = round((time.perf_counter() - start) * 1000, 1)
            if he.code == 403 or he.code == 401:
                return {"success": False, "latency_ms": latency, "provider": "serper", "error": "Invalid Serper API key (401/403 Unauthorized)."}
            return {"success": False, "latency_ms": latency, "provider": "serper", "error": f"HTTP error {he.code}: {he.reason}"}
        except Exception as e:
            latency = round((time.perf_counter() - start) * 1000, 1)
            return {"success": False, "latency_ms": latency, "provider": "serper", "error": str(e)}


class TavilySearchProvider(BaseSearchProvider):
    def search(self, query: str, api_key: str, limit: int = 5) -> List[SearchResultItem]:
        if not api_key:
            return []
        url = "https://api.tavily.com/search"
        payload = json.dumps({"query": query, "api_key": api_key, "max_results": limit}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json", "User-Agent": "NxtPak-Search/1.0"}
        )
        try:
            with urllib.request.urlopen(req, timeout=7) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                results = []
                for item in data.get("results", [])[:limit]:
                    results.append(SearchResultItem(
                        title=item.get("title", ""),
                        link=item.get("url", ""),
                        snippet=item.get("content", "")
                    ))
                return results
        except Exception as e:
            logger.warning("Tavily search error: %s", e)
            return []

    def test_connection(self, api_key: str) -> Dict[str, Any]:
        if not api_key:
            return {"success": False, "error": "Tavily API key is missing. Enter key in Settings."}
        start = time.perf_counter()
        try:
            res = self.search("El Araby Group", api_key, limit=1)
            latency = round((time.perf_counter() - start) * 1000, 1)
            if res:
                return {"success": True, "latency_ms": latency, "provider": "tavily", "message": f"Connected to Tavily ({latency}ms)."}
            return {"success": False, "latency_ms": latency, "provider": "tavily", "error": "No results returned. Check API credits."}
        except Exception as e:
            latency = round((time.perf_counter() - start) * 1000, 1)
            return {"success": False, "latency_ms": latency, "provider": "tavily", "error": str(e)}


class BraveSearchProvider(BaseSearchProvider):
    def search(self, query: str, api_key: str, limit: int = 5) -> List[SearchResultItem]:
        if not api_key:
            return []
        url = f"https://api.search.brave.com/res/v1/web/search?q={urllib.parse.quote(query)}&count={limit}"
        req = urllib.request.Request(
            url,
            headers={
                "X-Subscription-Token": api_key,
                "Accept": "application/json",
                "User-Agent": "NxtPak-Search/1.0"
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=7) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                results = []
                for item in data.get("web", {}).get("results", [])[:limit]:
                    results.append(SearchResultItem(
                        title=item.get("title", ""),
                        link=item.get("url", ""),
                        snippet=item.get("description", "")
                    ))
                return results
        except Exception as e:
            logger.warning("Brave search error: %s", e)
            return []

    def test_connection(self, api_key: str) -> Dict[str, Any]:
        if not api_key:
            return {"success": False, "error": "Brave Search API key is missing. Enter key in Settings."}
        start = time.perf_counter()
        try:
            res = self.search("El Araby Group", api_key, limit=1)
            latency = round((time.perf_counter() - start) * 1000, 1)
            if res:
                return {"success": True, "latency_ms": latency, "provider": "brave", "message": f"Connected to Brave Search ({latency}ms)."}
            return {"success": False, "latency_ms": latency, "provider": "brave", "error": "No results returned."}
        except Exception as e:
            latency = round((time.perf_counter() - start) * 1000, 1)
            return {"success": False, "latency_ms": latency, "provider": "brave", "error": str(e)}


class GoogleCustomSearchProvider(BaseSearchProvider):
    def search(self, query: str, api_key: str, limit: int = 5) -> List[SearchResultItem]:
        # Expects api_key format "API_KEY:CX" or just API_KEY
        if not api_key:
            return []
        cx = ""
        key = api_key
        if ":" in api_key:
            key, cx = api_key.split(":", 1)
        url = f"https://www.googleapis.com/customsearch/v1?q={urllib.parse.quote(query)}&key={key}&cx={cx}&num={limit}"
        req = urllib.request.Request(url, headers={"User-Agent": "NxtPak-Search/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=7) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                results = []
                for item in data.get("items", [])[:limit]:
                    results.append(SearchResultItem(
                        title=item.get("title", ""),
                        link=item.get("link", ""),
                        snippet=item.get("snippet", "")
                    ))
                return results
        except Exception as e:
            logger.warning("Google search error: %s", e)
            return []

    def test_connection(self, api_key: str) -> Dict[str, Any]:
        if not api_key:
            return {"success": False, "error": "Google Search API key is missing. Format: API_KEY:CX"}
        start = time.perf_counter()
        try:
            res = self.search("El Araby Group", api_key, limit=1)
            latency = round((time.perf_counter() - start) * 1000, 1)
            if res:
                return {"success": True, "latency_ms": latency, "provider": "google", "message": f"Connected to Google Custom Search ({latency}ms)."}
            return {"success": False, "latency_ms": latency, "provider": "google", "error": "No results returned or invalid CX."}
        except Exception as e:
            latency = round((time.perf_counter() - start) * 1000, 1)
            return {"success": False, "latency_ms": latency, "provider": "google", "error": str(e)}


PROVIDERS: Dict[str, BaseSearchProvider] = {
    "serper": SerperSearchProvider(),
    "tavily": TavilySearchProvider(),
    "brave": BraveSearchProvider(),
    "google": GoogleCustomSearchProvider(),
}


def get_search_provider(name: str = "serper") -> Optional[BaseSearchProvider]:
    """Retrieve search provider instance by name."""
    return PROVIDERS.get(name.lower().strip())
