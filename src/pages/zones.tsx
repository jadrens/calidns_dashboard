"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Chip,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Collapse,
  Switch,
  FormControlLabel,
  Checkbox,
  InputAdornment,
  useTheme,
} from "@mui/material";
import { Snackbar } from "../toast";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import BoltIcon from "@mui/icons-material/Bolt";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import { alpha } from "@mui/material";
import {
  hasToken,
  listZones,
  saveZone,
  deleteZone,
  deleteZoneCountry,
} from "../lib/api";
import { validateRecordValue } from "../lib/validation";
import type { Zone, DnsRecordSet, ZoneCountries } from "../lib/types";
import { useDocumentTitle } from "../useDocumentTitle";
import { useDnsMessages } from "../i18n";

const RECORD_TYPES = ["a", "aaaa", "txt", "cname"] as const;
const RECORD_LABELS: Record<string, string> = {
  a: "A (IPv4)",
  aaaa: "AAAA (IPv6)",
  txt: "TXT",
  cname: "CNAME",
};

function emptyRecordSet(): DnsRecordSet {
  return { a: [], aaaa: [], txt: [], cname: [] };
}

function emptyZone(): Zone {
  return {
    pattern: "",
    regex: "",
    countries: { default: emptyRecordSet() },
    ttl: 600,
    record: true,
    fast_open: false,
  };
}

