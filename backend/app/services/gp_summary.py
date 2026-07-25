import re

from app.db.models import InteractionRecord

_SEVERITY_TAG_RE = re.compile(
    r"^\s*(\[(?:moderate|major|minor|high|low|unknown|none)\]\s*)+",
    re.IGNORECASE,
)
_EM_DASH = "\u2014"


def strip_severity_tags(text: str) -> str:
    cleaned = text.strip()
    while True:
        next_text = _SEVERITY_TAG_RE.sub("", cleaned, count=1).strip()
        if next_text == cleaned:
            break
        cleaned = next_text
    return cleaned.replace(_EM_DASH, "-")


def _dedupe_summary(pair: str, summary: str) -> str:
    """Drop leading drug-name repetition already stated in the pair line."""
    if not summary:
        return ""
    parts = pair.split(" and ", 1)
    if len(parts) == 2:
        a_key = parts[0].strip().split()[0].lower() if parts[0].strip() else ""
        b_key = parts[1].strip().split()[0].lower() if parts[1].strip() else ""
        if a_key and b_key:
            prefix = f"{a_key} and {b_key}"
            if summary.lower().startswith(prefix):
                rest = summary[len(prefix) :].lstrip(" .,:;-")
                return rest if rest else summary
    if summary.lower().startswith(pair.lower()):
        rest = summary[len(pair) :].lstrip(" .,:;-")
        return rest if rest else summary
    return summary


def format_gp_interaction_line(rec: InteractionRecord) -> str:
    summary = strip_severity_tags(rec.summary)[:200]
    med_a = rec.med_a.display_name if rec.med_a else None
    med_b = rec.med_b.display_name if rec.med_b else None
    if med_a and med_b:
        pair = f"{med_a} and {med_b}"
        tail = _dedupe_summary(pair, summary)
        if tail:
            return f"Potential interaction: {pair}. {tail}"
        return f"Potential interaction: {pair}"
    if summary:
        return f"Potential interaction: {summary}"
    return "Potential interaction: review medicines together with a pharmacist or GP."
