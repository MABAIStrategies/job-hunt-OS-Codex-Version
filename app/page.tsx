"use client";

import {
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  DollarSign,
  Download,
  ExternalLink,
  FileText,
  ListChecks,
  MapPin,
  Plus,
  RefreshCcw,
  Search,
  Shield,
  Target,
  Trash2,
  TrendingUp,
  User,
  UsersRound,
} from "lucide-react";
import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ContactsWorkspace } from "./contacts-workspace";

type Stage =
  | "Prospect"
  | "Applied"
  | "In Process"
  | "Interview"
  | "Offer"
  | "Archived";
type WorkMode = "Remote" | "Hybrid" | "In Office";

type Opportunity = {
  id: string;
  company: string;
  title: string;
  location: string;
  workMode: WorkMode;
  compensation: string;
  source: string;
  sourceUrl: string;
  stage: Stage;
  nextStep: string;
  nextDate: string;
  priority: "Low" | "Medium" | "High";
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type OpportunityDraft = Omit<Opportunity, "id" | "createdAt" | "updatedAt">;

const STORAGE_KEY = "mab-job-hunt-os-opportunities-v1";
const MIN_TOTAL_COMP = 185000;

const targetProfile = {
  owner: "MABAIStrategies",
  product: "Job Hunt OS",
  legalEntity: "MAB AI Strategies LLC",
  authPreference: "Email and password",
  roleTargets: [
    "AI",
    "Strategy",
    "Innovation",
    "Director",
    "Sales",
    "GTM",
    "Business",
  ],
  geography:
    "50-mile radius around Wilmington, DE for hybrid/in-office; anywhere on earth if remote",
  minimumCompensation: MIN_TOTAL_COMP,
  avoid: "Verizon and telecom",
  resumeSource: "Desktop -> MAB AI Strategies -> Resume",
  pilot: "Mark",
};

const seedOpportunities: Opportunity[] = [
  {
    id: "seed-databricks",
    company: "Databricks",
    title: "Director, GTM Strategy - Enterprise",
    location: "Remote, US",
    workMode: "Remote",
    compensation: "$320K - $380K total annual compensation",
    source: "LinkedIn",
    sourceUrl: "https://www.linkedin.com/jobs/",
    stage: "Interview",
    nextStep: "Panel prep and case narrative",
    nextDate: "2026-07-22",
    priority: "High",
    notes:
      "Strong GTM and AI platform fit. Emphasize enterprise motion, sales operating cadence, and executive stakeholder work.",
    createdAt: "2026-07-01",
    updatedAt: "2026-07-18",
  },
  {
    id: "seed-openai",
    company: "OpenAI",
    title: "Strategic Partnerships Lead",
    location: "Remote, US",
    workMode: "Remote",
    compensation: "$350K - $450K total annual compensation",
    source: "Company careers",
    sourceUrl: "https://openai.com/careers/",
    stage: "In Process",
    nextStep: "Follow up with recruiter",
    nextDate: "2026-07-24",
    priority: "High",
    notes:
      "Position around enterprise AI adoption, partner strategy, and measurable GTM outcomes.",
    createdAt: "2026-07-05",
    updatedAt: "2026-07-16",
  },
  {
    id: "seed-hubspot",
    company: "HubSpot",
    title: "Director, AI Strategy and Revenue Innovation",
    location: "Remote, US",
    workMode: "Remote",
    compensation: "$250K - $330K total annual compensation",
    source: "Referral",
    sourceUrl: "",
    stage: "Applied",
    nextStep: "Send value snapshot",
    nextDate: "2026-07-25",
    priority: "Medium",
    notes:
      "Map MAB AI Strategies work to AI-assisted revenue operations and enablement.",
    createdAt: "2026-07-09",
    updatedAt: "2026-07-12",
  },
];

const emptyDraft: OpportunityDraft = {
  company: "",
  title: "",
  location: "Remote",
  workMode: "Remote",
  compensation: "$185K+ total annual compensation",
  source: "Manual",
  sourceUrl: "",
  stage: "Prospect",
  nextStep: "Research compensation and decision makers",
  nextDate: "",
  priority: "Medium",
  notes: "",
};

const packageItems = [
  "Master profile current",
  "Role-specific resume",
  "ATS keyword gap checked",
  "Cover letter draft",
  "LinkedIn headline/About ready",
  "Follow-up sequence drafted",
  "Interview proof stories mapped",
];

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `opp-${Date.now()}`;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function parseCompensationRange(value: string) {
  const matches = value.match(/\d+(?:,\d{3})*|\d+/g) ?? [];
  const numbers = matches
    .map((match) => Number(match.replaceAll(",", "")))
    .map((amount) => (amount < 1000 ? amount * 1000 : amount))
    .filter((amount) => Number.isFinite(amount));

  if (numbers.length === 0) {
    return { low: 0, high: 0 };
  }

  return {
    low: Math.min(...numbers),
    high: Math.max(...numbers),
  };
}

function isInTargetGeography(opportunity: Opportunity) {
  const location = opportunity.location.toLowerCase();
  return (
    opportunity.workMode === "Remote" ||
    location.includes("remote") ||
    location.includes("wilmington") ||
    location.includes("delaware") ||
    location.includes("philadelphia") ||
    location.includes("baltimore")
  );
}

function scoreOpportunity(opportunity: Opportunity) {
  const comp = parseCompensationRange(opportunity.compensation);
  const roleText = `${opportunity.title} ${opportunity.notes}`.toLowerCase();
  const roleMatchCount = targetProfile.roleTargets.filter((role) =>
    roleText.includes(role.toLowerCase()),
  ).length;
  const compensationScore =
    comp.high >= MIN_TOTAL_COMP ? 35 : comp.high > 0 ? 18 : 8;
  const geographyScore = isInTargetGeography(opportunity) ? 25 : 5;
  const roleScore = Math.min(25, roleMatchCount * 7);
  const momentumScore = ["Interview", "Offer"].includes(opportunity.stage)
    ? 15
    : opportunity.stage === "In Process"
      ? 10
      : 5;

  return Math.min(
    100,
    compensationScore + geographyScore + roleScore + momentumScore,
  );
}

function toCsv(opportunities: Opportunity[]) {
  const headers = [
    "company",
    "title",
    "stage",
    "priority",
    "location",
    "workMode",
    "compensation",
    "source",
    "sourceUrl",
    "nextStep",
    "nextDate",
    "score",
    "notes",
  ];
  const rows = opportunities.map((opportunity) =>
    headers
      .map((header) => {
        const value =
          header === "score"
            ? scoreOpportunity(opportunity)
            : opportunity[header as keyof Opportunity];
        return `"${String(value ?? "").replaceAll('"', '""')}"`;
      })
      .join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-card__icon">{icon}</div>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </div>
  );
}

function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span
      className={`stage-badge stage-badge--${stage.toLowerCase().replaceAll(" ", "-")}`}
    >
      {stage}
    </span>
  );
}

