import csv
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


EXPECTED_FILES = [
    ".github/workflows/validate.yml",
    ".gitignore",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "LICENSE",
    "README.md",
    "SECURITY.md",
    "docs/go-live-checklist.md",
    "docs/verification.md",
    "requirements-dev.txt",
    ".env.example",
    "package.json",
    "package-lock.json",
    "next.config.mjs",
    "tsconfig.json",
    "vercel.json",
    "app/layout.tsx",
    "app/page.tsx",
    "app/contacts-workspace.tsx",
    "app/globals.css",
    "lib/contacts.ts",
    "proxy.ts",
    "docs/deployment.md",
    "examples/contacts-import-template.csv",
    "skills/job-hunt-os/SKILL.md",
    "skills/job-hunt-os/agents/openai.yaml",
    "skills/job-hunt-os/references/intake.md",
    "skills/job-hunt-os/references/freshness-research.md",
    "skills/job-hunt-os/references/compensation.md",
    "skills/job-hunt-os/references/ats-gap-analysis.md",
    "skills/job-hunt-os/references/resume-cover-letter.md",
    "skills/job-hunt-os/references/follow-up.md",
    "skills/job-hunt-os/references/interview-prep.md",
    "skills/job-hunt-os/references/mock-review.md",
    "skills/job-hunt-os/references/knowledge-gaps.md",
    "skills/job-hunt-os/references/dashboard.md",
    "skills/job-hunt-os/references/runtime-adapters.md",
    "skills/job-hunt-os/references/truth-policy.md",
    "skills/job-hunt-os/templates/dashboard-row-template.csv",
    "skills/job-hunt-os/templates/outreach-sequence.md",
    "skills/job-hunt-os/templates/application-package.md",
    "skills/job-hunt-os/templates/release-announcement.md",
    "skills/job-hunt-os/templates/pricing-matrix.csv",
    "product/master-spec.md",
    "strategy/roadmap.md",
    "strategy/sales-sequences.md",
    "strategy/pricing-matrix.md",
    "strategy/pricing-matrix.csv",
    "strategy/production-architecture.md",
    "launch/release-announcement.md",
    "launch/video-short-script.md",
    "launch/social-banner-brief.md",
    "launch/roadmap-diagram.mmd",
    "launch/export-manifest.json",
    "launch/design-reference/job-hunt-os-dashboard-concept.png",
]


SCHEMA_NAMES = [
    "master-profile",
    "job-target",
    "compensation-estimate",
    "application-package",
    "dashboard-record",
    "outreach-sequence",
    "pricing-matrix",
    "launch-asset",
]


BANNED_RUNTIME_STRINGS = [
    "/home/" + "claude",
    "/mnt/" + "skills",
    "/mnt/" + "user-data",
    "web" + "_search",
    "web" + "_fetch",
    "present" + "_files",
    "Claude" + " will",
]


def read_text(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def test_required_deliverables_exist():
    missing = [path for path in EXPECTED_FILES if not (ROOT / path).is_file()]
    assert missing == []


def test_skill_markdown_is_codex_native_and_lean():
    skill = read_text("skills/job-hunt-os/SKILL.md")
    assert skill.startswith("---\n")
    assert "name: job-hunt-os" in skill
    assert len(skill.splitlines()) < 500
    for banned in BANNED_RUNTIME_STRINGS:
        assert banned not in skill


def test_all_schemas_and_examples_are_valid_json():
    for name in SCHEMA_NAMES:
        schema_path = ROOT / "skills/job-hunt-os/schemas" / f"{name}.schema.json"
        example_path = ROOT / "examples" / f"{name}.example.json"

        with schema_path.open(encoding="utf-8") as handle:
            schema = json.load(handle)
        with example_path.open(encoding="utf-8") as handle:
            example = json.load(handle)

        assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
        assert schema["type"] in {"object", "array"}
        assert example is not None


def test_no_claude_runtime_strings_outside_migration_notes():
    allowed = {ROOT / "docs/migration-notes.md"}
    matches = []
    for path in ROOT.rglob("*"):
        if path.is_dir() or path in allowed or ".git" in path.parts:
            continue
        if path.suffix.lower() not in {".md", ".json", ".yaml", ".csv", ".mmd", ".py"}:
            continue
        text = path.read_text(encoding="utf-8")
        for banned in BANNED_RUNTIME_STRINGS:
            if banned in text:
                matches.append((str(path.relative_to(ROOT)), banned))
    assert matches == []


def test_pricing_matrix_has_required_b2b_tiers():
    with (ROOT / "strategy/pricing-matrix.csv").open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))

    tiers = {row["tier"] for row in rows}
    assert {"Pilot", "Team", "Growth/RPO", "Enterprise"}.issubset(tiers)
    for row in rows:
        assert row["setup_fee_usd"]
        assert row["monthly_subscription_usd"]
        assert row["ideal_customer_profile"]


def test_sales_sequences_cover_three_icps_and_five_touches():
    text = read_text("strategy/sales-sequences.md")
    for icp in ["Staffing Agencies", "RPO and Outplacement Firms", "University and Career Services"]:
        assert icp in text
    assert len(re.findall(r"Touch [1-5]", text)) >= 15


def test_launch_manifest_covers_social_platforms():
    manifest = json.loads(read_text("launch/export-manifest.json"))
    platforms = {item["platform"] for item in manifest["assets"]}
    assert {
        "x-twitter",
        "linkedin",
        "facebook",
        "pinterest",
        "youtube-shorts",
        "tiktok",
        "instagram",
    }.issubset(platforms)
    assert manifest["verification_required"] is True


def test_web_app_includes_personal_pilot_defaults():
    page = read_text("app/page.tsx")
    assert "MABAIStrategies" in page
    assert "MAB AI Strategies LLC" in page
    assert "Wilmington, DE" in page
    assert "185000" in page
    assert "Verizon and telecom" in page
    assert "Desktop -> MAB AI Strategies -> Resume" in page


def test_contact_import_is_local_and_deduplicated():
    page = read_text("app/page.tsx")
    workspace = read_text("app/contacts-workspace.tsx")
    contacts = read_text("lib/contacts.ts")

    assert "ContactsWorkspace" in page
    assert "Import contacts" in workspace
    assert "indexedDB" in contacts
    assert "duplicateRecords" in contacts
    assert "email:" in contacts
    assert "linkedin:" in contacts
    assert "accept=\".csv,.tsv" in workspace
