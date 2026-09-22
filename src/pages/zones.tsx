"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  Tabs,
  Tab,
  useTheme,
	useMediaQuery,
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
import MoreVertIcon from "@mui/icons-material/MoreVert";
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
import { getZoneDepthGroup } from "../lib/zoneGrouping";

type RecordType = keyof DnsRecordSet;

const RECORD_TYPES: readonly RecordType[] = [
  "a", "aaaa", "txt", "cname", "mx", "ns", "srv", "caa", "ptr", "soa", "other",
];
const RECORD_LABELS: Record<RecordType, string> = {
  a: "A (IPv4)",
  aaaa: "AAAA (IPv6)",
  txt: "TXT",
  cname: "CNAME",
  mx: "MX",
  ns: "NS",
  srv: "SRV",
  caa: "CAA",
  ptr: "PTR",
  soa: "SOA",
  other: "Other",
};
const RECORD_PLACEHOLDERS: Record<RecordType, string> = {
  a: "192.0.2.10",
  aaaa: "2001:db8::10",
  txt: "v=spf1 mx -all",
  cname: "target.example.com.",
  mx: "10 mail.example.com.",
  ns: "ns1.example.com.",
  srv: "10 5 443 service.example.com.",
  caa: '0 issue "letsencrypt.org"',
  ptr: "host.example.com.",
  soa: "ns1.example.com. hostmaster.example.com. 2026092001 3600 900 1209600 300",
  other: "SSHFP 1 1 0123456789abcdef...",
};
const ZONE_DEPTHS = [1, 2, 3, 4] as const;

function emptyRecordSet(): DnsRecordSet {
  return Object.fromEntries(RECORD_TYPES.map((type) => [type, []])) as DnsRecordSet;
}

function emptyZone(): Zone {
  return {
    pattern: "",
    regex: "",
    mode: "simple",
    countries: { default: emptyRecordSet() },
    ttl: 600,
    record: true,
    fast_open: false,
  };
}

