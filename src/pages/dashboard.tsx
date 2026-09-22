"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
  useTheme,
  TextField,
  FormControlLabel,
  Switch,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Chip,
	Divider,
} from "@mui/material";
import { Snackbar } from "../toast";
import DnsIcon from "@mui/icons-material/Dns";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import CachedIcon from "@mui/icons-material/Cached";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import BarChartIcon from "@mui/icons-material/BarChart";
import HubIcon from "@mui/icons-material/Hub";
import { alpha } from "@mui/material";
import { hasToken, getApiBase, getStats, checkHealth, getServerConfig, updateServerConfig, getClusterStatus, getClusterHistory } from "../lib/api";
import type { StatsResponse, ServerConfig, ClusterStatus, ClusterHistory } from "../lib/types";
import { useDocumentTitle } from "../useDocumentTitle";
import { useDnsMessages } from "../i18n";

function formatClusterTime(value?: string) {
	if (!value || value.startsWith("0001-")) return "-";
	return new Date(value).toLocaleString();
}

export default function DnsManagerDashboard() {
  const theme = useTheme();
  const messages = useDnsMessages();
  useDocumentTitle(messages.title);
  const [health, setHealth] = useState<boolean | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
	const [clusterStatus, setClusterStatus] = useState<ClusterStatus | null>(null);
	const [clusterHistory, setClusterHistory] = useState<ClusterHistory | null>(null);
	const [clusterDialogOpen, setClusterDialogOpen] = useState(false);
	const [clusterHistoryLoading, setClusterHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  const fetchData = useCallback(async () => {
    if (!hasToken()) return;
    setLoading(true);
    setError("");

    try {
		const [h, s, cfg, cluster] = await Promise.all([
        checkHealth().then(() => true).catch(() => false),
        getStats().catch(() => null),
        getServerConfig().catch(() => null),
		getClusterStatus().catch(() => null),
      ]);
      setHealth(h);
      setStats(s as StatsResponse | null);
      setServerConfig(cfg as ServerConfig | null);
		setClusterStatus(cluster as ClusterStatus | null);
    } catch {
      setError("Failed to fetch data from the DNS server");
    } finally {
      setLoading(false);
    }
  }, []);

	const openClusterDetails = async () => {
		setClusterDialogOpen(true);
		setClusterHistoryLoading(true);
		try {
			const [status, history] = await Promise.all([getClusterStatus(), getClusterHistory()]);
			setClusterStatus(status);
			setClusterHistory(history);
		} catch {
			setClusterHistory(null);
		} finally {
			setClusterHistoryLoading(false);
		}
	};

  useEffect(() => {
    fetchData();
  }, [fetchData]);

	useEffect(() => {
		if (!hasToken()) return;
		const timer = window.setInterval(() => {
			void getClusterStatus().then(setClusterStatus).catch(() => undefined);
		}, 60_000);
		return () => window.clearInterval(timer);
	}, []);

  const handleSaveConfig = async () => {
    if (!serverConfig) return;
    setSavingConfig(true);
    try {
      await updateServerConfig({
        default_ttl: serverConfig.default_ttl,
        default_response: serverConfig.default_response,
        default_record: serverConfig.default_record,
      });
      setToast({ open: true, message: "Server config saved", severity: "success" });
    } catch (err) {
      setToast({ open: true, message: err instanceof Error ? err.message : "Failed to save config", severity: "error" });
    } finally {
      setSavingConfig(false);
    }
  };

	const clusterTone = clusterStatus?.mode === "master"
		? clusterStatus.total === 0 || clusterStatus.online === clusterStatus.total
			? theme.palette.success.main
			: clusterStatus.online === 0
				? theme.palette.error.main
				: theme.palette.warning.main
		: clusterStatus?.mode === "slave" && clusterStatus.sync?.success
			? theme.palette.success.main
			: theme.palette.error.main;
	const clusterSummary = clusterStatus?.mode === "master"
		? `${clusterStatus.online}/${clusterStatus.total} ${messages.onlineSlaves}`
		: clusterStatus?.mode === "slave"
			? (clusterStatus.sync?.success ? messages.syncSucceeded : messages.syncFailed)
			: messages.standaloneRole;

  if (!hasToken()) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <Box sx={{ textAlign: "center" }}>
          <DnsIcon sx={{ fontSize: 56, mb: 2, color: "text.disabled" }} />
          <Typography variant="h6" color="text.secondary">
            {messages.tokenPrompt}
          </Typography>
        </Box>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 2, sm: 4 }, py: 4, maxWidth: 1000, mx: "auto" }}>
      <Typography
        variant="h5"
        sx={{ fontWeight: 700, fontFamily: "var(--font-inter)", mb: 1 }}
      >
        {messages.dashboard}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        {messages.serverAt} <code>{getApiBase()}</code>
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Health card */}
        <Grid size={{ xs: 12, sm: 6, md: 6 }}>
          <Card
            elevation={0}
            sx={{
              height: "100%",
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: alpha(
                health ? theme.palette.success.main : theme.palette.error.main,
                0.04
              ),
            }}
          >
            <CardContent
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                py: 3,
                "&:last-child": { pb: 3 },
              }}
            >
              {health === null ? (
                <CircularProgress size={40} />
              ) : health ? (
                <CheckCircleIcon sx={{ fontSize: 40, color: "success.main" }} />
              ) : (
                <ErrorIcon sx={{ fontSize: 40, color: "error.main" }} />
              )}
              <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: "var(--font-inter)" }}>
                {health ? messages.online : messages.offline}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {messages.serverHealth}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Zone count */}
        <Grid size={{ xs: 12, sm: 6, md: 6 }}>
          <Card
            elevation={0}
            sx={{
              height: "100%",
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
            }}
          >
            <CardContent
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                py: 3,
                "&:last-child": { pb: 3 },
              }}
            >
              <DnsIcon sx={{ fontSize: 40, color: "primary.main" }} />
              <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: "var(--font-inter)" }}>
                {stats?.zones ?? 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Zones
              </Typography>
            </CardContent>
          </Card>
        </Grid>

		{/* Cluster status */}
		{clusterStatus && clusterStatus.mode !== "" && (
		  <Grid size={{ xs: 12 }}>
		    <Card
		      component="button"
		      type="button"
		      onClick={() => void openClusterDetails()}
		      elevation={0}
		      sx={{
		        width: "100%",
		        color: "inherit",
		        textAlign: "left",
		        cursor: "pointer",
		        border: 1,
		        borderColor: alpha(clusterTone, 0.55),
		        borderRadius: 2,
		        bgcolor: alpha(clusterTone, 0.055),
		        "&:hover": { bgcolor: alpha(clusterTone, 0.1) },
		      }}
		    >
		      <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, py: 2.25, "&:last-child": { pb: 2.25 } }}>
		        <HubIcon sx={{ fontSize: 38, color: clusterTone }} />
		        <Box sx={{ flex: 1, minWidth: 0 }}>
		          <Typography variant="overline" color="text.secondary">{messages.clusterStatus}</Typography>
		          <Typography variant="h6" sx={{ fontWeight: 700 }}>{clusterSummary}</Typography>
		          <Typography variant="caption" color="text.secondary" noWrap>
		            {clusterStatus.mode === "master" ? messages.masterRole : `${messages.slaveRole} · ${clusterStatus.master ?? "-"}`}
		          </Typography>
		        </Box>
		        <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: clusterTone, boxShadow: `0 0 0 5px ${alpha(clusterTone, 0.15)}` }} />
		      </CardContent>
		    </Card>
		  </Grid>
		)}

        {/* Total queries */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card
            elevation={0}
            sx={{
              height: "100%",
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: alpha(theme.palette.info.main, 0.04),
            }}
          >
            <CardContent
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                py: 3,
                "&:last-child": { pb: 3 },
              }}
            >
              <BarChartIcon sx={{ fontSize: 40, color: "info.main" }} />
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  fontFamily: "var(--font-inter)",
                  color: "info.main",
                }}
              >
                {stats?.recorder && "total_queries" in stats.recorder
                  ? stats.recorder.total_queries.toLocaleString()
                  : "-"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Queries
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Cache hited + hit rate */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card
            elevation={0}
            sx={{
              height: "100%",
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: alpha(theme.palette.success.main, 0.04),
            }}
          >
            <CardContent
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.5,
                py: 3,
                "&:last-child": { pb: 3 },
              }}
            >
              <CachedIcon sx={{ fontSize: 40, color: "success.main" }} />
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  fontFamily: "var(--font-inter)",
                  color: "success.main",
                }}
              >
                {stats?.recorder && "cache_hited" in stats.recorder
                  ? stats.recorder.cache_hited.toLocaleString()
                  : "-"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Cache Hited
              </Typography>
              {stats?.recorder && "cache_hited" in stats.recorder && stats.recorder.total_queries > 0 && (
                <Typography
                  variant="body1"
                  sx={{
                    fontWeight: 700,
                    fontFamily: "var(--font-inter)",
                    color: "success.main",
                    mt: 0.5,
                  }}
                >
                  {((stats.recorder.cache_hited / stats.recorder.total_queries) * 100).toFixed(1)}% hit rate
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Dropped */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card
            elevation={0}
            sx={{
              height: "100%",
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: alpha(theme.palette.error.main, 0.04),
            }}
          >
            <CardContent
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                py: 3,
                "&:last-child": { pb: 3 },
              }}
            >
              <WarningAmberIcon sx={{ fontSize: 40, color: "error.main" }} />
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  fontFamily: "var(--font-inter)",
                  color: "error.main",
                }}
              >
                {stats?.recorder && "dropped" in stats.recorder
                  ? stats.recorder.dropped.toLocaleString()
                  : "-"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Dropped
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Server default config */}
      {serverConfig && (
        <Card
          elevation={0}
          sx={{
            mt: 4,
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <CardContent sx={{ py: 2.5, px: 3, "&:last-child": { pb: 2.5 } }}>
            <Typography variant="h6" sx={{ fontWeight: 600, fontFamily: "var(--font-inter)", mb: 2 }}>
              Server Defaults
            </Typography>
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 2.5,
                alignItems: "flex-end",
              }}
            >
              {/* Listen address — read only */}
              <TextField
                label="Listen Address"
                value={serverConfig.listen}
                slotProps={{
                  input: {
                    readOnly: true,
                    sx: { fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: "0.85rem" },
                  },
                }}
                sx={{ minWidth: 180 }}
              />

              {/* Default TTL */}
              <TextField
                label="Default TTL (seconds)"
                type="number"
                value={serverConfig.default_ttl}
                onChange={(e) =>
                  setServerConfig({ ...serverConfig, default_ttl: parseInt(e.target.value) || 0 })
                }
                slotProps={{
                  input: {
                    sx: { fontFamily: "var(--font-jetbrains-mono), monospace" },
                  },
                }}
                sx={{ minWidth: 150 }}
              />

              {/* Default response */}
              <FormControl sx={{ minWidth: 160 }}>
                <InputLabel>Default Response</InputLabel>
                <Select
                  value={serverConfig.default_response}
                  label="Default Response"
                  onChange={(e) =>
                    setServerConfig({
                      ...serverConfig,
                      default_response: e.target.value as ServerConfig["default_response"],
                    })
                  }
                  sx={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}
                >
                  <MenuItem value="refuse">refuse</MenuItem>
                  <MenuItem value="nxdomain">nxdomain</MenuItem>
                  <MenuItem value="servfail">servfail</MenuItem>
                </Select>
              </FormControl>

              {/* Default record */}
              <FormControlLabel
                control={
                  <Switch
                    checked={serverConfig.default_record}
                    onChange={(e) =>
                      setServerConfig({ ...serverConfig, default_record: e.target.checked })
                    }
                  />
                }
                label="Record by default"
              />

              <Button
                variant="contained"
                onClick={handleSaveConfig}
                disabled={savingConfig}
                sx={{ textTransform: "none", borderRadius: 2, ml: "auto" }}
              >
                {savingConfig ? "Saving..." : "Save Config"}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

	  <Dialog open={clusterDialogOpen} onClose={() => setClusterDialogOpen(false)} maxWidth="md" fullWidth>
		<DialogTitle sx={{ fontWeight: 700 }}>{messages.clusterDetails}</DialogTitle>
		<DialogContent dividers>
		  {clusterStatus?.mode === "master" ? (
		    <Box sx={{ display: "grid", gap: 1 }}>
		      {(clusterStatus.slaves ?? []).map((peer) => (
		        <Box key={peer.address} sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.5, border: 1, borderColor: "divider", borderRadius: 2 }}>
		          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: peer.online ? "success.main" : "error.main" }} />
		          <Box sx={{ flex: 1, minWidth: 0 }}>
		            <Typography sx={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontWeight: 600 }} noWrap>{peer.address}</Typography>
		            <Typography variant="caption" color="text.secondary">{formatClusterTime(peer.checked_at)} · {peer.duration_ms}ms</Typography>
		            {peer.error && <Typography variant="caption" color="error.main" sx={{ display: "block" }}>{peer.error}</Typography>}
		          </Box>
		          <Chip size="small" color={peer.online ? "success" : "error"} label={peer.online ? messages.online : messages.offline} />
		        </Box>
		      ))}
		    </Box>
		  ) : clusterStatus?.mode === "slave" ? (
		    <Box sx={{ display: "grid", gap: 1 }}>
		      <Typography><strong>{messages.masterRole}:</strong> {clusterStatus.master}</Typography>
		      <Typography><strong>{messages.lastSync}:</strong> {formatClusterTime(clusterStatus.sync?.checked_at)}</Typography>
		      <Typography><strong>{messages.recordCount}:</strong> {clusterStatus.sync?.record_count ?? clusterStatus.snapshot.record_count}</Typography>
		      <Box><Chip size="small" color={clusterStatus.sync?.success ? "success" : "error"} label={clusterStatus.sync?.success ? messages.syncSucceeded : messages.syncFailed} /></Box>
		      {clusterStatus.sync?.error && <Alert severity="error">{clusterStatus.sync.error}</Alert>}
		    </Box>
		  ) : null}

		  <Divider sx={{ my: 2.5 }} />
		  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>{messages.checkHistory}</Typography>
		  {clusterHistoryLoading ? (
		    <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={28} /></Box>
		  ) : !clusterHistory?.events.length ? (
		    <Typography color="text.secondary">{messages.noClusterHistory}</Typography>
		  ) : (
		    <Box sx={{ display: "grid", gap: 1, maxHeight: 360, overflowY: "auto" }}>
		      {clusterHistory.events.map((event, index) => (
		        <Box key={`${event.occurred_at}-${event.peer}-${index}`} sx={{ display: "flex", gap: 1.5, p: 1.25, borderBottom: 1, borderColor: "divider" }}>
		          <Box sx={{ mt: 0.75, width: 9, height: 9, flexShrink: 0, borderRadius: "50%", bgcolor: event.success ? "success.main" : "error.main" }} />
		          <Box sx={{ minWidth: 0 }}>
		            <Typography variant="body2" sx={{ fontWeight: 600 }}>
		              {event.peer || (event.kind === "sync" ? clusterStatus?.master : "-")}
		            </Typography>
		            <Typography variant="caption" color="text.secondary">
		              {formatClusterTime(event.occurred_at)} · {event.duration_ms}ms
		              {event.full_sync ? ` · ${messages.fullSync}` : event.kind === "sync" ? ` · ${messages.noChange}` : ""}
		            </Typography>
		            {event.error && <Typography variant="caption" color="error.main" sx={{ display: "block" }}>{event.error}</Typography>}
		          </Box>
		        </Box>
		      ))}
		    </Box>
		  )}
		</DialogContent>
		<DialogActions><Button onClick={() => setClusterDialogOpen(false)}>{messages.close}</Button></DialogActions>
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
