"""Arabic/English text normalization and an intentionally empty local catalog index.

No product records are bundled here. Catalog results require crawler-ingested
records with source provenance; until that crawler exists, local searches return
no products instead of replaying unsourced specifications.
"""

import re
import unicodedata
from typing import Dict, List, Any, Optional, Tuple

# ─────────────────────────────────────────────────────────────────────────────
# Arabic Normalization & Digit Conversion
# ─────────────────────────────────────────────────────────────────────────────

ARABIC_INDIC_MAP = str.maketrans("٠١٢٣٤٥٦٧٨٩،", "0123456789,")

def normalize_arabic_text(text: str) -> str:
    """
    Normalize Arabic and English text for robust fuzzy search:
    - Normalizes Arabic-Indic digits (٠-٩) to ASCII (0-9)
    - Normalizes Alef forms (أ, إ, آ -> ا)
    - Normalizes Taa Marbouta (ة -> ه)
    - Normalizes Yaa (ى -> ي)
    - Strips Arabic diacritics (tashkeel: fat-ha, damma, kasra, shadda, sukoon, etc.)
    - Removes punctuation and extra whitespace
    """
    if not text:
        return ""
    
    # 1. Translate Arabic-Indic digits
    text = text.translate(ARABIC_INDIC_MAP)
    
    # 2. Strip Arabic diacritics (Unicode range 064B - 0652)
    text = re.sub(r"[\u064B-\u0652\u0670]", "", text)
    
    # 3. Normalize Alef forms
    text = re.sub(r"[أإآٱ]", "ا", text)
    
    # 4. Normalize Taa Marbouta to Haa
    text = re.sub(r"ة", "ه", text)
    
    # 5. Normalize Alef Maksura to Yaa
    text = re.sub(r"ى", "ي", text)
    
    # 6. Normalize punctuation and lowercase
    text = text.lower().strip()
    return text

def normalize_model_key(model: str) -> str:
    """Normalize model strings for strict identifier matching (removes hyphens, slashes, spaces)."""
    return re.sub(r"[\s\-_/]+", "", model.upper()).strip()


# ─────────────────────────────────────────────────────────────────────────────
# Synonyms & Category Mapping Dictionary
# ─────────────────────────────────────────────────────────────────────────────

