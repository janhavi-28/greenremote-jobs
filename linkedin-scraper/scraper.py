"""
scraper.py – LinkedIn job scraper using Playwright.

Architecture
────────────
1. `LinkedInScraper` is the main class.
2. Optional login via LinkedIn credentials (session persisted in browser context).
3. For each (query, location) pair:
   a. Navigate to LinkedIn public jobs search.
   b. Paginate through result pages.
   c. For each card, click to open detail panel and extract structured data.
4. Random delays and human-like interaction to avoid bot detection.
5. Hard stop when `cfg.max_jobs_per_run` is reached.

Note: This scraper uses LinkedIn's *public* job search pages (no wall-garden
login required for basic listings). LinkedIn credentials enable richer data
such as full descriptions on some listings.
"""

from __future__ import annotations

import random
import time
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from urllib.parse import quote_plus, urljoin

from playwright.sync_api import (
    Browser,
    BrowserContext,
    Page,
    Playwright,
    sync_playwright,
    TimeoutError as PlaywrightTimeout,
)
from tenacity import retry, stop_after_attempt, wait_exponential

from config import cfg
from logger import log

# ── URL templates ─────────────────────────────────────────────────────────────

_JOBS_SEARCH_URL = (
    "https://www.linkedin.com/jobs/search/"
    "?keywords={query}&location={location}&f_WT=2"   # f_WT=2 = Remote
    "&sortBy=DD"                                       # Most recent
)
_LOGIN_URL = "https://www.linkedin.com/login"

# ── Selectors (may need updating if LinkedIn changes their DOM) ───────────────

_SEL = {
    # Search results
    "job_cards":      "ul.jobs-search__results-list > li",
    "job_card_link":  "a.base-card__full-link",
    # Detail panel / page
    "job_title":      "h1.top-card-layout__title, h1.jobs-unified-top-card__job-title",
    "company":        "a.topcard__org-name-link, span.jobs-unified-top-card__company-name",
    "location":       "span.topcard__flavor--bullet, span.jobs-unified-top-card__bullet",
    "description":    "div.description__text, div.jobs-description-content__text",
    "emp_type":       "span.description__job-criteria-text",
    # Pagination
    "next_btn":       "li[data-test-pagination-page-btn].selected + li button",
    # Login
    "email_input":    "#username",
    "pass_input":     "#password",
    "login_btn":      "button[data-litms-control-id='login-submit'], button[type='submit']",
}


# ── Data container ────────────────────────────────────────────────────────────

@dataclass
class RawJob:
    title:           str = ""
    company:         str = ""
    location:        str = ""
    description:     str = ""
    employment_type: str = ""
    source_url:      str = ""

    def to_dict(self) -> Dict[str, str]:
        return {
            "title":           self.title,
            "company":         self.company,
            "location":        self.location,
            "description":     self.description,
            "employment_type": self.employment_type,
            "source_url":      self.source_url,
        }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _random_delay(min_s: float | None = None, max_s: float | None = None) -> None:
    lo = min_s if min_s is not None else cfg.delay_min
    hi = max_s if max_s is not None else cfg.delay_max
    time.sleep(random.uniform(lo, hi))


def _safe_text(page: Page, selector: str, default: str = "") -> str:
    """Extract inner-text from the first matching element; return default if absent."""
    try:
        el = page.query_selector(selector)
        return el.inner_text().strip() if el else default
    except Exception:
        return default


def _safe_attr(page: Page, selector: str, attr: str, default: str = "") -> str:
    try:
        el = page.query_selector(selector)
        return (el.get_attribute(attr) or "").strip() if el else default
    except Exception:
        return default


def _extract_job_url(card_element) -> str:
    """Pull the canonical job URL from a card element."""
    try:
        link = card_element.query_selector(_SEL["job_card_link"])
        if link:
            href = link.get_attribute("href") or ""
            # LinkedIn sometimes returns relative URLs
            return urljoin("https://www.linkedin.com", href.split("?")[0].strip())
    except Exception:
        pass
    return ""


# ── Main scraper class ────────────────────────────────────────────────────────

