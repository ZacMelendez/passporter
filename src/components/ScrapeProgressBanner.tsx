import {
    Box,
    CircularProgress,
    Grid,
    LinearProgress,
    Stack,
    Typography,
} from "@mui/material";
import type { ScrapeProgress } from "../types/entries";

export type ScrapeProgressBannerProps = {
    scrapeProgress: ScrapeProgress | null;
};

export function ScrapeProgressBanner({
    scrapeProgress,
}: ScrapeProgressBannerProps) {
    if (!scrapeProgress) return null;

    const completedCount =
        scrapeProgress.done + scrapeProgress.error + scrapeProgress.noResults;
    const progressPercent =
        scrapeProgress.total > 0
            ? (completedCount / scrapeProgress.total) * 100
            : 0;

    return (
        <Box sx={{ m: 3 }}>
            <Box sx={{ mb: 2 }}>
                <Stack
                    direction="row"
                    alignItems="center"
                    spacing={2}
                    sx={{ mb: 1 }}
                >
                    <CircularProgress size={20} />
                    <Typography variant="h6" fontWeight={600}>
                        Scraping in progress...
                    </Typography>
                </Stack>
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                >
                    Processing up to 25 sites concurrently
                </Typography>
                <Box sx={{ mb: 2 }}>
                    <LinearProgress
                        variant="determinate"
                        value={progressPercent}
                        sx={{
                            height: 8,
                            borderRadius: 1,
                        }}
                    />
                </Box>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
                        <Box>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                            >
                                In Progress
                            </Typography>
                            <Typography variant="h6" color="warning.main">
                                {scrapeProgress.inProgress}
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
                        <Box>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                            >
                                Completed
                            </Typography>
                            <Typography variant="h6" color="success.main">
                                {scrapeProgress.done}
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
                        <Box>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                            >
                                Failed
                            </Typography>
                            <Typography variant="h6" color="error.main">
                                {scrapeProgress.error}
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
                        <Box>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                            >
                                No Results
                            </Typography>
                            <Typography variant="h6" color="warning.main">
                                {scrapeProgress.noResults}
                            </Typography>
                        </Box>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
                        <Box>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                            >
                                Remaining
                            </Typography>
                            <Typography variant="h6">
                                {scrapeProgress.pending}
                            </Typography>
                        </Box>
                    </Grid>
                </Grid>
            </Box>
        </Box>
    );
}
