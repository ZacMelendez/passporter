import {
    AppBar,
    Button,
    LinearProgress,
    Toolbar,
    Typography,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import PrivacyTipIcon from "@mui/icons-material/PrivacyTip";

export type AppHeaderProps = {
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onFileChange: React.ChangeEventHandler<HTMLInputElement>;
    onImportClick: () => void;
    isImporting: boolean;
    isFetching: boolean;
};

export function AppHeader({
    fileInputRef,
    onFileChange,
    onImportClick,
    isImporting,
    isFetching,
}: AppHeaderProps) {
    return (
        <AppBar
            position="fixed"
            sx={{
                zIndex: (theme) => theme.zIndex.drawer + 1,
                bgcolor: "background.paper",
            }}
        >
            <Toolbar>
                <PrivacyTipIcon sx={{ mr: 2, color: "primary.main" }} />
                <Typography
                    variant="h6"
                    sx={{ flexGrow: 1, fontWeight: 600 }}
                >
                    Passporter
                </Typography>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    style={{ display: "none" }}
                    onChange={onFileChange}
                />
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<CloudUploadIcon />}
                    onClick={onImportClick}
                    disabled={isImporting}
                    sx={{ mr: 1 }}
                >
                    {isImporting ? "Importing…" : "Import CSV"}
                </Button>
            </Toolbar>
            {isFetching && (
                <LinearProgress color="primary" sx={{ height: 2 }} />
            )}
        </AppBar>
    );
}
