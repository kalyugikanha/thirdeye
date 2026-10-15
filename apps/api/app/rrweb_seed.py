import json
import gzip
from datetime import datetime, timezone
from pathlib import Path

def build_growinsight_rrweb(t_ms: int = None):
    if t_ms is None:
        t_ms = int(datetime.now(timezone.utc).timestamp() * 1000) - 45000

    css_content = """
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #f8fafc; color: #0f172a; -webkit-font-smoothing: antialiased; }
      header { background: #081120; border-bottom: 1px solid rgba(255,255,255,0.08); padding: 0 48px; height: 80px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; }
      .brand { display: flex; align-items: center; gap: 14px; text-decoration: none; }
      .brand img { height: 40px; object-fit: contain; }
      .brand-fallback { font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
      .brand-fallback span { color: #d4af37; }
      nav { display: flex; align-items: center; gap: 32px; }
      nav a { color: #cbd5e1; text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; }
      nav a.active, nav a:hover { color: #d4af37; }
      .btn-gold { background: linear-gradient(135deg, #c59b27 0%, #e0b438 100%); color: #081120; font-size: 13px; font-weight: 700; padding: 11px 22px; border-radius: 10px; border: none; cursor: pointer; text-decoration: none; box-shadow: 0 4px 14px rgba(197,155,39,0.35); }
      .hero { background: radial-gradient(circle at 80% 20%, #1e3155 0%, #0a1324 70%); padding: 80px 48px 90px; color: #ffffff; position: relative; overflow: hidden; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .hero-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(212,175,55,0.12); border: 1px solid rgba(212,175,55,0.35); color: #e8c65d; font-size: 12px; font-weight: 600; padding: 6px 16px; border-radius: 9999px; margin-bottom: 24px; }
      .hero h1 { font-size: 50px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.15; max-width: 860px; margin-bottom: 20px; color: #ffffff; }
      .hero h1 span { color: #d4af37; }
      .hero p { font-size: 18px; line-height: 1.6; color: #94a3b8; max-width: 720px; margin-bottom: 36px; }
      .hero-ctas { display: flex; align-items: center; gap: 16px; margin-bottom: 56px; }
      .btn-secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.18); color: #ffffff; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 10px; text-decoration: none; }
      .stats-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; padding-top: 36px; border-top: 1px solid rgba(255,255,255,0.08); max-width: 960px; }
      .stat-item h3 { font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; margin-bottom: 4px; }
      .stat-item h3 span { color: #d4af37; }
      .stat-item p { font-size: 13px; color: #64748b; font-weight: 500; }
      .services { padding: 90px 48px; background: #ffffff; }
      .section-header { text-align: center; max-width: 700px; margin: 0 auto 64px; }
      .section-badge { color: #c59b27; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; }
      .section-title { font-size: 36px; font-weight: 800; color: #081120; letter-spacing: -0.02em; margin-bottom: 16px; }
      .section-subtitle { font-size: 16px; color: #64748b; line-height: 1.6; }
      .cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; max-width: 1240px; margin: 0 auto; }
      .card { background: #fbfcfe; border: 1px solid #e2e8f0; border-radius: 20px; padding: 36px 30px; transition: transform 0.2s, box-shadow 0.2s; position: relative; }
      .card-icon { width: 56px; height: 56px; border-radius: 14px; background: #081120; color: #d4af37; display: flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 24px; }
      .card h3 { font-size: 20px; font-weight: 700; color: #081120; margin-bottom: 12px; letter-spacing: -0.01em; }
      .card p { font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 24px; }
      .card a { color: #c59b27; text-decoration: none; font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }
      footer { background: #050a14; color: #64748b; padding: 48px; text-align: center; font-size: 13px; border-top: 1px solid rgba(255,255,255,0.05); }
    """

    node_id = 0
    def nid():
        nonlocal node_id
        node_id += 1
        return node_id

    doc_id = nid()
    doctype_id = nid()
    html_id = nid()
    head_id = nid()
    title_id = nid()
    title_txt_id = nid()
    style_id = nid()
    style_txt_id = nid()
    body_id = nid()

    rrweb_events = [
        # 1. Meta Event
        {
            "type": 4,
            "data": {
                "href": "https://growinsight.co.in/",
                "width": 1440,
                "height": 900
            },
            "timestamp": t_ms
        },
        # 2. Full Snapshot Event
        {
            "type": 2,
            "data": {
                "node": {
                    "type": 0,
                    "id": doc_id,
                    "childNodes": [
                        {
                            "type": 1,
                            "name": "html",
                            "publicId": "",
                            "systemId": "",
                            "id": doctype_id
                        },
                        {
                            "type": 2,
                            "tagName": "html",
                            "attributes": {"lang": "en"},
                            "id": html_id,
                            "childNodes": [
                                {
                                    "type": 2,
                                    "tagName": "head",
                                    "attributes": {},
                                    "id": head_id,
                                    "childNodes": [
                                        {
                                            "type": 2,
                                            "tagName": "title",
                                            "attributes": {},
                                            "id": title_id,
                                            "childNodes": [
                                                {
                                                    "type": 3,
                                                    "textContent": "Home - GrowInsight Solutions LLP",
                                                    "id": title_txt_id
                                                }
                                            ]
                                        },
                                        {
                                            "type": 2,
                                            "tagName": "style",
                                            "attributes": {},
                                            "id": style_id,
                                            "childNodes": [
                                                {
                                                    "type": 3,
                                                    "textContent": css_content,
                                                    "id": style_txt_id
                                                }
                                            ]
                                        }
                                    ]
                                },
                                {
                                    "type": 2,
                                    "tagName": "body",
                                    "attributes": {},
                                    "id": body_id,
                                    "childNodes": [
                                        # Header
                                        {
                                            "type": 2,
                                            "tagName": "header",
                                            "attributes": {},
                                            "id": nid(),
                                            "childNodes": [
                                                {
                                                    "type": 2,
                                                    "tagName": "a",
                                                    "attributes": {"class": "brand", "href": "/"},
                                                    "id": nid(),
                                                    "childNodes": [
                                                        {
                                                            "type": 2,
                                                            "tagName": "img",
                                                            "attributes": {
                                                                "src": "https://growinsight.co.in/wp-content/uploads/2024/10/Grow2x-Logo1.png",
                                                                "alt": "GrowInsight Solutions"
                                                            },
                                                            "id": nid(),
                                                            "childNodes": []
                                                        },
                                                        {
                                                            "type": 2,
                                                            "tagName": "span",
                                                            "attributes": {"class": "brand-fallback"},
                                                            "id": nid(),
                                                            "childNodes": [
                                                                {"type": 3, "textContent": "GrowInsight", "id": nid()},
                                                                {"type": 2, "tagName": "span", "attributes": {}, "id": nid(), "childNodes": [{"type": 3, "textContent": " Solutions", "id": nid()}]}
                                                            ]
                                                        }
                                                    ]
                                                },
                                                {
                                                    "type": 2,
                                                    "tagName": "nav",
                                                    "attributes": {},
                                                    "id": nid(),
                                                    "childNodes": [
                                                        {"type": 2, "tagName": "a", "attributes": {"href": "#", "class": "active"}, "id": nid(), "childNodes": [{"type": 3, "textContent": "Home", "id": nid()}]},
                                                        {"type": 2, "tagName": "a", "attributes": {"href": "#"}, "id": nid(), "childNodes": [{"type": 3, "textContent": "Real Estate Consulting", "id": nid()}]},
                                                        {"type": 2, "tagName": "a", "attributes": {"href": "#"}, "id": nid(), "childNodes": [{"type": 3, "textContent": "Wealth Consulting", "id": nid()}]},
                                                        {"type": 2, "tagName": "a", "attributes": {"href": "#"}, "id": nid(), "childNodes": [{"type": 3, "textContent": "Trading & Investments", "id": nid()}]},
                                                        {"type": 2, "tagName": "a", "attributes": {"href": "#"}, "id": nid(), "childNodes": [{"type": 3, "textContent": "About Us", "id": nid()}]},
                                                        {"type": 2, "tagName": "a", "attributes": {"href": "#"}, "id": nid(), "childNodes": [{"type": 3, "textContent": "Contact", "id": nid()}]}
                                                    ]
                                                },
                                                {
                                                    "type": 2,
                                                    "tagName": "button",
                                                    "attributes": {"class": "btn-gold"},
                                                    "id": 88,
                                                    "childNodes": [{"type": 3, "textContent": "Schedule Consultation", "id": nid()}]
                                                }
                                            ]
                                        },
                                        # Hero Section
                                        {
                                            "type": 2,
                                            "tagName": "section",
                                            "attributes": {"class": "hero"},
                                            "id": nid(),
                                            "childNodes": [
                                                {
                                                    "type": 2,
                                                    "tagName": "div",
                                                    "attributes": {"class": "hero-badge"},
                                                    "id": nid(),
                                                    "childNodes": [
                                                        {"type": 3, "textContent": "✦ RERA Registered & Luxury Real Estate Consulting", "id": nid()}
                                                    ]
                                                },
                                                {
                                                    "type": 2,
                                                    "tagName": "h1",
                                                    "attributes": {},
                                                    "id": 105,
                                                    "childNodes": [
                                                        {"type": 3, "textContent": "To move your wealth ", "id": nid()},
                                                        {"type": 2, "tagName": "span", "attributes": {}, "id": nid(), "childNodes": [{"type": 3, "textContent": "forward", "id": nid()}]}
                                                    ]
                                                },
                                                {
                                                    "type": 2,
                                                    "tagName": "p",
                                                    "attributes": {},
                                                    "id": nid(),
                                                    "childNodes": [
                                                        {"type": 3, "textContent": "Comprehensive wealth management, high-yield luxury real estate acquisitions, and proprietary investment advisory tailored for HNIs, institutional investors, and family offices.", "id": nid()}
                                                    ]
                                                },
                                                {
                                                    "type": 2,
                                                    "tagName": "div",
                                                    "attributes": {"class": "hero-ctas"},
                                                    "id": nid(),
                                                    "childNodes": [
                                                        {
                                                            "type": 2,
                                                            "tagName": "a",
                                                            "attributes": {"class": "btn-gold", "href": "#"},
                                                            "id": 120,
                                                            "childNodes": [{"type": 3, "textContent": "Explore Premium Assets", "id": nid()}]
                                                        },
                                                        {
                                                            "type": 2,
                                                            "tagName": "a",
                                                            "attributes": {"class": "btn-secondary", "href": "#"},
                                                            "id": nid(),
                                                            "childNodes": [{"type": 3, "textContent": "Advisory Portfolio", "id": nid()}]
                                                        }
                                                    ]
                                                },
                                                # Stats Bar
                                                {
                                                    "type": 2,
                                                    "tagName": "div",
                                                    "attributes": {"class": "stats-bar"},
                                                    "id": nid(),
                                                    "childNodes": [
                                                        {
                                                            "type": 2, "tagName": "div", "attributes": {"class": "stat-item"}, "id": nid(),
                                                            "childNodes": [
                                                                {"type": 2, "tagName": "h3", "attributes": {}, "id": nid(), "childNodes": [{"type": 3, "textContent": "₹1,250", "id": nid()}, {"type": 2, "tagName": "span", "attributes": {}, "id": nid(), "childNodes": [{"type": 3, "textContent": "Cr+", "id": nid()}]}]},
                                                                {"type": 2, "tagName": "p", "attributes": {}, "id": nid(), "childNodes": [{"type": 3, "textContent": "Portfolios Advised", "id": nid()}]}
                                                            ]
                                                        },
                                                        {
                                                            "type": 2, "tagName": "div", "attributes": {"class": "stat-item"}, "id": nid(),
                                                            "childNodes": [
                                                                {"type": 2, "tagName": "h3", "attributes": {}, "id": nid(), "childNodes": [{"type": 3, "textContent": "450", "id": nid()}, {"type": 2, "tagName": "span", "attributes": {}, "id": nid(), "childNodes": [{"type": 3, "textContent": "+", "id": nid()}]}]},
                                                                {"type": 2, "tagName": "p", "attributes": {}, "id": nid(), "childNodes": [{"type": 3, "textContent": "Luxury Closures", "id": nid()}]}
                                                            ]
                                                        },
                                                        {
                                                            "type": 2, "tagName": "div", "attributes": {"class": "stat-item"}, "id": nid(),
                                                            "childNodes": [
                                                                {"type": 2, "tagName": "h3", "attributes": {}, "id": nid(), "childNodes": [{"type": 3, "textContent": "100", "id": nid()}, {"type": 2, "tagName": "span", "attributes": {}, "id": nid(), "childNodes": [{"type": 3, "textContent": "%", "id": nid()}]}]},
                                                                {"type": 2, "tagName": "p", "attributes": {}, "id": nid(), "childNodes": [{"type": 3, "textContent": "RERA Verified", "id": nid()}]}
                                                            ]
                                                        },
                                                        {
                                                            "type": 2, "tagName": "div", "attributes": {"class": "stat-item"}, "id": nid(),
                                                            "childNodes": [
                                                                {"type": 2, "tagName": "h3", "attributes": {}, "id": nid(), "childNodes": [{"type": 3, "textContent": "99.4", "id": nid()}, {"type": 2, "tagName": "span", "attributes": {}, "id": nid(), "childNodes": [{"type": 3, "textContent": "%", "id": nid()}]}]},
                                                                {"type": 2, "tagName": "p", "attributes": {}, "id": nid(), "childNodes": [{"type": 3, "textContent": "Client Retention", "id": nid()}]}
                                                            ]
                                                        }
                                                    ]
                                                }
                                            ]
                                        },
                                        # Services Grid
                                        {
                                            "type": 2,
                                            "tagName": "section",
                                            "attributes": {"class": "services"},
                                            "id": nid(),
                                            "childNodes": [
                                                {
                                                    "type": 2,
                                                    "tagName": "div",
                                                    "attributes": {"class": "section-header"},
                                                    "id": nid(),
                                                    "childNodes": [
                                                        {"type": 2, "tagName": "div", "attributes": {"class": "section-badge"}, "id": nid(), "childNodes": [{"type": 3, "textContent": "Solutions We Provide", "id": nid()}]},
                                                        {"type": 2, "tagName": "h2", "attributes": {"class": "section-title"}, "id": nid(), "childNodes": [{"type": 3, "textContent": "Comprehensive Investment Solutions", "id": nid()}]},
                                                        {"type": 2, "tagName": "p", "attributes": {"class": "section-subtitle"}, "id": nid(), "childNodes": [{"type": 3, "textContent": "Combining deep market intelligence, legal due diligence, and bespoke portfolio structuring for generational wealth creation.", "id": nid()}]}
                                                    ]
                                                },
                                                {
                                                    "type": 2,
                                                    "tagName": "div",
                                                    "attributes": {"class": "cards-grid"},
                                                    "id": nid(),
                                                    "childNodes": [
                                                        {
                                                            "type": 2, "tagName": "div", "attributes": {"class": "card"}, "id": 140,
                                                            "childNodes": [
                                                                {"type": 2, "tagName": "div", "attributes": {"class": "card-icon"}, "id": nid(), "childNodes": [{"type": 3, "textContent": "🏢", "id": nid()}]},
                                                                {"type": 2, "tagName": "h3", "attributes": {}, "id": nid(), "childNodes": [{"type": 3, "textContent": "Real Estate Consulting", "id": nid()}]},
                                                                {"type": 2, "tagName": "p", "attributes": {}, "id": nid(), "childNodes": [{"type": 3, "textContent": "High-end residential villas, penthouses, and pre-leased Grade-A commercial properties with verified title deeds and high rental yield.", "id": nid()}]},
                                                                {"type": 2, "tagName": "a", "attributes": {"href": "#"}, "id": nid(), "childNodes": [{"type": 3, "textContent": "Explore Real Estate →", "id": nid()}]}
                                                            ]
                                                        },
                                                        {
                                                            "type": 2, "tagName": "div", "attributes": {"class": "card"}, "id": 150,
                                                            "childNodes": [
                                                                {"type": 2, "tagName": "div", "attributes": {"class": "card-icon"}, "id": nid(), "childNodes": [{"type": 3, "textContent": "💎", "id": nid()}]},
                                                                {"type": 2, "tagName": "h3", "attributes": {}, "id": nid(), "childNodes": [{"type": 3, "textContent": "Wealth Consulting", "id": nid()}]},
                                                                {"type": 2, "tagName": "p", "attributes": {}, "id": nid(), "childNodes": [{"type": 3, "textContent": "Multi-asset family office management, tax-efficient succession planning, and personalized wealth preservation structures.", "id": nid()}]},
                                                                {"type": 2, "tagName": "a", "attributes": {"href": "#"}, "id": nid(), "childNodes": [{"type": 3, "textContent": "Learn More →", "id": nid()}]}
                                                            ]
                                                        },
                                                        {
                                                            "type": 2, "tagName": "div", "attributes": {"class": "card"}, "id": 160,
                                                            "childNodes": [
                                                                {"type": 2, "tagName": "div", "attributes": {"class": "card-icon"}, "id": nid(), "childNodes": [{"type": 3, "textContent": "📈", "id": nid()}]},
                                                                {"type": 2, "tagName": "h3", "attributes": {}, "id": nid(), "childNodes": [{"type": 3, "textContent": "Trading & Investment", "id": nid()}]},
                                                                {"type": 2, "tagName": "p", "attributes": {}, "id": nid(), "childNodes": [{"type": 3, "textContent": "Quantitative market strategies, private credit, and alternative investment funds delivering alpha across macro market cycles.", "id": nid()}]},
                                                                {"type": 2, "tagName": "a", "attributes": {"href": "#"}, "id": nid(), "childNodes": [{"type": 3, "textContent": "View Offerings →", "id": nid()}]}
                                                            ]
                                                        }
                                                    ]
                                                }
                                            ]
                                        },
                                        # Footer
                                        {
                                            "type": 2,
                                            "tagName": "footer",
                                            "attributes": {},
                                            "id": nid(),
                                            "childNodes": [
                                                {"type": 3, "textContent": "© 2026 GrowInsight Solutions LLP. All rights reserved. RERA Registered Advisor.", "id": nid()}
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                "initialOffset": {"left": 0, "top": 0}
            },
            "timestamp": t_ms + 100
        },
        # 3. Mouse Positions (Interactive realistic cursor trail)
        {
            "type": 3,
            "data": {
                "source": 1,
                "positions": [
                    {"x": 180, "y": 42, "id": 88, "timeOffset": 0},
                    {"x": 340, "y": 42, "id": 88, "timeOffset": 300},
                    {"x": 580, "y": 42, "id": 88, "timeOffset": 800},
                    {"x": 780, "y": 42, "id": 88, "timeOffset": 1200},
                    {"x": 1280, "y": 42, "id": 88, "timeOffset": 1800},
                    {"x": 1280, "y": 42, "id": 88, "timeOffset": 2400},
                    {"x": 860, "y": 180, "id": 105, "timeOffset": 3200},
                    {"x": 380, "y": 260, "id": 105, "timeOffset": 4000},
                    {"x": 220, "y": 380, "id": 120, "timeOffset": 5000},
                    {"x": 220, "y": 380, "id": 120, "timeOffset": 5500}
                ]
            },
            "timestamp": t_ms + 1200
        },
        # 4. Click interaction on CTA button (id: 120)
        {
            "type": 3,
            "data": {
                "source": 2,
                "type": 2,
                "id": 120,
                "x": 220,
                "y": 380
            },
            "timestamp": t_ms + 6700
        },
        # 5. Scroll down to Services section
        {
            "type": 3,
            "data": {
                "source": 3,
                "id": html_id,
                "x": 0,
                "y": 480
            },
            "timestamp": t_ms + 8000
        },
        # 6. Mouse hover over Real Estate card (id: 140)
        {
            "type": 3,
            "data": {
                "source": 1,
                "positions": [
                    {"x": 320, "y": 620, "id": 140, "timeOffset": 0},
                    {"x": 380, "y": 660, "id": 140, "timeOffset": 600},
                    {"x": 680, "y": 660, "id": 150, "timeOffset": 1500},
                    {"x": 720, "y": 700, "id": 150, "timeOffset": 2200}
                ]
            },
            "timestamp": t_ms + 10000
        },
        # 7. Final click on Wealth Consulting card
        {
            "type": 3,
            "data": {
                "source": 2,
                "type": 2,
                "id": 150,
                "x": 720,
                "y": 700
            },
            "timestamp": t_ms + 14500
        }
    ]

    return rrweb_events

def write_growinsight_snapshot(target_dirs):
    events = build_growinsight_rrweb()
    gz_bytes = gzip.compress(json.dumps(events).encode("utf-8"))
    for d in target_dirs:
        d = Path(d)
        d.mkdir(parents=True, exist_ok=True)
        with open(d / "2n69l5dt3kd.json.gz", "wb") as f:
            f.write(gz_bytes)
        # Also plain json for fallbacks
        with open(d / "2n69l5dt3kd.json", "w", encoding="utf-8") as f:
            json.dump(events, f)
    return events
