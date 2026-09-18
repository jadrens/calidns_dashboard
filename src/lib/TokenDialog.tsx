"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
} from "@mui/material";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import { ApiEndpointConnectionError, hasToken, setToken, removeToken, getApiBase, setApiBase, resetApiBase, resolveApiBase, getStats } from "./api";
import { alpha, useTheme } from "@mui/material";
import { useDnsMessages } from "../i18n";
import { toast } from "../toast";

export default function TokenDialog() {
  const theme = useTheme();
  const messages = useDnsMessages();
  const [open, setOpen] = useState(false);
  const [token, setTokenValue] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [needsEndpoint, setNeedsEndpoint] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNeedsEndpoint(!getApiBase());
      setOpen(!hasToken());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSave = async () => {
    const trimmed = token.trim();
    if (needsEndpoint && !endpoint.trim()) {
      toast.warning(messages.endpointRequired);
      return;
    }
    if (!trimmed) {
      toast.warning(messages.tokenRequired);
      return;
    }

    setLoading(true);

    try {
      if (needsEndpoint) setApiBase(await resolveApiBase(endpoint));
      setToken(trimmed);
      await getStats();
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof ApiEndpointConnectionError
        ? messages.endpointUnreachable
        : err instanceof Error ? err.message : messages.endpointUnreachable);
      removeToken();
      if (needsEndpoint) resetApiBase();
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && token.trim() && (!needsEndpoint || endpoint.trim()) && !loading) {
      handleSave();
    }
  };

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      slotProps={{
        backdrop: { sx: { backdropFilter: "blur(4px)" } },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pt: 3, pb: 1 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            color: "primary.main",
          }}
        >
          <VpnKeyIcon />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: "var(--font-inter)" }}>
            {messages.authTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {needsEndpoint ? messages.authFirstUse : messages.authDescription}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2, pb: 1 }}>
        {needsEndpoint && <TextField
          autoFocus
          fullWidth
          label={messages.endpoint}
          type="url"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="dns.example.com"
          helperText={messages.protocolHint}
          sx={{ mb: 2 }}
        />}
        <TextField
          autoFocus={!needsEndpoint}
          fullWidth
          label={messages.apiToken}
          type="password"
          value={token}
          onChange={(e) => setTokenValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={messages.tokenPlaceholder}
          slotProps={{
            input: {
              sx: {
                borderRadius: 2,
                fontFamily: "var(--font-jetbrains-mono), monospace",
                fontSize: "0.9rem",
              },
            },
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          {messages.authHelp}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!token.trim() || (needsEndpoint && !endpoint.trim()) || loading}
          sx={{
            px: 4,
            py: 1.2,
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 600,
          }}
        >
          {loading ? messages.connecting : messages.connect}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