export default function Home() {
  const [opportunities, setOpportunities] =
    useState<Opportunity[]>(seedOpportunities);
  const [selectedId, setSelectedId] = useState(seedOpportunities[0]?.id ?? "");
  const [draft, setDraft] = useState<OpportunityDraft>(emptyDraft);
  const [query, setQuery] = useState("");
  const [activeView, setActiveView] = useState<"dashboard" | "contacts">(
    "dashboard",
  );
  const [contactCount, setContactCount] = useState(0);

  const updateContactCount = useCallback(
    (count: number) => setContactCount(count),
    [],
  );

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved) as Opportunity[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setOpportunities(parsed);
        setSelectedId(parsed[0].id);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(opportunities));
  }, [opportunities]);

  const filteredOpportunities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return opportunities;
    }

    return opportunities.filter((opportunity) =>
      [
        opportunity.company,
        opportunity.title,
        opportunity.stage,
        opportunity.location,
        opportunity.notes,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [opportunities, query]);

  const selectedOpportunity =
    opportunities.find((opportunity) => opportunity.id === selectedId) ??
    opportunities[0] ??
    seedOpportunities[0];

  const metrics = useMemo(() => {
    const active = opportunities.filter(
      (opportunity) => opportunity.stage !== "Archived",
    );
    const averageScore = active.length
      ? Math.round(
          active.reduce(
            (total, opportunity) => total + scoreOpportunity(opportunity),
            0,
          ) / active.length,
        )
      : 0;
    const maxComp = active.reduce((highest, opportunity) => {
      const comp = parseCompensationRange(opportunity.compensation);
      return Math.max(highest, comp.high);
    }, 0);

    return {
      total: active.length,
      applied: active.filter((opportunity) => opportunity.stage === "Applied")
        .length,
      inMotion: active.filter((opportunity) =>
        ["In Process", "Interview", "Offer"].includes(opportunity.stage),
      ).length,
      interviews: active.filter(
        (opportunity) => opportunity.stage === "Interview",
      ).length,
      offers: active.filter((opportunity) => opportunity.stage === "Offer")
        .length,
      averageScore,
      maxComp,
    };
  }, [opportunities]);

  function addOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.company.trim() || !draft.title.trim()) {
      return;
    }

    const now = new Date().toISOString().slice(0, 10);
    const opportunity: Opportunity = {
      ...draft,
      id: createId(),
      company: draft.company.trim(),
      title: draft.title.trim(),
      createdAt: now,
      updatedAt: now,
    };

    setOpportunities((current) => [opportunity, ...current]);
    setSelectedId(opportunity.id);
    setDraft(emptyDraft);
  }

  function updateSelected(updates: Partial<Opportunity>) {
    setOpportunities((current) =>
      current.map((opportunity) =>
        opportunity.id === selectedOpportunity.id
          ? {
              ...opportunity,
              ...updates,
              updatedAt: new Date().toISOString().slice(0, 10),
            }
          : opportunity,
      ),
    );
  }

  function deleteSelected() {
    setOpportunities((current) => {
      const next = current.filter(
        (opportunity) => opportunity.id !== selectedOpportunity.id,
      );
      setSelectedId(next[0]?.id ?? "");
      return next;
    });
  }

  function exportCsv() {
    const blob = new Blob([toCsv(opportunities)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "job-hunt-os-dashboard.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function showDashboardSection(sectionId: string) {
    setActiveView("dashboard");
    window.setTimeout(
      () =>
        document
          .getElementById(sectionId)
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  }

  return (
    <main className="app-shell">
      <aside className="side-rail" aria-label="Workspace">
        <div className="brand-lockup">
          <div className="brand-mark">MAB</div>
          <div>
            <h1>Job Hunt OS</h1>
            <p>MAB AI Strategies</p>
          </div>
        </div>

        <nav className="nav-stack" aria-label="Primary">
          <button
            className={`nav-item${activeView === "dashboard" ? " nav-item--active" : ""}`}
            type="button"
            onClick={() => showDashboardSection("dashboard")}
          >
            <Target size={16} />
            <span>Dashboard</span>
          </button>
          <button
            className="nav-item"
            type="button"
            onClick={() => showDashboardSection("opportunities")}
          >
            <Briefcase size={16} />
            <span>Opportunities</span>
          </button>
          <button
            className="nav-item"
            type="button"
            onClick={() => showDashboardSection("package")}
          >
            <FileText size={16} />
            <span>Resume Package</span>
          </button>
          <button
            className={`nav-item${activeView === "contacts" ? " nav-item--active" : ""}`}
            type="button"
            onClick={() => setActiveView("contacts")}
          >
            <UsersRound size={16} />
            <span>Contacts</span>
            {contactCount ? (
              <small className="nav-count">
                {contactCount.toLocaleString()}
              </small>
            ) : null}
          </button>
          <button
            className="nav-item"
            type="button"
            onClick={() => showDashboardSection("readiness")}
          >
            <Shield size={16} />
            <span>Readiness</span>
          </button>
        </nav>

        <div className="rail-panel">
          <div className="mini-label">Pilot</div>
          <strong>{targetProfile.pilot}</strong>
          <span>{targetProfile.legalEntity}</span>
        </div>

        <div className="readiness-mini">
          <span>{metrics.averageScore}</span>
          <p>Average Fit Score</p>
        </div>
      </aside>

      {activeView === "contacts" ? (
        <ContactsWorkspace onCountChange={updateContactCount} />
      ) : (
        <>
          <section className="workspace" id="dashboard">
            <header className="top-bar">
              <div>
                <p className="eyebrow">Live personal workspace</p>
                <h2>Executive Job Search Dashboard</h2>
              </div>
              <div className="top-actions">
                <button
                  className="icon-button"
                  type="button"
                  onClick={exportCsv}
                  aria-label="Export CSV"
                  title="Export CSV"
                >
                  <Download size={18} />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => {
                    setOpportunities(seedOpportunities);
                    setSelectedId(seedOpportunities[0].id);
                  }}
                  aria-label="Restore starter opportunities"
                  title="Restore starter opportunities"
                >
                  <RefreshCcw size={18} />
                </button>
              </div>
            </header>

            <section className="target-strip" aria-labelledby="target-profile">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Target Profile</p>
                  <h3 id="target-profile">{targetProfile.owner}</h3>
                </div>
                <span className="status-pill">Browser storage v1</span>
              </div>
              <div className="target-grid">
                <div>
                  <User size={17} />
                  <span>Roles</span>
                  <strong>{targetProfile.roleTargets.join(" / ")}</strong>
                </div>
                <div>
                  <MapPin size={17} />
                  <span>Geography</span>
                  <strong>{targetProfile.geography}</strong>
                </div>
                <div>
                  <DollarSign size={17} />
                  <span>Compensation Floor</span>
                  <strong>
                    {formatCurrency(targetProfile.minimumCompensation)} total
                    annual compensation
                  </strong>
                </div>
                <div>
                  <Building2 size={17} />
                  <span>Avoid</span>
                  <strong>{targetProfile.avoid}</strong>
                </div>
              </div>
            </section>

            <section className="metrics-grid" aria-label="Pipeline metrics">
              <StatCard
                icon={<Briefcase size={18} />}
                label="Active opportunities"
                value={String(metrics.total)}
                detail="Not archived"
              />
              <StatCard
                icon={<CheckCircle2 size={18} />}
                label="Applied"
                value={String(metrics.applied)}
                detail="Submitted packages"
              />
              <StatCard
                icon={<TrendingUp size={18} />}
                label="In motion"
                value={String(metrics.inMotion)}
                detail="Recruiter or hiring flow"
              />
              <StatCard
                icon={<Calendar size={18} />}
                label="Interviews"
                value={String(metrics.interviews)}
                detail="Prep required"
              />
              <StatCard
                icon={<Target size={18} />}
                label="Offers"
                value={String(metrics.offers)}
                detail="Negotiation track"
              />
              <StatCard
                icon={<DollarSign size={18} />}
                label="Highest target comp"
                value={metrics.maxComp ? formatCurrency(metrics.maxComp) : "$0"}
                detail="Parsed from saved roles"
              />
            </section>

            <form className="add-row" onSubmit={addOpportunity}>
              <label>
                <span>Company</span>
                <input
                  value={draft.company}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      company: event.target.value,
                    }))
                  }
                  placeholder="Company"
                />
              </label>
              <label>
                <span>Role</span>
                <input
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Role title"
                />
              </label>
              <label>
                <span>Stage</span>
                <select
                  value={draft.stage}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      stage: event.target.value as Stage,
                    }))
                  }
                >
                  {[
                    "Prospect",
                    "Applied",
                    "In Process",
                    "Interview",
                    "Offer",
                  ].map((stage) => (
                    <option key={stage}>{stage}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Work mode</span>
                <select
                  value={draft.workMode}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      workMode: event.target.value as WorkMode,
                    }))
                  }
                >
                  {["Remote", "Hybrid", "In Office"].map((mode) => (
                    <option key={mode}>{mode}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Compensation</span>
                <input
                  value={draft.compensation}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      compensation: event.target.value,
                    }))
                  }
                  placeholder="$185K+"
                />
              </label>
              <button className="primary-button" type="submit">
                <Plus size={18} />
                Add Opportunity
              </button>
            </form>

            <section className="opportunity-section" id="opportunities">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Pipeline</p>
                  <h3>Opportunities</h3>
                </div>
                <label className="search-box">
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search"
                  />
                </label>
              </div>

              <div
                className="table-shell"
                role="region"
                aria-label="Saved opportunities"
              >
                <table>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Role</th>
                      <th>Stage</th>
                      <th>Next Step</th>
                      <th>Comp</th>
                      <th>Fit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOpportunities.map((opportunity) => (
                      <tr
                        key={opportunity.id}
                        className={
                          opportunity.id === selectedOpportunity.id
                            ? "selected-row"
                            : ""
                        }
                        onClick={() => setSelectedId(opportunity.id)}
                      >
                        <td>
                          <strong>{opportunity.company}</strong>
                          <span>{opportunity.location}</span>
                        </td>
                        <td>{opportunity.title}</td>
                        <td>
                          <StageBadge stage={opportunity.stage} />
                        </td>
                        <td>
                          <strong>
                            {opportunity.nextStep || "Assign next step"}
                          </strong>
                          <span>{opportunity.nextDate || "No date set"}</span>
                        </td>
                        <td>{opportunity.compensation}</td>
                        <td>
                          <span className="fit-score">
                            {scoreOpportunity(opportunity)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </section>

          <aside className="detail-panel" aria-label="Opportunity detail">
            <section className="detail-card">
              <div className="detail-heading">
                <div>
                  <p className="eyebrow">Selected Opportunity</p>
                  <h3>{selectedOpportunity.company}</h3>
                  <span>{selectedOpportunity.title}</span>
                </div>
                <span className="fit-score fit-score--large">
                  {scoreOpportunity(selectedOpportunity)}
                </span>
              </div>

              <div className="badge-row">
                <StageBadge stage={selectedOpportunity.stage} />
                <span className="status-pill">
                  {selectedOpportunity.workMode}
                </span>
                <span className="status-pill">
                  {selectedOpportunity.priority} priority
                </span>
              </div>

              <div className="detail-grid">
                <label>
                  <span>Stage</span>
                  <select
                    value={selectedOpportunity.stage}
                    onChange={(event) =>
                      updateSelected({ stage: event.target.value as Stage })
                    }
                  >
                    {[
                      "Prospect",
                      "Applied",
                      "In Process",
                      "Interview",
                      "Offer",
                      "Archived",
                    ].map((stage) => (
                      <option key={stage}>{stage}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Priority</span>
                  <select
                    value={selectedOpportunity.priority}
                    onChange={(event) =>
                      updateSelected({
                        priority: event.target.value as Opportunity["priority"],
                      })
                    }
                  >
                    {["Low", "Medium", "High"].map((priority) => (
                      <option key={priority}>{priority}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Next step</span>
                  <input
                    value={selectedOpportunity.nextStep}
                    onChange={(event) =>
                      updateSelected({ nextStep: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Next date</span>
                  <input
                    type="date"
                    value={selectedOpportunity.nextDate}
                    onChange={(event) =>
                      updateSelected({ nextDate: event.target.value })
                    }
                  />
                </label>
              </div>

              <label className="notes-field">
                <span>Notes</span>
                <textarea
                  value={selectedOpportunity.notes}
                  onChange={(event) =>
                    updateSelected({ notes: event.target.value })
                  }
                  rows={7}
                />
              </label>

              <div className="detail-actions">
                {selectedOpportunity.sourceUrl ? (
                  <a
                    className="secondary-button"
                    href={selectedOpportunity.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={16} />
                    Source
                  </a>
                ) : null}
                <button
                  className="danger-button"
                  type="button"
                  onClick={deleteSelected}
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </section>

            <section className="detail-card" id="package">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Application Package</p>
                  <h3>Readiness Checklist</h3>
                </div>
                <ListChecks size={18} />
              </div>
              <ul className="checklist">
                {packageItems.map((item, index) => (
                  <li key={item}>
                    <CheckCircle2
                      className={index < 3 ? "check-ready" : "check-pending"}
                      size={18}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="detail-card" id="readiness">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Production Path</p>
                  <h3>Integration Queue</h3>
                </div>
                <Shield size={18} />
              </div>
              <div className="integration-list">
                <span>Neon Postgres</span>
                <strong>Ready for guarded setup</strong>
                <span>Email/password auth</span>
                <strong>Env-gated basic auth now, Clerk/Neon Auth later</strong>
                <span>Stripe Link</span>
                <strong>Payment link hook reserved</strong>
              </div>
            </section>
          </aside>
        </>
      )}
    </main>
  );
}
