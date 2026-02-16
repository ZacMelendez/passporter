import type { ImportEntryPayload, RawRow } from "../types/entries";

export function extractEmail(text: string | null | undefined): string | null {
    if (!text) return null;
    const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match ? match[0] : null;
}

export function normalizeRows(rows: RawRow[]): ImportEntryPayload[] {
    return rows
        .map((row) => {
            const getFirst = (keys: string[]): string | null => {
                for (const key of keys) {
                    const v = row[key];
                    if (v && v.trim()) return v.trim();
                }
                return null;
            };

            const url =
                getFirst([
                    "url",
                    "URL",
                    "origin",
                    "Origin",
                    "website",
                    "Website",
                    "site",
                    "Site",
                ]) ?? "";

            const name =
                getFirst(["name", "Name", "title", "Title", "site", "Site"]) ??
                null;

            const username =
                getFirst([
                    "username",
                    "Username",
                    "user",
                    "User",
                    "login",
                    "Login",
                ]) ?? null;

            const explicitEmail =
                getFirst(["email", "Email", "e-mail", "E-mail"]) ?? undefined;

            const sourceEmail =
                extractEmail(explicitEmail) ??
                extractEmail(username) ??
                extractEmail(name);

            return {
                name,
                url,
                username,
                sourceEmail,
            };
        })
        .filter((e) => e.url && e.url.trim().length > 0);
}
