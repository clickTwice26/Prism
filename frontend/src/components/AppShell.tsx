"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { AccessibilityIcon, Menu01Icon } from "@hugeicons/core-free-icons";
import { useSettings } from "@/lib/settings";
import { SIDEBAR_MINI_WIDTH, SIDEBAR_WIDTH } from "@/lib/theme";
import { AccessibilityPanel } from "./AccessibilityPanel";
import { Icon } from "./Icon";
import { SidebarContent } from "./Sidebar";

// Layout: a permanent, collapsible sidebar from the md breakpoint up; below it,
// a slim top bar whose menu button opens the same sidebar as a drawer. Both
// are always rendered and switched with CSS, so server and client markup match.
export function AppShell({ children }: { children: ReactNode }) {
  const { settings, update } = useSettings();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const collapsed = settings.sidebarCollapsed;
  const width = collapsed ? SIDEBAR_MINI_WIDTH : SIDEBAR_WIDTH;

  const openSettings = () => {
    setMobileOpen(false);
    setSettingsOpen(true);
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh" }}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          width,
          flexShrink: 0,
          transition: (t) => t.transitions.create("width", { duration: t.transitions.duration.shorter }),
          "& .MuiDrawer-paper": {
            width,
            boxSizing: "border-box",
            borderRight: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
            overflowX: "hidden",
            transition: (t) => t.transitions.create("width", { duration: t.transitions.duration.shorter }),
          },
        }}
      >
        <SidebarContent
          collapsed={collapsed}
          onOpenSettings={openSettings}
          onToggleCollapse={() => update({ sidebarCollapsed: !collapsed })}
        />
      </Drawer>

      {/* Mobile sidebar */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { width: SIDEBAR_WIDTH } }}
      >
        <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} onOpenSettings={openSettings} />
      </Drawer>

      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Mobile top bar */}
        <AppBar
          position="sticky"
          color="default"
          sx={{ display: { md: "none" }, bgcolor: "background.paper", borderBottom: 1, borderColor: "divider" }}
        >
          <Toolbar sx={{ gap: 1 }}>
            <IconButton edge="start" aria-label="Open menu" onClick={() => setMobileOpen(true)} size="large">
              <Icon icon={Menu01Icon} />
            </IconButton>
            <Typography
              component={Link}
              href="/"
              variant="h4"
              sx={{ flex: 1, color: "text.primary", textDecoration: "none", fontWeight: 800, letterSpacing: "-0.03em" }}
            >
              Prism
            </Typography>
            <IconButton aria-label="Reading settings" onClick={openSettings} size="large">
              <Icon icon={AccessibilityIcon} />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Container
          component="main"
          id="main"
          tabIndex={-1}
          maxWidth="lg"
          sx={{ flex: 1, py: { xs: 3, md: 6 }, px: { xs: 2, sm: 3, md: 5 }, outline: "none" }}
        >
          {children}
        </Container>
      </Box>

      <Drawer anchor="right" open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <AccessibilityPanel />
      </Drawer>
    </Box>
  );
}
