import axios from "axios";
import type {
    Entry,
    ImportEntryPayload,
    ImportResponse,
    ScrapeProgress,
} from "../types/entries";

export const API_BASE =
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

export async function fetchEntries(): Promise<Entry[]> {
    const res = await axios.get<Entry[]>(`${API_BASE}/entries`);
    return res.data;
}

export async function importEntries(
    entries: ImportEntryPayload[],
): Promise<ImportResponse> {
    const res = await axios.post<ImportResponse>(`${API_BASE}/import`, {
        entries,
    });
    return res.data;
}

export async function scrapeOne(id: number): Promise<Entry> {
    const res = await axios.post<Entry>(`${API_BASE}/entries/${id}/scrape`);
    return res.data;
}

export async function scrapeBatch(): Promise<{
    started: number;
    totalCandidates: number;
}> {
    const res = await axios.post<{ started: number; totalCandidates: number }>(
        `${API_BASE}/entries/scrape-batch`,
    );
    return res.data;
}

export async function getScrapeProgress(): Promise<ScrapeProgress> {
    const res = await axios.get<ScrapeProgress>(
        `${API_BASE}/entries/scrape-progress`,
    );
    return res.data;
}

export async function updateEntry(
    id: number,
    data: {
        privacyUrl?: string | null;
        scrapedEmails?: string[];
        siteName?: string | null;
    },
): Promise<Entry> {
    const res = await axios.patch<Entry>(`${API_BASE}/entries/${id}`, data);
    return res.data;
}

export async function deleteEntries(ids: number[]): Promise<{ deleted: number }> {
    if (ids.length === 0) return { deleted: 0 };
    if (ids.length === 1) {
        await axios.delete(`${API_BASE}/entries/${ids[0]}`);
        return { deleted: 1 };
    }
    const res = await axios.post<{ deleted: number }>(
        `${API_BASE}/entries/delete-batch`,
        { ids },
    );
    return res.data;
}
