# NxtPak AI — Hackathon Demo Script & Field Measurement Guide

## 1. Overview

NxtPak AI is configured with verified, authentic data from El Araby Group product datasheets and website listings. In compliance with strict engineering integrity:
- **No data is fabricated.** If a parameter is not published in manufacturer documentation, the system marks it as `Not available — enter it`.
- **Physical testing standards** never return `PASS` in software.
- **Clearances** are user-editable engineering assumptions, not ISO mandates.

This guide lists the exact physical measurements required from the factory floor before running full optimization for demonstration.

---

## 2. Product 1: Tornado Stand Fan 16" (TSF-16W)

**Source:** El Araby Germany GmbH Datasheet (URL: `https://d.otto.de/files/63751d29-94cc-4425-8250-d7468ff8c95c.pdf`)

### Verified Data Already Loaded
- **Net weight:** 7.3 kg
- **Gross weight:** 9.1 kg
- **Derived packaging mass:** 1.8 kg
- **Assembled dimensions:** 460 mm (L) × 400 mm (W) × 1400 mm (H)
- **Baseline carton external:** 575 mm (L) × 310 mm (W) × 490 mm (H)
- **Container load:** 760 units per 40-foot HQ container
- **Electrical specs:** 220 V AC 50 Hz, 60 W ±3 W, 4 plastic blades

### Measurements Required on Site
1. **Carton wall thickness:** Measure corrugated board thickness (typically 3.0 to 5.0 mm).
2. **Board grade / type:** Note flute profile (e.g. B-flute, C-flute, double wall BC).
3. **Cushioning & inserts:** Note material (e.g. molded pulp, EPS foam, corrugated corner pads) and thickness per side.
4. **Packed component dimensions:** The fan ships **disassembled**. Measure each packed part individually:
   - Motor head + control column
   - Base weight / plate
   - Front & rear guards (wire cages)
   - Fan blades (assembled hub)
   - Extension pole / tube
   - Fasteners & manual pack
5. **Baseline unit cost:** Packaging unit cost (e.g. in EGP) for corrugated carton and inserts.

---

## 3. Product 2: Tornado Electric Blender 500W 1.5L (BL500/2)

**Source:** El Araby Group Official Product Page (URL: `https://www.elarabygroup.com/en/tornado-electric-blender-500-watt-1-5-liter-2-mills-black-bl500-2-black`)

### Verified Data Already Loaded
- **Net weight:** 2.6 kg
- **Gross weight:** 2.8 kg
- **Derived packaging mass:** 0.2 kg
- **Power / Capacity:** 500 W, 1.5 L jug, 2 grinding mills
- **Materials:** Transparent break-resistant plastic jug, stainless steel blades, made in Egypt

### Measurements Required on Site
1. **Assembled blender dimensions:** Height, width, and depth of motor base with jug attached.
2. **Individual piece dimensions:**
   - Motor base unit (height, base diameter/width)
   - 1.5 L plastic jug (height, rim diameter, handle protrusion)
   - Mill 1 (height, diameter)
   - Mill 2 (height, diameter)
3. **Current carton dimensions:** Outer length, width, and height (mm).
   *(Note: The Amazon Egypt lead of ~35.6 × 33 × 21.8 cm is stored as an unverified note and must not be used as baseline until verified).*
4. **Inserts:** Material and shape (e.g. pulp tray, cardboard partitions).
5. **Unit costs:** Corrugated box cost and insert costs in EGP.

---

## 4. Live Hackathon Demo Walkthrough (5 Minutes)

1. **Start from Real Product:**
   - On the Dashboard, click **Load as Draft Project** under *Tornado Stand Fan 16" (TSF-16W)*.
   - Show that all fields display their real datasheet source and evidence snippet.
   - Show that unknown fields (board thickness, component sizes) are honest and marked *Not available*.
2. **Inspect 3D Workspace:**
   - Switch between **Box (Outside)**, **Inside the Box**, and **Product Alone** views.
   - Demonstrate 3D rotation, zoom, wireframe toggle, and top/front camera angles.
   - Point out that clearances are explicitly labeled *Engineering assumption*, with no false ISO badges.
3. **Side-by-Side Comparison:**
   - Open the **Comparison** tab to view Actual (Baseline) vs My Plan vs Proposed.
   - Toggle **Show formulas** to show transparent volume and utilization mathematics.
4. **Evaluate ISO Standards:**
   - Open the **ISO Standards** tab.
   - Explain that physical-test standards (ISO 2248 drop, ISO 13355 vibration, ISO 12048 compression) strictly show `NOT_CONFIGURED` or `NOT_VERIFIABLE` because software cannot substitute for physical drop towers and shake tables.
5. **AI Assistant:**
   - Click the floating assistant button.
   - Run quick actions: *"What is missing?"* and *"Explain comparison"*.
   - Point out offline mode transparency (zero data sent to third parties) and optional Gemini API integration.
6. **Export Engineering Report:**
   - Download the PDF report containing all geometric calculations, ISO evaluation statements, and data provenance.