class LinkedInScraper:
    """Playwright-based LinkedIn job scraper."""

    def __init__(self) -> None:
        self._playwright: Playwright | None = None
        self._browser:    Browser | None    = None
        self._context:    BrowserContext | None = None
        self._page:       Page | None       = None
        self._logged_in:  bool = False

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def start(self) -> None:
        """Launch the browser and create a persistent context."""
        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(
            headless=cfg.headless,
            slow_mo=100,
            args=[
                "--lang=en-US",
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
            ],
        )
        self._context = self._browser.new_context(
            locale="en-US",
            viewport={"width": 1280, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
        )
        self._page = self._context.new_page()
        log.debug("Browser launched (headless=%s)", cfg.headless)

    def stop(self) -> None:
        """Gracefully close everything."""
        try:
            if self._context:
                self._context.close()
            if self._browser:
                self._browser.close()
            if self._playwright:
                self._playwright.stop()
        except Exception as exc:
            log.warning("Error during browser shutdown: %s", exc)
        self._logged_in = False
        log.debug("Browser closed.")

    # ── Login ─────────────────────────────────────────────────────────────────

    def _login(self) -> bool:
        """
        Attempt LinkedIn login. Returns True on success.
        Safe to call even if credentials are not configured (returns False).
        """
        if not cfg.linkedin_email or not cfg.linkedin_password:
            log.info("No LinkedIn credentials configured; scraping without login.")
            return False

        page = self._page
        assert page is not None

        try:
            log.info("Logging in to LinkedIn as %s …", cfg.linkedin_email)
            page.goto(_LOGIN_URL, wait_until="domcontentloaded", timeout=30_000)
            _random_delay(1, 2)

            page.fill(_SEL["email_input"], cfg.linkedin_email)
            _random_delay(0.5, 1.0)
            page.fill(_SEL["pass_input"], cfg.linkedin_password)
            _random_delay(0.5, 1.0)
            page.click(_SEL["login_btn"])
            page.wait_for_load_state("networkidle", timeout=20_000)

            # Detect login success by checking for feed or nav
            if "/feed" in page.url or "mynetwork" in page.url or "jobs" in page.url:
                log.info("Login successful.")
                self._logged_in = True
                return True
            else:
                log.warning("Login may have failed (current URL: %s)", page.url)
                return False
        except Exception as exc:
            log.error("Login error: %s", exc)
            return False

    # ── Job detail extraction ─────────────────────────────────────────────────

    def _extract_from_detail_page(self, url: str) -> Optional[RawJob]:
        """
        Navigate to a job detail page and extract all fields.
        Returns None on failure.
        """
        page = self._page
        assert page is not None

        try:
            page.goto(url, wait_until="domcontentloaded", timeout=25_000)
            _random_delay(1.5, 3.0)

            title       = _safe_text(page, _SEL["job_title"])
            company     = _safe_text(page, _SEL["company"])
            location    = _safe_text(page, _SEL["location"])
            description = _safe_text(page, _SEL["description"])

            # Employment type lives inside a criteria list
            emp_type = ""
            criteria_headers = page.query_selector_all("h3.description__job-criteria-subheader")
            criteria_texts   = page.query_selector_all(_SEL["emp_type"])
            for header, text_el in zip(criteria_headers, criteria_texts):
                if "employment type" in (header.inner_text() or "").lower():
                    emp_type = text_el.inner_text().strip()
                    break

            if not title and not company:
                log.debug("  No title/company found at %s — skipping", url)
                return None

            return RawJob(
                title=title,
                company=company,
                location=location,
                description=description,
                employment_type=emp_type,
                source_url=url,
            )
        except PlaywrightTimeout:
            log.warning("  Timeout loading %s — skipping", url)
            return None
        except Exception as exc:
            log.warning("  Error extracting %s: %s — skipping", url, exc)
            return None

    # ── Search pagination ─────────────────────────────────────────────────────

    def _collect_card_urls(self, query: str, location: str, max_count: int) -> List[str]:
        """
        Navigate the search results for *query* + *location* and collect job URLs
        until we have *max_count* or there are no more pages.
        """
        page = self._page
        assert page is not None

        base_url = _JOBS_SEARCH_URL.format(
            query=quote_plus(query),
            location=quote_plus(location),
        )
        urls: List[str] = []
        start = 0

        while len(urls) < max_count:
            paged_url = f"{base_url}&start={start}"
            log.info("  Fetching search page: start=%d  (collected so far: %d)", start, len(urls))

            try:
                page.goto(paged_url, wait_until="domcontentloaded", timeout=30_000)
            except PlaywrightTimeout:
                log.warning("  Timeout on search URL %s — stopping pagination", paged_url)
                break

            _random_delay()

            # Scroll to trigger lazy-loading
            for _ in range(3):
                page.evaluate("window.scrollBy(0, document.body.scrollHeight / 3)")
                _random_delay(0.5, 1.0)

            cards = page.query_selector_all(_SEL["job_cards"])
            if not cards:
                log.info("  No job cards found — end of results.")
                break

            new_urls = []
            for card in cards:
                url = _extract_job_url(card)
                if url and url not in urls:
                    new_urls.append(url)

            if not new_urls:
                log.info("  No new URLs on this page — stopping pagination.")
                break

            urls.extend(new_urls)
            log.debug("  +%d URLs from this page (total: %d)", len(new_urls), len(urls))

            # Check if next page exists
            try:
                next_btn = page.query_selector(_SEL["next_btn"])
                if not next_btn or not next_btn.is_enabled():
                    log.info("  No next-page button — reached last page.")
                    break
            except Exception:
                break

            start += 25   # LinkedIn paginates in steps of 25
            _random_delay(cfg.delay_min, cfg.delay_max)

        return urls[:max_count]

    # ── Public entry point ────────────────────────────────────────────────────

    def scrape(self) -> List[Dict]:
        """
        Run the full scrape across all configured queries/locations.
        Returns a list of raw job dicts ready for normalisation.
        """
        self.start()

        try:
            self._login()

            all_raw: List[Dict] = []
            remaining = cfg.max_jobs_per_run

            for query in cfg.search_queries:
                if remaining <= 0:
                    break
                for location in cfg.search_locations:
                    if remaining <= 0:
                        break

                    log.info("Scraping query='%s'  location='%s'  (remaining budget: %d)",
                             query, location, remaining)

                    urls = self._collect_card_urls(query, location, max_count=remaining)
                    log.info("  Collected %d job URLs", len(urls))

                    for url in urls:
                        if remaining <= 0:
                            break
                        job = self._extract_from_detail_page(url)
                        if job:
                            all_raw.append(job.to_dict())
                            remaining -= 1
                        _random_delay()

            log.info("Scraping complete. Total raw jobs: %d", len(all_raw))
            return all_raw

        finally:
            self.stop()
