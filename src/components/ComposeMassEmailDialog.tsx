import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
    Typography,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { useMemo, useState } from "react";
import type { Entry } from "../types/entries";

const DEFAULT_SUBJECT = "Request to remove my email from your databases";
const DEFAULT_BODY_TEMPLATE =
    "I would like to remove the e-mail ${email} from your databases. Please do so, or if you need any more info from me, please reach back out.";

function collectBccEmails(entries: Entry[]): string[] {
    const set = new Set<string>();
    for (const entry of entries) {
        for (const e of entry.scrapedEmails ?? []) {
            const trimmed = e.trim();
            if (trimmed && trimmed.includes("@")) set.add(trimmed);
        }
    }
    return Array.from(set);
}

export type ComposeMassEmailDialogProps = {
    open: boolean;
    onClose: () => void;
    entries: Entry[];
};

export function ComposeMassEmailDialog({
    open,
    onClose,
    entries,
}: ComposeMassEmailDialogProps) {
    const [userEmail, setUserEmail] = useState("");
    const [subject, setSubject] = useState(DEFAULT_SUBJECT);
    const [bodyTemplate, setBodyTemplate] = useState(DEFAULT_BODY_TEMPLATE);

    const bccEmails = useMemo(() => collectBccEmails(entries), [entries]);
    const body = useMemo(
        () => bodyTemplate.replace(/\$\{email\}/g, userEmail.trim() || "${email}"),
        [bodyTemplate, userEmail],
    );

    const mailtoUrl = useMemo(() => {
        if (bccEmails.length === 0) return null;
        const params = new URLSearchParams();
        params.set("bcc", bccEmails.join(","));
        params.set("subject", subject);
        params.set("body", body);
        return `mailto:?${params.toString()}`;
    }, [bccEmails, subject, body]);

    const handleOpenInMail = () => {
        if (mailtoUrl) {
            window.location.href = mailtoUrl;
            onClose();
        }
    };

    const handleExportTxt = () => {
        const lines = [
            "Subject:",
            subject,
            "",
            "Body:",
            body,
            "",
            "BCC (comma-separated):",
            bccEmails.join(", "),
            "",
            "BCC (one per line):",
            ...bccEmails,
        ];
        const content = lines.join("\n");
        const blob = new Blob([content], { type: "text/plain; charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "mass-email-bcc.txt";
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Compose mass email (BCC)</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    All company addresses will be in BCC so each recipient gets the
                    same message without seeing others.
                </Typography>
                <TextField
                    label="Your email (to request removal)"
                    placeholder="you@example.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    fullWidth
                    type="email"
                    sx={{ mb: 2 }}
                />
                <TextField
                    label="Subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    fullWidth
                    sx={{ mb: 2 }}
                />
                <TextField
                    label="Message body"
                    value={bodyTemplate}
                    onChange={(e) => setBodyTemplate(e.target.value)}
                    fullWidth
                    multiline
                    minRows={3}
                    placeholder="Use ${email} where your email should appear."
                    helperText="Use ${email} in the text to insert your email."
                    sx={{ mb: 2 }}
                />
                <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        Recipients (BCC): {bccEmails.length} address
                        {bccEmails.length !== 1 ? "es" : ""} from {entries.length}{" "}
                        entr{entries.length === 1 ? "y" : "ies"}
                    </Typography>
                    {bccEmails.length === 0 && (
                        <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
                            No scraped emails in the selected entries. Scrape privacy
                            pages first or add entries with contact emails.
                        </Typography>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant="outlined"
                    startIcon={<FileDownloadIcon />}
                    onClick={handleExportTxt}
                    disabled={bccEmails.length === 0}
                >
                    Export as .txt
                </Button>
                <Button
                    variant="contained"
                    startIcon={<EmailIcon />}
                    onClick={handleOpenInMail}
                    disabled={bccEmails.length === 0}
                >
                    Open in mail client
                </Button>
            </DialogActions>
        </Dialog>
    );
}