export default function ZonesPage() {
  const theme = useTheme();
	const compactActions = useMediaQuery(theme.breakpoints.down("md"));
  const messages = useDnsMessages();
  useDocumentTitle(messages.zoneManagement);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Group zones by the requested number of rightmost domain labels.
  const [zoneDepth, setZoneDepth] = useState<number>(2);
  const [selectedGroup, setSelectedGroup] = useState("");

  // Selection
  const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(new Set());

  // Batch delete
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const zoneGroups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const zone of zones) {
      const group = getZoneDepthGroup(zone.pattern, zoneDepth);
      counts.set(group, (counts.get(group) || 0) + 1);
    }
    return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [zoneDepth, zones]);

  const activeGroup = zoneGroups.some(([group]) => group === selectedGroup)
    ? selectedGroup
    : zoneGroups[0]?.[0] || "";

  // Filtered zones
  const filteredZones = zones.filter((z) => {
    if (getZoneDepthGroup(z.pattern, zoneDepth) !== activeGroup) return false;
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
  const [zoneMenuAnchor, setZoneMenuAnchor] = useState<HTMLElement | null>(null);
  const [zoneMenuTarget, setZoneMenuTarget] = useState<Zone | null>(null);

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

  const updateRecordValue = (countryCode: string, recordType: RecordType, index: number, value: string) => {
    const records = { ...editingZone.countries[countryCode] } as Record<string, string[]>;
    const arr = [...(records[recordType] || [])];
    arr[index] = value;
    records[recordType] = arr;
    setEditingZone({
      ...editingZone,
      countries: { ...editingZone.countries, [countryCode]: records as DnsRecordSet },
    });

    // Validate record types with client-side validators. The API performs the
    // authoritative validation for structured and generic DNS records.
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

  const addRecordValue = (countryCode: string, recordType: RecordType) => {
    const records = { ...editingZone.countries[countryCode] } as Record<string, string[]>;
    records[recordType] = [...(records[recordType] || []), ""];
    setEditingZone({
      ...editingZone,
      countries: { ...editingZone.countries, [countryCode]: records as DnsRecordSet },
    });
  };

  const removeRecordValue = (countryCode: string, recordType: RecordType, index: number) => {
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
    const failed: string[] = [];
    for (const pattern of selectedPatterns) {
      try {
        await deleteZone(pattern);
        deleted++;
      } catch {
        failed.push(pattern);
      }
    }
    setBatchDeleting(false);
    setBatchDeleteOpen(false);
    setSelectedPatterns(new Set(failed));
    showToast(
      failed.length > 0 ? `Deleted ${deleted} zone(s); ${failed.length} failed` : `Deleted ${deleted} zone(s)`,
      failed.length > 0 ? "error" : "success"
    );
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

  const closeZoneMenu = () => {
    setZoneMenuAnchor(null);
    setZoneMenuTarget(null);
  };

  const editorFields = (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1 }}>
      <TextField
        select
        label={messages.matchMode}
        value={editingZone.mode}
        onChange={(e) => setEditingZone({
          ...editingZone,
          mode: e.target.value as Zone["mode"],
        })}
        fullWidth
        helperText={editingZone.mode === "simple" ? messages.simpleModeHelp : messages.golangModeHelp}
      >
        <MenuItem value="simple">{messages.simpleMode}</MenuItem>
        <MenuItem value="golang">{messages.golangMode}</MenuItem>
      </TextField>

      <TextField
        label={editingZone.mode === "simple" ? messages.domain : messages.pattern}
        value={editingZone.pattern}
        onChange={(e) => setEditingZone({ ...editingZone, pattern: e.target.value, regex: e.target.value })}
        placeholder={editingZone.mode === "simple" ? "example.com" : "^example\\.com\\.?$"}
        fullWidth
        slotProps={{
          input: {
            sx: { borderRadius: 2, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.85rem" },
          },
        }}
        helperText={editingZone.mode === "simple" ? messages.simpleModeHelp : messages.golangModeHelp}
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
                        placeholder={RECORD_PLACEHOLDERS[type]}
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
      <Box sx={{ display: "flex", gap: { xs: 1.25, sm: 2 }, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
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
          sx={{ minWidth: { xs: "100%", sm: 240 }, flex: 1 }}
        />
        <FormControl size="small" sx={{ minWidth: 140, flex: { xs: "1 1 140px", sm: "0 0 auto" } }}>
          <InputLabel id="zone-depth-label">{messages.zoneDepth}</InputLabel>
          <Select
            labelId="zone-depth-label"
            value={zoneDepth}
            label={messages.zoneDepth}
            onChange={(event) => {
              setZoneDepth(Number(event.target.value));
              setSelectedGroup("");
              clearSelection();
            }}
          >
            {ZONE_DEPTHS.map((depth) => (
              <MenuItem key={depth} value={depth}>{depth}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5, flex: { xs: "1 1 auto", sm: "0 0 auto" } }}>
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

      {zoneGroups.length > 0 && (
        <>
        <FormControl fullWidth size="small" sx={{ display: { xs: "flex", sm: "none" }, mb: 2 }}>
          <InputLabel id="zone-group-label">{messages.zoneGroup}</InputLabel>
          <Select
            labelId="zone-group-label"
            value={activeGroup}
            label={messages.zoneGroup}
            onChange={(event) => {
              setSelectedGroup(event.target.value);
              clearSelection();
            }}
            sx={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}
          >
            {zoneGroups.map(([group, count]) => (
              <MenuItem key={group} value={group} sx={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                {group} ({count})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ display: { xs: "none", sm: "block" }, borderBottom: 1, borderColor: "divider", mb: 2 }}>
          <Tabs
            value={activeGroup}
            onChange={(_, value: string) => {
              setSelectedGroup(value);
              clearSelection();
            }}
            variant="scrollable"
            scrollButtons="auto"
            aria-label={`${messages.zoneDepth} ${zoneDepth}`}
            sx={{
              minHeight: 44,
              "& .MuiTab-root": { minWidth: "auto", minHeight: 44, px: { xs: 1.75, sm: 2 } },
            }}
          >
            {zoneGroups.map(([group, count]) => (
              <Tab
                key={group}
                value={group}
                label={`${group} (${count})`}
                sx={{ textTransform: "none", fontFamily: "var(--font-jetbrains-mono), monospace" }}
              />
            ))}
          </Tabs>
        </Box>
        </>
      )}

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
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "auto minmax(0, 1fr) auto",
                  alignItems: "center",
                  px: { xs: 1, sm: 2 },
                  gap: 0.5,
                }}
              >
                <Checkbox
                  checked={selectedPatterns.has(zone.pattern)}
                  onChange={() => toggleSelect(zone.pattern)}
                  size="small"
                  slotProps={{ input: { "aria-label": `Select ${zone.pattern}` } }}
                />
                <ButtonBase onClick={() => setExpandedPattern(expandedPattern === zone.pattern ? null : zone.pattern)} aria-expanded={expandedPattern === zone.pattern} aria-label={`Toggle ${zone.pattern} details`} sx={{ minWidth: 0, minHeight: 52, px: 1, display: "flex", justifyContent: "space-between", textAlign: "left" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, overflow: "hidden" }}>
                    <Typography title={zone.pattern} noWrap sx={{ minWidth: 0, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.85rem", fontWeight: 600 }}>
                      {zone.pattern}
                    </Typography>
                    <Chip
                      label={zone.mode === "simple" ? messages.simpleMode : messages.golangMode}
                      size="small"
                      variant="outlined"
                      sx={{ flexShrink: 0 }}
                    />
                  </Box>
                  <ExpandMoreIcon sx={{ ml: 1, transform: expandedPattern === zone.pattern ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                </ButtonBase>
				{compactActions ? (
				  <IconButton
				    size="small"
				    aria-label={`More actions for ${zone.pattern}`}
				    onClick={(event) => {
				      setZoneMenuAnchor(event.currentTarget);
				      setZoneMenuTarget(zone);
				    }}
				  >
				    <MoreVertIcon />
				  </IconButton>
				) : (
				  <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
				    <Tooltip title={messages.copyPattern}>
				      <IconButton size="small" aria-label={`${messages.copyPattern}: ${zone.pattern}`} onClick={() => void copyPattern(zone.pattern)}>
				        <ContentCopyIcon fontSize="small" />
				      </IconButton>
				    </Tooltip>
				    <Tooltip title={`${messages.recordQueries}: ${zone.record ? messages.on : messages.off}`}>
				      <span>
				        <IconButton
				          size="small"
				          aria-label={`${messages.recordQueries}: ${zone.record ? messages.on : messages.off}`}
				          disabled={updatingPattern === zone.pattern || (saving && editingPattern === zone.pattern)}
				          onClick={() => void toggleZoneSetting(zone, "record")}
				        >
				          <FiberManualRecordIcon fontSize="small" sx={{ color: zone.record ? "success.main" : "text.disabled" }} />
				        </IconButton>
				      </span>
				    </Tooltip>
				    <Tooltip title={`${messages.fastOpen}: ${zone.fast_open ? messages.on : messages.off}`}>
				      <span>
				        <IconButton
				          size="small"
				          aria-label={`${messages.fastOpen}: ${zone.fast_open ? messages.on : messages.off}`}
				          disabled={updatingPattern === zone.pattern || (saving && editingPattern === zone.pattern)}
				          onClick={() => void toggleZoneSetting(zone, "fast_open")}
				        >
				          <BoltIcon fontSize="small" sx={{ color: zone.fast_open ? "warning.main" : "text.disabled" }} />
				        </IconButton>
				      </span>
				    </Tooltip>
				    <Tooltip title={messages.deleteZone}>
				      <IconButton size="small" color="error" aria-label={`${messages.deleteZone}: ${zone.pattern}`} onClick={() => confirmDeleteZone(zone)}>
				        <DeleteIcon fontSize="small" />
				      </IconButton>
				    </Tooltip>
				  </Box>
				)}
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

      <Menu
        anchorEl={zoneMenuAnchor}
        open={Boolean(zoneMenuAnchor && zoneMenuTarget)}
        onClose={closeZoneMenu}
        slotProps={{ paper: { sx: { minWidth: 210 } } }}
      >
        <MenuItem
          onClick={() => {
            if (zoneMenuTarget) void copyPattern(zoneMenuTarget.pattern);
            closeZoneMenu();
          }}
        >
          <ContentCopyIcon sx={{ mr: 1.5, fontSize: 19 }} />
          {messages.copyPattern}
        </MenuItem>
        <MenuItem
          disabled={!zoneMenuTarget || updatingPattern === zoneMenuTarget.pattern || (saving && editingPattern === zoneMenuTarget.pattern)}
          onClick={() => {
            if (zoneMenuTarget) void toggleZoneSetting(zoneMenuTarget, "record");
            closeZoneMenu();
          }}
        >
          <FiberManualRecordIcon sx={{ mr: 1.5, fontSize: 20, color: zoneMenuTarget?.record ? "success.main" : "text.disabled" }} />
          {messages.recordQueries}: {zoneMenuTarget?.record ? messages.on : messages.off}
        </MenuItem>
        <MenuItem
          disabled={!zoneMenuTarget || updatingPattern === zoneMenuTarget.pattern || (saving && editingPattern === zoneMenuTarget.pattern)}
          onClick={() => {
            if (zoneMenuTarget) void toggleZoneSetting(zoneMenuTarget, "fast_open");
            closeZoneMenu();
          }}
        >
          <BoltIcon sx={{ mr: 1.5, fontSize: 20, color: zoneMenuTarget?.fast_open ? "warning.main" : "text.disabled" }} />
          {messages.fastOpen}: {zoneMenuTarget?.fast_open ? messages.on : messages.off}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (zoneMenuTarget) confirmDeleteZone(zoneMenuTarget);
            closeZoneMenu();
          }}
          sx={{ color: "error.main" }}
        >
          <DeleteIcon sx={{ mr: 1.5, fontSize: 19 }} />
          {messages.deleteZone}
        </MenuItem>
      </Menu>

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
