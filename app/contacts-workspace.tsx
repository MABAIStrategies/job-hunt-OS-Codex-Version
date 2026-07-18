"use client";

import {
  Building2,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Link2,
  Mail,
  Search,
  Trash2,
  Upload,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  clearContacts,
  Contact,
  contactsToCsv,
  deleteContact,
  getContacts,
  mergeContacts,
  parseContactsFile,
  putContacts,
} from "../lib/contacts";

type ImportSummary = {
  fileName: string;
  added: number;
  duplicates: number;
  rejected: number;
  warnings: string[];
};

function downloadCsv(contents: string, fileName: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ContactDetail({
  contact,
  onSave,
  onDelete,
}: {
  contact: Contact;
  onSave: (contact: Contact) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(contact);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(contact);
    setSaved(false);
  }, [contact.id]);

  function update(field: keyof Contact, value: string) {
    setSaved(false);
    setDraft((current) => {
      const next = { ...current, [field]: value };
      if (field === "firstName" || field === "lastName") {
        next.fullName = [next.firstName, next.lastName]
          .filter(Boolean)
          .join(" ");
      }
      return next;
    });
  }

  async function save() {
    await onSave({ ...draft, updatedAt: new Date().toISOString() });
    setSaved(true);
  }

  return (
    <section className="detail-card contact-detail-card">
      <div className="detail-heading">
        <div>
          <p className="eyebrow">Selected Contact</p>
          <h3>{draft.fullName || draft.email || "Unnamed contact"}</h3>
          <span>
            {[draft.title, draft.company].filter(Boolean).join(" at ") ||
              "No company details"}
          </span>
        </div>
        <span className="contact-avatar">
          {(draft.firstName || draft.email || "?").slice(0, 1).toUpperCase()}
        </span>
      </div>

      <div className="contact-link-row">
        {draft.email ? (
          <a
            className="icon-button"
            href={`mailto:${draft.email}`}
            aria-label="Email contact"
            title="Email contact"
          >
            <Mail size={17} />
          </a>
        ) : null}
        {draft.linkedinUrl ? (
          <a
            className="icon-button"
            href={draft.linkedinUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open LinkedIn"
            title="Open LinkedIn"
          >
            <ExternalLink size={17} />
          </a>
        ) : null}
      </div>

      <div className="detail-grid contact-edit-grid">
        <label>
          <span>First name</span>
          <input
            value={draft.firstName}
            onChange={(event) => update("firstName", event.target.value)}
          />
        </label>
        <label>
          <span>Last name</span>
          <input
            value={draft.lastName}
            onChange={(event) => update("lastName", event.target.value)}
          />
        </label>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={draft.email}
            onChange={(event) => update("email", event.target.value)}
          />
        </label>
        <label>
          <span>Phone</span>
          <input
            value={draft.phone}
            onChange={(event) => update("phone", event.target.value)}
          />
        </label>
        <label>
          <span>Company</span>
          <input
            value={draft.company}
            onChange={(event) => update("company", event.target.value)}
          />
        </label>
        <label>
          <span>Title</span>
          <input
            value={draft.title}
            onChange={(event) => update("title", event.target.value)}
          />
        </label>
        <label className="contact-field-wide">
          <span>LinkedIn URL</span>
          <input
            value={draft.linkedinUrl}
            onChange={(event) => update("linkedinUrl", event.target.value)}
          />
        </label>
        <label className="contact-field-wide">
          <span>Location</span>
          <input
            value={draft.location}
            onChange={(event) => update("location", event.target.value)}
          />
        </label>
        <label className="contact-field-wide">
          <span>Tags</span>
          <input
            value={draft.tags}
            onChange={(event) => update("tags", event.target.value)}
            placeholder="recruiter, ai, warm"
          />
        </label>
      </div>

      <label className="notes-field">
        <span>Notes</span>
        <textarea
          value={draft.notes}
          onChange={(event) => update("notes", event.target.value)}
          rows={5}
        />
      </label>

      <div className="detail-actions">
        <button className="primary-button" type="button" onClick={save}>
          <CheckCircle2 size={16} />
          {saved ? "Saved" : "Save changes"}
        </button>
        <button
          className="danger-button"
          type="button"
          onClick={() => onDelete(contact.id)}
        >
          <Trash2 size={16} />
          Delete
        </button>
      </div>
    </section>
  );
}

export function ContactsWorkspace({
  onCountChange,
}: {
  onCountChange: (count: number) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    getContacts()
      .then((savedContacts) => {
        const sorted = savedContacts.sort((a, b) =>
          (a.fullName || a.email).localeCompare(b.fullName || b.email),
        );
        setContacts(sorted);
        setSelectedId(sorted[0]?.id ?? "");
      })
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    onCountChange(contacts.length);
  }, [contacts.length, onCountChange]);

  const filteredContacts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return contacts;
    }
    return contacts.filter((contact) =>
      [
        contact.fullName,
        contact.email,
        contact.company,
        contact.title,
        contact.location,
        contact.tags,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [contacts, query]);

  const selectedContact =
    contacts.find((contact) => contact.id === selectedId) ??
    filteredContacts[0];
  const companyCount = new Set(
    contacts
      .map((contact) => contact.company.trim().toLowerCase())
      .filter(Boolean),
  ).size;
  const emailCount = contacts.filter((contact) => contact.email).length;
  const linkedInCount = contacts.filter(
    (contact) => contact.linkedinUrl,
  ).length;

  async function importFile(file?: File) {
    if (!file) {
      return;
    }
    setImporting(true);
    setError("");
    setSummary(null);
    try {
      const parsed = await parseContactsFile(file);
      const merged = mergeContacts(contacts, parsed.contacts);
      await putContacts(merged.contacts);
      setContacts(merged.contacts);
      setSelectedId((current) => current || merged.contacts[0]?.id || "");
      setSummary({
        fileName: file.name,
        added: merged.addedRecords,
        duplicates: merged.duplicateRecords,
        rejected: parsed.rejectedRows,
        warnings: [...parsed.parseWarnings, ...parsed.rejectedReasons].slice(
          0,
          6,
        ),
      });
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "The contact file could not be imported.",
      );
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    void importFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    void importFile(event.dataTransfer.files?.[0]);
  }

  function handleDropzoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInputRef.current?.click();
    }
  }

  async function saveContact(contact: Contact) {
    await putContacts([contact]);
    setContacts((current) =>
      current.map((item) => (item.id === contact.id ? contact : item)),
    );
  }

  async function removeContact(id: string) {
    await deleteContact(id);
    setContacts((current) => {
      const next = current.filter((contact) => contact.id !== id);
      setSelectedId(next[0]?.id ?? "");
      return next;
    });
  }

  async function removeAllContacts() {
    if (
      !window.confirm(
        `Delete all ${contacts.length.toLocaleString()} contacts from this browser?`,
      )
    ) {
      return;
    }
    await clearContacts();
    setContacts([]);
    setSelectedId("");
    setSummary(null);
  }

  return (
    <>
      <section className="workspace" id="contacts">
        <header className="top-bar">
          <div>
            <p className="eyebrow">Private relationship workspace</p>
            <h2>Contacts</h2>
          </div>
          <div className="top-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() =>
                downloadCsv(contactsToCsv(contacts), "job-hunt-os-contacts.csv")
              }
              disabled={contacts.length === 0}
            >
              <Download size={17} />
              Export
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={17} />
              Import contacts
            </button>
          </div>
        </header>

        <section className="contact-metrics" aria-label="Contact metrics">
          <div>
            <UsersRound size={18} />
            <span>Total contacts</span>
            <strong>{contacts.length.toLocaleString()}</strong>
          </div>
          <div>
            <Building2 size={18} />
            <span>Companies</span>
            <strong>{companyCount.toLocaleString()}</strong>
          </div>
          <div>
            <Mail size={18} />
            <span>With email</span>
            <strong>{emailCount.toLocaleString()}</strong>
          </div>
          <div>
            <Link2 size={18} />
            <span>With LinkedIn</span>
            <strong>{linkedInCount.toLocaleString()}</strong>
          </div>
        </section>

        <section className="contact-import-section">
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            onChange={handleFileChange}
          />
          <div
            className={`contact-dropzone${dragActive ? " contact-dropzone--active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={handleDropzoneKeyDown}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <FileSpreadsheet size={28} />
            <div>
              <strong>
                {importing
                  ? "Importing contacts..."
                  : "Drop a CSV or TSV contact list here"}
              </strong>
              <span>
                Large files stay in this browser. Existing email and LinkedIn
                matches are deduplicated.
              </span>
            </div>
            <Upload size={19} />
          </div>

          {summary ? (
            <div className="import-summary" role="status">
              <CheckCircle2 size={19} />
              <div>
                <strong>{summary.fileName}</strong>
                <span>
                  {summary.added.toLocaleString()} added ·{" "}
                  {summary.duplicates.toLocaleString()} duplicates merged ·{" "}
                  {summary.rejected.toLocaleString()} rejected
                </span>
                {summary.warnings.length ? (
                  <small>{summary.warnings.join(" | ")}</small>
                ) : null}
              </div>
            </div>
          ) : null}
          {error ? (
            <div className="import-error" role="alert">
              {error}
            </div>
          ) : null}
        </section>

        <section className="opportunity-section contacts-section">
          <div className="section-header">
            <div>
              <p className="eyebrow">Relationship inventory</p>
              <h3>
                {loading
                  ? "Loading contacts..."
                  : `${filteredContacts.length.toLocaleString()} contacts`}
              </h3>
            </div>
            <label className="search-box">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search people, companies, titles"
              />
            </label>
          </div>

          <div
            className="table-shell"
            role="region"
            aria-label="Imported contacts"
          >
            <table className="contacts-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Title</th>
                  <th>Email</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className={
                      contact.id === selectedContact?.id ? "selected-row" : ""
                    }
                    onClick={() => setSelectedId(contact.id)}
                  >
                    <td>
                      <strong>{contact.fullName || "Unnamed contact"}</strong>
                      <span>{contact.location || "No location"}</span>
                    </td>
                    <td>{contact.company || "-"}</td>
                    <td>{contact.title || "-"}</td>
                    <td>{contact.email || "-"}</td>
                    <td>{contact.tags || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && filteredContacts.length === 0 ? (
            <div className="empty-contacts">
              <UserRoundCheck size={24} />
              <strong>
                {contacts.length
                  ? "No contacts match this search"
                  : "Your contact inventory is empty"}
              </strong>
              <span>
                {contacts.length
                  ? "Try another name, company, title, or tag."
                  : "Import the contact list to create the first relationship inventory."}
              </span>
            </div>
          ) : null}
        </section>
      </section>

      <aside className="detail-panel" aria-label="Contact detail">
        {selectedContact ? (
          <ContactDetail
            contact={selectedContact}
            onSave={saveContact}
            onDelete={removeContact}
          />
        ) : (
          <section className="detail-card">
            <p className="eyebrow">Import Map</p>
            <h3>Recognized fields</h3>
            <div className="import-field-list">
              <span>Name</span>
              <strong>First, last, or full name</strong>
              <span>Reach</span>
              <strong>Email, phone, LinkedIn URL</strong>
              <span>Context</span>
              <strong>Company, title, location</strong>
              <span>Workflow</span>
              <strong>Tags and notes</strong>
            </div>
          </section>
        )}

        <section className="detail-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Data handling</p>
              <h3>Local for personal v1</h3>
            </div>
            <FileSpreadsheet size={18} />
          </div>
          <p className="detail-copy">
            Contacts are stored in IndexedDB in this browser. They are not
            uploaded to Vercel or a shared database in this version.
          </p>
          {contacts.length ? (
            <button
              className="danger-button"
              type="button"
              onClick={removeAllContacts}
            >
              <Trash2 size={16} />
              Delete all contacts
            </button>
          ) : null}
        </section>
      </aside>
    </>
  );
}
