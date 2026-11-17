"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
  AccessibilityIcon,
  Analytics01Icon,
  BookOpen01Icon,
  Home01Icon,
  MagicWand01Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { AccessibilityPanel } from "./AccessibilityPanel";
import { Icon } from "./Icon";

const NAV = [
  { href: "/", label: "Home", icon: Home01Icon },
  { href: "/read", label: "Read & images", icon: BookOpen01Icon },
  { href: "/simplify", label: "Simplify", icon: MagicWand01Icon },
  { href: "/live", label: "Live class", icon: Video01Icon },
  { href: "/study", label: "Study", icon: Analytics01Icon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)))?.href ?? false;

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <AppBar position="sticky" color="default" sx={{ bgcolor: "background.paper", borderBottom: 1, borderColor: "divider" }}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography
            component={Link}
            href="/"
            variant="h6"
            sx={{ color: "text.primary", textDecoration: "none", fontWeight: 800, letterSpacing: "-0.02em" }}
          >
            Prism
          </Typography>
          <Box component="nav" aria-label="Main" sx={{ flex: 1, minWidth: 0 }}>
            <Tabs value={current} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
              {NAV.map((n) => (
                <Tab
                  key={n.href}
                  value={n.href}
                  component={Link}
                  href={n.href}
                  label={n.label}
                  icon={<Icon icon={n.icon} size={20} />}
                  iconPosition="start"
                  sx={{ minHeight: 64 }}
                />
              ))}
            </Tabs>
          </Box>
          <Tooltip title="Reading settings">
            <IconButton aria-label="Reading settings" onClick={() => setOpen(true)} size="large">
              <Icon icon={AccessibilityIcon} />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <AccessibilityPanel />
      </Drawer>
      <Container component="main" id="main" tabIndex={-1} maxWidth="lg" sx={{ py: { xs: 3, md: 5 }, outline: "none" }}>
        {children}
      </Container>
    </>
  );
}
