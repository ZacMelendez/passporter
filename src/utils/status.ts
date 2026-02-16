import type { Entry } from "../types/entries";

export function statusLabel(status: Entry["status"]): string {
    switch (status) {
        case "pending":
            return "Pending";
        case "in_progress":
            return "Scraping…";
        case "done":
            return "Done";
        case "no_results":
            return "No email found";
        case "error":
            return "Error";
        default:
            return status;
    }
}
