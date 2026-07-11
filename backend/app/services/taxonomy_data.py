"""The full TanoAudit vulnerability taxonomy: 27 categories + an attack-chain catalog.

Each class: (name, cwe, owasp, severity). CWE/OWASP/severity are best-effort
hints used for the Learning Hub and finding cross-links. Educational content is
generated from these by `learning_seed.build_classes()`.
"""
from __future__ import annotations

# (class_name, cwe, owasp, severity)
TAXONOMY: dict[str, list[tuple[str, str, str, str]]] = {
    "Authentication & Authorization": [
        ("Broken Authentication Flow", "CWE-287", "A07:2021", "high"),
        ("Missing or Weak Password Policy", "CWE-521", "A07:2021", "medium"),
        ("Hardcoded Credentials", "CWE-798", "A07:2021", "critical"),
        ("JWT None Algorithm", "CWE-347", "A02:2021", "critical"),
        ("JWT Weak Secret", "CWE-326", "A02:2021", "high"),
        ("JWT Missing Expiry", "CWE-613", "A07:2021", "medium"),
        ("OAuth Misconfiguration", "CWE-1021", "A07:2021", "high"),
        ("Privilege Escalation", "CWE-269", "A01:2021", "high"),
        ("Insecure Direct Object Reference (IDOR)", "CWE-639", "A01:2021", "high"),
        ("Missing RBAC", "CWE-862", "A01:2021", "high"),
        ("Session Fixation", "CWE-384", "A07:2021", "medium"),
        ("Session Hijacking", "CWE-294", "A07:2021", "high"),
        ("Missing Cookie Security Flags", "CWE-1004", "A05:2021", "medium"),
        ("Default Credentials", "CWE-1392", "A07:2021", "high"),
        ("Auth Bypass via Parameter Tampering", "CWE-639", "A01:2021", "high"),
    ],
    "Injection": [
        ("SQL Injection (Classic)", "CWE-89", "A03:2021", "critical"),
        ("Blind SQL Injection", "CWE-89", "A03:2021", "high"),
        ("Time-Based SQL Injection", "CWE-89", "A03:2021", "high"),
        ("NoSQL Injection", "CWE-943", "A03:2021", "high"),
        ("Command Injection", "CWE-78", "A03:2021", "critical"),
        ("LDAP Injection", "CWE-90", "A03:2021", "high"),
        ("XPath Injection", "CWE-643", "A03:2021", "medium"),
        ("Server-Side Template Injection (SSTI)", "CWE-1336", "A03:2021", "critical"),
        ("Log Injection", "CWE-117", "A09:2021", "medium"),
        ("Header Injection", "CWE-113", "A03:2021", "medium"),
        ("Email Injection", "CWE-93", "A03:2021", "medium"),
        ("XML External Entity (XXE)", "CWE-611", "A05:2021", "high"),
    ],
    "Data Exposure & Secrets": [
        ("Hardcoded API Keys", "CWE-798", "A05:2021", "critical"),
        ("Hardcoded Passwords or Tokens", "CWE-798", "A07:2021", "critical"),
        ("Private Keys in Source", "CWE-321", "A02:2021", "critical"),
        ("Exposed DB Connection Strings", "CWE-200", "A05:2021", "high"),
        ("PII Logged", "CWE-532", "A09:2021", "medium"),
        ("Sensitive Data in URLs", "CWE-598", "A04:2021", "medium"),
        ("Unencrypted Sensitive Data at Rest", "CWE-311", "A02:2021", "high"),
        ("Weak Encryption (MD5/SHA1/DES)", "CWE-327", "A02:2021", "high"),
        ("Insecure Random Generation", "CWE-330", "A02:2021", "medium"),
        ("Missing Field-Level Encryption", "CWE-311", "A02:2021", "medium"),
    ],
    "Input Validation & Sanitization": [
        ("Reflected XSS", "CWE-79", "A03:2021", "high"),
        ("Stored XSS", "CWE-79", "A03:2021", "high"),
        ("DOM-Based XSS", "CWE-79", "A03:2021", "high"),
        ("Missing Input Validation", "CWE-20", "A03:2021", "medium"),
        ("Path Traversal", "CWE-22", "A01:2021", "high"),
        ("File Upload Without Type Validation", "CWE-434", "A04:2021", "high"),
        ("Zip Slip", "CWE-22", "A01:2021", "high"),
        ("Regular Expression DoS (ReDoS)", "CWE-1333", "A05:2021", "medium"),
        ("Integer Overflow/Underflow", "CWE-190", "A03:2021", "medium"),
        ("Type Confusion", "CWE-843", "A03:2021", "medium"),
        ("Mass Assignment", "CWE-915", "A08:2021", "high"),
        ("Open Redirect", "CWE-601", "A01:2021", "medium"),
    ],
    "API Security": [
        ("Missing Rate Limiting", "CWE-770", "A04:2021", "medium"),
        ("Broken Object-Level Authorization", "CWE-639", "A01:2021", "high"),
        ("Excessive Data Exposure", "CWE-213", "A03:2021", "medium"),
        ("Missing API Versioning Security", "CWE-1059", "A04:2021", "low"),
        ("Missing Endpoint Authentication", "CWE-306", "A07:2021", "high"),
        ("CORS Misconfiguration", "CWE-942", "A05:2021", "high"),
        ("GraphQL Introspection in Production", "CWE-200", "A05:2021", "medium"),
        ("REST Verb Tampering", "CWE-650", "A01:2021", "medium"),
        ("Insecure API Key Transmission", "CWE-319", "A02:2021", "high"),
        ("Missing Request Size Limits", "CWE-770", "A04:2021", "medium"),
    ],
    "Database & Storage": [
        ("Raw Query Construction", "CWE-89", "A03:2021", "high"),
        ("Missing Parameterized Queries", "CWE-89", "A03:2021", "high"),
        ("ORM Misuse Leading to Injection", "CWE-89", "A03:2021", "high"),
        ("Insecure DB Configuration", "CWE-16", "A05:2021", "medium"),
        ("Missing DB Access Controls", "CWE-284", "A01:2021", "high"),
        ("Timing Attacks via Unindexed Queries", "CWE-208", "A04:2021", "low"),
        ("Insecure File Storage Paths", "CWE-22", "A01:2021", "medium"),
        ("World-Readable Permissions", "CWE-732", "A05:2021", "medium"),
        ("Backup Files in Web Root", "CWE-530", "A05:2021", "medium"),
        ("DB Error Messages Exposed", "CWE-209", "A04:2021", "low"),
    ],
    "Dependency & Supply Chain": [
        ("Known Vulnerable Packages (CVE)", "CWE-1035", "A06:2021", "high"),
        ("Outdated Dependencies", "CWE-1104", "A06:2021", "medium"),
        ("Unpinned Versions", "CWE-1104", "A06:2021", "medium"),
        ("Typosquatting-Prone Imports", "CWE-427", "A06:2021", "medium"),
        ("Abandoned Packages", "CWE-1104", "A06:2021", "low"),
        ("Missing Integrity Checks (SRI)", "CWE-353", "A08:2021", "medium"),
        ("Dev Dependencies in Production", "CWE-1104", "A06:2021", "low"),
        ("Malicious Package Patterns", "CWE-506", "A06:2021", "high"),
    ],
    "Configuration & Infrastructure": [
        ("Debug Mode in Production", "CWE-489", "A05:2021", "high"),
        ("Verbose Error Messages", "CWE-209", "A05:2021", "medium"),
        ("Missing Security Headers", "CWE-693", "A05:2021", "medium"),
        ("Insecure TLS/SSL Configuration", "CWE-326", "A02:2021", "high"),
        ("HTTP Instead of HTTPS", "CWE-319", "A02:2021", "high"),
        ("Exposed Admin Interfaces", "CWE-419", "A05:2021", "high"),
        ("Default Framework Configs", "CWE-1188", "A05:2021", "medium"),
        ("Unvalidated Environment Variables", "CWE-15", "A05:2021", "low"),
        ("Docker Misconfigurations in Code", "CWE-250", "A05:2021", "medium"),
        ("Secrets in Committed Env Files", "CWE-538", "A05:2021", "high"),
    ],
    "Business Logic": [
        ("Race Condition", "CWE-362", "A04:2021", "high"),
        ("Time-of-Check Time-of-Use (TOCTOU)", "CWE-367", "A04:2021", "high"),
        ("Insufficient Workflow Validation", "CWE-841", "A04:2021", "medium"),
        ("Price/Quantity Manipulation", "CWE-840", "A04:2021", "high"),
        ("Insecure State Management", "CWE-642", "A04:2021", "medium"),
        ("Missing Transaction Atomicity", "CWE-362", "A04:2021", "medium"),
        ("Predictable Resource IDs", "CWE-340", "A01:2021", "medium"),
        ("Forced Browsing", "CWE-425", "A01:2021", "medium"),
    ],
    "Cryptography": [
        ("Weak Hashing", "CWE-328", "A02:2021", "high"),
        ("ECB Mode Encryption", "CWE-327", "A02:2021", "high"),
        ("Static IV/Nonce Reuse", "CWE-329", "A02:2021", "high"),
        ("Insufficient Key Length", "CWE-326", "A02:2021", "medium"),
        ("Insecure Key Storage", "CWE-320", "A02:2021", "high"),
        ("Missing Certificate Validation", "CWE-295", "A07:2021", "high"),
        ("Self-Signed Cert Acceptance in Production", "CWE-295", "A07:2021", "medium"),
        ("Broken PRNG", "CWE-338", "A02:2021", "medium"),
    ],
    "AI-Generated Code Specific": [
        ("Hallucinated Library Imports", "CWE-1104", "A06:2021", "high"),
        ("Overly Permissive CORS from AI Boilerplate", "CWE-942", "A05:2021", "high"),
        ("Insecure Defaults from AI Scaffolding", "CWE-1188", "A05:2021", "medium"),
        ("Missing Error Handling in AI Async Code", "CWE-755", "A04:2021", "medium"),
        ("Incomplete Auth Stubs", "CWE-306", "A07:2021", "high"),
        ("TODO/FIXME Security Markers", "CWE-546", "A04:2021", "low"),
        ("Overly Broad Exception Catching", "CWE-396", "A04:2021", "low"),
    ],
    "Frontend Specific": [
        ("Sensitive Logic Client-Side", "CWE-602", "A04:2021", "medium"),
        ("Sensitive Data in localStorage/sessionStorage", "CWE-922", "A04:2021", "medium"),
        ("Prototype Pollution", "CWE-1321", "A03:2021", "high"),
        ("Insecure postMessage Handling", "CWE-345", "A08:2021", "medium"),
        ("Clickjacking", "CWE-1021", "A05:2021", "medium"),
        ("Missing Subresource Integrity", "CWE-353", "A08:2021", "low"),
        ("Exposed Internal API Structure in JS Bundles", "CWE-200", "A05:2021", "low"),
    ],
    "Concurrency & Race Conditions": [
        ("Thread-Unsafe Shared State", "CWE-362", "A04:2021", "high"),
        ("Missing Mutex/Lock", "CWE-667", "A04:2021", "medium"),
        ("Deadlock-Prone Patterns", "CWE-833", "A04:2021", "medium"),
        ("Insecure Parallel Jobs", "CWE-362", "A04:2021", "medium"),
        ("Double-Fetch", "CWE-365", "A04:2021", "medium"),
        ("Non-Atomic Check-Then-Act", "CWE-367", "A04:2021", "high"),
        ("Unsafe Singletons", "CWE-543", "A04:2021", "low"),
        ("Worker Thread Data Leakage", "CWE-200", "A04:2021", "medium"),
    ],
    "Error Handling & Logging": [
        ("Stack Traces Exposed", "CWE-209", "A05:2021", "medium"),
        ("Sensitive Data in Logs", "CWE-532", "A09:2021", "medium"),
        ("Missing Error Handling on Critical Ops", "CWE-755", "A04:2021", "medium"),
        ("Silent Exception Swallowing", "CWE-390", "A09:2021", "low"),
        ("Inconsistent Error Responses Leaking Info", "CWE-209", "A05:2021", "low"),
        ("Log Forging/Injection", "CWE-117", "A09:2021", "medium"),
        ("Missing Audit Logs on Sensitive Actions", "CWE-778", "A09:2021", "medium"),
        ("Excessive User Behavior Logging", "CWE-532", "A09:2021", "low"),
        ("Error Codes Revealing Architecture", "CWE-209", "A05:2021", "low"),
        ("Unhandled Promise Rejections", "CWE-755", "A04:2021", "low"),
    ],
    "Memory & Resource Management": [
        ("Buffer Overflow Patterns", "CWE-120", "A03:2021", "critical"),
        ("Memory Leaks in Long-Running Processes", "CWE-401", "A04:2021", "medium"),
        ("Null Pointer Dereference", "CWE-476", "A04:2021", "medium"),
        ("Use-After-Free", "CWE-416", "A03:2021", "high"),
        ("Uncontrolled Resource Consumption", "CWE-400", "A04:2021", "high"),
        ("Missing Connection Pool Limits", "CWE-770", "A04:2021", "medium"),
        ("File Handle Leaks", "CWE-403", "A04:2021", "low"),
        ("Infinite Loops", "CWE-835", "A04:2021", "medium"),
        ("DoS via Large Payload", "CWE-400", "A04:2021", "high"),
        ("Missing Timeout on External Calls", "CWE-1088", "A04:2021", "medium"),
    ],
    "Deserialization": [
        ("Insecure Object Deserialization", "CWE-502", "A08:2021", "critical"),
        ("Untrusted Data Deserialization", "CWE-502", "A08:2021", "high"),
        ("Missing Type Validation on Deserialized Objects", "CWE-502", "A08:2021", "high"),
        ("YAML/XML Deserialization Attacks", "CWE-502", "A08:2021", "high"),
        ("JSON Deserialization Without Schema Validation", "CWE-20", "A08:2021", "medium"),
        ("Pickle with User-Supplied Data", "CWE-502", "A08:2021", "critical"),
        ("PHP unserialize on User Input", "CWE-502", "A08:2021", "critical"),
        ("Missing Integrity Check on Serialized Data", "CWE-345", "A08:2021", "high"),
    ],
    "Cloud & Serverless": [
        ("Overly Permissive IAM Roles in Code", "CWE-732", "A01:2021", "high"),
        ("Public S3 Buckets in IaC", "CWE-732", "A05:2021", "high"),
        ("Hardcoded Lambda Env Vars", "CWE-798", "A05:2021", "high"),
        ("Missing VPC Configuration", "CWE-1188", "A05:2021", "medium"),
        ("Serverless Function with No Timeout", "CWE-1088", "A04:2021", "medium"),
        ("Cloud Credentials in Source", "CWE-798", "A05:2021", "critical"),
        ("Insecure Presigned URL Generation", "CWE-639", "A01:2021", "high"),
        ("Missing Logging Configuration", "CWE-778", "A09:2021", "low"),
        ("Public-Facing Storage Buckets", "CWE-732", "A05:2021", "high"),
        ("Overly Broad Security Group Rules", "CWE-732", "A05:2021", "high"),
    ],
    "Mobile & Cross-Platform": [
        ("Sensitive Data in AsyncStorage", "CWE-922", "A04:2021", "medium"),
        ("Insecure Deep Link Handling", "CWE-939", "A01:2021", "medium"),
        ("Missing Certificate Pinning", "CWE-295", "A07:2021", "medium"),
        ("Exported Components Without Permission Checks", "CWE-926", "A01:2021", "high"),
        ("Insecure Inter-App Communication", "CWE-927", "A04:2021", "medium"),
        ("Sensitive Data in App Bundle", "CWE-312", "A04:2021", "medium"),
        ("Weak Local Authentication", "CWE-287", "A07:2021", "medium"),
        ("Insecure WebView Configuration", "CWE-749", "A05:2021", "high"),
        ("Clipboard Data Exposure", "CWE-200", "A04:2021", "low"),
        ("Debug Flags in Release Builds", "CWE-489", "A05:2021", "medium"),
    ],
    "WebSocket & Real-Time": [
        ("Missing Auth on WebSocket Upgrade", "CWE-306", "A07:2021", "high"),
        ("No Message Size Limits", "CWE-770", "A04:2021", "medium"),
        ("Missing Origin Validation", "CWE-346", "A05:2021", "high"),
        ("Unauthenticated Broadcast Channels", "CWE-306", "A01:2021", "high"),
        ("Sensitive Data Over Unencrypted WS", "CWE-319", "A02:2021", "high"),
        ("Missing Rate Limiting on Socket Events", "CWE-770", "A04:2021", "medium"),
        ("Insecure Room/Channel Access Control", "CWE-284", "A01:2021", "high"),
        ("Event Name Injection", "CWE-74", "A03:2021", "medium"),
        ("Replay Attacks", "CWE-294", "A07:2021", "medium"),
        ("Missing Heartbeat Timeout", "CWE-1088", "A04:2021", "low"),
    ],
    "Third-Party Integration & Webhooks": [
        ("Missing Webhook Signature Verification", "CWE-345", "A08:2021", "high"),
        ("SSRF via User-Controlled URLs", "CWE-918", "A10:2021", "high"),
        ("Unvalidated Redirect URIs in OAuth", "CWE-601", "A01:2021", "medium"),
        ("Missing Timeout on Third-Party API Calls", "CWE-1088", "A04:2021", "medium"),
        ("API Keys in Query Params", "CWE-598", "A02:2021", "high"),
        ("Insecure SDK Configurations", "CWE-1188", "A05:2021", "medium"),
        ("Missing TLS Verification on Outbound Requests", "CWE-295", "A07:2021", "high"),
        ("Sensitive Data Forwarded to Third Parties", "CWE-200", "A04:2021", "medium"),
        ("Webhook Endpoint Without Auth", "CWE-306", "A07:2021", "high"),
        ("Trusting Unverified Third-Party Data", "CWE-345", "A08:2021", "medium"),
    ],
    # ── Modern / infrastructure ──────────────────────────────────────────────
    "Containers & Orchestration": [
        ("Container Running as Root", "CWE-250", "A05:2021", "high"),
        ("Privileged Container", "CWE-250", "A05:2021", "high"),
        ("Docker Socket Mounted Into Container", "CWE-668", "A05:2021", "critical"),
        ("Unpinned Base Image (latest tag)", "CWE-1104", "A06:2021", "medium"),
        ("Secrets Baked Into Image Layers", "CWE-538", "A05:2021", "high"),
        ("Missing Resource Limits on Pods", "CWE-770", "A04:2021", "medium"),
        ("hostNetwork / hostPID / hostIPC Enabled", "CWE-668", "A05:2021", "high"),
        ("Overly Permissive securityContext", "CWE-732", "A05:2021", "high"),
        ("Kubernetes RBAC Wildcards", "CWE-732", "A01:2021", "high"),
        ("Writable Root Filesystem in Container", "CWE-732", "A05:2021", "medium"),
    ],
    "Infrastructure as Code": [
        ("Public Ingress (0.0.0.0/0) in IaC", "CWE-732", "A05:2021", "high"),
        ("Unencrypted Storage Resource in IaC", "CWE-311", "A02:2021", "high"),
        ("Hardcoded Secrets in Terraform/CloudFormation", "CWE-798", "A05:2021", "critical"),
        ("Disabled Logging/Audit in IaC", "CWE-778", "A09:2021", "medium"),
        ("Overly Permissive IAM Policy in IaC", "CWE-732", "A01:2021", "high"),
        ("Missing Deletion Protection on Stateful Resource", "CWE-1188", "A05:2021", "medium"),
        ("Plaintext State File With Secrets", "CWE-312", "A05:2021", "high"),
        ("Default VPC / Default Security Group Use", "CWE-1188", "A05:2021", "medium"),
    ],
    "CI/CD & Build Security": [
        ("Pipeline Secrets Exposed in Logs", "CWE-532", "A09:2021", "high"),
        ("Unpinned GitHub Action / Build Step", "CWE-1357", "A08:2021", "high"),
        ("Self-Hosted Runner Exposed to Untrusted PRs", "CWE-668", "A08:2021", "critical"),
        ("pull_request_target Misuse", "CWE-94", "A08:2021", "critical"),
        ("Missing Artifact/Build Provenance", "CWE-353", "A08:2021", "medium"),
        ("Overprivileged CI Tokens (write-all)", "CWE-732", "A01:2021", "high"),
        ("Untrusted Input in Build Scripts", "CWE-94", "A03:2021", "high"),
        ("Cache Poisoning in CI", "CWE-349", "A08:2021", "medium"),
    ],
    "Supply Chain Integrity": [
        ("Missing Lockfile / Reproducible Build", "CWE-1104", "A06:2021", "medium"),
        ("Dependency Confusion (internal name on public registry)", "CWE-427", "A06:2021", "high"),
        ("Install-Time Script Execution (postinstall)", "CWE-506", "A06:2021", "high"),
        ("Missing SBOM", "CWE-1104", "A06:2021", "low"),
        ("Unverified Third-Party Binary/Curl-Pipe-Sh", "CWE-494", "A08:2021", "high"),
        ("Compromised/Hijacked Maintainer Patterns", "CWE-506", "A06:2021", "high"),
    ],
    # ── AI / LLM application security ─────────────────────────────────────────
    "AI/LLM Application Security": [
        ("Prompt Injection (direct)", "CWE-1427", "A03:2021", "high"),
        ("Indirect/Stored Prompt Injection", "CWE-1427", "A03:2021", "high"),
        ("Insecure LLM Output Handling (downstream eval/exec)", "CWE-94", "A03:2021", "critical"),
        ("RAG/Context Data Leakage", "CWE-200", "A01:2021", "high"),
        ("Excessive Agency / Unbounded Tool Use", "CWE-285", "A01:2021", "high"),
        ("System Prompt / Secret Leakage", "CWE-200", "A05:2021", "high"),
        ("Unbounded Token/Cost Consumption (LLM DoS)", "CWE-770", "A04:2021", "medium"),
        ("Missing Output Validation/Guardrails", "CWE-20", "A03:2021", "medium"),
        ("Training/Fine-Tune Data Poisoning Patterns", "CWE-1427", "A08:2021", "medium"),
        ("Sensitive Data Sent to Third-Party LLM", "CWE-200", "A04:2021", "high"),
    ],
    # ── Privacy & compliance ─────────────────────────────────────────────────
    "Privacy & Compliance": [
        ("PII Collected Without Consent Gate", "CWE-359", "A04:2021", "medium"),
        ("Missing Data Retention/Deletion", "CWE-212", "A04:2021", "medium"),
        ("PII Sent to Analytics/Third Parties", "CWE-359", "A04:2021", "high"),
        ("Missing Audit Trail on PII Access", "CWE-778", "A09:2021", "medium"),
        ("Excessive Data Collection (minimization)", "CWE-359", "A04:2021", "low"),
        ("Unmasked PII in Non-Prod/Logs", "CWE-532", "A09:2021", "medium"),
        ("Missing Right-to-Erasure Path", "CWE-212", "A04:2021", "low"),
        ("Cross-Border Data Transfer Without Safeguards", "CWE-359", "A04:2021", "medium"),
    ],
    # ── Protocol / network ───────────────────────────────────────────────────
    "Protocol & Network": [
        ("HTTP Request Smuggling", "CWE-444", "A05:2021", "high"),
        ("Web Cache Poisoning", "CWE-349", "A05:2021", "high"),
        ("Web Cache Deception", "CWE-525", "A05:2021", "medium"),
        ("Host Header Injection", "CWE-644", "A03:2021", "medium"),
        ("DNS Rebinding Exposure", "CWE-350", "A05:2021", "medium"),
        ("Missing Email Auth (SPF/DKIM/DMARC)", "CWE-290", "A07:2021", "medium"),
        ("Insecure gRPC (no TLS / no auth)", "CWE-319", "A02:2021", "high"),
        ("Missing HSTS / Downgrade to HTTP", "CWE-319", "A05:2021", "medium"),
    ],
}