export default function ZonesPage() {
  const theme = useTheme();
  const messages = useDnsMessages();
  useDocumentTitle(messages.zoneManagement);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Selection
  const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(new Set());

  // Batch delete
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  // Filtered zones
  const filteredZones = zones.filter((z) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return z.pattern.toLowerCase().includes(q);
  });

  // Clear selection when search changes
  const clearSelection = () => setSelectedPatterns(new Set());

  // Editor dialog
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone>(emptyZone());
  const [editingPattern, setEditingPattern] = useState<string | null>(null);
  const [expandedPattern, setExpandedPattern] = useState<string | null>(null);
  const [updatingPattern, setUpdatingPattern] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState("");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Zone | null>(null);
  const [deleteCountry, setDeleteCountry] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  // IP validation errors: key = `${countryCode}:${recordType}:${index}`
  const [recordErrors, setRecordErrors] = useState<Record<string, string>>({});

  const fetchZones = useCallback(async () => {
    if (!hasToken()) return;
    setLoading(true);
    try {
      const data = await listZones();
      setZones(data.zones);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch zones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  // --- Editor helpers ---

  const openAddEditor = () => {
    setEditingZone(emptyZone());
    setEditingPattern(null);
    setEditorError("");
    setRecordErrors({});
    setEditorOpen(true);
  };

  const openEditEditor = (zone: Zone) => {
    // Deep clone to avoid mutating original
    setEditingZone(JSON.parse(JSON.stringify(zone)));
    setEditingPattern(zone.pattern);
    setExpandedPattern(zone.pattern);
    setEditorError("");
    setRecordErrors({});
  };

  const toggleZoneSetting = async (zone: Zone, setting: "record" | "fast_open") => {
    setUpdatingPattern(zone.pattern);
    const updated = { ...zone, [setting]: !zone[setting] };
    try {
      await saveZone(updated);
      setZones((current) => current.map((item) => item.pattern === zone.pattern ? updated : item));
      if (editingPattern === zone.pattern) {
        setEditingZone((current) => ({ ...current, [setting]: updated[setting] }));
      }
      showToast("Zone saved successfully", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save zone", "error");
    } finally {
      setUpdatingPattern(null);
    }
  };

  const updateCountryCode = (oldCode: string, newCode: string) => {
    if (oldCode === newCode) return;
    const countries: ZoneCountries = {};
    for (const [code, records] of Object.entries(editingZone.countries)) {
      const key = code === oldCode ? newCode : code;
      countries[key] = records;
    }
    setEditingZone({ ...editingZone, countries });
  };

  const updateRecordValue = (countryCode: string, recordType: string, index: number, value: string) => {
    const records = { ...editingZone.countries[countryCode] } as Record<string, string[]>;
    const arr = [...(records[recordType] || [])];
    arr[index] = value;
    records[recordType] = arr;
    setEditingZone({
      ...editingZone,
      countries: { ...editingZone.countries, [countryCode]: records as DnsRecordSet },
    });

    // Validate IP for A/AAAA records
    const errorKey = `${countryCode}:${recordType}:${index}`;
    const err = validateRecordValue(recordType, value);
    setRecordErrors((prev) => {
      const next = { ...prev };
      if (err) {
        next[errorKey] = err;
      } else {
        delete next[errorKey];
      }
      return next;
    });
  };

  const addRecordValue = (countryCode: string, recordType: string) => {
    const records = { ...editingZone.countries[countryCode] } as Record<string, string[]>;
    records[recordType] = [...(records[recordType] || []), ""];
    setEditingZone({
      ...editingZone,
      countries: { ...editingZone.countries, [countryCode]: records as DnsRecordSet },
    });
  };

  const removeRecordValue = (countryCode: string, recordType: string, index: number) => {
    const records = { ...editingZone.countries[countryCode] } as Record<string, string[]>;
    records[recordType] = [...(records[recordType] || [])];
    records[recordType].splice(index, 1);
    setEditingZone({
      ...editingZone,
      countries: { ...editingZone.countries, [countryCode]: records as DnsRecordSet },
    });

    // Remove validation error for this slot and re-index remaining
    setRecordErrors((prev) => {
      const next: Record<string, string> = {};
      const prefix = `${countryCode}:${recordType}:`;
      for (const [key, err] of Object.entries(prev)) {
        if (!key.startsWith(prefix)) {
          next[key] = err;
          continue;
        }
        const idx = parseInt(key.slice(prefix.length), 10);
        if (idx < index) {
          next[key] = err;
        } else if (idx > index) {
          next[`${prefix}${idx - 1}`] = err;
        }
        // idx === index: drop it
      }
      return next;
    });
  };

  const addCountry = () => {
    // Don't allow adding if there's already an empty country code
    if ("" in editingZone.countries) return;
    const countries = { ...editingZone.countries, "": emptyRecordSet() };
    setEditingZone({ ...editingZone, countries });
  };

  const removeCountry = (code: string) => {
    if (code === "default") return;
    const countries = { ...editingZone.countries };
    delete countries[code];
    setEditingZone({ ...editingZone, countries });
  };

  const handleSave = async () => {
    const zone = editingZone;
    if (!zone.pattern.trim()) {
      setEditorError("Pattern is required");
      return;
    }
    // Reject empty country codes
    for (const code of Object.keys(zone.countries)) {
      if (!code.trim()) {
        setEditorError("Country code cannot be empty. Please enter a valid country code (e.g. US)");
        return;
      }
    }

    // Check IP validation errors
    const ipErrors = Object.entries(recordErrors).filter(([, err]) => !!err);
    if (ipErrors.length > 0) {
      setEditorError(`Please fix ${ipErrors.length} invalid IP address(es) before saving`);
      return;
    }

    // Clean empty strings from record arrays
    const cleaned: ZoneCountries = {};
    for (const [code, records] of Object.entries(zone.countries)) {
      const cleanedRecords: DnsRecordSet = {};
      let hasAny = false;
      for (const type of RECORD_TYPES) {
        const vals = (records[type] || []).filter((v) => v.trim());
        if (vals.length > 0) {
          cleanedRecords[type] = vals;
          hasAny = true;
        }
      }
      if (hasAny || code === "default") {
        cleaned[code] = hasAny ? cleanedRecords : records;
      }
    }

    const payload: Zone = {
      ...zone,
      pattern: zone.pattern.trim(),
      regex: zone.regex.trim() || zone.pattern.trim(),
      countries: cleaned,
    };

    setSaving(true);
    setEditorError("");
    try {
      await saveZone(payload);
      if (editingPattern !== null) {
        setZones((current) => current.map((item) => item.pattern === editingPattern ? payload : item));
        if (payload.pattern !== editingPattern) {
          try {
            const data = await listZones();
            setZones(data.zones);
          } catch {
            // Keep the saved zone visible; the next manual refresh will reconcile the list.
          }
        }
        setExpandedPattern(payload.pattern);
        setEditingPattern(null);
      } else {
        setEditorOpen(false);
        await fetchZones();
      }
      showToast("Zone saved successfully", "success");
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : "Failed to save zone");
    } finally {
      setSaving(false);
    }
  };

  // --- Delete helpers ---

  const confirmDeleteZone = (zone: Zone) => {
    setDeleteTarget(zone);
    setDeleteCountry(null);
    setDeleteOpen(true);
  };

  const confirmDeleteCountry = (zone: Zone, country: string) => {
    setDeleteTarget(zone);
    setDeleteCountry(country);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteCountry) {
        await deleteZoneCountry(deleteTarget.pattern, deleteCountry);
        showToast(`Country "${deleteCountry}" deleted`, "success");
      } else {
        await deleteZone(deleteTarget.pattern);
        showToast("Zone deleted", "success");
      }
      setDeleteOpen(false);
      await fetchZones();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  };

  // --- Selection helpers ---

  const toggleSelect = (pattern: string) => {
    setSelectedPatterns((prev) => {
      const next = new Set(prev);
      if (next.has(pattern)) next.delete(pattern);
      else next.add(pattern);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allPatterns = filteredZones.map((z) => z.pattern);
    if (allPatterns.every((p) => selectedPatterns.has(p))) {
      setSelectedPatterns(new Set());
    } else {
      setSelectedPatterns(new Set(allPatterns));
    }
  };

  const isAllSelected = filteredZones.length > 0 && filteredZones.every((z) => selectedPatterns.has(z.pattern));
  const isIndeterminate = filteredZones.some((z) => selectedPatterns.has(z.pattern)) && !isAllSelected;

  // --- Batch delete ---

  const handleBatchDelete = async () => {
    if (selectedPatterns.size === 0) return;
    setBatchDeleting(true);
    let deleted = 0;
    for (const pattern of selectedPatterns) {
      try {
        await deleteZone(pattern);
        deleted++;
      } catch {
        // continue with remaining
      }
    }
    setBatchDeleting(false);
    setBatchDeleteOpen(false);
    setSelectedPatterns(new Set());
    showToast(`Deleted ${deleted} zone(s)`, deleted > 0 ? "success" : "error");
    await fetchZones();
  };

  const showToast = (message: string, severity: "success" | "error") => {
    setToast({ open: true, message, severity });
  };

  const copyPattern = async (pattern: string) => {
    try {
      await navigator.clipboard.writeText(pattern);
      showToast("Pattern copied", "success");
    } catch {
      showToast("Failed to copy", "error");
    }
  };

  const editorFields = (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1 }}>
      <TextField
        label="Pattern (regex)"
        value={editingZone.pattern}
        onChange={(e) => setEditingZone({ ...editingZone, pattern: e.target.value, regex: e.target.value })}
        placeholder="^example\.com\.?$"
        fullWidth
        slotProps={{
          input: {
            sx: { borderRadius: 2, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.85rem" },
          },
        }}
        helperText="Go regex pattern to match incoming DNS queries"
      />

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <TextField
          label="TTL (seconds)"
          type="number"
          value={editingZone.ttl}
          onChange={(e) => setEditingZone({ ...editingZone, ttl: parseInt(e.target.value) || 600 })}
          slotProps={{
            input: {
              sx: { borderRadius: 2, fontFamily: "var(--font-jetbrains-mono), monospace" },
            },
          }}
          sx={{ width: 160 }}
        />
        {editingPattern === null && <>
          <FormControlLabel
            control={<Switch checked={editingZone.record} onChange={(e) => setEditingZone({ ...editingZone, record: e.target.checked })} />}
            label={messages.recordQueries}
          />
          <FormControlLabel
            control={<Switch checked={editingZone.fast_open} onChange={(e) => setEditingZone({ ...editingZone, fast_open: e.target.checked })} />}
            label={messages.fastOpen}
          />
        </>}
      </Box>

      {/* Countries */}
      <Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Countries / Records
          </Typography>
          <Button size="small" onClick={addCountry} startIcon={<AddIcon />} sx={{ textTransform: "none" }}>
            {messages.addCountry}
          </Button>
        </Box>

        {Object.entries(editingZone.countries).map(([code, records], idx) => (
          <Card
            key={idx}
            elevation={0}
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              mb: 1.5,
              bgcolor: alpha(theme.palette.background.default, 0.5),
            }}
          >
            <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <TextField
                  size="small"
                  value={code}
                  onChange={(e) => updateCountryCode(code, e.target.value)}
                  disabled={code === "default"}
                  placeholder="e.g. US"
                  slotProps={{
                    input: {
                      sx: { borderRadius: 1.5, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" },
                    },
                  }}
                  sx={{ width: 100 }}
                />
                {code !== "default" && (
                  <Tooltip title={`Remove country "${code}"`}>
                    <IconButton size="small" onClick={() => removeCountry(code)} color="error">
                      <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>

              {RECORD_TYPES.map((type) => (
                <Box key={type} sx={{ mb: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 80, fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                      {RECORD_LABELS[type]}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => addRecordValue(code, type)}
                      sx={{ textTransform: "none", fontSize: "0.7rem", py: 0, minWidth: 24 }}
                    >
                      +
                    </Button>
                  </Box>
                  {(records[type] || []).map((val, i) => (
                    <Box key={i} sx={{ display: "flex", gap: 0.5, mb: 0.5 }}>
                      <TextField
                        size="small"
                        fullWidth
                        value={val}
                        onChange={(e) => updateRecordValue(code, type, i, e.target.value)}
                        placeholder={type === "a" ? "e.g. 192.168.1.1" : type === "aaaa" ? "e.g. 2001:db8::1" : "Enter value..."}
                        error={!!recordErrors[`${code}:${type}:${i}`]}
                        helperText={recordErrors[`${code}:${type}:${i}`] || undefined}
                        slotProps={{
                          input: {
                            sx: { borderRadius: 1.5, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem" },
                          },
                        }}
                      />
                      <IconButton size="small" onClick={() => removeRecordValue(code, type, i)}>
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              ))}
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );

  if (!hasToken()) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <Typography variant="h6" color="text.secondary">Please enter your API token</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 2, sm: 4 }, py: 4, width: "100%", maxWidth: 1440, mx: "auto" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: "var(--font-inter)" }}>
            {messages.zoneManagement}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {zones.length} zone{zones.length !== 1 ? "s" : ""}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            onClick={fetchZones}
            disabled={loading}
            sx={{ textTransform: "none", borderRadius: 2 }}
          >
            {messages.refresh}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openAddEditor}
            sx={{ textTransform: "none", borderRadius: 2 }}
          >
            {messages.addZone}
          </Button>
        </Box>
      </Box>

      {/* Search + Batch actions */}
      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          size="small"
          placeholder="Search zones..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); clearSelection(); }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: 240, flex: 1 }}
        />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Checkbox
            checked={isAllSelected}
            indeterminate={isIndeterminate}
            onChange={toggleSelectAll}
            disabled={filteredZones.length === 0}
            size="small"
          />
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
            {selectedPatterns.size > 0 ? `${selectedPatterns.size} selected` : "Select all"}
          </Typography>
          {selectedPatterns.size > 0 && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteIcon />}
              onClick={() => setBatchDeleteOpen(true)}
              sx={{ textTransform: "none", borderRadius: 2 }}
            >
              Delete Selected ({selectedPatterns.size})
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : zones.length === 0 ? (
        <Card elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 2, textAlign: "center", py: 8 }}>
          <CardContent>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
              {messages.noZones}
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openAddEditor} sx={{ textTransform: "none", borderRadius: 2 }}>
              {messages.createFirstZone}
            </Button>
          </CardContent>
        </Card>
      ) : filteredZones.length === 0 ? (
        <Card elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: 2, textAlign: "center", py: 8 }}>
          <CardContent>
            <Typography variant="h6" color="text.secondary">
              {messages.noZoneMatches}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {filteredZones.map((zone) => (
            <Card
              key={zone.pattern}
              elevation={0}
              sx={{ border: 1, borderColor: selectedPatterns.has(zone.pattern) ? "primary.main" : "divider", borderRadius: 2 }}
            >
              <Box sx={{ display: "flex", alignItems: "center", px: { xs: 1, sm: 2 }, gap: 0.5 }}>
                <Checkbox
                  checked={selectedPatterns.has(zone.pattern)}
                  onChange={() => toggleSelect(zone.pattern)}
                  size="small"
                  slotProps={{ input: { "aria-label": `Select ${zone.pattern}` } }}
                />
                <ButtonBase onClick={() => setExpandedPattern(expandedPattern === zone.pattern ? null : zone.pattern)} aria-expanded={expandedPattern === zone.pattern} aria-label={`Toggle ${zone.pattern} details`} sx={{ flex: 1, minWidth: 0, minHeight: 52, px: 1, display: "flex", justifyContent: "space-between", textAlign: "left" }}>
                  <Typography sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.85rem", fontWeight: 600, overflowWrap: "anywhere" }}>
                    {zone.pattern}
                  </Typography>
                  <ExpandMoreIcon sx={{ ml: 1, transform: expandedPattern === zone.pattern ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                </ButtonBase>
                <Tooltip title={messages.copyPattern}><IconButton size="small" onClick={() => copyPattern(zone.pattern)} aria-label={messages.copyPattern}><ContentCopyIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                <Tooltip title={`${messages.recordQueries}: ${zone.record ? messages.on : messages.off}`}>
                  <span><IconButton size="small" disabled={updatingPattern === zone.pattern || (saving && editingPattern === zone.pattern)} onClick={() => toggleZoneSetting(zone, "record")} aria-label={messages.recordQueries} aria-pressed={zone.record} sx={{ color: zone.record ? "success.main" : "text.disabled" }}><FiberManualRecordIcon sx={{ fontSize: 20 }} /></IconButton></span>
                </Tooltip>
                <Tooltip title={`${messages.fastOpen}: ${zone.fast_open ? messages.on : messages.off}`}>
                  <span><IconButton size="small" disabled={updatingPattern === zone.pattern || (saving && editingPattern === zone.pattern)} onClick={() => toggleZoneSetting(zone, "fast_open")} aria-label={messages.fastOpen} aria-pressed={zone.fast_open} sx={{ color: zone.fast_open ? "warning.main" : "text.disabled" }}><BoltIcon sx={{ fontSize: 20 }} /></IconButton></span>
                </Tooltip>
                <Tooltip title={messages.deleteZone}><IconButton size="small" onClick={() => confirmDeleteZone(zone)} color="error" aria-label={messages.deleteZone}><DeleteIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
              </Box>
              <Collapse in={expandedPattern === zone.pattern} unmountOnExit>
              <Box sx={{ px: { xs: 2, sm: 3 }, pt: 1, pb: 2 }}>
                {editingPattern === zone.pattern ? <>
                  {editorError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setEditorError("")}>{editorError}</Alert>}
                  {editorFields}
                  <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2 }}>
                    <Button onClick={() => setEditingPattern(null)} disabled={saving}>{messages.cancel}</Button>
                    <Button variant="contained" onClick={handleSave} disabled={saving || updatingPattern === zone.pattern || !editingZone.pattern.trim()}>{saving ? "Saving..." : messages.save}</Button>
                  </Box>
                </> : <>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">TTL: {zone.ttl}s</Typography>
                    <Button size="small" startIcon={<EditIcon />} onClick={() => openEditEditor(zone)} disabled={updatingPattern === zone.pattern}>{messages.editZone}</Button>
                </Box>
                <Box>
                  {Object.entries(zone.countries).map(([code, records]) => (
                    <Accordion
                      key={code}
                      disableGutters
                      elevation={0}
                      sx={{
                        border: 1,
                        borderColor: "divider",
                        borderRadius: "8px !important",
                        mb: 0.5,
                        "&:before": { display: "none" },
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                          minHeight: 40,
                          "& .MuiAccordionSummary-content": { my: 0.5, alignItems: "center", gap: 1 },
                        }}
                      >
                        <Chip
                          label={code}
                          size="small"
                          color={code === "default" ? "primary" : "info"}
                          variant={code === "default" ? "filled" : "outlined"}
                        />
                        {code !== "default" && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDeleteCountry(zone, code);
                            }}
                            sx={{ ml: "auto", mr: 1 }}
                          >
                            <CloseIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        )}
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                                {messages.type}
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, fontSize: "0.8rem", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                                {messages.values}
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {RECORD_TYPES.filter((t) => (records[t] || []).length > 0).map((type) => (
                              <TableRow key={type}>
                                <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem", width: 100 }}>
                                  {RECORD_LABELS[type]}
                                </TableCell>
                                <TableCell sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.8rem", wordBreak: "break-all" }}>
                                  {(records[type] || []).join(", ")}
                                </TableCell>
                              </TableRow>
                            ))}
                            {RECORD_TYPES.every((t) => !(records[t] || []).length) && (
                              <TableRow>
                                <TableCell colSpan={2} sx={{ fontSize: "0.8rem", color: "text.secondary" }}>
                                  {messages.noRecords}
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
                </>}
              </Box>
              </Collapse>
            </Card>
          ))}
        </Box>
      )}

      {/* --- Add Dialog --- */}
      <Dialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{ backdrop: { sx: { backdropFilter: "blur(4px)" } } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontFamily: "var(--font-inter)" }}>
          {messages.addZone}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {editorError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setEditorError("")}>
              {editorError}
            </Alert>
          )}

          {editorFields}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setEditorOpen(false)} sx={{ textTransform: "none", borderRadius: 2 }}>
            {messages.cancel}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !editingZone.pattern.trim()}
            sx={{ textTransform: "none", borderRadius: 2, px: 4 }}
          >
            {saving ? "Saving..." : "Save Zone"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* --- Delete confirmation --- */}
      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {deleteCountry ? "Delete Country" : "Delete Zone"}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {deleteCountry
              ? `Are you sure you want to delete country "${deleteCountry}" from this zone?`
              : `Are you sure you want to delete the entire zone "${deleteTarget?.pattern}"?`}
          </Typography>
          <Typography variant="body2" color="error.main" sx={{ mt: 1, fontWeight: 600 }}>
            {deleteCountry ? "This action cannot be undone." : "This will delete ALL countries and records. This action cannot be undone."}
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

      {/* --- Batch delete confirmation --- */}
      <Dialog
        open={batchDeleteOpen}
        onClose={() => setBatchDeleteOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Selected Zones</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {selectedPatterns.size} selected zone(s)?
          </Typography>
          <Typography variant="body2" color="error.main" sx={{ mt: 1, fontWeight: 600 }}>
            This will delete ALL countries and records for each zone. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setBatchDeleteOpen(false)} sx={{ textTransform: "none", borderRadius: 2 }}>
            {messages.cancel}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleBatchDelete}
            disabled={batchDeleting}
            sx={{ textTransform: "none", borderRadius: 2 }}
          >
            {batchDeleting ? "Deleting..." : `Delete ${selectedPatterns.size} zone(s)`}
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
