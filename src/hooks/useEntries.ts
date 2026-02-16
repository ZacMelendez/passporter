import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { useMemo, useState, useEffect } from "react";
import {
    fetchEntries,
    importEntries,
    scrapeOne,
    scrapeBatch,
    getScrapeProgress,
    deleteEntries,
} from "../api/entries";
import type { Entry, ScrapeProgress } from "../types/entries";

const ENTRIES_QUERY_KEY = ["entries"];

export function useEntriesQuery() {
    return useQuery({
        queryKey: ENTRIES_QUERY_KEY,
        queryFn: fetchEntries,
    });
}

export function useImportMutation() {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();

    return useMutation({
        mutationFn: importEntries,
        onSuccess: (importSummary) => {
            queryClient.invalidateQueries({ queryKey: ENTRIES_QUERY_KEY });
            enqueueSnackbar(
                `✓ Import completed: ${importSummary.imported} new entries imported from ${importSummary.total} total entries.`,
                { variant: "success" },
            );
        },
        onError: (error: unknown) => {
            enqueueSnackbar(
                `Failed to import CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
                { variant: "error" },
            );
        },
    });
}

export function useScrapeOneMutation() {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();

    return useMutation({
        mutationFn: scrapeOne,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ENTRIES_QUERY_KEY });
            enqueueSnackbar("✓ Scrape completed.", { variant: "success" });
        },
    });
}

export function useDeleteEntriesMutation() {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();

    return useMutation({
        mutationFn: deleteEntries,
        onSuccess: ({ deleted }) => {
            queryClient.invalidateQueries({ queryKey: ENTRIES_QUERY_KEY });
            enqueueSnackbar(
                deleted === 1
                    ? "✓ Entry deleted."
                    : `✓ ${deleted} entries deleted.`,
                { variant: "success" },
            );
        },
        onError: (error: unknown) => {
            enqueueSnackbar(
                `Failed to delete: ${error instanceof Error ? error.message : "Unknown error"}`,
                { variant: "error" },
            );
        },
    });
}

export function useScrapeBatch() {
    const queryClient = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    const [isScrapingBatch, setIsScrapingBatch] = useState(false);
    const [scrapeProgress, setScrapeProgress] = useState<ScrapeProgress | null>(
        null,
    );

    const scrapeBatchMutation = useMutation({
        mutationFn: scrapeBatch,
        onSuccess: ({ started, totalCandidates }) => {
            setIsScrapingBatch(true);
            queryClient.invalidateQueries({ queryKey: ENTRIES_QUERY_KEY });
            enqueueSnackbar(
                `✓ Scrape completed. ${started} new entries scraped from ${totalCandidates} total entries.`,
                { variant: "success" },
            );
        },
    });

    useEffect(() => {
        if (!isScrapingBatch) return;

        const interval = setInterval(async () => {
            try {
                const progress = await getScrapeProgress();
                setScrapeProgress(progress);

                if (progress.pending === 0 && progress.inProgress === 0) {
                    setIsScrapingBatch(false);
                    queryClient.invalidateQueries({ queryKey: ENTRIES_QUERY_KEY });
                } else {
                    queryClient.invalidateQueries({ queryKey: ENTRIES_QUERY_KEY });
                }
            } catch (error) {
                console.error("Failed to fetch scrape progress:", error);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isScrapingBatch, queryClient]);

    return {
        scrapeBatchMutation,
        isScrapingBatch,
        scrapeProgress,
    };
}

export function useEntriesStats(entries: Entry[] | undefined) {
    return useMemo(() => {
        const list = entries ?? [];
        return {
            total: list.length,
            pending: list.filter(
                (e) => e.status === "pending" || e.status === "error",
            ).length,
            completed: list.filter((e) => e.status === "done").length,
            emailsFound: list.reduce((acc, e) => acc + e.scrapedEmails.length, 0),
        };
    }, [entries]);
}

export function useFilteredEntries(
    entries: Entry[] | undefined,
    hideNoEmails: boolean,
) {
    return useMemo(() => {
        let list = entries ?? [];
        if (hideNoEmails) {
            list = list.filter(
                (e) =>
                    (e.scrapedEmails && e.scrapedEmails.length > 0) ||
                    e.sourceEmail ||
                    e.privacyUrl,
            );
        }
        return list;
    }, [entries, hideNoEmails]);
}
