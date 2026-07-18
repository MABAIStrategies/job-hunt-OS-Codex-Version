import Papa from "papaparse";

export type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  linkedinUrl: string;
  location: string;
  tags: string;
  notes: string;
  sourceFile: string;
  createdAt: string;
  updatedAt: string;
};

export type ContactImportResult = {
  contacts: Contact[];
  rejectedRows: number;
  rejectedReasons: string[];
  parseWarnings: string[];
};

export type ContactMergeResult = {
  contacts: Contact[];
  addedRecords: number;
  duplicateRecords: number;
};

const DATABASE_NAME = "mab-job-hunt-os";
const DATABASE_VERSION = 1;
const CONTACT_STORE = "contacts";

const headerAliases = {
  firstName: ["firstname", "first", "givenname"],
  lastName: ["lastname", "last", "surname", "familyname"],
  fullName: ["fullname", "name", "contactname", "person"],
  email: [
    "email",
    "emailaddress",
    "workemail",
    "businessemail",
    "primaryemail",
  ],
  phone: [
    "phone",
    "phonenumber",
    "mobile",
    "mobilephone",
    "telephone",
    "workphone",
  ],
  company: [
    "company",
    "companyname",
    "organization",
    "organisation",
    "employer",
    "accountname",
  ],
  title: ["title", "jobtitle", "position", "role", "headline"],
  linkedinUrl: ["linkedin", "linkedinurl", "linkedinprofile", "profileurl"],
  location: ["location", "city", "citystate", "geography", "region"],
  tags: ["tags", "tag", "labels", "segments", "lists"],
  notes: ["notes", "note", "description", "comments"],
} as const;

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function cleanValue(value: unknown) {
  return String(value ?? "").trim();
}

