"use client";

import { useEffect, useState, useCallback, Suspense, useMemo } from "react";
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
import CachedIcon from "@mui/icons-material/Cached";
import PublicIcon from "@mui/icons-material/Public";
import LinkIcon from "@mui/icons-material/Link";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { alpha } from "@mui/material";
import Link from "../Link";
import { hasToken, listEdns, deleteEdns } from "../lib/api";
import type { EdnsItem } from "../lib/types";
import { useDocumentTitle } from "../useDocumentTitle";
import { useDnsMessages } from "../i18n";

const PAGE_SIZE = 20;

const QUICK_TIMES = [
  { label: "1h ago", hours: 1 },
  { label: "1d ago", hours: 24 },
  { label: "3d ago", hours: 72 },
  { label: "1w ago", hours: 168 },
];

function EdnsPageContent() {
  const theme = useTheme();
  const messages = useDnsMessages();
  useDocumentTitle(messages.ednsRecords);
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);

  // Search filters
  const [subnet, setSubnet] = useState("");
  const [searchSubnet, setSearchSubnet] = useState("");
  const [nsid, setNsid] = useState("");
  const [searchNsid, setSearchNsid] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [searchCountryCode, setSearchCountryCode] = useState("");
  const [searchId, setSearchId] = useState<number | undefined>(undefined);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timeMenuAnchor, setTimeMenuAnchor] = useState<null | HTMLElement>(null);

  // Data
  const [items, setItems] = useState<EdnsItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Delete
  const [deleteIds, setDeleteIds] = useState<number[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteFilteredOpen, setDeleteFilteredOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });

  const fetchData = useCallback(async () => {
    if (!hasToken()) return;
    setLoading(true);
    setError("");
    try {
      const data = await listEdns({
        id: searchId,
        subnet: searchSubnet || undefined,
        country_code: searchCountryCode || undefined,
        nsid: searchNsid || undefined,
        start: startTime || undefined,
        end: endTime || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch EDNS records");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [searchId, searchSubnet, searchCountryCode, searchNsid, startTime, endTime, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Read ?id= from URL and auto-search
  useEffect(() => {
    const idParam = searchParams.get("id");
    if (idParam) {
      const num = parseInt(idParam, 10);
      if (!isNaN(num) && num > 0) {
        setSearchId(num);
      }
    }
  }, [searchParams]);

  const handleSearch = () => {
    setSearchSubnet(subnet.trim());
    setSearchCountryCode(countryCode.trim().toUpperCase());
    setSearchNsid(nsid.trim());
    setPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleClear = () => {
    setSubnet("");
    setSearchSubnet("");
    setCountryCode("");
    setSearchCountryCode("");
    setNsid("");
    setSearchNsid("");
    setSearchId(undefined);
    setStartTime("");
    setEndTime("");
    setPage(1);
  };

  const handleQuickTime = (hoursAgo: number) => {
    const d = new Date(Date.now() - hoursAgo * 3600000);
    setStartTime(d.toISOString().slice(0, 16));
    setEndTime("");
    setPage(1);
    setTimeMenuAnchor(null);
  };

  // Clear selection on filter/page change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, searchSubnet, searchCountryCode, searchNsid, startTime, endTime, searchId]);

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
    const allIds = items.map((i) => i.id);
    if (allIds.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const isAllSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id));
  const isIndeterminate = items.some((i) => selectedIds.has(i.id)) && !isAllSelected;

  // --- Delete ---
  const confirmDelete = (ids: number[]) => {
    setDeleteIds(ids);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (deleteIds.length === 0) return;
    setDeleting(true);
    try {
      let deleted = 0;
      for (const id of deleteIds) {
        try {
          const result = await deleteEdns({ id });
          deleted += result.deleted;
        } catch {
          // continue
        }
      }
      showToast(`Deleted ${deleted} EDNS record(s)`, "success");
      setSelectedIds(new Set());
      await fetchData();
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
      const result = await deleteEdns({
        id: searchId,
        subnet: searchSubnet || undefined,
        country_code: searchCountryCode || undefined,
        nsid: searchNsid || undefined,
        start: startTime || undefined,
        end: endTime || undefined,
      });
      showToast(`Deleted ${result.deleted} EDNS records matching filter`, "success");
      setSelectedIds(new Set());
      await fetchData();
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
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <Typography variant="h6" color="text.secondary">
          {messages.tokenPrompt}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 2, sm: 4 }, py: 4, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: "var(--font-inter)" }}>
            <PublicIcon sx={{ fontSize: 28, verticalAlign: "middle", mr: 1, color: "info.main" }} />
            {messages.ednsRecords}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {messages.ednsDescription} — {total} {messages.records}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            component={Link}
            href="/mtools/dns-manager/queries"
            variant="outlined"
            size="small"
            startIcon={<LinkIcon />}
            sx={{ textTransform: "none", borderRadius: 2 }}
          >
            {messages.queries}
          </Button>
        </Box>
      </Box>

      {/* Search bar */}
      <Card elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 2, mb: 3 }}>
        <CardContent sx={{ py: 2, px: 3, "&:last-child": { pb: 2 } }}>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-end" }}>
            <TextField
              label={messages.ipSubnet}
              value={subnet}
              onChange={(e) => setSubnet(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 203.0.113.0/24"
              slotProps={{
                input: {
                  sx: { borderRadius: 2, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.85rem" },
                },
              }}
              sx={{ flex: { xs: "1 1 100%", sm: "1 1 180px" } }}
            />
            <TextField
              label={messages.countryCode}
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="e.g. CN"
              slotProps={{
                input: {
                  sx: { borderRadius: 2, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.85rem" },
                },
              }}
              sx={{ flex: { xs: "1 1 100%", sm: "0 0 100px" } }}
            />
            <TextField
              label="NSID"
              value={nsid}
              onChange={(e) => setNsid(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. hkns"
              slotProps={{
                input: {
                  sx: { borderRadius: 2, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.85rem" },
                },
              }}
              sx={{ flex: { xs: "1 1 100%", sm: "1 1 140px" } }}
            />
            <TextField
              label={messages.startTime}
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              slotProps={{
                input: { sx: { borderRadius: 2, fontSize: "0.85rem" } },
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
                input: { sx: { borderRadius: 2, fontSize: "0.85rem" } },
                inputLabel: { shrink: true },
              }}
              sx={{ flex: { xs: "1 1 100%", sm: "0 0 200px" } }}
            />
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
                onClick={handleSearch}
                disabled={loading}
                sx={{ textTransform: "none", borderRadius: 2 }}
              >
                {messages.search}
              </Button>
              <Tooltip title={messages.refreshData}>
                <IconButton
                  onClick={fetchData}
                  disabled={loading}
                  color="primary"
                  sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}
                >
                  <CachedIcon />
                </IconButton>
              </Tooltip>
              <Button variant="outlined" onClick={handleClear} sx={{ textTransform: "none", borderRadius: 2 }}>
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
              <Menu anchorEl={timeMenuAnchor} open={Boolean(timeMenuAnchor)} onClose={() => setTimeMenuAnchor(null)}>
                {QUICK_TIMES.map((qt) => (
                  <MenuItem key={qt.label} onClick={() => handleQuickTime(qt.hours)}>
                    {qt.label}
                  </MenuItem>
                ))}
              </Menu>
              {(searchSubnet || searchCountryCode || searchNsid || startTime || endTime || searchId !== undefined) && (
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

      {/* Active ID filter */}
      {searchId !== undefined && (
        <Alert
          severity="info"
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button
              size="small"
              color="inherit"
              onClick={() => setSearchId(undefined)}
              sx={{ textTransform: "none" }}
            >
              {messages.clear}
            </Button>
          }
        >
          Filtered by query ID: #{searchId}
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
            onClick={() => confirmDelete(Array.from(selectedIds))}
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

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {/* Table */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : items.length === 0 ? (
        <Card elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 2, textAlign: "center", py: 8 }}>
          <CardContent>
            <PublicIcon sx={{ fontSize: 56, mb: 2, color: "text.disabled" }} />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              {messages.noEdns}
            </Typography>
            <Typography variant="body2" color="text.disabled">
              EDNS records appear when clients send EDNS Client Subnet (ECS) information with their DNS queries
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 2, overflow: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.action.hover, 0.04) }}>
                  <TableCell sx={{ width: 48, p: "4px 8px" }}>
                    <Checkbox
                      size="small"
                      checked={isAllSelected}
                      indeterminate={isIndeterminate}
                      onChange={toggleSelectAll}
                      sx={{ p: 0.5 }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                    {messages.id}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                    {messages.domain}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                    {messages.type}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                    {messages.clientIp}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                    {messages.subnet}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                    EDNS Country
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                    EDNS City
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                    EDNS ASN
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                    EDNS AS Name
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                    NSID
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                    {messages.time}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 48 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, idx) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                  <TableRow
                    key={`${item.id}-${idx}`}
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
                      <Checkbox
                        size="small"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id)}
                        sx={{ p: 0.5 }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                      <Tooltip title="View in Queries">
                        <Button
                          component={Link}
                          href={`/mtools/dns-manager/queries?highlight=${item.id}`}
                          size="small"
                          variant="text"
                          sx={{
                            textTransform: "none",
                            borderRadius: 1,
                            p: 0,
                            minWidth: "auto",
                            fontFamily: "var(--font-jetbrains-mono), monospace",
                            color: "info.main",
                            fontSize: "0.8rem",
                          }}
                        >
                          #{item.id}
                        </Button>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem", wordBreak: "break-all", maxWidth: 160 }}>
                      {item.domain}
                    </TableCell>
                    <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                      <Chip label={item.query_type} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        {item.client_ip}
                        <IconButton size="small" onClick={() => copyText(item.client_ip)}>
                          <ContentCopyIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        {item.subnet}
                        <IconButton size="small" onClick={() => copyText(item.subnet)}>
                          <ContentCopyIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                      <Chip label={item.edns_country_code || "—"} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                      {item.edns_city || "—"}
                    </TableCell>
                    <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                      {item.edns_asn || "—"}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                        fontSize: "0.8rem",
                        maxWidth: 140,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <Tooltip title={item.edns_as_name || ""}>
                        <span>{item.edns_as_name || "—"}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.75rem", wordBreak: "break-all", maxWidth: 120 }}>
                      {item.nsid || "—"}
                    </TableCell>
                    <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                      {formatTime(item.created_at)}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={`Delete EDNS record #${item.id}`}>
                        <IconButton size="small" onClick={() => confirmDelete([item.id])} color="error">
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
        <DialogTitle sx={{ fontWeight: 700 }}>Delete EDNS Record</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deleteIds.length}</strong> EDNS record
            {deleteIds.length !== 1 ? "s" : ""}?
          </Typography>
          {deleteIds.length === 1 && (
            <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary", fontFamily: "monospace" }}>
              ID: {deleteIds[0]}
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
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Filtered EDNS Records</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>all</strong> EDNS records matching the current filter?
          </Typography>
          <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {searchId !== undefined && (
              <Chip label={`ID: #${searchId}`} size="small" variant="outlined" />
            )}
            {searchSubnet && (
              <Chip label={`Subnet: ${searchSubnet}`} size="small" variant="outlined" />
            )}
            {searchCountryCode && (
              <Chip label={`Country: ${searchCountryCode}`} size="small" variant="outlined" />
            )}
            {searchNsid && (
              <Chip label={`NSID: ${searchNsid}`} size="small" variant="outlined" />
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

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={toast.severity} variant="filled" sx={{ borderRadius: 2 }} onClose={() => setToast({ ...toast, open: false })}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default function EdnsPage() {
  return (
    <Suspense fallback={
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    }>
      <EdnsPageContent />
    </Suspense>
  );
}
