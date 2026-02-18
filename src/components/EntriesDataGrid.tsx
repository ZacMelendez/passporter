import {
    Box,
    Button,
    Checkbox,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    IconButton,
    InputAdornment,
    InputLabel,
    Link,
    MenuItem,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import ClearIcon from "@mui/icons-material/Clear";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AddIcon from "@mui/icons-material/Add";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
    type ColumnDef,
    type ColumnFiltersState,
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    useReactTable,
    type FilterFn,
} from "@tanstack/react-table";
import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from "react";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";
import type { Entry, EntryStatus } from "../types/entries";
import { statusLabel } from "../utils/status";

// ---- Filter model (MUI X–style operators + multi-condition) ----

export type FilterOperator =
    | "contains"
    | "equals"
    | "startsWith"
    | "endsWith"
    | "isEmpty"
    | "isNotEmpty"
    | "doesNotContain";

export type ColumnFilterItem = {
    operator: FilterOperator;
    value: string;
};

export type ColumnFilterValue = { items: ColumnFilterItem[] };

/** One filter condition row (column + operator + value) for the filter dialog */
export type FilterRow = {
    columnId: string;
    operator: FilterOperator;
    value: string;
};

const FILTERABLE_COLUMNS: { id: string; label: string }[] = [
    { id: "site", label: "Site" },
    { id: "username", label: "Username" },
    { id: "sourceEmail", label: "CSV Email" },
    { id: "scrapedEmails", label: "Policy Emails" },
    { id: "privacyUrl", label: "Privacy URL" },
    { id: "status", label: "Status" },
];

const DEFAULT_FILTER_ROW: FilterRow = {
    columnId: FILTERABLE_COLUMNS[0]!.id,
    operator: "contains",
    value: "",
};

function isFilterRowActive(row: FilterRow): boolean {
    if (row.operator === "isEmpty" || row.operator === "isNotEmpty")
        return true;
    return VALUE_BASED_OPERATORS.has(row.operator) && row.value.trim() !== "";
}

function filterRowsToColumnFilters(rows: FilterRow[]): ColumnFiltersState {
    const byColumn = new Map<string, ColumnFilterItem[]>();
    for (const row of rows) {
        if (!row.columnId) continue;
        if (!isFilterRowActive(row)) continue;
        const list = byColumn.get(row.columnId) ?? [];
        list.push({ operator: row.operator, value: row.value });
        byColumn.set(row.columnId, list);
    }
    return Array.from(byColumn.entries()).map(([id, items]) => ({
        id,
        value: { items } as unknown,
    }));
}

const STRING_OPERATORS: { value: FilterOperator; label: string }[] = [
    { value: "contains", label: "Contains" },
    { value: "equals", label: "Equals" },
    { value: "startsWith", label: "Starts with" },
    { value: "endsWith", label: "Ends with" },
    { value: "doesNotContain", label: "Does not contain" },
    { value: "isEmpty", label: "Is empty" },
    { value: "isNotEmpty", label: "Is not empty" },
];

const VALUE_BASED_OPERATORS = new Set<FilterOperator>([
    "contains",
    "equals",
    "startsWith",
    "endsWith",
    "doesNotContain",
]);

function applyStringOperator(
    cellValue: unknown,
    operator: FilterOperator,
    filterValue: string,
): boolean {
    const str =
        cellValue == null || cellValue === ""
            ? ""
            : String(cellValue).toLowerCase();
    const filter = filterValue.trim().toLowerCase();

    switch (operator) {
        case "contains":
            return filter ? str.includes(filter) : true;
        case "equals":
            return filter ? str === filter : true;
        case "startsWith":
            return filter ? str.startsWith(filter) : true;
        case "endsWith":
            return filter ? str.endsWith(filter) : true;
        case "doesNotContain":
            return filter ? !str.includes(filter) : true;
        case "isEmpty":
            return str === "";
        case "isNotEmpty":
            return str !== "";
        default:
            return true;
    }
}

function makeMultiItemFilterFn(
    getCellValue: (row: Entry, columnId: string) => unknown,
): FilterFn<Entry> {
    return (row, columnId, filterValue) => {
        const parsed = filterValue as ColumnFilterValue | undefined;
        const items = parsed?.items;
        if (!items?.length) return true;

        const cellValue = getCellValue(row.original, columnId);
        for (const item of items) {
            const pass = applyStringOperator(
                cellValue,
                item.operator,
                item.value,
            );
            if (!pass) return false;
        }
        return true;
    };
}