function createContactId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `contact-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizedRow(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      normalizeHeader(key),
      cleanValue(value),
    ]),
  );
}

function readAlias(row: Record<string, string>, aliases: readonly string[]) {
  for (const alias of aliases) {
    const value = row[alias];
    if (value) {
      return value;
    }
  }
  return "";
}

function splitFullName(fullName: string) {
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return { firstName: parts[0] ?? "", lastName: "" };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function mapRow(
  row: Record<string, unknown>,
  sourceFile: string,
): Contact | null {
  const normalized = normalizedRow(row);
  const importedFullName = readAlias(normalized, headerAliases.fullName);
  const splitName = splitFullName(importedFullName);
  const firstName =
    readAlias(normalized, headerAliases.firstName) || splitName.firstName;
  const lastName =
    readAlias(normalized, headerAliases.lastName) || splitName.lastName;
  const fullName =
    importedFullName || [firstName, lastName].filter(Boolean).join(" ");
  const email = readAlias(normalized, headerAliases.email).toLowerCase();
  const linkedinUrl = readAlias(normalized, headerAliases.linkedinUrl);

  if (!fullName && !email && !linkedinUrl) {
    return null;
  }

  const now = new Date().toISOString();
  return {
    id: createContactId(),
    firstName,
    lastName,
    fullName,
    email,
    phone: readAlias(normalized, headerAliases.phone),
    company: readAlias(normalized, headerAliases.company),
    title: readAlias(normalized, headerAliases.title),
    linkedinUrl,
    location: readAlias(normalized, headerAliases.location),
    tags: readAlias(normalized, headerAliases.tags),
    notes: readAlias(normalized, headerAliases.notes),
    sourceFile,
    createdAt: now,
    updatedAt: now,
  };
}

export function parseContactsFile(file: File): Promise<ContactImportResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      worker: true,
      complete: (results) => {
        const contacts: Contact[] = [];
        const rejectedReasons: string[] = [];

        results.data.forEach((row, index) => {
          const contact = mapRow(row, file.name);
          if (contact) {
            contacts.push(contact);
          } else {
            rejectedReasons.push(
              `Row ${index + 2}: no name, email, or LinkedIn URL`,
            );
          }
        });

        resolve({
          contacts,
          rejectedRows: rejectedReasons.length,
          rejectedReasons: rejectedReasons.slice(0, 10),
          parseWarnings: results.errors
            .slice(0, 10)
            .map((error) => `Row ${error.row ?? "?"}: ${error.message}`),
        });
      },
      error: (error) => reject(error),
    });
  });
}

function normalizeLinkedIn(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[?#].*$/, "")
    .replace(/\/$/, "");
}

function dedupeKeys(contact: Contact) {
  const keys = [];
  if (contact.email) {
    keys.push(`email:${contact.email.trim().toLowerCase()}`);
  }
  if (contact.linkedinUrl) {
    keys.push(`linkedin:${normalizeLinkedIn(contact.linkedinUrl)}`);
  }
  if (contact.fullName && contact.company) {
    keys.push(
      `person:${contact.fullName.trim().toLowerCase()}|${contact.company.trim().toLowerCase()}`,
    );
  }
  return keys;
}

function mergePreferExisting(existing: Contact, incoming: Contact): Contact {
  const merged = { ...incoming, ...existing };
  for (const key of Object.keys(incoming) as Array<keyof Contact>) {
    if (!cleanValue(existing[key]) && cleanValue(incoming[key])) {
      merged[key] = incoming[key];
    }
  }
  merged.updatedAt = new Date().toISOString();
  return merged;
}

export function mergeContacts(
  existing: Contact[],
  incoming: Contact[],
): ContactMergeResult {
  const contacts = [...existing];
  const keyToIndex = new Map<string, number>();
  contacts.forEach((contact, index) =>
    dedupeKeys(contact).forEach((key) => keyToIndex.set(key, index)),
  );

  let addedRecords = 0;
  let duplicateRecords = 0;

  for (const contact of incoming) {
    const matchIndex = dedupeKeys(contact)
      .map((key) => keyToIndex.get(key))
      .find((index): index is number => index !== undefined);

    if (matchIndex !== undefined) {
      duplicateRecords += 1;
      contacts[matchIndex] = mergePreferExisting(contacts[matchIndex], contact);
      dedupeKeys(contacts[matchIndex]).forEach((key) =>
        keyToIndex.set(key, matchIndex),
      );
      continue;
    }

    const nextIndex = contacts.length;
    contacts.push(contact);
    dedupeKeys(contact).forEach((key) => keyToIndex.set(key, nextIndex));
    addedRecords += 1;
  }

  return {
    contacts: contacts.sort((a, b) =>
      (a.fullName || a.email).localeCompare(b.fullName || b.email),
    ),
    addedRecords,
    duplicateRecords,
  };
}

function openContactsDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CONTACT_STORE)) {
        database.createObjectStore(CONTACT_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ?? new Error("Unable to open the contact database."),
      );
  });
}

export async function getContacts() {
  const database = await openContactsDatabase();
  return new Promise<Contact[]>((resolve, reject) => {
    const transaction = database.transaction(CONTACT_STORE, "readonly");
    const request = transaction.objectStore(CONTACT_STORE).getAll();
    request.onsuccess = () => resolve(request.result as Contact[]);
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to load contacts."));
    transaction.oncomplete = () => database.close();
  });
}

export async function putContacts(contacts: Contact[]) {
  if (contacts.length === 0) {
    return;
  }
  const database = await openContactsDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(CONTACT_STORE, "readwrite");
    const store = transaction.objectStore(CONTACT_STORE);
    contacts.forEach((contact) => store.put(contact));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Unable to save contacts."));
  });
  database.close();
}

export async function deleteContact(id: string) {
  const database = await openContactsDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(CONTACT_STORE, "readwrite");
    transaction.objectStore(CONTACT_STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Unable to delete the contact."));
  });
  database.close();
}

export async function clearContacts() {
  const database = await openContactsDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(CONTACT_STORE, "readwrite");
    transaction.objectStore(CONTACT_STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Unable to clear contacts."));
  });
  database.close();
}

export function contactsToCsv(contacts: Contact[]) {
  return Papa.unparse(
    contacts.map(
      ({ id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...contact }) =>
        contact,
    ),
    { quotes: true },
  );
}
