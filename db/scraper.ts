import * as cheerio from "cheerio";
import { URL } from "node:url";

export type ScrapeResult = {
    privacyUrl: string | null;
    emails: string[];
};

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** File extensions that indicate a match is a filename (e.g. icon@3x.png), not an email */
const ASSET_EXTENSIONS = new Set([
    "png",
    "jpg",
    "jpeg",
    "gif",
    "svg",
    "webp",
    "ico",
    "bmp",
    "tiff",
    "avif",
    "pdf",
    "woff",
    "woff2",
    "ttf",
    "eot",
    "otf",
    "mp4",
    "webm",
    "mp3",
    "wav",
]);

function isLikelyEmail(s: string): boolean {
    const trimmed = s.trim().toLowerCase();
    if (!trimmed.includes("@")) return false;
    const afterAt = trimmed.split("@")[1] ?? "";
    const lastPart = afterAt.split(".").pop() ?? "";
    return !ASSET_EXTENSIONS.has(lastPart);
}

function normalizeOrigin(rawUrl: string): string {
    try {
        const u = new URL(rawUrl);
        return u.origin;
    } catch {
        return rawUrl;
    }
}

const SCRAPE_TIMEOUT_MS = 30_000;

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
    const res = await fetch(url, {
        redirect: "follow",
        signal,
        headers: {
            "User-Agent":
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36 passporter-local-tool",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    });

    if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
    }

    return await res.text();
}

/** e.g. https://us.workforcelogiq.com -> https://workforcelogiq.com */
function getMainDomainOrigin(origin: string): string | null {
    try {
        const u = new URL(origin);
        const labels = u.hostname.split(".");
        if (labels.length <= 2) return null;
        const mainHost = labels.slice(1).join(".");
        return `${u.protocol}//${mainHost}`;
    } catch {
        return null;
    }
}

function originHasSubdomain(origin: string): boolean {
    try {
        return new URL(origin).hostname.split(".").length > 2;
    } catch {
        return false;
    }
}

function resolveLink(origin: string, href: string): string | null {
    try {
        return new URL(href, origin).toString();
    } catch {
        return null;
    }
}

function collectEmailsFromHtml(html: string, emails: Set<string>): void {
    const $ = cheerio.load(html);

    // mailto: links
    $('a[href^="mailto:"]').each((_i, el) => {
        const href = $(el).attr("href");
        if (!href) return;
        const email =
            href
                .replace(/^mailto:/i, "")
                .split("?")[0]
                ?.trim() ?? "";
        if (!email || !isLikelyEmail(email)) return;
        emails.add(email);
    });

    // plain text emails (exclude filenames like icon@3x.png)
    const text = $.text();
    const matches = text.match(EMAIL_REGEX);
    if (matches) {
        for (const m of matches) {
            if (isLikelyEmail(m)) emails.add(m);
        }
    }
}

function findPrivacyLink(html: string, origin: string): string | undefined {
    const $ = cheerio.load(html);
    let found: string | undefined;

    $("a[href]").each((_i, el) => {
        if (found) return;

        const href = $(el).attr("href") ?? "";
        const text = $(el).text().toLowerCase();
        const hrefLower = href.toLowerCase();

        if (text.includes("privacy") || hrefLower.includes("privacy")) {
            const resolved = resolveLink(origin, href);
            if (resolved) {
                found = resolved;
            }
        }
    });

    return found;
}

function buildPrivacyCandidates(origin: string): string[] {
    const suffixes = [
        "/privacy",
        "/privacy-policy",
        "/privacy_policy",
        "/legal/privacy",
        "/policies/privacy",
    ];

    return suffixes.map((s) => origin.replace(/\/+$/, "") + s);
}

async function scrapeOrigin(
    origin: string,
    signal?: AbortSignal,
): Promise<ScrapeResult> {
    const emails = new Set<string>();

    let homepageHtml: string | null = null;
    try {
        homepageHtml = await fetchText(origin, signal);
    } catch {
        // ignore, we'll still try common privacy URLs
    }

    let privacyUrl: string | null = null;

    if (homepageHtml) {
        privacyUrl = findPrivacyLink(homepageHtml, origin) ?? null;
        collectEmailsFromHtml(homepageHtml, emails);
    }

    if (!privacyUrl) {
        const candidates = buildPrivacyCandidates(origin);
        for (const candidate of candidates) {
            try {
                const html = await fetchText(candidate, signal);
                privacyUrl = candidate;
                collectEmailsFromHtml(html, emails);
                break;
            } catch {
                // try next
            }
        }
    } else {
        try {
            const html = await fetchText(privacyUrl, signal);
            collectEmailsFromHtml(html, emails);
        } catch {
            // ignore, we still have any emails we collected so far
        }
    }

    return {
        privacyUrl,
        emails: Array.from(emails),
    };
}

export async function findPrivacyPolicyAndEmails(
    rawUrl: string,
): Promise<ScrapeResult> {
    const origin = normalizeOrigin(rawUrl);

    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), SCRAPE_TIMEOUT_MS);

    let result: ScrapeResult;
    try {
        result = await scrapeOrigin(origin, ac.signal);
    } catch {
        result = { privacyUrl: null, emails: [] };
    } finally {
        clearTimeout(timeoutId);
    }

    const shouldTryMainDomain =
        !result.privacyUrl &&
        result.emails.length === 0 &&
        originHasSubdomain(origin);

    if (shouldTryMainDomain) {
        const mainOrigin = getMainDomainOrigin(origin);
        if (mainOrigin) {
            try {
                const mainResult = await scrapeOrigin(mainOrigin);
                return {
                    privacyUrl: mainResult.privacyUrl ?? result.privacyUrl,
                    emails: [
                        ...new Set([...result.emails, ...mainResult.emails]),
                    ],
                };
            } catch {
                // keep first attempt result
            }
        }
    }

    return result;
}
