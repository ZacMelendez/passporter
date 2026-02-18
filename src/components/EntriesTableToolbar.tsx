import {
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Stack,
    Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import RefreshIcon from "@mui/icons-material/Refresh";
import EmailIcon from "@mui/icons-material/Email";
import RuleIcon from "@mui/icons-material/Rule";
import React from "react";
import MoreVertIcon from "@mui/icons-material/MoreVert";

export type EntriesTableToolbarProps = {
    filteredCount: number;
    hideNoEmails: boolean;
    onHideNoEmailsChange: (checked: boolean) => void;
    onScrapeAll: () => void;
    onExport: () => void;
    onComposeMassEmail: () => void;
    onReviewMultipleEmails: () => void;
    hasPending: boolean;
    isScraping: boolean;
};

export function EntriesTableToolbar({
    filteredCount,
    onScrapeAll,
    onExport,
    onComposeMassEmail,
    onReviewMultipleEmails,
    hasPending,
    isScraping,
}: EntriesTableToolbarProps) {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = (action?: () => void) => {
        setAnchorEl(null);
        if (action) {
            action();
        }
    };
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
            <IconButton
                aria-label="more"
                id="long-button"
                aria-controls={open ? "long-menu" : undefined}
                aria-expanded={open ? "true" : undefined}
                aria-haspopup="true"
                onClick={handleClick}
            >
                <MoreVertIcon />
            </IconButton>
            <Menu
                anchorEl={anchorEl}
                id="account-menu"
                open={open}
                onClose={() => handleClose()}
                slotProps={{
                    paper: {
                        elevation: 0,
                        sx: {
                            overflow: "visible",
                            filter: "drop-shadow(0px 2px 8px rgba(0,0,0,0.32))",
                            mt: 1.5,
                            "& .MuiAvatar-root": {
                                width: 32,
                                height: 32,
                                ml: -0.5,
                                mr: 1,
                            },
                            "&::before": {
                                content: '""',
                                display: "block",
                                position: "absolute",
                                top: 0,
                                right: 14,
                                width: 10,
                                height: 10,
                                bgcolor: "background.paper",
                                transform: "translateY(-50%) rotate(45deg)",
                                zIndex: 0,
                            },
                        },
                    },
                }}
                transformOrigin={{ horizontal: "right", vertical: "top" }}
                anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            >
                <MenuItem
                    onClick={() => handleClose(onScrapeAll)}
                    disabled={!hasPending || isScraping}
                >
                    <ListItemIcon>
                        <RefreshIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        {isScraping ? "Scraping…" : "Scrape All Pending"}
                    </ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleClose(onReviewMultipleEmails)}>
                    <ListItemIcon>
                        <RuleIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Review multiple emails</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleClose(onComposeMassEmail)}>
                    <ListItemIcon>
                        <EmailIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Compose mass email</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleClose(onExport)}>
                    <ListItemIcon>
                        <DownloadIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Export Emails</ListItemText>
                </MenuItem>
            </Menu>
        </Stack>
    );
}
