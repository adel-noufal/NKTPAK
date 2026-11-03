from app.services import fetch_service

# Keep the real implementation before the autouse offline fixture replaces it.
bing_web_product_search = fetch_service._bing_web_product_search


def test_web_fallback_returns_live_search_cards_without_invented_specs(monkeypatch):
    html = """<ol id="b_results">
      <li class="b_algo"><h2><a href="https://shop.example/products/stand-fan">Tornado Stand Fan TSF-16W</a></h2></li>
      <li class="b_algo"><h2><a href="https://retailer.example/products/desk-fan">Fresh Desk Fan</a></h2></li>
    </ol>"""

    class FakeResponse:
        status = 200
        def __enter__(self): return self
        def __exit__(self, *args): return False
        def read(self): return html.encode("utf-8")

    monkeypatch.setattr(fetch_service.urllib.request, "urlopen", lambda *args, **kwargs: FakeResponse())
    monkeypatch.setattr(fetch_service, "fetch_html_content", lambda *args, **kwargs: None)

    candidates, diagnostic = bing_web_product_search("fan", product_name="fan")

    assert diagnostic["status"] == "success"
    assert len(candidates) == 2
    assert candidates[0].brand == "Tornado"
    assert candidates[0].model == "TSF-16W"
    assert candidates[0].dimensions_mm is None
    assert candidates[0].net_weight_kg is None
    assert candidates[1].source_url == "https://retailer.example/products/desk-fan"


def test_web_fallback_model_filter_does_not_require_model_when_searching_by_name(monkeypatch):
    html = """<ol><li class="b_algo"><h2><a href="https://shop.example/products/fan">Tornado Stand Fan</a></h2></li></ol>"""

    class FakeResponse:
        def __enter__(self): return self
        def __exit__(self, *args): return False
        def read(self): return html.encode("utf-8")

    monkeypatch.setattr(fetch_service.urllib.request, "urlopen", lambda *args, **kwargs: FakeResponse())
    monkeypatch.setattr(fetch_service, "fetch_html_content", lambda *args, **kwargs: None)
    candidates, _ = bing_web_product_search("fan", product_name="fan", model_number="")
    assert len(candidates) == 1
    assert candidates[0].model is None
