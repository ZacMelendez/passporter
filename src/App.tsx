import { Box } from "@mui/material";
import { useRef, useState } from "react";
import type { EntriesDataGridHandle } from "./components/EntriesDataGrid";
import Papa from "papaparse";
import "./App.css";
import { useSnackbar } from "notistack";

import { updateEntry } from "./api/entries";
import type { Entry, RawRow } from "./types/entries";
import { normalizeRows } from "./utils/csv";
import { useQueryClient } from "@tanstack/react-query";
import {
    useEntriesQuery,
    useImportMutation,
    useScrapeOneMutation,
    useScrapeBatch,
    useEntriesStats,
    useFilteredEntries,
    useDeleteEntriesMutation,
} from "./hooks/useEntries";
import { AppHeader } from "./components/AppHeader";
import { ScrapeProgressBanner } from "./components/ScrapeProgressBanner";
import { EntriesTableToolbar } from "./components/EntriesTableToolbar";
import { EntriesEmptyState } from "./components/EntriesEmptyState";
import { EntriesDataGrid } from "./components/EntriesDataGrid";
import { entriesToExportCsv } from "./utils/exportCsv";

function App() {
    const { enqueueSnackbar } = useSnackbar();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const gridRef = useRef<EntriesDataGridHandle | null>(null);
    const [hideNoEmails, setHideNoEmails] = useState(false);

    const entriesQuery = useEntriesQuery();
    const importMutation = useImportMutation();
    const scrapeOneMutation = useScrapeOneMutation();
    const deleteEntriesMutation = useDeleteEntriesMutation();
    const { scrapeBatchMutation, isScrapingBatch, scrapeProgress } =
        useScrapeBatch();

    const stats = useEntriesStats(entriesQuery.data);
    const filteredEntries = useFilteredEntries(entriesQuery.data, hideNoEmails);
    const hasPending = stats.pending > 0;

    const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (
        event,
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        Papa.parse<RawRow>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rows = results.data ?? [];
                const normalized = normalizeRows(rows);
                if (normalized.length === 0) return;
                importMutation.mutate(normalized);
            },
            error: (error) => {
                enqueueSnackbar(error.message, { variant: "error" });
            },
        });
    };

    const handleChooseFile = () => {
        fileInputRef.current?.click();
    };

    const handleExport = () => {
        const entries =
            gridRef.current?.getFilteredEntries() ?? filteredEntries;
        const csv = entriesToExportCsv(entries);
        const blob = new Blob([csv], {
            type: "text/csv; charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "privacy-emails.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleProcessRowUpdate = async (newRow: Entry) => {
        const updateData: Parameters<typeof updateEntry>[1] = {};
        if (newRow.privacyUrl !== undefined) {
            updateData.privacyUrl = newRow.privacyUrl;
        }
        if (newRow.scrapedEmails !== undefined) {
            updateData.scrapedEmails = newRow.scrapedEmails;
        }
        if (newRow.siteName !== undefined) {
            updateData.siteName = newRow.siteName;
        }
        const updated = await updateEntry(newRow.id, updateData);
        queryClient.invalidateQueries({ queryKey: ["entries"] });
        return updated;
    };

    const showScrapeBanner =
        (isScrapingBatch || scrapeProgress) && scrapeProgress;

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                height: "100vh",
                overflow: "hidden",
                bgcolor: "background.default",
            }}
        >
            <AppHeader
                fileInputRef={fileInputRef}
                onFileChange={handleFileChange}
                onImportClick={handleChooseFile}
                isImporting={importMutation.isPending}
                isFetching={entriesQuery.isFetching}
            />

            <Box
                component="main"
                sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                    overflow: "hidden",
                    pt: 10,
                }}
            >
                {showScrapeBanner && (
                    <ScrapeProgressBanner scrapeProgress={scrapeProgress} />
                )}

                <Box
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        mb: 3,
                    }}
                >
                    <Box sx={{ flexShrink: 0, px: 2, pb: 2 }}>
                        <EntriesTableToolbar
                            filteredCount={filteredEntries.length}
                            hideNoEmails={hideNoEmails}
                            onHideNoEmailsChange={setHideNoEmails}
                            onScrapeAll={() => scrapeBatchMutation.mutate()}
                            onExport={handleExport}
                            hasPending={hasPending}
                            isScraping={
                                scrapeBatchMutation.isPending || isScrapingBatch
                            }
                        />
                    </Box>
                    {filteredEntries.length === 0 ? (
                        <EntriesEmptyState
                            hideNoEmails={hideNoEmails}
                            hasAnyEntries={(entriesQuery.data?.length ?? 0) > 0}
                        />
                    ) : (
                        <Box
                            sx={{
                                flex: 1,
                                minHeight: 0,
                                display: "flex",
                                flexDirection: "column",
                            }}
                        >
                            <EntriesDataGrid
                                ref={gridRef}
                                rows={filteredEntries}
                                onProcessRowUpdate={handleProcessRowUpdate}
                                onScrapeOne={(id) =>
                                    scrapeOneMutation.mutate(id)
                                }
                                isScrapeOnePending={scrapeOneMutation.isPending}
                                scrapeOneVariableId={
                                    scrapeOneMutation.variables
                                }
                                onDeleteSelected={(ids) =>
                                    deleteEntriesMutation.mutate(ids)
                                }
                                isDeletePending={
                                    deleteEntriesMutation.isPending
                                }
                            />
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
}

export default App;