CATEGORY_SYNONYMS: Dict[str, List[str]] = {
    "Fans": [
        "fan", "fans", "ventilator", "stand fan", "ceiling fan", "box fan", "wall fan", "desk fan",
        "مروحه", "مروحة", "مراوح", "مروحة ستاند", "مروحه ستاند", "مروحة سقف", "مروحة حائط", "مروحة مكتب"
    ],
    "Blenders": [
        "blender", "blenders", "mixer", "food processor", "grinder",
        "خلاط", "خلاطات", "عصاره", "عصارة", "كبه", "كبة", "محضر طعام"
    ],
    "Washing Machines": [
        "washer", "washers", "washing machine", "laundry", "top load", "front load",
        "غساله", "غسالة", "غسالات", "غسالة ملابس", "غساله ملابس", "نصف اوتوماتيك", "فوق اوتوماتيك"
    ],
    "Air Conditioners": [
        "ac", "air conditioner", "split ac", "cooling", "inverter", "hvac",
        "تكييف", "تكييفات", "مكيف", "مكيفات", "سبليت", "انفرتر"
    ],
    "Water Heaters": [
        "heater", "water heater", "geyser", "electric heater", "gas heater",
        "سخان", "سخانات", "سخان مياه", "سخان كهرباء", "سخان غاز"
    ],
    "TVs": [
        "tv", "television", "smart tv", "led", "display", "screen", "monitor",
        "تلفزيون", "تلفزيونات", "شاشه", "شاشة", "شاشات", "سمارت"
    ],
    "Microwaves": [
        "microwave", "micro wave", "oven", "grill",
        "ميكروويف", "ميكرويف", "مايكرويف", "فرن"
    ],
    "Kettles": [
        "kettle", "electric kettle", "water kettle", "tea maker",
        "غلايه", "غلاية", "غلايات", "كاتل", "ابريق"
    ],
    "Water Dispensers": [
        "dispenser", "water dispenser", "water cooler",
        "موزع مياه", "ديسبنسر", "مبرد مياه", "كولدير"
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Verified Rich Catalog Database
# Contains true physical specifications for El Araby models with complete
# assembled dimensions, packaging carton dimensions, weights, and components.
# ─────────────────────────────────────────────────────────────────────────────

CATALOG_ITEMS: List[Dict[str, Any]] = []

# Build fast lookup indexes
CATALOG_BY_MODEL_KEY: Dict[str, Dict[str, Any]] = {
    normalize_model_key(item["model"]): item for item in CATALOG_ITEMS
}


# ─────────────────────────────────────────────────────────────────────────────
# Search Engine Functions
# ─────────────────────────────────────────────────────────────────────────────

def search_catalog(query: str, brand_filter: Optional[str] = None, category_filter: Optional[str] = None) -> Tuple[List[Dict[str, Any]], Optional[str], Dict[str, int]]:
    """
    Search local catalog with deep query understanding:
    1. Check category synonyms (e.g. 'fan' or 'مروحة' matches all fans in catalog)
    2. Model key exact or substring match (e.g. 'tsf-16w', 'tsf16', '16w')
    3. Multi-word full text match across Name, Name_ar, Brand, Model, Category, Sub_category
    4. Fuzzy typo suggestion if no exact match found
    
    Returns:
        (matched_items, did_you_mean, category_chips)
    """
    if not query or not query.strip():
        # Empty query -> return all items (or filtered by brand/category)
        filtered = CATALOG_ITEMS
        if brand_filter and brand_filter != "Other…":
            filtered = [i for i in filtered if i["brand"].lower() == brand_filter.lower()]
        if category_filter:
            filtered = [i for i in filtered if i["category"].lower() == category_filter.lower()]
        chips = _compute_category_chips(filtered)
        return filtered, None, chips

    raw_q = query.strip()
    norm_q = normalize_arabic_text(raw_q)
    model_key_q = normalize_model_key(raw_q)
    
    matched: List[Dict[str, Any]] = []
    
    # Check if query matches a known category synonym
    matched_synonym_category = None
    for cat_name, synonyms in CATEGORY_SYNONYMS.items():
        for syn in synonyms:
            syn_norm = normalize_arabic_text(syn)
            if norm_q == syn_norm or norm_q in syn_norm.split():
                matched_synonym_category = cat_name
                break
        if matched_synonym_category:
            break

    # If query is a category term (e.g. "fan", "مروحة", "blender", "غسالة")
    if matched_synonym_category:
        for item in CATALOG_ITEMS:
            if item["category"] == matched_synonym_category:
                matched.append(item)
    else:
        # Check by Model Key exact or substring
        for item in CATALOG_ITEMS:
            item_key = normalize_model_key(item["model"])
            if model_key_q == item_key or model_key_q in item_key or item_key in model_key_q:
                if item not in matched:
                    matched.append(item)

        # Check by text containment in name, brand, model, sku, or Arabic name
        for item in CATALOG_ITEMS:
            if item in matched:
                continue
            item_text = f"{item['name']} {item.get('name_ar', '')} {item['brand']} {item['model']} {item.get('sku', '')} {item.get('sub_category', '')}"
            norm_item_text = normalize_arabic_text(item_text)
            
            # Match if all query tokens appear in item text, or query is substring
            q_tokens = [t for t in norm_q.split() if len(t) > 1]
            if norm_q in norm_item_text or (q_tokens and all(tok in norm_item_text for tok in q_tokens)):
                matched.append(item)

    # Apply brand / category filters if requested
    if brand_filter and brand_filter != "Other…":
        matched = [i for i in matched if i["brand"].lower() == brand_filter.lower()]
    if category_filter:
        matched = [i for i in matched if i["category"].lower() == category_filter.lower()]

    # Did you mean fuzzy fallback if no items found
    did_you_mean = None
    if not matched:
        # Find closest model using Levenshtein distance on model keys
        best_candidate = None
        min_dist = 999
        for item in CATALOG_ITEMS:
            item_key = normalize_model_key(item["model"])
            d = _levenshtein(model_key_q, item_key)
            if d < min_dist and d <= 3:
                min_dist = d
                best_candidate = item["model"]
        
        if best_candidate:
            did_you_mean = best_candidate

    chips = _compute_category_chips(matched)
    return matched, did_you_mean, chips


def autocomplete_search(query: str, limit: int = 8) -> Dict[str, Any]:
    """
    Fast autocomplete endpoint providing suggestions for:
    - Models & Products
    - Categories
    - Brands
    """
    if not query or not query.strip():
        # Return popular items
        return {
            "products": [{"name": i["name"], "model": i["model"], "brand": i["brand"], "category": i["category"]} for i in CATALOG_ITEMS[:limit]],
            "categories": list(CATEGORY_SYNONYMS.keys()),
            "brands": ["Tornado", "Toshiba", "Sharp"],
        }

    norm_q = normalize_arabic_text(query)
    model_q = normalize_model_key(query)

    prod_suggestions = []
    cat_suggestions = set()
    brand_suggestions = set()

    for item in CATALOG_ITEMS:
        item_key = normalize_model_key(item["model"])
        norm_name = normalize_arabic_text(item["name"])
        norm_ar = normalize_arabic_text(item.get("name_ar", ""))
        
        if model_q in item_key or norm_q in norm_name or norm_q in norm_ar or norm_q in item["brand"].lower():
            if len(prod_suggestions) < limit:
                prod_suggestions.append({
                    "name": item["name"],
                    "model": item["model"],
                    "brand": item["brand"],
                    "category": item["category"],
                    "sub_category": item.get("sub_category")
                })
            cat_suggestions.add(item["category"])
            brand_suggestions.add(item["brand"])

    # Also check category synonym matches
    for cat_name, synonyms in CATEGORY_SYNONYMS.items():
        for syn in synonyms:
            if norm_q in normalize_arabic_text(syn):
                cat_suggestions.add(cat_name)
                break

    return {
        "products": prod_suggestions,
        "categories": sorted(list(cat_suggestions)),
        "brands": sorted(list(brand_suggestions)),
    }


def browse_catalog(category: Optional[str] = None, brand: Optional[str] = None) -> Dict[str, Any]:
    """Browse catalog mode: returns category breakdown and items."""
    all_categories = {}
    for item in CATALOG_ITEMS:
        cat = item["category"]
        all_categories[cat] = all_categories.get(cat, 0) + 1

    items = CATALOG_ITEMS
    if category:
        items = [i for i in items if i["category"].lower() == category.lower()]
    if brand and brand != "Other…":
        items = [i for i in items if i["brand"].lower() == brand.lower()]

    return {
        "total_count": len(items),
        "categories": [{"name": cat, "count": count} for cat, count in all_categories.items()],
        "items": items,
    }


def get_item_by_model(model_or_key: str) -> Optional[Dict[str, Any]]:
    """Lookup product specification by model number."""
    key = normalize_model_key(model_or_key)
    return CATALOG_BY_MODEL_KEY.get(key)


def _compute_category_chips(items: List[Dict[str, Any]]) -> Dict[str, int]:
    """Compute count per category or sub-category for interactive filter chips."""
    chips: Dict[str, int] = {}
    for item in items:
        # Prefer sub_category if available, else category
        label = item.get("sub_category") or item.get("category")
        if label:
            chips[label] = chips.get(label, 0) + 1
    return chips


def _levenshtein(s1: str, s2: str) -> int:
    """Compute Levenshtein edit distance between two strings."""
    if len(s1) < len(s2):
        return _levenshtein(s2, s1)
    if len(s2) == 0:
        return len(s1)

    previous_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    return previous_row[-1]
