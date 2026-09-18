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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tooltip,
  useTheme,
  Pagination,
} from "@mui/material";
import { Snackbar } from "../toast";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CachedIcon from "@mui/icons-material/Cached";
import { alpha } from "@mui/material";
import Link from "../Link";
import LinkIcon from "@mui/icons-material/Link";
import { hasToken, getGeoCache, deleteGeoCache } from "../lib/api";
import type { GeoCacheEntry } from "../lib/types";
import { useDocumentTitle } from "../useDocumentTitle";
import { useDnsMessages } from "../i18n";

const PAGE_SIZE = 20;

export default function GeocachePage() {
  const theme = useTheme();
  const messages = useDnsMessages();
  useDocumentTitle(messages.geocache);

  // Search filters
  const [subnet, setSubnet] = useState("");
  const [searchSubnet, setSearchSubnet] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [searchCountryCode, setSearchCountryCode] = useState("");

  // Data
  const [entries, setEntries] = useState<GeoCacheEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Selection
  const [selectedSubnets, setSelectedSubnets] = useState<Set<string>>(new Set());

  // Delete
  const [deleteSubnets, setDeleteSubnets] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [clearAllOpen, setClearAllOpen] = useState(false);
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
    try {
      const data = await getGeoCache({
        subnet: searchSubnet || undefined,
        country_code: searchCountryCode || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      setEntries(data.entries || []);
      setTotal(data.total);
    } catch {
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [searchSubnet, searchCountryCode, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = () => {
    setSearchSubnet(subnet.trim());
    setSearchCountryCode(countryCode.trim().toUpperCase());
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
    setPage(1);
  };

  // Clear selection on filter change
  useEffect(() => {
    setSelectedSubnets(new Set());
  }, [searchSubnet, searchCountryCode, page]);

  // --- Selection helpers ---
  const toggleSelect = (subnet: string) => {
    setSelectedSubnets((prev) => {
      const next = new Set(prev);
      if (next.has(subnet)) next.delete(subnet);
      else next.add(subnet);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allSubnets = entries.map((e) => e.subnet);
    if (allSubnets.every((s) => selectedSubnets.has(s))) {
      setSelectedSubnets(new Set());
    } else {
      setSelectedSubnets(new Set(allSubnets));
    }
  };

  const isAllSelected = entries.length > 0 && entries.every((e) => selectedSubnets.has(e.subnet));
  const isIndeterminate = entries.some((e) => selectedSubnets.has(e.subnet)) && !isAllSelected;

  // --- Delete ---
  const confirmDeleteEntry = (subnets: string[]) => {
    setDeleteSubnets(subnets);
    setDeleteOpen(true);
  };

  const handleDeleteEntry = async () => {
    if (deleteSubnets.length === 0) return;
    setDeleting(true);
    try {
      let deleted = 0;
      for (const s of deleteSubnets) {
        try {
          const result = await deleteGeoCache({ subnet: s });
          deleted += result.deleted;
        } catch {
          // continue
        }
      }
      showToast(`Deleted ${deleted} cache entr${deleted !== 1 ? "ies" : "y"}`, "success");
      setSelectedSubnets(new Set());
      await fetchData();
      setDeleteOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete cache failed", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleClearAll = async () => {
    setDeleting(true);
    try {
      const result = await deleteGeoCache();
      showToast(`Deleted ${result.deleted} cache entries`, "success");
      await fetchData();
      setClearAllOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Clear cache failed", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteFiltered = async () => {
    setDeleting(true);
    try {
      const result = await deleteGeoCache({
        subnet: searchSubnet || undefined,
        country_code: searchCountryCode || undefined,
      });
      showToast(`Deleted ${result.deleted} cache entries matching filter`, "success");
      setSelectedSubnets(new Set());
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
    <Box sx={{ px: { xs: 2, sm: 4 }, py: 4, maxWidth: 1200, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: "var(--font-inter)" }}>
            <CachedIcon sx={{ fontSize: 28, verticalAlign: "middle", mr: 1, color: "warning.main" }} />
            {messages.geocache}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {messages.geocacheDescription} — {total} {messages.entries}
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
              sx={{ flex: { xs: "1 1 100%", sm: "1 1 200px" } }}
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
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setClearAllOpen(true)}
                sx={{ textTransform: "none", borderRadius: 2 }}
              >
                {messages.clearAll}
              </Button>
              {(searchSubnet || searchCountryCode) && (
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

      {/* Batch action bar */}
      {selectedSubnets.size > 0 && (
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
            {selectedSubnets.size} entr{selectedSubnets.size !== 1 ? "ies" : "y"} selected
          </Typography>
          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            onClick={() => confirmDeleteEntry(Array.from(selectedSubnets))}
            sx={{ textTransform: "none", borderRadius: 2 }}
          >
            {messages.deleteSelected}
          </Button>
          <Button
            variant="text"
            size="small"
            onClick={() => setSelectedSubnets(new Set())}
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
      ) : entries.length === 0 ? (
        <Card elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 2, textAlign: "center", py: 8 }}>
          <CardContent>
            <CachedIcon sx={{ fontSize: 56, mb: 2, color: "text.disabled" }} />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              {messages.noCache}
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Geo cache entries appear when DNS queries are geolocated. Try searching with different filters.
            </Typography>
          </CardContent>
        </Card>
      ) : (
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
                  #
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                  {messages.subnet}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                  {messages.country}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                  {messages.city}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                  {messages.asn}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                  {messages.asName}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                  {messages.expires}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, width: 48 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry, idx) => {
                const isSelected = selectedSubnets.has(entry.subnet);
                return (
                <TableRow
                  key={entry.subnet}
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
                      onChange={() => toggleSelect(entry.subnet)}
                      sx={{ p: 0.5 }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem", color: "text.secondary" }}>
                    {idx + 1}
                  </TableCell>
                  <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      {entry.subnet}
                      <IconButton size="small" onClick={() => copyText(entry.subnet)}>
                        <ContentCopyIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                    <Chip label={entry.country_code} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                    {entry.city || "—"}
                  </TableCell>
                  <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" }}>
                    {entry.asn || "—"}
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
                    <Tooltip title={entry.as_name || ""}>
                      <span>{entry.as_name || "—"}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                    {formatTime(entry.expires_at)}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Delete this cache entry">
                      <IconButton size="small" onClick={() => confirmDeleteEntry([entry.subnet])} color="error">
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
      )}

      {/* Pagination */}
      {(() => {
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        if (totalPages > 1) {
          return (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, p) => setPage(p)}
                color="primary"
                shape="rounded"
              />
            </Box>
          );
        }
        return null;
      })()}

      {/* Delete single entry dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Cache Entry</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deleteSubnets.length}</strong> cache entr
            {deleteSubnets.length !== 1 ? "ies" : "y"}?
          </Typography>
          {deleteSubnets.length === 1 && (
            <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary", fontFamily: "monospace" }}>
              {deleteSubnets[0]}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Entr{deleteSubnets.length !== 1 ? "ies" : "y"} will be re-created on the next geolocation lookup.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteOpen(false)} sx={{ textTransform: "none", borderRadius: 2 }}>
            {messages.cancel}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteEntry}
            disabled={deleting}
            sx={{ textTransform: "none", borderRadius: 2 }}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Clear all dialog */}
      <Dialog open={clearAllOpen} onClose={() => setClearAllOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Clear All Cache</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>all</strong> geo cache entries?
          </Typography>
          <Typography variant="body2" color="error.main" sx={{ mt: 1, fontWeight: 600 }}>
            This action cannot be undone. All cached geolocation data will be cleared.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setClearAllOpen(false)} sx={{ textTransform: "none", borderRadius: 2 }}>
            {messages.cancel}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleClearAll}
            disabled={deleting}
            sx={{ textTransform: "none", borderRadius: 2 }}
          >
            {deleting ? "Clearing..." : "Clear All"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete filtered dialog */}
      <Dialog open={deleteFilteredOpen} onClose={() => setDeleteFilteredOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Filtered Cache</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>all</strong> geo cache entries matching the current filter?
          </Typography>
          <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {searchSubnet && (
              <Chip label={`Subnet: ${searchSubnet}`} size="small" variant="outlined" />
            )}
            {searchCountryCode && (
              <Chip label={`Country: ${searchCountryCode}`} size="small" variant="outlined" />
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
