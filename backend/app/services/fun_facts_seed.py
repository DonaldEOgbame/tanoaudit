"""Fun facts pool (70+) + idempotent seeding."""
from __future__ import annotations

from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.models.fun_fact import FunFact

FACTS = [
    "The first computer bug was an actual moth found in Harvard's Mark II in 1947.",
    "NASA's Voyager 1 is still running code from the 1970s — over 15 billion miles from Earth.",
    "The average web page now weighs more than the original Doom game (2.3MB vs 2.39MB).",
    "Git was created by Linus Torvalds in just 10 days.",
    "The name 'Python' comes from Monty Python, not the snake.",
    "The first 1GB hard drive (1980) weighed 550 pounds and cost $40,000.",
    "There are more possible chess games than atoms in the observable universe.",
    "The Apollo 11 guidance computer had less processing power than a modern calculator.",
    "The first domain ever registered was symbolics.com on March 15, 1985.",
    "'Hello, World!' was popularized in a 1978 C programming book by Kernighan.",
    "The term 'debugging' predates computers — Edison used it in 1878.",
    "About 70% of breaches trace to three bug classes: injection, broken auth, and misconfiguration.",
    "The QWERTY keyboard was designed in the 1870s to slow typists down and prevent jams.",
    "The first webcam watched a coffee pot at Cambridge so people knew when it was full.",
    "Bitcoin's creator, Satoshi Nakamoto, has never been conclusively identified.",
    "The '@' symbol was chosen for email in 1971 because it was rarely used elsewhere.",
    "JavaScript was created in 10 days in 1995 by Brendan Eich.",
    "The first 1TB SSD would have been unimaginable in 1956, when 5MB weighed a ton.",
    "Ada Lovelace wrote the first algorithm intended for a machine, in the 1840s.",
    "The Morris Worm (1988) was one of the first to spread across the internet.",
    "There are an estimated 700+ programming languages in existence.",
    "The 'cloud' is just someone else's computer — usually in a very large building.",
    "The first banner ad (1994) had a 44% click-through rate.",
    "C is older than most developers using it — it dates to 1972.",
    "A 'jiffy' is an actual unit of time: ~1/60th of a second in computing.",
    "The Unix epoch starts at 00:00:00 UTC on January 1, 1970.",
    "The 2038 problem is Y2K's cousin: 32-bit time_t overflows on Jan 19, 2038.",
    "The first version of Windows (1985) ran on top of MS-DOS.",
    "Stack Overflow gets a new question roughly every few seconds.",
    "The longest-running software bug can persist for decades before discovery.",
    "Linux runs on everything from supercomputers to smart fridges to Mars rovers.",
    "The first emoji set (1999) had just 176 symbols, each 12x12 pixels.",
    "RSA encryption is named after Rivest, Shamir, and Adleman, who published it in 1977.",
    "The word 'robot' comes from the Czech 'robota', meaning forced labor.",
    "HTTP 418 'I'm a teapot' is a real (joke) status code from 1998.",
    "Mosaic (1993) was the first widely used graphical web browser.",
    "The first 'computer programmer' job postings appeared in the 1950s.",
    "Tabs vs spaces is statistically correlated with higher salaries — for spaces.",
    "The Therac-25 race condition is a landmark case study in software safety.",
    "A single Google search uses the computing power of the entire Apollo program — briefly.",
    "The first YouTube video, 'Me at the zoo', was uploaded in April 2005.",
    "Cobol, written in 1959, still runs much of the world's banking infrastructure.",
    "The 'foo' and 'bar' placeholders likely come from military slang 'FUBAR'.",
    "SQL was originally called SEQUEL until a trademark forced the rename.",
    "The first 1-megapixel camera sensor arrived decades after the first digital image (1957).",
    "The Heartbleed bug (2014) let attackers read server memory using a single missing bounds check.",
    "Log4Shell (2021) was exploitable with one log line — and it logged user input by default.",
    "The most expensive single character bug: a missing '-' in Mariner 1's code lost a $80M rocket in 1962.",
    "Roughly 90% of a typical app's code is third-party dependencies you didn't write.",
    "A 'rubber duck' is a real debugging tool — explaining code aloud to one often reveals the bug.",
    "The strongest passwords aren't complex — they're long. Length beats symbols every time.",
    "The average secret leaked to GitHub is found by scanners in under a minute.",
    "SSL/TLS certificates used to last 5 years; today many last just 90 days for safety.",
    "The 'S' in IoT stands for Security. (There is no S in IoT.)",
    "CVE-2008-0166 weakened every Debian SSL key for two years by removing one line of 'unused' code.",
    "Zero-day means the vendor has had zero days to fix it — attackers found it first.",
    "The first ransomware (1989) was mailed on floppy disks to 20,000 people.",
    "Most SQL injection still works the same way it did when it was named in 1998.",
    "Phishing predates the web — the term was coined on AOL in the mid-1990s.",
    "A megabyte of RAM in 1965 would have cost about $5 million.",
    "Null references — 'the billion-dollar mistake' — were invented by Tony Hoare in 1965.",
    "The Mars Climate Orbiter was lost in 1999 because one team used metric and the other imperial.",
    "GANs, deepfakes, and most modern AI image tools trace back to a 2014 idea sketched in a bar.",
    "The first computer mouse (1964) was a wooden box with two metal wheels.",
    "ASCII art predates computers — typewriter art contests ran in the 1890s.",
    "Regex was formalized in the 1950s by a mathematician studying neurons, not text.",
    "The 'Konami Code' (↑↑↓↓←→←→BA) still unlocks easter eggs on sites today.",
    "Reproducible builds let you prove a binary came from the source — defeating supply-chain tampering.",
    "The longest a CVE has stayed unpatched in the wild is measured in years, not days.",
    "Rowhammer attacks flip bits in RAM just by reading nearby memory very fast.",
    "Defense in depth works because no single control is ever 100% — layers cover each other's gaps.",
]


async def seed_fun_facts() -> int:
    async with SessionLocal() as db:
        existing = set((await db.execute(select(FunFact.text))).scalars().all())
        added = 0
        for fact in FACTS:
            if fact not in existing:
                db.add(FunFact(text=fact))
                added += 1
        await db.commit()
        return added
