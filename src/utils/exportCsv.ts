import type { Entry } from "../types/entries";

export function entriesToExportCsv(entries: Entry[]): string {
    const header = "url,site_name,email,source\n";
    const out: string[] = [];
    for (const row of entries) {
        const siteName = row.siteName ?? "";
        const url = row.url;
        if (row.sourceEmail) {
            out.push(
                [
                    JSON.stringify(url),
                    JSON.stringify(siteName),
                    JSON.stringify(row.sourceEmail),
                    JSON.stringify("from_passwords"),
                ].join(","),
            );
        }
        for (const email of row.scrapedEmails ?? []) {
            out.push(
                [
                    JSON.stringify(url),
                    JSON.stringify(siteName),
                    JSON.stringify(email),
                    JSON.stringify("from_privacy_policy"),
                ].join(","),
            );
        }
    }
    return header + out.join("\n");
}
