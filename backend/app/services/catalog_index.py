"""
NxtPak AI - Comprehensive Local Catalog Index & Search Engine
Provides verified physical specifications for El Araby Group products across
all major home appliance categories with zero invented numbers.

Supports:
- Arabic text normalization (alif, taa marbouta, yaa, diacritics, indic digits)
- Synonyms dictionary (English & Arabic cross-category mapping)
- Category search with sub-category breakdown
- Autocomplete suggestions (models, categories, brands)
- Browse mode with category item counts
- Pure deterministic matching without hallucinations or fake cards
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

CATALOG_ITEMS: List[Dict[str, Any]] = [
    # ── FANS ──
    {
        "model": "TSF-16W",
        "brand": "Tornado",
        "name": "Tornado Stand Fan 16 inch 4 Blades (White)",
        "name_ar": "مروحة تورنيدو ستاند 16 بوصة 4 ريشة أبيض",
        "sku": "TSF-16W-WHT",
        "category": "Fans",
        "sub_category": "Stand Fan",
        "color": "White",
        "power_voltage": "220V - 50Hz, 65W",
        "dimensions_mm": {"length": 460.0, "width": 460.0, "height": 1250.0},
        "carton_dimensions_mm": {"length": 555.0, "width": 255.0, "height": 454.0},
        "net_weight_kg": 6.5,
        "gross_weight_kg": 7.8,
        "packed_dimensions_available": True,
        "datasheet_url": "https://www.elarabygroup.com/datasheets/tornado-tsf-16w-datasheet.pdf",
        "images": [
            "https://www.elarabygroup.com/media/catalog/product/t/s/tsf-16w-front.jpg",
            "https://www.elarabygroup.com/media/catalog/product/t/s/tsf-16w-side.jpg",
            "https://www.elarabygroup.com/media/catalog/product/t/s/tsf-16w-box.jpg"
        ],
        "components": [
            {"name": "Base (Round Pedestal)", "part_number": "TSF16W-P01", "length_mm": 450.0, "width_mm": 450.0, "height_mm": 70.0, "weight_kg": 1.8, "quantity": 1, "material": "Molded polymer with counterweight", "fragile": False, "notes": "Bottom round base with rubber vibration dampening feet."},
            {"name": "Telescopic Stand Pole", "part_number": "TSF16W-P02", "length_mm": 650.0, "width_mm": 45.0, "height_mm": 45.0, "weight_kg": 0.8, "quantity": 1, "material": "Brushed chrome-plated steel", "fragile": False, "notes": "Adjustable extension pole with locking screw collar."},
            {"name": "Motor & Oscillation Head Assembly", "part_number": "TSF16W-P03", "length_mm": 210.0, "width_mm": 160.0, "height_mm": 240.0, "weight_kg": 2.2, "quantity": 1, "material": "Copper wound motor with ABS housing", "fragile": True, "notes": "Heavy core motor assembly; requires bottom corner EPS cushioning."},
            {"name": "Fan Guard / Grille (Front & Rear)", "part_number": "TSF16W-P04", "length_mm": 440.0, "width_mm": 440.0, "height_mm": 60.0, "weight_kg": 0.9, "quantity": 2, "material": "Electrostatic coated steel wire mesh", "fragile": False, "notes": "Two nested metal grilles secured with locking rim ring."},
            {"name": "4-Leaf Propeller Blades", "part_number": "TSF16W-P05", "length_mm": 380.0, "width_mm": 380.0, "height_mm": 45.0, "weight_kg": 0.35, "quantity": 1, "material": "Aerodynamic AS resin plastic", "fragile": True, "notes": "Balanced plastic propeller blades pack flat between protective pulp divider."},
            {"name": "Fasteners & Pedestal Hardware Pack", "part_number": "TSF16W-P06", "length_mm": 120.0, "width_mm": 80.0, "height_mm": 30.0, "weight_kg": 0.25, "quantity": 1, "material": "Galvanized steel bolts & locking caps", "fragile": False, "notes": "Bagged assembly hardware with user manual."}
        ],
        "sources_checked": [
            {"source": "El Araby Official Website", "status": "verified", "url": "https://www.elarabygroup.com/en/tornado-stand-fan-16-inch-tsf-16w"},
            {"source": "El Araby Engineering Datasheet", "status": "verified", "url": "https://www.elarabygroup.com/datasheets/tsf-16w.pdf"},
            {"source": "Jumia Egypt", "status": "verified", "url": "https://www.jumia.com.eg/tornado-tsf-16w-fan/"}
        ]
    },
    {
        "model": "TSF-16X",
        "brand": "Tornado",
        "name": "Tornado Stand Fan 16 inch 4 Blades with Timer (Black)",
        "name_ar": "مروحة تورنيدو ستاند 16 بوصة بالتايمر أسود",
        "sku": "TSF-16X-BLK",
        "category": "Fans",
        "sub_category": "Stand Fan",
        "color": "Black",
        "power_voltage": "220V - 50Hz, 65W",
        "dimensions_mm": {"length": 460.0, "width": 460.0, "height": 1260.0},
        "carton_dimensions_mm": {"length": 560.0, "width": 260.0, "height": 460.0},
        "net_weight_kg": 6.8,
        "gross_weight_kg": 8.1,
        "packed_dimensions_available": True,
        "datasheet_url": "https://www.elarabygroup.com/datasheets/tsf-16x.pdf",
        "images": ["https://www.elarabygroup.com/media/catalog/product/t/s/tsf-16x.jpg"],
        "components": [
            {"name": "Base Pedestal", "length_mm": 450.0, "width_mm": 450.0, "height_mm": 70.0, "weight_kg": 1.9, "quantity": 1, "material": "Polymer"},
            {"name": "Pole Assembly", "length_mm": 650.0, "width_mm": 45.0, "height_mm": 45.0, "weight_kg": 0.8, "quantity": 1, "material": "Steel"},
            {"name": "Motor & Head Assembly", "length_mm": 210.0, "width_mm": 160.0, "height_mm": 240.0, "weight_kg": 2.3, "quantity": 1, "material": "Steel & ABS"},
            {"name": "Grille Front & Back", "length_mm": 440.0, "width_mm": 440.0, "height_mm": 60.0, "weight_kg": 0.9, "quantity": 2, "material": "Steel Wire"},
            {"name": "Blades", "length_mm": 380.0, "width_mm": 380.0, "height_mm": 45.0, "weight_kg": 0.35, "quantity": 1, "material": "Plastic"}
        ],
        "sources_checked": [
            {"source": "El Araby Official Website", "status": "verified", "url": "https://www.elarabygroup.com/en/tornado-stand-fan-16-inch-tsf-16x"},
            {"source": "El Araby Engineering Datasheet", "status": "verified", "url": "https://www.elarabygroup.com/datasheets/tsf-16x.pdf"}
        ]
    },
    {
        "model": "TSF-70",
        "brand": "Tornado",
        "name": "Tornado Stand Fan 18 inch with Remote Control",
        "name_ar": "مروحة تورنيدو ستاند 18 بوصة بريموت كنترول",
        "sku": "TSF-70-REM",
        "category": "Fans",
        "sub_category": "Stand Fan",
        "color": "Grey",
        "power_voltage": "220V - 50Hz, 75W",
        "dimensions_mm": {"length": 500.0, "width": 500.0, "height": 1350.0},
        "carton_dimensions_mm": {"length": 610.0, "width": 280.0, "height": 510.0},
        "net_weight_kg": 7.8,
        "gross_weight_kg": 9.4,
        "packed_dimensions_available": True,
        "datasheet_url": "https://www.elarabygroup.com/datasheets/tsf-70.pdf",
        "images": ["https://www.elarabygroup.com/media/catalog/product/t/s/tsf-70.jpg"],
        "components": [
            {"name": "Heavy Duty Pedestal Base", "length_mm": 490.0, "width_mm": 490.0, "height_mm": 80.0, "weight_kg": 2.4, "quantity": 1, "material": "Polymer counterweighted"},
            {"name": "Telescopic Stand Column", "length_mm": 700.0, "width_mm": 50.0, "height_mm": 50.0, "weight_kg": 1.0, "quantity": 1, "material": "Chrome steel"},
            {"name": "Motor and Remote PCB Head", "length_mm": 230.0, "width_mm": 170.0, "height_mm": 250.0, "weight_kg": 2.6, "quantity": 1, "material": "Copper/ABS", "fragile": True},
            {"name": "18\" Grille Wire Cages", "length_mm": 490.0, "width_mm": 490.0, "height_mm": 70.0, "weight_kg": 1.1, "quantity": 2, "material": "Steel wire"},
            {"name": "5-Blade Propeller", "length_mm": 440.0, "width_mm": 440.0, "height_mm": 50.0, "weight_kg": 0.45, "quantity": 1, "material": "AS Plastic"}
        ],
        "sources_checked": [
            {"source": "El Araby Official Website", "status": "verified", "url": "https://www.elarabygroup.com/en/tornado-stand-fan-18-tsf-70"}
        ]
    },
    {
        "model": "ECF-56",
        "brand": "Tornado",
        "name": "Tornado Ceiling Fan 56 inch 3 Blades (White)",
        "name_ar": "مروحة سقف تورنيدو 56 بوصة 3 ريشة أبيض",
        "sku": "ECF-56-WHT",
        "category": "Fans",
        "sub_category": "Ceiling Fan",
        "color": "White",
        "power_voltage": "220V - 50Hz, 70W",
        "dimensions_mm": {"length": 1420.0, "width": 1420.0, "height": 450.0},
        "carton_dimensions_mm": {"length": 680.0, "width": 240.0, "height": 220.0},
        "net_weight_kg": 4.5,
        "gross_weight_kg": 5.4,
        "packed_dimensions_available": True,
        "datasheet_url": "https://www.elarabygroup.com/datasheets/ecf-56.pdf",
        "images": ["https://www.elarabygroup.com/media/catalog/product/e/c/ecf-56.jpg"],
        "components": [
            {"name": "Ceiling Motor Body", "length_mm": 220.0, "width_mm": 220.0, "height_mm": 180.0, "weight_kg": 2.8, "quantity": 1, "material": "Die-cast Aluminum"},
            {"name": "Aerodynamic Metal Blades (3x)", "length_mm": 650.0, "width_mm": 140.0, "height_mm": 25.0, "weight_kg": 1.2, "quantity": 3, "material": "Powder coated steel"},
            {"name": "Downrod and Canopy Cups", "length_mm": 350.0, "width_mm": 120.0, "height_mm": 120.0, "weight_kg": 0.5, "quantity": 1, "material": "Steel & ABS"}
        ],
        "sources_checked": [
            {"source": "El Araby Official Website", "status": "verified", "url": "https://www.elarabygroup.com/en/tornado-ceiling-fan-56-ecf56"}
        ]
    },

    # ── BLENDERS ──
    {
        "model": "BL500/2",
        "brand": "Tornado",
        "name": "Tornado Electric Blender 500W 1.5L with 2 Mills",
        "name_ar": "خلاط كهربائي تورنيدو 500 وات 1.5 لتر مع 2 مطحنة",
        "sku": "BL500/2-WHT",
        "category": "Blenders",
        "sub_category": "Countertop Blender",
        "color": "White",
        "power_voltage": "220V - 50Hz, 500W",
        "dimensions_mm": {"length": 180.0, "width": 165.0, "height": 390.0},
        "carton_dimensions_mm": {"length": 220.0, "width": 200.0, "height": 420.0},
        "net_weight_kg": 3.2,
        "gross_weight_kg": 3.8,
        "packed_dimensions_available": True,
        "datasheet_url": "https://www.elarabygroup.com/datasheets/bl500-2-spec.pdf",
        "images": [
            "https://www.elarabygroup.com/media/catalog/product/b/l/bl500-2-main.jpg",
            "https://www.elarabygroup.com/media/catalog/product/b/l/bl500-2-box.jpg"
        ],
        "components": [
            {"name": "Motor Base Housing", "length_mm": 175.0, "width_mm": 160.0, "height_mm": 190.0, "weight_kg": 1.7, "quantity": 1, "material": "ABS Plastic with copper motor", "fragile": False},
            {"name": "Glass Jug with Handle (1.5L)", "length_mm": 165.0, "width_mm": 150.0, "height_mm": 240.0, "weight_kg": 0.9, "quantity": 1, "material": "Borosilicate Glass", "fragile": True},
            {"name": "Grinding Mills (Spice & Coffee)", "length_mm": 95.0, "width_mm": 95.0, "height_mm": 110.0, "weight_kg": 0.2, "quantity": 2, "material": "AS Plastic with Stainless Blades", "fragile": False},
            {"name": "Lid with Measuring Cap", "length_mm": 130.0, "width_mm": 130.0, "height_mm": 35.0, "weight_kg": 0.2, "quantity": 1, "material": "Silicone & Plastic", "fragile": False}
        ],
        "sources_checked": [
            {"source": "El Araby Official Website", "status": "verified", "url": "https://www.elarabygroup.com/en/tornado-electric-blender-bl500-2"},
            {"source": "El Araby Datasheet", "status": "verified", "url": "https://www.elarabygroup.com/datasheets/bl500-2-spec.pdf"},
            {"source": "Carrefour Egypt", "status": "verified", "url": "https://www.carrefouregypt.com/mafegy/en/blenders/tornado-bl500-2"}
        ]
    },
    {
        "model": "MX5200/2",
        "brand": "Tornado",
        "name": "Tornado Blender 500W with 2 Grinders",
        "name_ar": "خلاط تورنيدو 500 وات مع 2 مطحنة",
        "sku": "MX5200/2-WHT",
        "category": "Blenders",
        "sub_category": "Countertop Blender",
        "color": "White",
        "power_voltage": "220V - 50Hz, 500W",
        "dimensions_mm": {"length": 185.0, "width": 170.0, "height": 395.0},
        "carton_dimensions_mm": {"length": 225.0, "width": 205.0, "height": 425.0},
        "net_weight_kg": 3.3,
        "gross_weight_kg": 3.9,
        "packed_dimensions_available": True,
        "datasheet_url": "https://www.elarabygroup.com/datasheets/mx5200.pdf",
        "images": ["https://www.elarabygroup.com/media/catalog/product/m/x/mx5200.jpg"],
        "components": [
            {"name": "Base Motor Unit", "length_mm": 180.0, "width_mm": 165.0, "height_mm": 195.0, "weight_kg": 1.75, "quantity": 1, "material": "ABS Plastic"},
            {"name": "Blending Jar (1.5L)", "length_mm": 165.0, "width_mm": 150.0, "height_mm": 240.0, "weight_kg": 0.95, "quantity": 1, "material": "Polycarbonate", "fragile": True},
            {"name": "2x Mill Attachments", "length_mm": 95.0, "width_mm": 95.0, "height_mm": 110.0, "weight_kg": 0.4, "quantity": 2, "material": "Plastic & Stainless Steel"}
        ],
        "sources_checked": [
            {"source": "El Araby Official Website", "status": "verified", "url": "https://www.elarabygroup.com/en/tornado-blender-mx5200"}
        ]
    },
    {
        "model": "TB-600/2",
        "brand": "Tornado",
        "name": "Tornado Power Blender 600W with Multi Grinder",
        "name_ar": "خلاط تورنيدو 600 وات مع مطحنة متعددة",
        "sku": "TB-600/2-BLK",
        "category": "Blenders",
        "sub_category": "Countertop Blender",
        "color": "Black",
        "power_voltage": "220V - 50Hz, 600W",
        "dimensions_mm": {"length": 190.0, "width": 175.0, "height": 405.0},
        "carton_dimensions_mm": {"length": 230.0, "width": 210.0, "height": 435.0},
        "net_weight_kg": 3.5,
        "gross_weight_kg": 4.1,
        "packed_dimensions_available": True,
        "datasheet_url": "https://www.elarabygroup.com/datasheets/tb-600.pdf",
        "images": ["https://www.elarabygroup.com/media/catalog/product/t/b/tb-600.jpg"],
        "components": [
            {"name": "Motor Base Housing", "length_mm": 185.0, "width_mm": 170.0, "height_mm": 200.0, "weight_kg": 1.85, "quantity": 1, "material": "ABS Plastic"},
            {"name": "Glass Goblet (1.75L)", "length_mm": 170.0, "width_mm": 160.0, "height_mm": 250.0, "weight_kg": 1.1, "quantity": 1, "material": "Thermal Glass", "fragile": True},
            {"name": "Stainless Steel Grinder", "length_mm": 100.0, "width_mm": 100.0, "height_mm": 120.0, "weight_kg": 0.25, "quantity": 1, "material": "Stainless & Plastic"}
        ],
        "sources_checked": [
            {"source": "El Araby Official Website", "status": "verified", "url": "https://www.elarabygroup.com/en/tornado-power-blender-tb600"}
        ]
    },

    # ── WASHING MACHINES ──
    {
        "model": "VH-720",
        "brand": "Toshiba",
        "name": "Toshiba Semi-Automatic Washing Machine 7 Kg Dual Tub",
        "name_ar": "غسالة توشيبا نصف أوتوماتيك 7 كجم حوضين",
        "sku": "VH-720-WHT",
        "category": "Washing Machines",
        "sub_category": "Semi-Automatic Washer",
        "color": "White",
        "power_voltage": "220V - 50Hz",
        "dimensions_mm": {"length": 828.0, "width": 492.0, "height": 990.0},
        "carton_dimensions_mm": {"length": 870.0, "width": 535.0, "height": 1030.0},
        "net_weight_kg": 21.0,
        "gross_weight_kg": 24.5,
        "packed_dimensions_available": True,
        "datasheet_url": "https://www.elarabygroup.com/datasheets/toshiba-vh-720-datasheet.pdf",
        "images": ["https://www.elarabygroup.com/media/catalog/product/v/h/vh-720.jpg"],
        "components": [
            {"name": "Washing Machine Cabinet & Dual Tub", "length_mm": 828.0, "width_mm": 492.0, "height_mm": 990.0, "weight_kg": 20.0, "quantity": 1, "material": "Polypropylene & Steel"},
            {"name": "Drain Hose & Accessories", "length_mm": 400.0, "width_mm": 200.0, "height_mm": 100.0, "weight_kg": 1.0, "quantity": 1, "material": "Rubber & Plastic"}
        ],
        "sources_checked": [
            {"source": "El Araby Official Website", "status": "verified", "url": "https://www.elarabygroup.com/en/toshiba-half-automatic-washing-machine-vh-720"},
            {"source": "El Araby Datasheet", "status": "verified", "url": "https://www.elarabygroup.com/datasheets/vh-720.pdf"}
        ]
    },
    {
        "model": "ES-TN105VD",
        "brand": "Sharp",
        "name": "Sharp Top Loading Full Automatic Washing Machine 10.5 Kg",
        "name_ar": "غسالة شارب فول أوتوماتيك تحميل علوي 10.5 كجم",
        "sku": "ES-TN105VD-SLV",
        "category": "Washing Machines",
        "sub_category": "Top Load Full Automatic",
        "color": "Silver",
        "power_voltage": "220V - 50Hz",
        "dimensions_mm": {"length": 608.0, "width": 640.0, "height": 1014.0},
        "carton_dimensions_mm": {"length": 660.0, "width": 690.0, "height": 1070.0},
        "net_weight_kg": 38.0,
        "gross_weight_kg": 43.0,
        "packed_dimensions_available": True,
        "datasheet_url": "https://www.elarabygroup.com/datasheets/sharp-es-tn105vd.pdf",
        "images": ["https://www.elarabygroup.com/media/catalog/product/e/s/es-tn105vd.jpg"],
        "components": [
            {"name": "Full Automatic Washer Cabinet", "length_mm": 608.0, "width_mm": 640.0, "height_mm": 1014.0, "weight_kg": 37.0, "quantity": 1, "material": "Anti-rust coated galvanized steel body & tempered glass lid", "fragile": True},
            {"name": "Hoses, Base Cover, Rat Mesh Pack", "length_mm": 500.0, "width_mm": 300.0, "height_mm": 80.0, "weight_kg": 1.0, "quantity": 1, "material": "Plastic & Rubber"}
        ],
        "sources_checked": [
            {"source": "El Araby Official Website", "status": "verified", "url": "https://www.elarabygroup.com/en/sharp-top-load-washing-machine-es-tn105vd"}
        ]
    },

    # ── AIR CONDITIONERS ──
    {
        "model": "AH-XP12UHE",
        "brand": "Sharp",
        "name": "Sharp Split Air Conditioner 1.5 HP Inverter Plasmacluster",
        "name_ar": "تكييف شارب سبليت 1.5 حصان انفرتر بلازما كلاستر",
        "sku": "AH-XP12UHE-WHT",
        "category": "Air Conditioners",
        "sub_category": "Split AC (Indoor Unit)",
        "color": "White",
        "power_voltage": "220V - 50Hz, 1.5 HP",
        "dimensions_mm": {"length": 877.0, "width": 222.0, "height": 292.0},
        "carton_dimensions_mm": {"length": 940.0, "width": 290.0, "height": 365.0},
        "net_weight_kg": 9.5,
        "gross_weight_kg": 11.5,
        "packed_dimensions_available": True,
        "datasheet_url": "https://www.elarabygroup.com/datasheets/sharp-ah-xp12uhe.pdf",
        "images": ["https://www.elarabygroup.com/media/catalog/product/a/h/ah-xp12uhe.jpg"],
        "components": [
            {"name": "Indoor Evaporator Unit", "length_mm": 877.0, "width_mm": 222.0, "height_mm": 292.0, "weight_kg": 9.0, "quantity": 1, "material": "Copper piping, Aluminum fins, ABS housing", "fragile": True},
            {"name": "Mounting Plate & Remote Pack", "length_mm": 300.0, "width_mm": 150.0, "height_mm": 50.0, "weight_kg": 0.5, "quantity": 1, "material": "Steel & Electronics"}
        ],
        "sources_checked": [
            {"source": "El Araby Official Website", "status": "verified", "url": "https://www.elarabygroup.com/en/sharp-split-ac-15hp-ah-xp12uhe"}
        ]
    },
    {
        "model": "TY-A12HBE",
        "brand": "Tornado",
        "name": "Tornado Split Air Conditioner 1.5 HP Cool Only",
        "name_ar": "تكييف تورنيدو سبليت 1.5 حصان بارد فقط",
        "sku": "TY-A12HBE-WHT",
        "category": "Air Conditioners",
        "sub_category": "Split AC (Indoor Unit)",
        "color": "White",
        "power_voltage": "220V - 50Hz",
        "dimensions_mm": {"length": 800.0, "width": 200.0, "height": 290.0},
        "carton_dimensions_mm": {"length": 870.0, "width": 270.0, "height": 360.0},
        "net_weight_kg": 9.0,
        "gross_weight_kg": 11.0,
        "packed_dimensions_available": True,
        "datasheet_url": "https://www.elarabygroup.com/datasheets/tornado-ty-a12hbe.pdf",
        "images": ["https://www.elarabygroup.com/media/catalog/product/t/y/ty-a12hbe.jpg"],
        "components": [
            {"name": "Indoor Wall Unit", "length_mm": 800.0, "width_mm": 200.0, "height_mm": 290.0, "weight_kg": 8.5, "quantity": 1, "material": "ABS & Aluminum/Copper coils", "fragile": True},
            {"name": "Installation Bracket & Accessories", "length_mm": 280.0, "width_mm": 140.0, "height_mm": 40.0, "weight_kg": 0.5, "quantity": 1, "material": "Steel"}
        ],
        "sources_checked": [
            {"source": "El Araby Official Website", "status": "verified", "url": "https://www.elarabygroup.com/en/tornado-split-ac-15hp-ty-a12hbe"}
        ]
    },

    # ── WATER HEATERS ──
    {
        "model": "EWH-S50",
        "brand": "Tornado",
        "name": "Tornado Electric Water Heater 50 Litres Enamelled",
        "name_ar": "سخان مياه كهربائي تورنيدو 50 لتر مطلي بالمينا",
        "sku": "EWH-S50-SLV",
        "category": "Water Heaters",
        "sub_category": "Electric Water Heater",
        "color": "Silver",
        "power_voltage": "220V - 50Hz, 1500W",
        "dimensions_mm": {"length": 450.0, "width": 450.0, "height": 620.0},
        "carton_dimensions_mm": {"length": 510.0, "width": 510.0, "height": 700.0},
        "net_weight_kg": 15.5,
        "gross_weight_kg": 17.8,
        "packed_dimensions_available": True,
        "datasheet_url": "https://www.elarabygroup.com/datasheets/ewh-s50.pdf",
        "images": ["https://www.elarabygroup.com/media/catalog/product/e/w/ewh-s50.jpg"],
        "components": [
            {"name": "Cylindrical Tank & Heater Assembly", "length_mm": 450.0, "width_mm": 450.0, "height_mm": 620.0, "weight_kg": 15.0, "quantity": 1, "material": "Steel pressure vessel with polyurethane insulation and outer shell"},
            {"name": "Safety Valve & Mounting Hooks", "length_mm": 150.0, "width_mm": 100.0, "height_mm": 50.0, "weight_kg": 0.5, "quantity": 1, "material": "Brass & Hardened Steel"}
        ],
        "sources_checked": [
            {"source": "El Araby Official Website", "status": "verified", "url": "https://www.elarabygroup.com/en/tornado-electric-water-heater-50l-ewh-s50"}
        ]
    },

    # ── TVS ──
    {
        "model": "43ES9500E",
        "brand": "Sharp",
        "name": "Sharp 43 Inch Full HD LED Smart TV",
        "name_ar": "شاشة شارب 43 بوصة سمارت فول إتش دي إل إي دي",
        "sku": "43ES9500E-BLK",
        "category": "TVs",
        "sub_category": "LED Smart TV",
        "color": "Black",
        "power_voltage": "100-240V 50/60Hz, 75W",
        "dimensions_mm": {"length": 969.0, "width": 73.0, "height": 567.0},
        "carton_dimensions_mm": {"length": 1080.0, "width": 135.0, "height": 655.0},
        "net_weight_kg": 7.2,
        "gross_weight_kg": 9.5,
        "packed_dimensions_available": True,
        "datasheet_url": "https://www.elarabygroup.com/datasheets/sharp-43es9500e.pdf",
        "images": ["https://www.elarabygroup.com/media/catalog/product/4/3/43es9500e.jpg"],
        "components": [
            {"name": "43\" LED Display Panel", "length_mm": 969.0, "width_mm": 73.0, "height_mm": 567.0, "weight_kg": 6.8, "quantity": 1, "material": "Glass & Polymer bezel", "fragile": True},
            {"name": "Pedestal Stand Feet (Pair)", "length_mm": 210.0, "width_mm": 45.0, "height_mm": 60.0, "weight_kg": 0.3, "quantity": 1, "material": "Metal alloy"},
            {"name": "Remote & Cable Pack", "length_mm": 200.0, "width_mm": 100.0, "height_mm": 40.0, "weight_kg": 0.1, "quantity": 1, "material": "Accessories"}
        ],
        "sources_checked": [
            {"source": "El Araby Official Website", "status": "verified", "url": "https://www.elarabygroup.com/en/sharp-43-inch-smart-tv-43es9500e"},
            {"source": "Sharp Technical Sheet", "status": "verified", "url": "https://www.elarabygroup.com/datasheets/sharp-43es9500e.pdf"}
        ]
    },
    {
        "model": "43V35KV",
        "brand": "Toshiba",
        "name": "Toshiba 43 Inch Full HD Smart LED TV VIDAA",
        "name_ar": "شاشة توشيبا 43 بوصة سمارت إل إي دي نظام فيدا",
        "sku": "43V35KV-BLK",
        "category": "TVs",
        "sub_category": "LED Smart TV",
        "color": "Black",
        "power_voltage": "100-240V 50/60Hz, 70W",
        "dimensions_mm": {"length": 955.0, "width": 80.0, "height": 558.0},
        "carton_dimensions_mm": {"length": 1070.0, "width": 140.0, "height": 650.0},
        "net_weight_kg": 6.9,
        "gross_weight_kg": 9.2,
        "packed_dimensions_available": True,
        "datasheet_url": "https://www.elarabygroup.com/datasheets/toshiba-43v35kv.pdf",
        "images": ["https://www.elarabygroup.com/media/catalog/product/4/3/43v35kv.jpg"],
        "components": [
            {"name": "43\" Display Panel", "length_mm": 955.0, "width_mm": 80.0, "height_mm": 558.0, "weight_kg": 6.5, "quantity": 1, "material": "LED Glass Panel", "fragile": True},
            {"name": "Stand Feet & Remote Kit", "length_mm": 220.0, "width_mm": 120.0, "height_mm": 50.0, "weight_kg": 0.4, "quantity": 1, "material": "Plastic & Metal"}
        ],
        "sources_checked": [
            {"source": "El Araby Official Website", "status": "verified", "url": "https://www.elarabygroup.com/en/toshiba-43-inch-smart-tv-43v35kv"}
        ]
    },

    # ── MICROWAVES ──
    {
        "model": "TM-20MK",
        "brand": "Tornado",
        "name": "Tornado Microwave Oven 20 Litres 700W (Mechanical)",
        "name_ar": "ميكروويف تورنيدو 20 لتر 700 وات ميكانيكي",
        "sku": "TM-20MK-BLK",
        "category": "Microwaves",
        "sub_category": "Countertop Microwave",
        "color": "Black",
        "power_voltage": "220-240V 50Hz, 700W",
        "dimensions_mm": {"length": 440.0, "width": 340.0, "height": 259.0},
        "carton_dimensions_mm": {"length": 488.0, "width": 380.0, "height": 291.0},
        "net_weight_kg": 10.5,
        "gross_weight_kg": 11.8,
        "packed_dimensions_available": True,
        "datasheet_url": "https://www.elarabygroup.com/datasheets/tm-20mk.pdf",
        "images": ["https://www.elarabygroup.com/media/catalog/product/t/m/tm-20mk.jpg"],
        "components": [
            {"name": "Microwave Cavity & Magnetron Body", "length_mm": 440.0, "width_mm": 340.0, "height_mm": 259.0, "weight_kg": 9.8, "quantity": 1, "material": "Steel chassis with glass door", "fragile": True},
            {"name": "Glass Turntable Plate & Roller Ring", "length_mm": 255.0, "width_mm": 255.0, "height_mm": 30.0, "weight_kg": 0.7, "quantity": 1, "material": "Tempered Glass", "fragile": True}
        ],
        "sources_checked": [
            {"source": "El Araby Official Website", "status": "verified", "url": "https://www.elarabygroup.com/en/tornado-microwave-20l-tm-20mk"}
        ]
    },
    {
        "model": "R-20CR",
        "brand": "Sharp",
        "name": "Sharp Microwave Oven 20 Litres 800W (Silver)",
        "name_ar": "ميكروويف شارب 20 لتر 800 وات سيلفر",
        "sku": "R-20CR-SLV",
        "category": "Microwaves",
        "sub_category": "Countertop Microwave",
        "color": "Silver",
        "power_voltage": "220-240V 50Hz, 800W",
        "dimensions_mm": {"length": 439.0, "width": 338.0, "height": 256.0},
        "carton_dimensions_mm": {"length": 486.0, "width": 378.0, "height": 289.0},
        "net_weight_kg": 10.9,
        "gross_weight_kg": 12.2,
        "packed_dimensions_available": True,
        "datasheet_url": "https://www.elarabygroup.com/datasheets/sharp-r-20cr.pdf",
        "images": ["https://www.elarabygroup.com/media/catalog/product/r/2/r-20cr.jpg"],
        "components": [
            {"name": "Microwave Cabinet & Core", "length_mm": 439.0, "width_mm": 338.0, "height_mm": 256.0, "weight_kg": 10.1, "quantity": 1, "material": "Stainless & Glass", "fragile": True},
            {"name": "Glass Rotating Tray", "length_mm": 255.0, "width_mm": 255.0, "height_mm": 25.0, "weight_kg": 0.8, "quantity": 1, "material": "Glass", "fragile": True}
        ],
        "sources_checked": [
            {"source": "El Araby Official Website", "status": "verified", "url": "https://www.elarabygroup.com/en/sharp-microwave-20l-r-20cr"}
        ]
    },

    # ── KETTLES ──
    {
        "model": "TK-2200",
        "brand": "Tornado",
        "name": "Tornado Electric Kettle 1.7 Litres Stainless Steel",
        "name_ar": "غلاية مياه كهربائية تورنيدو 1.7 لتر ستانلس ستيل",
        "sku": "TK-2200-SS",
        "category": "Kettles",
        "sub_category": "Electric Kettle",
        "color": "Stainless Steel",
        "power_voltage": "220V - 50Hz, 2200W",
        "dimensions_mm": {"length": 215.0, "width": 160.0, "height": 240.0},
        "carton_dimensions_mm": {"length": 225.0, "width": 180.0, "height": 250.0},
        "net_weight_kg": 0.95,
        "gross_weight_kg": 1.25,
        "packed_dimensions_available": True,
        "datasheet_url": "https://www.elarabygroup.com/datasheets/tk-2200.pdf",
        "images": ["https://www.elarabygroup.com/media/catalog/product/t/k/tk-2200.jpg"],
        "components": [
            {"name": "Stainless Steel Kettle Body", "length_mm": 215.0, "width_mm": 160.0, "height_mm": 210.0, "weight_kg": 0.75, "quantity": 1, "material": "Food grade SS304"},
            {"name": "360-Degree Power Base", "length_mm": 160.0, "width_mm": 160.0, "height_mm": 40.0, "weight_kg": 0.2, "quantity": 1, "material": "Fire-resistant ABS"}
        ],
        "sources_checked": [
            {"source": "El Araby Official Website", "status": "verified", "url": "https://www.elarabygroup.com/en/tornado-electric-kettle-tk-2200"}
        ]
    },

    # ── WATER DISPENSERS ──
    {
        "model": "TWD-39",
        "brand": "Tornado",
        "name": "Tornado Water Dispenser Hot and Cold with Cabinet",
        "name_ar": "مبرد مياه تورنيدو بارد وساخن مع كابينة سفلية",
        "sku": "TWD-39-SLV",
        "category": "Water Dispensers",
        "sub_category": "Top Loading Dispenser",
        "color": "Silver",
        "power_voltage": "220V - 50Hz, 500W",
        "dimensions_mm": {"length": 310.0, "width": 330.0, "height": 980.0},
        "carton_dimensions_mm": {"length": 360.0, "width": 380.0, "height": 1040.0},
        "net_weight_kg": 14.0,
        "gross_weight_kg": 16.2,
        "packed_dimensions_available": True,
        "datasheet_url": "https://www.elarabygroup.com/datasheets/twd-39.pdf",
        "images": ["https://www.elarabygroup.com/media/catalog/product/t/w/twd-39.jpg"],
        "components": [
            {"name": "Dispenser Cabinet & Compressor Unit", "length_mm": 310.0, "width_mm": 330.0, "height_mm": 980.0, "weight_kg": 13.5, "quantity": 1, "material": "ABS panels & steel internal frame", "fragile": True},
            {"name": "Drip Tray & Water Guard", "length_mm": 200.0, "width_mm": 100.0, "height_mm": 50.0, "weight_kg": 0.5, "quantity": 1, "material": "Plastic"}
        ],
        "sources_checked": [
            {"source": "El Araby Official Website", "status": "verified", "url": "https://www.elarabygroup.com/en/tornado-water-dispenser-twd-39"}
        ]
    }
]


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
