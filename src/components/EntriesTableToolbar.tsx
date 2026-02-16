import { Button, Stack, Typography } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import RefreshIcon from "@mui/icons-material/Refresh";

export type EntriesTableToolbarProps = {
    filteredCount: number;
    hideNoEmails: boolean;
    onHideNoEmailsChange: (checked: boolean) => void;
    onScrapeAll: () => void;
    onExport: () => void;
    hasPending: boolean;
    isScraping: boolean;
};

export function EntriesTableToolbar({
    filteredCount,
    onScrapeAll,
    onExport,
    hasPending,
    isScraping,
}: EntriesTableToolbarProps) {
    return (
        <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            mx={2}
            alignItems={{
                xs: "flex-start",
                sm: "center",
            }}
            justifyContent="space-between"
        >
            <Typography variant="h6" fontWeight={600}>
                Discovered Sites ({filteredCount})
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
                <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={onScrapeAll}
                    disabled={!hasPending || isScraping}
                >
                    {isScraping ? "Scraping…" : "Scrape All Pending"}
                </Button>
                <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<DownloadIcon />}
                    onClick={onExport}
                >
                    Export Emails
                </Button>
            </Stack>
        </Stack>
    );
}