# ── Attack chains: vulnerability *combinations* that constitute real hacks ────
# Unlike TAXONOMY (single local weaknesses), each chain is an ordered exploitation
# path built from multiple findings, grounded in a real breach or standard attack.
# Used two ways: (1) seeded into the Learning Hub as the "Attack Chains &
# Exploitation Paths" category, and (2) handed to the post-scan correlation pass
# (Module: attack_chains) as curated priors — the model may also propose novel
# chains beyond this catalog (hybrid mode).
#
# Each entry: name -> dict with
#   severity   : worst-case impact of the full chain
#   steps      : ordered list of steps. Each step is a dict {label, cwe:[...]}.
#                The correlation pass matches a step to a finding primarily by CWE
#                (wording-independent — 97% of findings carry one), falling back to
#                label/concept text. Listing several CWEs per step widens recall.
#   real_world : a grounding reference (breach / canonical technique)
#   impact     : what an attacker ultimately achieves
#   cwe        : representative CWE for the chain's terminal step
ATTACK_CHAIN_CATEGORY = "Attack Chains & Exploitation Paths"


def _s(label: str, *cwes: str) -> dict:
    """Build a CWE-keyed chain step."""
    return {"label": label, "cwe": list(cwes)}


ATTACK_CHAINS: dict[str, dict] = {
    # ── Cloud / IAM / metadata ────────────────────────────────────────────────
    "SSRF → Cloud Metadata → Credential Theft": {
        "severity": "critical",
        "steps": [_s("SSRF to a user-controlled URL", "CWE-918"),
                  _s("Cloud credentials reachable in source/env", "CWE-798", "CWE-522"),
                  _s("Overly permissive IAM role", "CWE-732", "CWE-269")],
        "real_world": "Capital One 2019 breach (SSRF to AWS IMDS, ~100M records).",
        "impact": "Steal cloud IAM credentials and pivot to read/exfiltrate storage.",
        "cwe": "CWE-918",
    },
    "Exposed Secret → Lateral Cloud Access": {
        "severity": "critical",
        "steps": [_s("Hardcoded API key / secret", "CWE-798", "CWE-321", "CWE-522"),
                  _s("Secret committed in env/config file", "CWE-538", "CWE-312"),
                  _s("Overly broad network/security-group access", "CWE-732", "CWE-284")],
        "real_world": "Leaked keys in git history reused against cloud control planes.",
        "impact": "Use a committed credential to authenticate and expand access.",
        "cwe": "CWE-798",
    },
    "Public Bucket → Sensitive Data Exposure": {
        "severity": "high",
        "steps": [_s("Public storage bucket / object ACL", "CWE-732"),
                  _s("Unencrypted sensitive data at rest", "CWE-311", "CWE-312"),
                  _s("PII / secrets stored in the bucket", "CWE-200", "CWE-359")],
        "real_world": "Countless open-S3-bucket breaches (Accenture, Verizon, etc.).",
        "impact": "Read exposed objects directly and exfiltrate sensitive data.",
        "cwe": "CWE-732",
    },
    "Presigned URL Abuse → Object Exfiltration": {
        "severity": "high",
        "steps": [_s("Insecure presigned URL generation", "CWE-639"),
                  _s("Missing object-level authorization", "CWE-639", "CWE-862")],
        "real_world": "Predictable/over-scoped presigned URLs granting cross-tenant reads.",
        "impact": "Forge or reuse presigned URLs to read other tenants' objects.",
        "cwe": "CWE-639",
    },
    "Lambda Env Secret → Privilege Escalation": {
        "severity": "high",
        "steps": [_s("Hardcoded function env credentials", "CWE-798"),
                  _s("Overly permissive IAM role", "CWE-732", "CWE-269")],
        "real_world": "Serverless functions over-privileged with embedded long-lived keys.",
        "impact": "Use the function's embedded credentials to escalate in the account.",
        "cwe": "CWE-798",
    },

    # ── Container / Kubernetes ────────────────────────────────────────────────
    "Container Escape → Host Compromise": {
        "severity": "critical",
        "steps": [_s("Privileged / root container", "CWE-250"),
                  _s("Docker socket or host namespace mounted", "CWE-668"),
                  _s("Writable host filesystem / securityContext", "CWE-732")],
        "real_world": "Privileged-container + docker.sock breakout to the node.",
        "impact": "Break out of the container and execute on the host node.",
        "cwe": "CWE-250",
    },
    "K8s RBAC Wildcard → Cluster Takeover": {
        "severity": "critical",
        "steps": [_s("Kubernetes RBAC wildcard permissions", "CWE-732", "CWE-269"),
                  _s("Overly permissive securityContext", "CWE-732"),
                  _s("Secrets readable from the namespace", "CWE-522", "CWE-798")],
        "real_world": "Wildcard ClusterRole leading to full cluster control.",
        "impact": "Use broad RBAC to read secrets and control the whole cluster.",
        "cwe": "CWE-732",
    },
    "Image Layer Secret → Registry Pivot": {
        "severity": "high",
        "steps": [_s("Secrets baked into image layers", "CWE-538", "CWE-798"),
                  _s("Unpinned / untrusted base image", "CWE-1104", "CWE-494")],
        "real_world": "Credentials extracted from published image history.",
        "impact": "Extract baked-in secrets from image layers and reuse them.",
        "cwe": "CWE-538",
    },

    # ── Injection → RCE families ──────────────────────────────────────────────
    "Insecure Deserialization → RCE → Lateral Movement": {
        "severity": "critical",
        "steps": [_s("Insecure/untrusted deserialization", "CWE-502"),
                  _s("Resulting code/command execution", "CWE-78", "CWE-94"),
                  _s("Overly permissive host credentials", "CWE-732", "CWE-269")],
        "real_world": "Apache Struts / Java deserialization gadget-chain RCEs.",
        "impact": "Remote code execution, then pivot using the host's credentials.",
        "cwe": "CWE-502",
    },
    "Command Injection → RCE → Lateral Movement": {
        "severity": "critical",
        "steps": [_s("OS command injection", "CWE-78", "CWE-77"),
                  _s("Cloud/host credentials reachable", "CWE-798", "CWE-522"),
                  _s("Overly permissive IAM role", "CWE-732")],
        "real_world": "Command injection in a web handler leading to host takeover.",
        "impact": "Execute commands on the host and pivot with its credentials.",
        "cwe": "CWE-78",
    },
    "SSTI → Remote Code Execution": {
        "severity": "critical",
        "steps": [_s("Server-side template injection", "CWE-1336", "CWE-94"),
                  _s("Sandbox/eval escape to code execution", "CWE-94", "CWE-95")],
        "real_world": "Jinja2/Twig SSTI escalated to RCE (classic PortSwigger labs).",
        "impact": "Escape the template sandbox to run arbitrary code on the server.",
        "cwe": "CWE-1336",
    },
    "XXE → File Read → SSRF": {
        "severity": "high",
        "steps": [_s("XML external entity (XXE) parsing", "CWE-611"),
                  _s("Local file disclosure or SSRF", "CWE-200", "CWE-918")],
        "real_world": "XXE reading /etc/passwd or pivoting to internal services.",
        "impact": "Read local files or reach internal services via the XML parser.",
        "cwe": "CWE-611",
    },
    "Verbose Errors → Info Leak → Targeted SQLi": {
        "severity": "high",
        "steps": [_s("Verbose error messages", "CWE-209", "CWE-489"),
                  _s("DB error/schema disclosure", "CWE-209", "CWE-200"),
                  _s("SQL injection", "CWE-89")],
        "real_world": "Error-based SQLi using leaked schema/driver details.",
        "impact": "Use leaked DB internals to craft a reliable injection and dump data.",
        "cwe": "CWE-89",
    },
    "SQL Injection → Auth Bypass → Data Dump": {
        "severity": "critical",
        "steps": [_s("SQL injection", "CWE-89"),
                  _s("Authentication bypass / weak auth", "CWE-287", "CWE-89"),
                  _s("Mass sensitive-data exposure", "CWE-200", "CWE-359")],
        "real_world": "SQLi-driven login bypass and user-table exfiltration.",
        "impact": "Bypass authentication via SQLi and dump the user database.",
        "cwe": "CWE-89",
    },
    "NoSQL Injection → Auth Bypass": {
        "severity": "high",
        "steps": [_s("NoSQL injection", "CWE-943"),
                  _s("Authentication bypass", "CWE-287")],
        "real_world": "MongoDB operator-injection ($ne/$gt) login bypass.",
        "impact": "Inject query operators to bypass authentication checks.",
        "cwe": "CWE-943",
    },
    "Log Injection → Log4Shell-style RCE": {
        "severity": "critical",
        "steps": [_s("Untrusted input into logging", "CWE-117"),
                  _s("Resulting code execution / lookup", "CWE-94", "CWE-502")],
        "real_world": "Log4Shell (CVE-2021-44228): logged input triggering JNDI RCE.",
        "impact": "Attacker-controlled logged data triggers remote code execution.",
        "cwe": "CWE-117",
    },

    # ── Authentication / session / authorization ──────────────────────────────
    "Auth Bypass → IDOR → Mass PII Exfiltration": {
        "severity": "critical",
        "steps": [_s("Broken / missing authentication", "CWE-287", "CWE-306"),
                  _s("IDOR / missing object authorization", "CWE-639", "CWE-862"),
                  _s("Missing rate limiting", "CWE-770"),
                  _s("Excessive data exposure", "CWE-200", "CWE-359")],
        "real_world": "Common bug-bounty/API breach pattern (enumerable IDs + weak authz).",
        "impact": "Enumerate and dump every user's records via predictable object IDs.",
        "cwe": "CWE-639",
    },
    "JWT None/Weak Secret → Admin Forgery": {
        "severity": "critical",
        "steps": [_s("JWT 'none' algorithm or weak secret", "CWE-347", "CWE-326"),
                  _s("Missing role/authorization checks", "CWE-862", "CWE-269")],
        "real_world": "alg:none / brute-forced HS256 secret to forge admin tokens.",
        "impact": "Forge a valid admin token and access privileged endpoints.",
        "cwe": "CWE-347",
    },
    "Session Fixation → Account Takeover": {
        "severity": "high",
        "steps": [_s("Session fixation", "CWE-384"),
                  _s("Missing cookie security flags", "CWE-1004", "CWE-614")],
        "real_world": "Fixed session id surviving login, enabling hijack.",
        "impact": "Fix a victim's session id and ride their authenticated session.",
        "cwe": "CWE-384",
    },
    "Missing RBAC → Privilege Escalation": {
        "severity": "high",
        "steps": [_s("Missing role-based access control", "CWE-862", "CWE-306"),
                  _s("Privilege escalation / IDOR", "CWE-269", "CWE-639")],
        "real_world": "Unprotected admin functions reachable by normal users.",
        "impact": "Reach privileged actions that lack authorization checks.",
        "cwe": "CWE-862",
    },
    "Parameter Tampering → Auth Bypass": {
        "severity": "high",
        "steps": [_s("Auth decision from client-controlled parameter", "CWE-639", "CWE-602"),
                  _s("Missing server-side authorization", "CWE-862")],
        "real_world": "isAdmin=true / role params trusted from the client.",
        "impact": "Tamper a trusted client parameter to elevate privileges.",
        "cwe": "CWE-639",
    },
    "Default Credentials → Admin Access": {
        "severity": "critical",
        "steps": [_s("Default or hardcoded credentials", "CWE-1392", "CWE-798"),
                  _s("Exposed admin interface", "CWE-419", "CWE-306")],
        "real_world": "Mirai-style takeover of devices with default logins.",
        "impact": "Log in with shipped defaults to an exposed admin panel.",
        "cwe": "CWE-1392",
    },

    # ── OAuth / SSO / redirect ────────────────────────────────────────────────
    "Open Redirect → OAuth Token Leak → Account Takeover": {
        "severity": "high",
        "steps": [_s("Open redirect", "CWE-601"),
                  _s("Unvalidated OAuth redirect URI", "CWE-601"),
                  _s("OAuth misconfiguration", "CWE-1021", "CWE-287")],
        "real_world": "OAuth redirect_uri abuse leaking auth codes/tokens.",
        "impact": "Steal an OAuth code/token via a crafted redirect and assume the account.",
        "cwe": "CWE-601",
    },
    "SSRF via Webhook → Internal Pivot": {
        "severity": "high",
        "steps": [_s("User-controlled webhook/callback URL", "CWE-918"),
                  _s("Missing outbound TLS/host validation", "CWE-295", "CWE-918")],
        "real_world": "Webhook URL fields used to reach internal services.",
        "impact": "Point a webhook at internal endpoints to reach private services.",
        "cwe": "CWE-918",
    },

    # ── Web client / XSS ──────────────────────────────────────────────────────
    "XSS → Token Theft → Account Takeover": {
        "severity": "high",
        "steps": [_s("Stored or reflected XSS", "CWE-79"),
                  _s("Token stored in localStorage", "CWE-922"),
                  _s("Missing HttpOnly cookie flags", "CWE-1004")],
        "real_world": "Stored XSS stealing JWTs from localStorage (no HttpOnly cookie).",
        "impact": "Exfiltrate session tokens from victims and hijack their accounts.",
        "cwe": "CWE-79",
    },
    "DOM XSS → Prototype Pollution → RCE": {
        "severity": "high",
        "steps": [_s("Prototype pollution", "CWE-1321"),
                  _s("DOM-based or client XSS sink", "CWE-79")],
        "real_world": "Prototype pollution gadget escalating to client-side RCE/XSS.",
        "impact": "Pollute Object.prototype to reach a dangerous client-side sink.",
        "cwe": "CWE-1321",
    },
    "Clickjacking → Action Hijack": {
        "severity": "medium",
        "steps": [_s("Missing frame protections (clickjacking)", "CWE-1021"),
                  _s("Sensitive state-changing action unprotected", "CWE-352")],
        "real_world": "UI-redress framing a victim into privileged actions.",
        "impact": "Trick a victim into triggering a sensitive action via an overlay.",
        "cwe": "CWE-1021",
    },
    "PostMessage Trust → Cross-Origin Data Theft": {
        "severity": "medium",
        "steps": [_s("Insecure postMessage origin handling", "CWE-345", "CWE-346"),
                  _s("Sensitive data exposed to the frame", "CWE-200")],
        "real_world": "Wildcard postMessage handlers leaking data cross-origin.",
        "impact": "A malicious frame reads data via an unvalidated message channel.",
        "cwe": "CWE-345",
    },

    # ── File upload / traversal ───────────────────────────────────────────────
    "File Upload → Path Traversal → Webshell": {
        "severity": "critical",
        "steps": [_s("Unrestricted file upload", "CWE-434"),
                  _s("Path traversal in storage path", "CWE-22"),
                  _s("Upload served from web root", "CWE-552", "CWE-419")],
        "real_world": "Classic unrestricted-upload-to-webshell on web roots.",
        "impact": "Drop an executable file in a served path and gain code execution.",
        "cwe": "CWE-434",
    },
    "Path Traversal → Sensitive File Read": {
        "severity": "high",
        "steps": [_s("Path / directory traversal", "CWE-22", "CWE-23"),
                  _s("Sensitive file / secret disclosure", "CWE-200", "CWE-538")],
        "real_world": "../ traversal reading config files and credentials.",
        "impact": "Escape the intended directory to read secrets and config.",
        "cwe": "CWE-22",
    },
    "Zip Slip → Arbitrary File Write": {
        "severity": "high",
        "steps": [_s("Zip Slip archive extraction", "CWE-22"),
                  _s("Write into executable/served path", "CWE-434", "CWE-552")],
        "real_world": "Zip Slip overwriting files outside the extraction dir.",
        "impact": "Write files outside the target dir via crafted archive paths.",
        "cwe": "CWE-22",
    },

    # ── Supply chain / CI-CD ──────────────────────────────────────────────────
    "Dependency Confusion → Build Compromise → Supply-Chain RCE": {
        "severity": "critical",
        "steps": [_s("Dependency confusion (internal name on public registry)", "CWE-427"),
                  _s("Install-time script execution", "CWE-506", "CWE-94"),
                  _s("Overprivileged CI token", "CWE-732", "CWE-269")],
        "real_world": "Alex Birsan 2021 dependency-confusion research across major orgs.",
        "impact": "Run attacker code in CI and compromise build artifacts/secrets.",
        "cwe": "CWE-427",
    },
    "pull_request_target → CI Secret Exfiltration": {
        "severity": "critical",
        "steps": [_s("pull_request_target / untrusted CI input", "CWE-94", "CWE-265"),
                  _s("Pipeline secrets exposed", "CWE-532", "CWE-798")],
        "real_world": "GitHub Actions pwn-request leaking repo secrets.",
        "impact": "Run attacker code in a trusted CI context and steal secrets.",
        "cwe": "CWE-94",
    },
    "Vulnerable Dependency → Known-CVE Exploit": {
        "severity": "high",
        "steps": [_s("Known vulnerable / outdated package", "CWE-1035", "CWE-1104", "CWE-937"),
                  _s("Reachable sink (deserialize/exec/render)", "CWE-502", "CWE-94", "CWE-79")],
        "real_world": "Equifax (Struts CVE-2017-5638) — unpatched dep exploited.",
        "impact": "Exploit a published CVE in a dependency reachable from the app.",
        "cwe": "CWE-1035",
    },
    "Curl-Pipe-Sh → Untrusted Code Execution": {
        "severity": "high",
        "steps": [_s("Unverified remote binary / curl|sh", "CWE-494"),
                  _s("Missing integrity / signature check", "CWE-345", "CWE-353")],
        "real_world": "Install scripts piping unverified remote code to a shell.",
        "impact": "Execute unverified downloaded code during build/deploy.",
        "cwe": "CWE-494",
    },

    # ── AI / LLM ──────────────────────────────────────────────────────────────
    "Prompt Injection → Tool Abuse → Data Exfiltration": {
        "severity": "high",
        "steps": [_s("Indirect/stored prompt injection", "CWE-1427"),
                  _s("Excessive agency / unbounded tool use", "CWE-285", "CWE-862"),
                  _s("Insecure LLM output to a dangerous sink", "CWE-94", "CWE-78")],
        "real_world": "Indirect prompt injection driving an LLM agent's tools (OWASP LLM Top 10).",
        "impact": "Hijack an AI agent to call tools/exfiltrate data on the attacker's behalf.",
        "cwe": "CWE-1427",
    },
    "Insecure LLM Output → Downstream Injection": {
        "severity": "high",
        "steps": [_s("Unvalidated LLM output handling", "CWE-94", "CWE-20"),
                  _s("Sink: eval / SQL / shell / HTML", "CWE-94", "CWE-89", "CWE-78", "CWE-79")],
        "real_world": "LLM output passed unvalidated into eval/SQL/render.",
        "impact": "Model output flows into a dangerous sink, enabling injection.",
        "cwe": "CWE-94",
    },
    "RAG Data Leak → System Prompt Exposure": {
        "severity": "medium",
        "steps": [_s("RAG/context data leakage", "CWE-200"),
                  _s("System prompt / secret leakage", "CWE-200", "CWE-522")],
        "real_world": "Retrieval contexts leaking other tenants' data or secrets.",
        "impact": "Extract private context, secrets, or the system prompt from the model.",
        "cwe": "CWE-200",
    },

    # ── Protocol / network / desync ───────────────────────────────────────────
    "Request Smuggling → Cache Poisoning → Mass Hijack": {
        "severity": "high",
        "steps": [_s("HTTP request smuggling / desync", "CWE-444"),
                  _s("Web cache poisoning", "CWE-349", "CWE-525"),
                  _s("Open redirect / response splitting", "CWE-601", "CWE-113")],
        "real_world": "Desync attacks poisoning shared caches/front-ends (PortSwigger research).",
        "impact": "Poison a shared cache to serve attacker content to many users.",
        "cwe": "CWE-444",
    },
    "Host Header Injection → Poisoned Reset Links": {
        "severity": "high",
        "steps": [_s("Host header injection", "CWE-644"),
                  _s("Reset/verification link uses untrusted host", "CWE-640", "CWE-601")],
        "real_world": "Password-reset poisoning via attacker-controlled Host header.",
        "impact": "Send reset links pointing at an attacker domain to capture tokens.",
        "cwe": "CWE-644",
    },
    "Missing TLS → MITM Credential Capture": {
        "severity": "high",
        "steps": [_s("HTTP instead of HTTPS / missing TLS", "CWE-319"),
                  _s("Missing certificate validation", "CWE-295")],
        "real_world": "Cleartext or unvalidated TLS enabling on-path interception.",
        "impact": "Intercept credentials/data on the network via a man-in-the-middle.",
        "cwe": "CWE-319",
    },

    # ── Webhooks / third-party ────────────────────────────────────────────────
    "Unsigned Webhook → Forged Event → State Change": {
        "severity": "high",
        "steps": [_s("Missing webhook signature verification", "CWE-345"),
                  _s("Trusting unverified third-party data", "CWE-345", "CWE-20")],
        "real_world": "Forged payment/CI webhooks accepted without signature checks.",
        "impact": "Forge third-party events to trigger unauthorized state changes.",
        "cwe": "CWE-345",
    },

    # ── WebSocket / realtime ──────────────────────────────────────────────────
    "Missing Auth on WebSocket → Broadcast Hijack": {
        "severity": "high",
        "steps": [_s("Missing auth on WebSocket upgrade", "CWE-306"),
                  _s("Unauthenticated broadcast channels", "CWE-306", "CWE-862"),
                  _s("Insecure room/channel access control", "CWE-284")],
        "real_world": "Unauthenticated realtime channels leaking/injecting messages.",
        "impact": "Read or inject messages across realtime channels without authentication.",
        "cwe": "CWE-306",
    },
    "Missing WS Origin Check → Cross-Site Hijack": {
        "severity": "high",
        "steps": [_s("Missing WebSocket origin validation", "CWE-346"),
                  _s("Authenticated socket actions exposed", "CWE-352", "CWE-306")],
        "real_world": "Cross-site WebSocket hijacking (CSWSH).",
        "impact": "Ride a victim's authenticated socket from an attacker page.",
        "cwe": "CWE-346",
    },

    # ── Business logic / race conditions ──────────────────────────────────────
    "Race Condition → Double-Spend / Limit Bypass": {
        "severity": "high",
        "steps": [_s("TOCTOU / non-atomic check-then-act", "CWE-362", "CWE-367"),
                  _s("Missing transaction atomicity", "CWE-362"),
                  _s("Price/quantity or balance manipulation", "CWE-840", "CWE-841")],
        "real_world": "Concurrent requests bypassing balance/limit checks (double-spend).",
        "impact": "Exploit a race window to bypass limits or spend twice.",
        "cwe": "CWE-362",
    },
    "Mass Assignment → Privilege Escalation": {
        "severity": "high",
        "steps": [_s("Mass assignment / over-binding", "CWE-915"),
                  _s("Privileged field set without authorization", "CWE-269", "CWE-862")],
        "real_world": "Binding is_admin/role via unfiltered model params (the GitHub 2012 bug).",
        "impact": "Set a privileged field through unfiltered object binding.",
        "cwe": "CWE-915",
    },
    "Predictable IDs → Forced Browsing → Data Access": {
        "severity": "medium",
        "steps": [_s("Predictable resource identifiers", "CWE-340"),
                  _s("Forced browsing / missing authorization", "CWE-425", "CWE-862")],
        "real_world": "Sequential IDs plus unprotected endpoints enabling enumeration.",
        "impact": "Guess identifiers and reach resources lacking authorization.",
        "cwe": "CWE-340",
    },

    # ── Crypto / secrets ──────────────────────────────────────────────────────
    "Weak Crypto → Forgeable Tokens": {
        "severity": "high",
        "steps": [_s("Weak hashing / encryption (MD5/SHA1/DES/ECB)", "CWE-327", "CWE-328"),
                  _s("Insecure randomness / predictable token", "CWE-330", "CWE-338")],
        "real_world": "Predictable tokens from weak PRNG / broken hashing.",
        "impact": "Predict or forge tokens protected by weak cryptography.",
        "cwe": "CWE-327",
    },
    "Plaintext Storage → Credential Disclosure": {
        "severity": "high",
        "steps": [_s("Plaintext / weakly-hashed credential storage", "CWE-256", "CWE-916"),
                  _s("Sensitive data exposure path", "CWE-200", "CWE-522")],
        "real_world": "Plaintext password stores dumped in breaches.",
        "impact": "Recover usable credentials from weak or plaintext storage.",
        "cwe": "CWE-256",
    },

    # ── Logging / error / info-leak ───────────────────────────────────────────
    "Stack Trace Exposure → Recon → Targeted Exploit": {
        "severity": "medium",
        "steps": [_s("Stack traces / debug exposed in production", "CWE-209", "CWE-489"),
                  _s("Architecture/secret detail leaked", "CWE-200", "CWE-215")],
        "real_world": "Debug pages leaking paths, versions, and secrets for targeting.",
        "impact": "Use leaked internals to craft a precise follow-on exploit.",
        "cwe": "CWE-209",
    },
    "Secrets in Logs → Credential Reuse": {
        "severity": "high",
        "steps": [_s("Sensitive data / secrets written to logs", "CWE-532"),
                  _s("Credential reachable / reused", "CWE-522", "CWE-798")],
        "real_world": "Tokens logged in plaintext then reused by an attacker.",
        "impact": "Harvest secrets from logs and reuse them to authenticate.",
        "cwe": "CWE-532",
    },

    # ── DoS / resource ────────────────────────────────────────────────────────
    "Missing Rate Limit → Credential Stuffing": {
        "severity": "high",
        "steps": [_s("Missing rate limiting", "CWE-770", "CWE-307"),
                  _s("Weak password policy / auth", "CWE-521", "CWE-287")],
        "real_world": "Unthrottled login enabling brute-force / credential stuffing.",
        "impact": "Brute-force or stuff credentials against an unthrottled endpoint.",
        "cwe": "CWE-307",
    },
    "Unbounded Payload → Resource Exhaustion DoS": {
        "severity": "medium",
        "steps": [_s("Missing request size / payload limits", "CWE-770"),
                  _s("Uncontrolled resource consumption / ReDoS", "CWE-400", "CWE-1333")],
        "real_world": "Large-payload or ReDoS inputs exhausting the service.",
        "impact": "Exhaust memory/CPU with oversized or pathological input.",
        "cwe": "CWE-400",
    },

    # ── Mobile ────────────────────────────────────────────────────────────────
    "Exported Component → Local Privilege Abuse": {
        "severity": "high",
        "steps": [_s("Exported component without permission check", "CWE-926"),
                  _s("Sensitive action / data exposed", "CWE-200", "CWE-862")],
        "real_world": "Exported Android components invoked by malicious apps.",
        "impact": "A malicious app invokes the exported component to abuse it.",
        "cwe": "CWE-926",
    },
    "Insecure Local Storage → Device-Theft Data Loss": {
        "severity": "medium",
        "steps": [_s("Sensitive data in local/async storage", "CWE-922", "CWE-312"),
                  _s("Weak local authentication", "CWE-287")],
        "real_world": "Tokens/PII in plaintext app storage recovered from a device.",
        "impact": "Recover sensitive data from unprotected on-device storage.",
        "cwe": "CWE-922",
    },
    "Insecure WebView → JS Bridge Abuse": {
        "severity": "high",
        "steps": [_s("Insecure WebView configuration", "CWE-749"),
                  _s("Native bridge / code execution exposed", "CWE-94", "CWE-749")],
        "real_world": "addJavascriptInterface exposing native methods to web content.",
        "impact": "Hostile web content calls native bridge methods via the WebView.",
        "cwe": "CWE-749",
    },
}


def chain_step_labels(chain: dict) -> list[str]:
    """The human labels of a chain's steps (steps are {label, cwe:[...]} dicts,
    or plain strings for any legacy entry)."""
    return [s["label"] if isinstance(s, dict) else str(s) for s in chain["steps"]]


def total_classes() -> int:
    return sum(len(v) for v in TAXONOMY.values())


def total_categories() -> int:
    return len(TAXONOMY) + 1  # +1 for the attack-chain category


def attack_chain_classes() -> list[tuple[str, str, str, str]]:
    """Attack chains in the (name, cwe, owasp, severity) shape the Learning Hub
    seeder consumes, so each chain becomes a Hub explainer alongside the taxonomy.
    OWASP is left as the cross-cutting marker since chains span multiple entries."""
    return [
        (name, c["cwe"], "Multiple", c["severity"])
        for name, c in ATTACK_CHAINS.items()
    ]