function getSiteNameDisplay(row: Entry): string {
    return (
        row.siteName ||
        (() => {
            try {
                return new URL(row.url).hostname;
            } catch {
                return "";
            }
        })()
    );
}

function getCellValueForColumn(entry: Entry, columnId: string): unknown {
    switch (columnId) {
        case "site":
            return `${getSiteNameDisplay(entry)} ${entry.url}`;
        case "scrapedEmails":
            return (entry.scrapedEmails || []).join(", ");
        case "privacyUrl":
            return entry.privacyUrl ?? "";
        default:
            return (entry as Record<string, unknown>)[columnId] ?? "";
    }
}

function isFilterItemActive(item: ColumnFilterItem): boolean {
    if (item.operator === "isEmpty" || item.operator === "isNotEmpty") {
        return true;
    }
    return VALUE_BASED_OPERATORS.has(item.operator) && item.value.trim() !== "";
}

function isColumnFilterActive(value: unknown): boolean {
    const parsed = value as ColumnFilterValue | undefined;
    return (
        !!parsed?.items?.length &&
        parsed.items.some((i) => isFilterItemActive(i))
    );
}

export type EntriesDataGridProps = {
    rows: Entry[];
    onProcessRowUpdate: (newRow: Entry) => Promise<Entry>;
    onScrapeOne: (id: number) => void;
    isScrapeOnePending: boolean;
    scrapeOneVariableId: number | undefined;
    onDeleteSelected?: (ids: number[]) => void;
    isDeletePending?: boolean;
};

export type EntriesDataGridHandle = {
    getFilteredEntries: () => Entry[];
    getSelectedEntries: () => Entry[];
};

declare module "@tanstack/react-table" {
    interface TableMeta<TData> {
        updateData: (
            rowIndex: number,
            columnId: string,
            value: unknown,
        ) => void;
    }
}

const columnHelper = createColumnHelper<Entry>();

const PAGE_SIZE_OPTIONS = [25, 50, 100, 500, 1000];
const DEFAULT_PAGE_SIZE = 100;
const FILTER_DEBOUNCE_MS = 300;

type FilterDialogProps = {
    open: boolean;
    onClose: () => void;
    filterRows: FilterRow[];
    onApply: (rows: FilterRow[]) => void;
};

