"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  IconButton,
  Checkbox,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tooltip,
  Menu,
  MenuItem,
  useTheme,
} from "@mui/material";
import { Snackbar } from "../toast";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import HistoryIcon from "@mui/icons-material/History";
import CachedIcon from "@mui/icons-material/Cached";
import LinkIcon from "@mui/icons-material/Link";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { alpha } from "@mui/material";
import { hasToken, listQueries, deleteQueries, deleteQueryById } from "../lib/api";
import type { QueryItem } from "../lib/types";
import { useDocumentTitle } from "../useDocumentTitle";
import { useDnsMessages } from "../i18n";

const PAGE_SIZE = 20;

export default function QueriesPage() {
  const theme = useTheme();
  const messages = useDnsMessages();
  useDocumentTitle(messages.dnsQueries);

  // Search
  const [domain, setDomain] = useState("");
  const [searchDomain, setSearchDomain] = useState("");
  const [clientIp, setClientIp] = useState("");
  const [searchClientIp, setSearchClientIp] = useState("");
  const [subnet, setSubnet] = useState("");
  const [searchSubnet, setSearchSubnet] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [searchCountryCode, setSearchCountryCode] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timeMenuAnchor, setTimeMenuAnchor] = useState<null | HTMLElement>(null);

  // Data
  const [items, setItems] = useState<QueryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "id" | "domain" | "filter";
    ids?: number[];
    domain?: string;
  } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteFilteredOpen, setDeleteFilteredOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // EDNS detail
  const [ednsDetailItem, setEdnsDetailItem] = useState<QueryItem | null>(null);

  // Toast
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });

  const fetchQueries = useCallback(async () => {
    if (!hasToken()) return;
    setLoading(true);
    setError("");
    try {
      const data = await listQueries({
        domain: searchDomain || undefined,
        ip: searchClientIp || undefined,
        subnet: searchSubnet || undefined,
        country_code: searchCountryCode || undefined,
        start: startTime || undefined,
        end: endTime || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch queries");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [searchDomain, searchClientIp, searchSubnet, searchCountryCode, startTime, endTime, page]);

  useEffect(() => {
    fetchQueries();
  }, [fetchQueries]);

  // Clear selection when page/items change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, searchDomain, searchClientIp, searchSubnet, searchCountryCode, startTime, endTime]);

  const handleSearch = () => {
    setSearchDomain(domain.trim());
    setSearchClientIp(clientIp.trim());
    setSearchSubnet(subnet.trim());
    setSearchCountryCode(countryCode.trim());
    setPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleClear = () => {
    setDomain("");
    setSearchDomain("");
    setClientIp("");
    setSearchClientIp("");
    setSubnet("");
    setSearchSubnet("");
    setCountryCode("");
    setSearchCountryCode("");
    setStartTime("");
    setEndTime("");
    setPage(1);
  };

  const handleRefresh = () => {
    fetchQueries();
  };

  const handleQuickTime = (hoursAgo: number) => {
    const d = new Date(Date.now() - hoursAgo * 3600000);
    const value = d.toISOString().slice(0, 16);
    setStartTime(value);
    setEndTime("");
    setPage(1);
    setTimeMenuAnchor(null);
  };

  const QUICK_TIMES = [
    { label: "1h ago", hours: 1 },
    { label: "1d ago", hours: 24 },
    { label: "3d ago", hours: 72 },
    { label: "1w ago", hours: 168 },
  ];

  // --- Selection helpers ---

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const selectable = items.filter((item) => item.id != null);
    if (selectable.length === 0) return;
    const allSelected = selectable.every((item) => selectedIds.has(item.id!));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectable.map((item) => item.id!)));
    }
  };

  const isAllSelected =
    items.length > 0 &&
    items.filter((i) => i.id != null).every((i) => selectedIds.has(i.id!));

  const isIndeterminate =
    items.some((i) => i.id != null && selectedIds.has(i.id!)) && !isAllSelected;

  // --- Delete ---

  const confirmDeleteSingle = (id: number) => {
    setDeleteTarget({ type: "id", ids: [id] });
    setDeleteOpen(true);
  };

  const confirmDeleteBatch = () => {
    if (selectedIds.size === 0) return;
    setDeleteTarget({ type: "id", ids: Array.from(selectedIds) });
    setDeleteOpen(true);
  };

  const confirmDeleteDomain = (domainName: string) => {
    setDeleteTarget({ type: "domain", domain: domainName });
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === "id" && deleteTarget.ids) {
        let deleted = 0;
        for (const id of deleteTarget.ids) {
          try {
            const result = await deleteQueryById(id);
            deleted += result.deleted;
          } catch {
            // continue with other deletions
          }
        }
        showToast(
          `Deleted ${deleted} query record${deleted !== 1 ? "s" : ""}`,
          "success"
        );
      } else if (deleteTarget.type === "domain" && deleteTarget.domain) {
        const result = await deleteQueries({ domain: deleteTarget.domain });
        showToast(
          `Deleted ${result.deleted} query records for "${deleteTarget.domain}"`,
          "success"
        );
      }
      setSelectedIds(new Set());
      await fetchQueries();
      setDeleteOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteFiltered = async () => {
    setDeleting(true);
    try {
      const result = await deleteQueries({
        domain: searchDomain || undefined,
        ip: searchClientIp || undefined,
        subnet: searchSubnet || undefined,
        country_code: searchCountryCode || undefined,
        start: startTime || undefined,
        end: endTime || undefined,
      });
      showToast(`Deleted ${result.deleted} query records matching filter`, "success");
      setSelectedIds(new Set());
      await fetchQueries();
      setDeleteFilteredOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete filtered failed", "error");
    } finally {
      setDeleting(false);
    }
  };

  const showToast = (message: string, severity: "success" | "error") => {
    setToast({ open: true, message, severity });
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied", "success");
    } catch {
      showToast("Failed to copy", "error");
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!hasToken()) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "60vh",
        }}
      >
        <Typography variant="h6" color="text.secondary">
          {messages.tokenPrompt}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 2, sm: 4 }, py: 4, maxWidth: 1400, mx: "auto" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="h5"
            sx={{ fontWeight: 700, fontFamily: "var(--font-inter)" }}
          >
            {messages.dnsQueries}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {messages.queriesDescription} — {total} {messages.records}
          </Typography>
        </Box>
      </Box>

      {/* Search bar */}
      <Card
        elevation={0}
        sx={{ border: 1, borderColor: "divider", borderRadius: 2, mb: 3 }}
      >
        <CardContent sx={{ py: 2, px: 3, "&:last-child": { pb: 2 } }}>
          <Box
            sx={{
              display: "flex",
              gap: 2,
              flexWrap: "wrap",
              alignItems: "flex-end",
            }}
          >
            <TextField
              label={messages.domain}
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Filter by domain..."
              slotProps={{
                input: {
                  sx: {
                    borderRadius: 2,
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    fontSize: "0.85rem",
                  },
                },
              }}
              sx={{ flex: { xs: "1 1 100%", sm: "1 1 150px" } }}
            />
            <TextField
              label={messages.clientIp}
              value={clientIp}
              onChange={(e) => setClientIp(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 203.0.113.5"
              slotProps={{
                input: {
                  sx: {
                    borderRadius: 2,
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    fontSize: "0.85rem",
                  },
                },
              }}
              sx={{ flex: { xs: "1 1 100%", sm: "1 1 150px" } }}
            />
            <TextField
              label={messages.ipSubnet}
              value={subnet}
              onChange={(e) => setSubnet(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 203.0.113.0/24"
              slotProps={{
                input: {
                  sx: {
                    borderRadius: 2,
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    fontSize: "0.85rem",
                  },
                },
              }}
              sx={{ flex: { xs: "1 1 100%", sm: "1 1 150px" } }}
            />
            <TextField
              label={messages.countryCode}
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="e.g. CN"
              slotProps={{
                input: {
                  sx: {
                    borderRadius: 2,
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    fontSize: "0.85rem",
                  },
                },
              }}
              sx={{ flex: { xs: "1 1 100%", sm: "0 0 100px" } }}
            />
            <TextField
              label={messages.startTime}
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              slotProps={{
                input: {
                  sx: { borderRadius: 2, fontSize: "0.85rem" },
                },
                inputLabel: { shrink: true },
              }}
              sx={{ flex: { xs: "1 1 100%", sm: "0 0 200px" } }}
            />
            <TextField
              label={messages.endTime}
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              slotProps={{
                input: {
                  sx: { borderRadius: 2, fontSize: "0.85rem" },
                },
                inputLabel: { shrink: true },
              }}
              sx={{ flex: { xs: "1 1 100%", sm: "0 0 200px" } }}
            />
            <Box
              sx={{
                display: "flex",
                gap: 1,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <Button
                variant="contained"
                startIcon={
                  loading ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <SearchIcon />
                  )
                }
                onClick={handleSearch}
                disabled={loading}
                sx={{ textTransform: "none", borderRadius: 2 }}
              >
                {messages.search}
              </Button>
              <Tooltip title={messages.refreshData}>
                <IconButton
                  onClick={handleRefresh}
                  disabled={loading}
                  color="primary"
                  sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}
                >
                  <CachedIcon />
                </IconButton>
              </Tooltip>
              <Button
                variant="outlined"
                onClick={handleClear}
                sx={{ textTransform: "none", borderRadius: 2 }}
              >
                {messages.clear}
              </Button>
              <Button
                variant="text"
                onClick={(e) => setTimeMenuAnchor(e.currentTarget)}
                startIcon={<AccessTimeIcon />}
                sx={{ textTransform: "none", borderRadius: 2, minWidth: "auto" }}
              >
                {messages.quickTime}
              </Button>
              <Menu
                anchorEl={timeMenuAnchor}
                open={Boolean(timeMenuAnchor)}
                onClose={() => setTimeMenuAnchor(null)}
              >
                {QUICK_TIMES.map((qt) => (
                  <MenuItem
                    key={qt.label}
                    onClick={() => handleQuickTime(qt.hours)}
                  >
                    {qt.label}
                  </MenuItem>
                ))}
              </Menu>
              {searchDomain && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => confirmDeleteDomain(searchDomain)}
                  sx={{ textTransform: "none", borderRadius: 2 }}
                >
                  Delete Domain
                </Button>
              )}
              {(searchDomain || searchClientIp || searchSubnet || searchCountryCode || startTime || endTime) && (
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setDeleteFilteredOpen(true)}
                  sx={{ textTransform: "none", borderRadius: 2 }}
                >
                  {messages.deleteFiltered}
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3, borderRadius: 2 }}
          onClose={() => setError("")}
        >
          {error}
        </Alert>
      )}

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            mb: 2,
            px: 2,
            py: 1,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.error.main, 0.08),
            border: 1,
            borderColor: alpha(theme.palette.error.main, 0.3),
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {selectedIds.size} record{selectedIds.size !== 1 ? "s" : ""} selected
          </Typography>
          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            onClick={confirmDeleteBatch}
            sx={{ textTransform: "none", borderRadius: 2 }}
          >
            {messages.deleteSelected}
          </Button>
          <Button
            variant="text"
            size="small"
            onClick={() => setSelectedIds(new Set())}
            sx={{ textTransform: "none" }}
          >
            {messages.deselectAll}
          </Button>
        </Box>
      )}

      {/* Table */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : items.length === 0 ? (
        <Card
          elevation={0}
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            textAlign: "center",
            py: 8,
          }}
        >
          <CardContent>
            <HistoryIcon
              sx={{ fontSize: 56, mb: 2, color: "text.disabled" }}
            />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              {messages.noQueries}
            </Typography>
            <Typography variant="body2" color="text.disabled">
              {searchDomain
                ? `No records for "${searchDomain}"`
                : "Try searching for a specific domain or adjust the time range"}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card
            elevation={0}
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              overflow: "auto",
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow
                  sx={{
                    bgcolor: alpha(theme.palette.action.hover, 0.04),
                  }}
                >
                  <TableCell sx={{ width: 48, p: "4px 8px" }}>
                    <Checkbox
                      size="small"
                      checked={isAllSelected}
                      indeterminate={isIndeterminate}
                      onChange={toggleSelectAll}
                      sx={{ p: 0.5 }}
                    />
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: "0.8rem",
                    }}
                  >
                    {messages.id}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: "0.8rem",
                    }}
                  >
                    {messages.domain}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: "0.8rem",
                    }}
                  >
                    {messages.type}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: "0.8rem",
                    }}
                  >
                    {messages.clientIp}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: "0.8rem",
                    }}
                  >
                    {messages.country}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: "0.8rem",
                    }}
                  >
                    {messages.city}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: "0.8rem",
                    }}
                  >
                    {messages.asn}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: "0.8rem",
                    }}
                  >
                    {messages.asName}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: "0.8rem",
                    }}
                  >
                    {messages.cached}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: "0.8rem",
                    }}
                  >
                    EDNS
                  </TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: "0.8rem",
                    }}
                  >
                    {messages.time}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 48 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, idx) => {
                  const rowId = item.id;
                  const isSelected = rowId != null && selectedIds.has(rowId);
                  return (
                  <TableRow
                    key={`${item.domain}-${item.created_at}-${idx}`}
                    sx={{
                      "&:last-child td": { border: 0 },
                      ...(isSelected
                        ? { bgcolor: alpha(theme.palette.error.main, 0.06) }
                        : idx % 2 === 0
                        ? { bgcolor: alpha(theme.palette.action.hover, 0.02) }
                        : {}),
                    }}
                  >
                    <TableCell sx={{ width: 48, p: "4px 8px" }}>
                      {rowId != null && (
                        <Checkbox
                          size="small"
                          checked={isSelected}
                          onChange={() => toggleSelect(rowId)}
                          sx={{ p: 0.5 }}
                        />
                      )}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                        fontSize: "0.8rem",
                      }}
                    >
                      {rowId ? `#${rowId}` : "—"}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                        fontSize: "0.8rem",
                        wordBreak: "break-all",
                        maxWidth: 200,
                      }}
                    >
                      {item.domain}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                        fontSize: "0.8rem",
                      }}
                    >
                      <Chip
                        label={item.query_type}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell
                      sx={{
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                        fontSize: "0.8rem",
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                        }}
                      >
                        {item.client_ip}
                        <IconButton
                          size="small"
                          onClick={() => copyText(item.client_ip)}
                        >
                          <ContentCopyIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell
                      sx={{
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                        fontSize: "0.8rem",
                      }}
                    >
                      {item.country_code || "-"}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                        fontSize: "0.8rem",
                      }}
                    >
                      {item.city || "-"}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                        fontSize: "0.8rem",
                      }}
                    >
                      {item.asn || "-"}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                        fontSize: "0.8rem",
                        maxWidth: 160,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <Tooltip title={item.as_name || ""}>
                        <span>{item.as_name || "-"}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell
                      sx={{
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                        fontSize: "0.8rem",
                      }}
                    >
                      {item.geo_cached ? (
                        <Chip
                          icon={<CachedIcon sx={{ fontSize: 12 }} />}
                          label="Yes"
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      ) : (
                        <Typography variant="caption" color="text.disabled">No</Typography>
                      )}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                        fontSize: "0.8rem",
                      }}
                    >
                      {item.edns_subnet ? (
                        <Chip
                          icon={<LinkIcon sx={{ fontSize: 12 }} />}
                          label="EDNS"
                          size="small"
                          variant="outlined"
                          color="info"
                          clickable
                          onClick={() => setEdnsDetailItem(item)}
                          sx={{
                            fontFamily: "var(--font-jetbrains-mono), monospace",
                            fontSize: "0.7rem",
                            borderRadius: 1,
                          }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                        fontSize: "0.8rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatTime(item.created_at)}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Delete this record">
                        <IconButton
                          size="small"
                          onClick={() => rowId != null && confirmDeleteSingle(rowId)}
                          color="error"
                        >
                          <DeleteIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, p) => setPage(p)}
                color="primary"
                shape="rounded"
              />
            </Box>
          )}
        </>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Records</DialogTitle>
        <DialogContent>
          {deleteTarget?.type === "id" ? (
            <Typography>
              Are you sure you want to delete{" "}
              <strong>{deleteTarget.ids?.length}</strong>{" "}
              query record{deleteTarget.ids?.length !== 1 ? "s" : ""}?
            </Typography>
          ) : (
            <Typography>
              Are you sure you want to delete <strong>all</strong> query history for domain &quot;{deleteTarget?.domain}&quot;?
            </Typography>
          )}
          <Typography variant="body2" color="error.main" sx={{ mt: 1, fontWeight: 600 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteOpen(false)} sx={{ textTransform: "none", borderRadius: 2 }}>
            {messages.cancel}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleting}
            sx={{ textTransform: "none", borderRadius: 2 }}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete filtered dialog */}
      <Dialog open={deleteFilteredOpen} onClose={() => setDeleteFilteredOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Filtered Queries</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>all</strong> query records matching the current filter?
          </Typography>
          <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {searchDomain && (
              <Chip label={`Domain: ${searchDomain}`} size="small" variant="outlined" />
            )}
            {searchClientIp && (
              <Chip label={`IP: ${searchClientIp}`} size="small" variant="outlined" />
            )}
            {searchSubnet && (
              <Chip label={`Subnet: ${searchSubnet}`} size="small" variant="outlined" />
            )}
            {searchCountryCode && (
              <Chip label={`Country: ${searchCountryCode}`} size="small" variant="outlined" />
            )}
            {startTime && (
              <Chip label={`Start: ${startTime}`} size="small" variant="outlined" />
            )}
            {endTime && (
              <Chip label={`End: ${endTime}`} size="small" variant="outlined" />
            )}
          </Box>
          <Typography variant="body2" color="error.main" sx={{ mt: 1, fontWeight: 600 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteFilteredOpen(false)} sx={{ textTransform: "none", borderRadius: 2 }}>
            {messages.cancel}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteFiltered}
            disabled={deleting}
            sx={{ textTransform: "none", borderRadius: 2 }}
          >
            {deleting ? "Deleting..." : "Delete Filtered"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* EDNS detail dialog */}
      <Dialog
        open={ednsDetailItem !== null}
        onClose={() => setEdnsDetailItem(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          EDNS Client Subnet — #{ednsDetailItem?.id} {ednsDetailItem?.domain}
        </DialogTitle>
        <DialogContent>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.action.hover, 0.04) }}>
                <TableCell />
                <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem" }}>Client Geo</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem" }}>EDNS Geo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(
                [
                  { label: "Subnet", client: ednsDetailItem?.client_ip, edns: ednsDetailItem?.edns_subnet },
                  { label: "Country", client: ednsDetailItem?.country_code, edns: ednsDetailItem?.edns_country_code },
                  { label: "City", client: ednsDetailItem?.city, edns: ednsDetailItem?.edns_city },
                  { label: "ASN", client: ednsDetailItem?.asn, edns: ednsDetailItem?.edns_asn },
                  { label: "AS Name", client: ednsDetailItem?.as_name, edns: ednsDetailItem?.edns_as_name },
                  { label: "NSID", client: "—", edns: ednsDetailItem?.nsid },
                ] as const
              ).map((row) => (
                <TableRow
                  key={row.label}
                  sx={{
                    bgcolor:
                      row.client && row.edns && row.client !== row.edns
                        ? alpha(theme.palette.warning.main, 0.08)
                        : undefined,
                  }}
                >
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: "0.8rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.label}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: "0.8rem",
                      wordBreak: "break-all",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <span>{row.client || "—"}</span>
                      {row.client && row.label !== "NSID" && (
                        <IconButton size="small" onClick={() => copyText(row.client!)}>
                          <ContentCopyIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell
                    sx={{
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: "0.8rem",
                      wordBreak: "break-all",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <span>{row.edns || "—"}</span>
                      {row.edns && row.label !== "NSID" && (
                        <IconButton size="small" onClick={() => copyText(row.edns!)}>
                          <ContentCopyIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            Rows highlighted when Client Geo differs from EDNS Geo.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setEdnsDetailItem(null)}
            sx={{ textTransform: "none", borderRadius: 2 }}
          >
            {messages.close}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          sx={{ borderRadius: 2 }}
          onClose={() => setToast({ ...toast, open: false })}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
