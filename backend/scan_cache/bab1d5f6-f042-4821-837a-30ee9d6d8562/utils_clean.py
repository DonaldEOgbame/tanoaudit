"""A deliberately clean file — no planted issues.

Used to sanity-check precision: findings reported here are unmatched and count
against precision (likely false positives), so keep this genuinely safe.
"""


def slugify(text: str) -> str:
    return "-".join(text.lower().split())


def clamp(value: int, low: int, high: int) -> int:
    return max(low, min(value, high))


def chunk(items: list, size: int) -> list:
    return [items[i : i + size] for i in range(0, len(items), size)]
