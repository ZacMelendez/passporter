import { Box, Typography } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

export type EntriesEmptyStateProps = {
    hideNoEmails: boolean;
    hasAnyEntries: boolean;
};

export function EntriesEmptyState({
    hideNoEmails,
    hasAnyEntries,
}: EntriesEmptyStateProps) {
    const isFilteredEmpty = hideNoEmails && hasAnyEntries;

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "text.secondary",
            }}
        >
            <CloudUploadIcon
                sx={{
                    fontSize: 64,
                    mb: 2,
                    opacity: 0.5,
                }}
            />
            <Typography variant="h6" gutterBottom>
                {isFilteredEmpty
                    ? "No entries with emails or links"
                    : "No entries yet"}
            </Typography>
            <Typography variant="body2">
                {hideNoEmails
                    ? "Try unchecking the filter or import a password CSV."
                    : "Import a password CSV to begin discovering privacy contact emails."}
            </Typography>
        </Box>
    );
}