function FilterDialog({
    open,
    onClose,
    filterRows,
    onApply,
}: FilterDialogProps) {
    const [localRows, setLocalRows] = useState<FilterRow[]>(() =>
        filterRows.length > 0 ? filterRows : [DEFAULT_FILTER_ROW],
    );
    const localRowsRef = useRef(localRows);
    localRowsRef.current = localRows;

    useEffect(() => {
        if (open) {
            setLocalRows(
                filterRows.length > 0 ? filterRows : [DEFAULT_FILTER_ROW],
            );
        }
    }, [open, filterRows.length, filterRows]);

    const updateRow = useCallback(
        (index: number, update: Partial<FilterRow>) => {
            setLocalRows((prev) =>
                prev.map((r, i) => (i === index ? { ...r, ...update } : r)),
            );
        },
        [],
    );

    const addRow = useCallback(() => {
        setLocalRows((prev) => [...prev, { ...DEFAULT_FILTER_ROW }]);
    }, []);

    const removeRow = useCallback((index: number) => {
        setLocalRows((prev) =>
            prev.length <= 1
                ? [DEFAULT_FILTER_ROW]
                : prev.filter((_, i) => i !== index),
        );
    }, []);

    const handleClose = useCallback(() => {
        onApply(localRowsRef.current);
        onClose();
    }, [onApply, onClose]);

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Filter by column</DialogTitle>
            <DialogContent>
                <Stack spacing={1.5} sx={{ pt: 0.5 }}>
                    {localRows.map((row, index) => (
                        <Stack
                            key={index}
                            direction="row"
                            spacing={1}
                            alignItems="flex-end"
                        >
                            <FormControl
                                size="small"
                                variant="standard"
                                sx={{ minWidth: 140 }}
                            >
                                <InputLabel>Column</InputLabel>
                                <Select
                                    value={row.columnId}
                                    onChange={(e) =>
                                        updateRow(index, {
                                            columnId: e.target.value,
                                        })
                                    }
                                    label="Column"
                                >
                                    {FILTERABLE_COLUMNS.map((col) => (
                                        <MenuItem key={col.id} value={col.id}>
                                            {col.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl
                                size="small"
                                variant="standard"
                                sx={{ minWidth: 130 }}
                            >
                                <InputLabel>Operator</InputLabel>
                                <Select
                                    value={row.operator}
                                    onChange={(e) =>
                                        updateRow(index, {
                                            operator: e.target
                                                .value as FilterOperator,
                                        })
                                    }
                                    label="Operator"
                                >
                                    {STRING_OPERATORS.map((op) => (
                                        <MenuItem
                                            key={op.value}
                                            value={op.value}
                                        >
                                            {op.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            {VALUE_BASED_OPERATORS.has(row.operator) ? (
                                <TextField
                                    placeholder="Value…"
                                    value={row.value}
                                    onChange={(e) =>
                                        updateRow(index, {
                                            value: e.target.value,
                                        })
                                    }
                                    variant="standard"
                                    sx={{
                                        flex: 1,
                                    }}
                                />
                            ) : (
                                <Box sx={{ flex: 1 }} />
                            )}
                            <IconButton
                                size="small"
                                onClick={() => removeRow(index)}
                                aria-label="Remove filter"
                                sx={{ p: 0.5 }}
                            >
                                <RemoveCircleOutlineIcon fontSize="small" />
                            </IconButton>
                        </Stack>
                    ))}
                    <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={addRow}
                        sx={{ alignSelf: "flex-start", textTransform: "none" }}
                    >
                        Add filter
                    </Button>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Done</Button>
            </DialogActions>
        </Dialog>
    );
}

function buildColumns(
    props: Pick<
        EntriesDataGridProps,
        "onScrapeOne" | "isScrapeOnePending" | "scrapeOneVariableId"
    >,
) {
    const { onScrapeOne, isScrapeOnePending, scrapeOneVariableId } = props;

    return [
        columnHelper.display({
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    size="small"
                    checked={table.getIsAllRowsSelected()}
                    indeterminate={
                        table.getIsSomeRowsSelected() &&
                        !table.getIsAllRowsSelected()
                    }
                    onChange={table.getToggleAllRowsSelectedHandler()}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    size="small"
                    checked={row.getIsSelected()}
                    disabled={!row.getCanSelect()}
                    onChange={row.getToggleSelectedHandler()}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Select row"
                />
            ),
            size: 48,
            enableSorting: false,
            enableColumnFilter: false,
        }),
        columnHelper.accessor(
            (row: Entry) => `${getSiteNameDisplay(row)} ${row.url}`,
            {
                id: "site",
                header: "Site",
                size: 220,
                enableColumnFilter: true,
                filterFn: makeMultiItemFilterFn(getCellValueForColumn),
                cell: ({ row, table }) => {
                    const name = getSiteNameDisplay(row.original);
                    const url = row.original.url;
                    return (
                        <Stack
                            direction="row"
                            alignItems="center"
                            spacing={0.5}
                        >
                            <EditableCell
                                value={name ?? ""}
                                row={row}
                                columnId="siteName"
                                table={table}
                                parsePayload={(v: string) =>
                                    v === "" ? null : v
                                }
                            />
                            <IconButton
                                component={Link}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                size="small"
                                aria-label="Open URL"
                            >
                                <OpenInNewIcon fontSize="small" />
                            </IconButton>
                        </Stack>
                    );
                },
            },
        ),
        columnHelper.accessor("username", {
            header: "Username",
            size: 150,
            enableColumnFilter: true,
            filterFn: makeMultiItemFilterFn(getCellValueForColumn),
            cell: ({ getValue }) => (
                <Typography variant="body2">{getValue() ?? "—"}</Typography>
            ),
        }),
        columnHelper.accessor("sourceEmail", {
            header: "CSV Email",
            size: 200,
            enableColumnFilter: true,
            filterFn: makeMultiItemFilterFn(getCellValueForColumn),
            cell: ({ getValue }) => {
                const v = getValue();
                return v ? (
                    <Chip size="small" label={v} color="default" />
                ) : (
                    <Typography variant="body2" color="text.disabled">
                        —
                    </Typography>
                );
            },
        }),
        columnHelper.accessor(
            (row: Entry) => (row.scrapedEmails || []).join(", "),
            {
                id: "scrapedEmails",
                header: "Policy Emails",
                size: 300,
                enableColumnFilter: true,
                filterFn: makeMultiItemFilterFn(getCellValueForColumn),
                cell: ({ row, table, getValue }) => {
                    const display = getValue() ?? "";
                    const emails = row.original.scrapedEmails;
                    const isEmpty =
                        !Array.isArray(emails) || emails.length === 0;
                    return (
                        <EditableCell
                            value={display}
                            row={row}
                            columnId="scrapedEmails"
                            table={table}
                            parsePayload={(v: string) =>
                                v
                                    .split(",")
                                    .map((e) => e.trim())
                                    .filter(Boolean)
                            }
                            placeholder={isEmpty ? "—" : undefined}
                            multiline
                            renderDisplay={(v) => {
                                const list =
                                    typeof v === "string" && v
                                        ? v
                                              .split(",")
                                              .map((e) => e.trim())
                                              .filter(Boolean)
                                        : [];
                                if (list.length === 0) {
                                    return (
                                        <Typography
                                            variant="body2"
                                            color="text.disabled"
                                        >
                                            —
                                        </Typography>
                                    );
                                }
                                return (
                                    <Stack
                                        direction="row"
                                        spacing={0.5}
                                        flexWrap="wrap"
                                    >
                                        {list.slice(0, 2).map((email, idx) => (
                                            <Chip
                                                key={idx}
                                                size="small"
                                                label={email}
                                                color="success"
                                                variant="outlined"
                                            />
                                        ))}
                                        {list.length > 2 && (
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                            >
                                                +{list.length - 2} more
                                            </Typography>
                                        )}
                                    </Stack>
                                );
                            }}
                        />
                    );
                },
            },
        ),
        columnHelper.accessor((row: Entry) => row.privacyUrl ?? "", {
            id: "privacyUrl",
            header: "Privacy URL",
            size: 300,
            enableColumnFilter: true,
            filterFn: makeMultiItemFilterFn(getCellValueForColumn),
            cell: ({ row, table, getValue }) => {
                const value = getValue() ?? "";
                return (
                    <EditableCell
                        value={value}
                        row={row}
                        columnId="privacyUrl"
                        table={table}
                        parsePayload={(v: string) => (v === "" ? null : v)}
                        renderDisplay={(v: string) =>
                            v ? (
                                <Link
                                    href={v}
                                    target="_blank"
                                    rel="noreferrer"
                                    underline="hover"
                                    color="primary"
                                >
                                    {v}
                                </Link>
                            ) : (
                                <Typography
                                    variant="body2"
                                    color="text.disabled"
                                >
                                    —
                                </Typography>
                            )
                        }
                    />
                );
            },
        }),
        columnHelper.accessor("status", {
            header: "Status",
            size: 150,
            enableColumnFilter: true,
            filterFn: makeMultiItemFilterFn(getCellValueForColumn),
            cell: ({ getValue }) => {
                const status = getValue() as EntryStatus;
                return (
                    <Chip
                        size="small"
                        label={statusLabel(status)}
                        color={
                            status === "done"
                                ? "success"
                                : status === "error"
                                  ? "error"
                                  : status === "no_results"
                                    ? "warning"
                                    : "default"
                        }
                        variant={status === "done" ? "filled" : "outlined"}
                    />
                );
            },
        }),
        columnHelper.display({
            id: "actions",
            header: "Actions",
            size: 120,
            enableColumnFilter: false,
            cell: ({ row }) => (
                <Stack direction="row" spacing={0.5}>
                    <IconButton
                        size="small"
                        aria-label="Scrape"
                        onClick={() => onScrapeOne(row.original.id)}
                        disabled={
                            isScrapeOnePending &&
                            scrapeOneVariableId === row.original.id
                        }
                    >
                        <RefreshIcon fontSize="small" />
                    </IconButton>
                    {row.original.privacyUrl && (
                        <IconButton
                            size="small"
                            aria-label="Open Privacy Policy"
                            onClick={() =>
                                window.open(row.original.privacyUrl!, "_blank")
                            }
                        >
                            <OpenInNewIcon fontSize="small" />
                        </IconButton>
                    )}
                </Stack>
            ),
        }),
    ] as ColumnDef<Entry, unknown>[];
}

type EditableCellProps = {
    value: string;
    row: { index: number; original: Entry };
    columnId: string;
    table: ReturnType<typeof useReactTable<Entry>>;
    parsePayload: (v: string) => unknown;
    placeholder?: string;
    multiline?: boolean;
    renderDisplay?: (value: string) => React.ReactNode;
};

function EditableCell({
    value,
    row,
    columnId,
    table,
    parsePayload,
    placeholder,
    multiline,
    renderDisplay,
}: EditableCellProps) {
    const [editing, setEditing] = useState(false);
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const meta = table.options.meta;
    const onBlur = () => {
        if (!meta?.updateData) return;
        const payload = parsePayload(localValue);
        meta.updateData(row.index, columnId, payload);
        setEditing(false);
    };

    if (editing) {
        return (
            <TextField
                size="small"
                fullWidth
                multiline={multiline}
                minRows={multiline ? 2 : 1}
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={onBlur}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !multiline) {
                        e.preventDefault();
                        onBlur();
                    }
                }}
                autoFocus
                variant="standard"
                sx={{ "& input": { fontSize: "0.875rem" } }}
            />
        );
    }

    const display = value || placeholder;
    return (
        <Box
            onClick={() => setEditing(true)}
            sx={{
                cursor: "pointer",
                minHeight: 20,
                "&:hover": { bgcolor: "action.hover" },
                borderRadius: 0.5,
                px: 0.5,
                py: 0.25,
            }}
        >
            {renderDisplay ? (
                renderDisplay(value)
            ) : (
                <Typography variant="body2">{display || "—"}</Typography>
            )}
        </Box>
    );
}

export const EntriesDataGrid = forwardRef<
    EntriesDataGridHandle,
    EntriesDataGridProps
>(function EntriesDataGrid(
    {
        rows,
        onProcessRowUpdate,
        onScrapeOne,
        isScrapeOnePending,
        scrapeOneVariableId,
        onDeleteSelected,
        isDeletePending = false,
    },
    ref,
) {
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: DEFAULT_PAGE_SIZE,
    });
    const [filterRows, setFilterRows] = useState<FilterRow[]>([
        DEFAULT_FILTER_ROW,
    ]);
    const columnFilters = useMemo(
        () => filterRowsToColumnFilters(filterRows),
        [filterRows],
    );
    const [globalFilter, setGlobalFilter] = useState("");
    const [draftGlobalFilter, setDraftGlobalFilter] = useState("");
    const draftGlobalFilterRef = useRef(draftGlobalFilter);
    draftGlobalFilterRef.current = draftGlobalFilter;
    const [filterDialogOpen, setFilterDialogOpen] = useState(false);
    const [rowSelection, setRowSelection] = useState<Record<string, boolean>>(
        {},
    );

    const columns = useMemo(
        () =>
            buildColumns({
                onScrapeOne,
                isScrapeOnePending,
                scrapeOneVariableId,
            }),
        [onScrapeOne, isScrapeOnePending, scrapeOneVariableId],
    );

    const table = useReactTable({
        data: rows,
        columns,
        getRowId: (row) => String(row.id),
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        state: {
            pagination,
            columnFilters,
            globalFilter,
            rowSelection,
        },
        onPaginationChange: setPagination,
        onColumnFiltersChange: () => {
            /* columnFilters derived from filterRows, not directly set */
        },
        onGlobalFilterChange: setGlobalFilter,
        onRowSelectionChange: setRowSelection,
        enableRowSelection: true,
        globalFilterFn: (row, _columnId, filterValue) => {
            const search = String(filterValue).toLowerCase();
            if (!search) return true;
            const entry = row.original;
            const searchable = [
                getSiteNameDisplay(entry),
                entry.url,
                entry.username ?? "",
                entry.sourceEmail ?? "",
                (entry.scrapedEmails || []).join(" "),
                entry.privacyUrl ?? "",
                entry.status,
            ]
                .join(" ")
                .toLowerCase();
            return searchable.includes(search);
        },
        manualPagination: false,
        pageCount: -1,
        meta: {
            updateData: (
                rowIndex: number,
                columnId: string,
                value: unknown,
            ) => {
                const row = rows[rowIndex];
                if (!row) return;
                const newRow: Entry = { ...row, [columnId]: value };
                onProcessRowUpdate(newRow).catch((err) => {
                    console.error("Update error:", err);
                });
            },
        },
    });

    const applyGlobalFilter = useDebouncedCallback(() => {
        setGlobalFilter(draftGlobalFilterRef.current);
        table.setPageIndex(0);
    }, FILTER_DEBOUNCE_MS);

    const hasActiveFilters =
        !!globalFilter ||
        columnFilters.some((f) =>
            isColumnFilterActive(f.value as ColumnFilterValue),
        );

    const selectedRows = table.getSelectedRowModel().rows;
    const selectedIds = useMemo(
        () => selectedRows.map((r) => r.original.id),
        [selectedRows],
    );
    const hasSelection = selectedIds.length > 0;

    const handleDeleteSelected = () => {
        if (!hasSelection || !onDeleteSelected) return;
        onDeleteSelected(selectedIds);
        setRowSelection({});
    };

    const clearAllFilters = () => {
        setGlobalFilter("");
        setDraftGlobalFilter("");
        setFilterRows([DEFAULT_FILTER_ROW]);
        table.setPageIndex(0);
    };

    const handleFilterDialogApply = useCallback(
        (newRows: FilterRow[]) => {
            setFilterRows(newRows);
            table.setPageIndex(0);
        },
        [table],
    );

    useImperativeHandle(ref, () => ({
        getFilteredEntries: () =>
            table.getFilteredRowModel().rows.map((r) => r.original),
        getSelectedEntries: () =>
            table.getSelectedRowModel().rows.map((r) => r.original),
    }));

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
            }}
        >
            <Stack
                direction="row"
                alignItems="center"
                spacing={2}
                sx={{
                    p: 1.5,
                    borderBottom: 1,
                    borderColor: "divider",
                    bgcolor: "background.paper",
                }}
            >
                <TextField
                    size="small"
                    placeholder="Search all columns…"
                    value={draftGlobalFilter}
                    onChange={(e) => {
                        setDraftGlobalFilter(e.target.value);
                        applyGlobalFilter();
                    }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" color="action" />
                            </InputAdornment>
                        ),
                    }}
                    sx={{ minWidth: 260 }}
                />
                <IconButton
                    color={hasActiveFilters ? "primary" : "default"}
                    onClick={() => setFilterDialogOpen(true)}
                >
                    <FilterListIcon />
                </IconButton>
                {hasActiveFilters && (
                    <Button
                        size="small"
                        startIcon={<ClearIcon />}
                        onClick={clearAllFilters}
                        variant="outlined"
                    >
                        Clear
                    </Button>
                )}
                {hasSelection && onDeleteSelected && (
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteOutlineIcon />}
                        onClick={handleDeleteSelected}
                        disabled={isDeletePending}
                    >
                        Delete ({selectedIds.length})
                    </Button>
                )}
                <FilterDialog
                    open={filterDialogOpen}
                    onClose={() => setFilterDialogOpen(false)}
                    filterRows={filterRows}
                    onApply={handleFilterDialogApply}
                />
            </Stack>
            <TableContainer sx={{ flex: 1, overflow: "auto" }}>
                <Table
                    size="small"
                    stickyHeader
                    sx={{
                        "& .MuiTableCell-head": {
                            bgcolor: "background.paper",
                            fontWeight: 600,
                        },
                    }}
                >
                    <TableHead>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableCell
                                        key={header.id}
                                        sx={{
                                            width: header.getSize(),
                                            minWidth: header.getSize(),
                                        }}
                                    >
                                        {flexRender(
                                            header.column.columnDef.header,
                                            header.getContext(),
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableHead>
                    <TableBody>
                        {table.getRowModel().rows.map((row) => (
                            <TableRow key={row.id} hover>
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell
                                        key={cell.id}
                                        sx={{
                                            width: cell.column.getSize(),
                                            minWidth: cell.column.getSize(),
                                            verticalAlign: "top",
                                        }}
                                    >
                                        {flexRender(
                                            cell.column.columnDef.cell,
                                            cell.getContext(),
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination
                component="div"
                count={table.getPrePaginationRowModel().rows.length}
                page={pagination.pageIndex}
                onPageChange={(_, page) => table.setPageIndex(page)}
                rowsPerPage={pagination.pageSize}
                onRowsPerPageChange={(e) => {
                    const size = Number(e.target.value);
                    table.setPageSize(size);
                }}
                rowsPerPageOptions={PAGE_SIZE_OPTIONS}
                showFirstButton
                showLastButton
                sx={{ borderTop: 1, borderColor: "divider" }}
            />
        </Box>
    );
});
