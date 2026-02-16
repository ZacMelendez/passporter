export type EntryStatus =
    | "pending"
    | "in_progress"
    | "done"
    | "error"
    | "no_results";

export type Entry = {
    id: number;
    siteName: string | null;
    url: string;
    username: string | null;
    sourceEmail: string | null;
    scrapedEmails: string[];
    privacyUrl: string | null;
    status: EntryStatus | string;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
};

export type ImportEntryPayload = {
    name?: string | null;
    url?: string | null;
    username?: string | null;
    sourceEmail?: string | null;
};

export type ImportResponse = {
    imported: number;
    duplicates: number;
    invalid: number;
    total: number;
};

export type RawRow = Record<string, string>;

export type ScrapeProgress = {
    total: number;
    pending: number;
    inProgress: number;
    done: number;
    error: number;
    noResults: number;
};
