import {
    Box,
    Button,
    Checkbox,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    FormGroup,
    Link,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveIcon from "@mui/icons-material/Save";
import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { deleteEntries, updateEntry } from "../api/entries";
import type { Entry } from "../types/entries";

const ENTRY_CARD_ESTIMATE_HEIGHT = 320;

export type ReviewMultipleEmailsDialogProps = {
    open: boolean;
    onClose: () => void;
    entries: Entry[];
    onSaved?: () => void;
};

function getEntryDisplayName(entry: Entry): string {
    return entry.siteName ?? entry.url ?? `Entry ${entry.id}`;
}

export function ReviewMultipleEmailsDialog({
    open,
    onClose,
    entries,
    onSaved,
}: ReviewMultipleEmailsDialogProps) {
    const [selections, setSelections] = useState<Record<number, string[]>>({});
    const [customEmails, setCustomEmails] = useState<Record<number, string[]>>(
        {},
    );
    const [customInputs, setCustomInputs] = useState<Record<number, string>>(
        {},
    );
    const [savedEntryIds, setSavedEntryIds] = useState<Set<number>>(new Set());
    const [deletedEntryIds, setDeletedEntryIds] = useState<Set<number>>(
        new Set(),
    );
    const [savingAll, setSavingAll] = useState(false);
    const [savingEntryId, setSavingEntryId] = useState<number | null>(null);
    const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const entriesWithMultiple = useMemo(
        () =>
            entries.filter(
                (e) => (e.scrapedEmails?.length ?? 0) > 1,
            ) as Entry[],
        [entries],
    );

    const visibleEntries = useMemo(
        () =>
            entriesWithMultiple.filter(
                (e) => !savedEntryIds.has(e.id) && !deletedEntryIds.has(e.id),
            ),
        [entriesWithMultiple, savedEntryIds, deletedEntryIds],
    );

    useEffect(() => {
        if (!open || entriesWithMultiple.length === 0) return;
        const next: Record<number, string[]> = {};
        for (const e of entriesWithMultiple) {
            const emails = e.scrapedEmails ?? [];
            next[e.id] = [...emails];
        }
        setSelections(next);
        setCustomEmails({});
        setCustomInputs({});
        setSavedEntryIds(new Set());
        setDeletedEntryIds(new Set());
    }, [open, entriesWithMultiple]);

    const selectionFor = (entryId: number): string[] =>
        selections[entryId] ??
        entriesWithMultiple.find((e) => e.id === entryId)?.scrapedEmails ??
        [];

    const customFor = (entryId: number): string[] =>
        customEmails[entryId] ?? [];

    const savedEmailsFor = (entryId: number): string[] => [
        ...selectionFor(entryId),
        ...customFor(entryId),
    ];

    const toggleEmail = (entryId: number, email: string, checked: boolean) => {
        setSelections((prev) => {
            const current = prev[entryId] ?? [];
            if (checked) {
                return { ...prev, [entryId]: [...current, email] };
            }
            return {
                ...prev,
                [entryId]: current.filter((e) => e !== email),
            };
        });
        setSaveError(null);
    };

    const deselectAllForEntry = (entryId: number) => {
        setSelections((prev) => ({ ...prev, [entryId]: [] }));
        setSaveError(null);
    };

    const isSelected = (entryId: number, email: string) =>
        selectionFor(entryId).includes(email);

    const canSaveEntry = (entryId: number) =>
        savedEmailsFor(entryId).length > 0;

    const canSaveAll = () =>
        visibleEntries.length > 0 &&
        visibleEntries.every((e) => canSaveEntry(e.id));

    const addCustomEmail = (entryId: number) => {
        const value = (customInputs[entryId] ?? "").trim();
        if (!value) return;
        setCustomEmails((prev) => ({
            ...prev,
            [entryId]: [...(prev[entryId] ?? []), value],
        }));
        setCustomInputs((prev) => ({ ...prev, [entryId]: "" }));
        setSaveError(null);
    };

    const removeCustomEmail = (entryId: number, email: string) => {
        setCustomEmails((prev) => ({
            ...prev,
            [entryId]: (prev[entryId] ?? []).filter((e) => e !== email),
        }));
        setSaveError(null);
    };

    const handleSaveOne = async (entry: Entry) => {
        const chosen = savedEmailsFor(entry.id);
        if (chosen.length === 0) return;
        setSaveError(null);
        setSavingEntryId(entry.id);
        try {
            await updateEntry(entry.id, { scrapedEmails: chosen });
            setCustomEmails((prev) => {
                const next = { ...prev };
                delete next[entry.id];
                return next;
            });
            setCustomInputs((prev) => ({ ...prev, [entry.id]: "" }));
            setSavedEntryIds((prev) => new Set(prev).add(entry.id));
            onSaved?.();
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setSavingEntryId(null);
        }
    };

    const handleDeleteOne = async (entry: Entry) => {
        if (
            !window.confirm(
                `Remove "${getEntryDisplayName(entry)}" from the database? This cannot be undone.`,
            )
        ) {
            return;
        }
        setSaveError(null);
        setDeletingEntryId(entry.id);
        try {
            await deleteEntries([entry.id]);
            setDeletedEntryIds((prev) => new Set(prev).add(entry.id));
            setSelections((prev) => {
                const next = { ...prev };
                delete next[entry.id];
                return next;
            });
            setCustomEmails((prev) => {
                const next = { ...prev };
                delete next[entry.id];
                return next;
            });
            setCustomInputs((prev) => {
                const next = { ...prev };
                delete next[entry.id];
                return next;
            });
            onSaved?.();
        } catch (err) {
            setSaveError(
                err instanceof Error ? err.message : "Failed to delete entry",
            );
        } finally {
            setDeletingEntryId(null);
        }
    };

    const handleSaveAll = async () => {
        if (!canSaveAll()) return;
        setSaveError(null);
        setSavingAll(true);
        try {
            for (const entry of visibleEntries) {
                const chosen = savedEmailsFor(entry.id);
                if (chosen.length === 0) continue;
                await updateEntry(entry.id, { scrapedEmails: chosen });
            }
            onSaved?.();
            onClose();
        } catch (err) {
            setSaveError(
                err instanceof Error ? err.message : "Failed to save updates",
            );
        } finally {
            setSavingAll(false);
        }
    };

    const handleClose = () => {
        setSaveError(null);
        setSelections({});
        setCustomEmails({});
        setCustomInputs({});
        setSavedEntryIds(new Set());
        setDeletedEntryIds(new Set());
        onClose();
    };

    const virtualizer = useVirtualizer({
        count: visibleEntries.length,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: () => ENTRY_CARD_ESTIMATE_HEIGHT,
        overscan: 2,
    });

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Review multiple privacy emails</DialogTitle>
            <DialogContent>
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                >
                    These entries have more than one scraped email. Select which
                    address(es) to keep for each. You can save each entry as you
                    go or save all selections at once at the bottom.
                </Typography>
                {entriesWithMultiple.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        No entries with multiple privacy emails.
                    </Typography>
                ) : visibleEntries.length === 0 ? (
                    <Typography variant="body2" color="success.main">
                        All entries in this list have been saved. You can close
                        this dialog.
                    </Typography>
                ) : (
                    <Box
                        ref={scrollContainerRef}
                        sx={{
                            height: "min(60vh, 480px)",
                            overflow: "auto",
                            contain: "strict",
                        }}
                    >
                        <Box
                            sx={{
                                height: `${virtualizer.getTotalSize()}px`,
                                width: "100%",
                                position: "relative",
                            }}
                        >
                            {virtualizer.getVirtualItems().map((virtualRow) => {
                                const entry =
                                    visibleEntries[virtualRow.index]!;
                                const emails = entry.scrapedEmails ?? [];
                                const isSaving = savingEntryId === entry.id;
                                return (
                                    <Box
                                        key={entry.id}
                                        ref={(el) => {
                                            if (el instanceof Element)
                                                virtualizer.measureElement(el);
                                        }}
                                        data-index={virtualRow.index}
                                        sx={{
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            width: "100%",
                                            transform: `translateY(${virtualRow.start}px)`,
                                            py: 1,
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                p: 2,
                                                border: 1,
                                                borderColor: "divider",
                                                borderRadius: 1,
                                                bgcolor: "action.hover",
                                            }}
                                        >
                                    <Typography
                                        variant="subtitle2"
                                        fontWeight={600}
                                        sx={{ mb: 0.5 }}
                                    >
                                        {getEntryDisplayName(entry)}
                                    </Typography>
                                    {entry.url && (
                                        <Link
                                            href={entry.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            variant="body2"
                                            sx={{ display: "block", mb: 1 }}
                                        >
                                            {entry.url}
                                        </Link>
                                    )}
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ mb: 0.5, display: "block" }}
                                    >
                                        Select from scraped emails, or add your
                                        own if you found a different one on the
                                        policy:
                                    </Typography>
                                    <FormGroup>
                                        {emails.map((email) => (
                                            <FormControlLabel
                                                key={email}
                                                control={
                                                    <Checkbox
                                                        size="small"
                                                        checked={isSelected(
                                                            entry.id,
                                                            email,
                                                        )}
                                                        onChange={(
                                                            _,
                                                            checked,
                                                        ) =>
                                                            toggleEmail(
                                                                entry.id,
                                                                email,
                                                                checked,
                                                            )
                                                        }
                                                    />
                                                }
                                                label={email}
                                                componentsProps={{
                                                    typography: {
                                                        variant: "body2",
                                                        sx: {
                                                            cursor: "pointer",
                                                            userSelect: "none",
                                                        },
                                                    },
                                                }}
                                            />
                                        ))}
                                    </FormGroup>
                                    <Box sx={{ mt: 1.5 }}>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ display: "block", mb: 0.5 }}
                                        >
                                            Or enter an email you found on the
                                            policy:
                                        </Typography>
                                        <Stack
                                            direction="row"
                                            spacing={1}
                                            alignItems="center"
                                            sx={{ flexWrap: "wrap", gap: 0.5 }}
                                        >
                                            <TextField
                                                size="small"
                                                placeholder="e.g. privacy@company.com"
                                                value={
                                                    customInputs[entry.id] ?? ""
                                                }
                                                onChange={(e) =>
                                                    setCustomInputs((prev) => ({
                                                        ...prev,
                                                        [entry.id]:
                                                            e.target.value,
                                                    }))
                                                }
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        addCustomEmail(
                                                            entry.id,
                                                        );
                                                    }
                                                }}
                                                sx={{ minWidth: 200, flex: 1 }}
                                            />
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={() =>
                                                    addCustomEmail(entry.id)
                                                }
                                                disabled={
                                                    !(
                                                        customInputs[
                                                            entry.id
                                                        ] ?? ""
                                                    ).trim()
                                                }
                                            >
                                                Add
                                            </Button>
                                        </Stack>
                                        {customFor(entry.id).length > 0 && (
                                            <Stack
                                                direction="row"
                                                flexWrap="wrap"
                                                gap={0.5}
                                                sx={{ mt: 1 }}
                                            >
                                                {customFor(entry.id).map(
                                                    (email) => (
                                                        <Chip
                                                            key={email}
                                                            label={email}
                                                            size="small"
                                                            onDelete={() =>
                                                                removeCustomEmail(
                                                                    entry.id,
                                                                    email,
                                                                )
                                                            }
                                                            variant="outlined"
                                                        />
                                                    ),
                                                )}
                                            </Stack>
                                        )}
                                    </Box>
                                    <Stack
                                        direction="row"
                                        justifyContent="space-between"
                                        spacing={1}
                                        sx={{ mt: 1.5 }}
                                        flexWrap="wrap"
                                    >
                                        <Stack direction="row" spacing={1}>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                onClick={() =>
                                                    deselectAllForEntry(
                                                        entry.id,
                                                    )
                                                }
                                            >
                                                Deselect all
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                color="error"
                                                startIcon={
                                                    <DeleteOutlineIcon />
                                                }
                                                onClick={() =>
                                                    handleDeleteOne(entry)
                                                }
                                                disabled={
                                                    deletingEntryId ===
                                                    entry.id
                                                }
                                            >
                                                {deletingEntryId === entry.id
                                                    ? "Deleting…"
                                                    : "Delete entry"}
                                            </Button>
                                        </Stack>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<SaveIcon />}
                                            onClick={() =>
                                                handleSaveOne(entry)
                                            }
                                            disabled={
                                                savedEmailsFor(entry.id)
                                                    .length === 0 || isSaving
                                            }
                                        >
                                            {isSaving
                                                ? "Saving…"
                                                : "Save this entry"}
                                        </Button>
                                    </Stack>
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>
                )}
                {saveError && (
                    <Typography variant="body2" color="error" sx={{ mt: 2 }}>
                        {saveError}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>

                <Button
                    variant="contained"
                    startIcon={<CheckCircleIcon />}
                    onClick={handleSaveAll}
                    disabled={
                        visibleEntries.length === 0 ||
                        !canSaveAll() ||
                        savingAll
                    }
                >
                    {savingAll ? "Saving…" : "Save all"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
