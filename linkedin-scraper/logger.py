"""
logger.py – Shared coloured logger for the entire scraper service.

Import `log` anywhere:
    from logger import log
    log.info("Hello")
"""

import logging
import sys

import colorlog

_HANDLER = colorlog.StreamHandler(stream=sys.stdout)
_HANDLER.setFormatter(
    colorlog.ColoredFormatter(
        "%(log_color)s%(asctime)s [%(levelname)s]%(reset)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        log_colors={
            "DEBUG": "cyan",
            "INFO": "green",
            "WARNING": "yellow",
            "ERROR": "red",
            "CRITICAL": "bold_red",
        },
    )
)

log = logging.getLogger("linkedin-scraper")
log.setLevel(logging.DEBUG)
log.addHandler(_HANDLER)
log.propagate = False
