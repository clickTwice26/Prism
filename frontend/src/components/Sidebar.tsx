"use client";

import { Fragment, useEffect, useState } from "react";
import Badge from "@mui/material/Badge";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type { IconSvgElement } from "@hugeicons/react";
import {
  AccessibilityIcon,
  Analytics01Icon,
  BookOpen01Icon,
  Home01Icon,
  MagicWand01Icon,
  PrismIcon,
  SecurityCheckIcon,
  SidebarLeft01Icon,
  SidebarRight01Icon,
  Target02Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { reviewCount } from "@/lib/api";
import { Icon } from "./Icon";

interface NavItem {
  href: string;
  label: string;
  hint: string;
  icon: IconSvgElement;
}

export const NAV_SECTIONS: { title: string | null; items: NavItem[] }[] = [
  { title: null, items: [{ href: "/", label: "Home", hint: "Start here", icon: Home01Icon }] },
  {
    title: "Learn",
    items: [
      { href: "/learn", label: "Adaptive lesson", hint: "Learns what helps you", icon: Target02Icon },
      { href: "/read", label: "Read & images", hint: "Listen and describe", icon: BookOpen01Icon },
      { href: "/simplify", label: "Simplify", hint: "Plain words and quiz", icon: MagicWand01Icon },
      { href: "/live", label: "Live class", hint: "Captions and video", icon: Video01Icon },
    ],
  },
  {
    title: "Teach",
    items: [
      { href: "/review", label: "Review", hint: "Check AI before learners", icon: SecurityCheckIcon },
      { href: "/study", label: "Study", hint: "Measure the impact", icon: Analytics01Icon },
    ],
  },
];

export const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

interface Props {
  collapsed: boolean;
  onNavigate?: () => void;
  onOpenSettings: () => void;
  onToggleCollapse?: () => void;
}

// Shared sidebar body for the permanent desktop drawer and the mobile drawer.
export function SidebarContent({ collapsed, onNavigate, onOpenSettings, onToggleCollapse }: Props) {
  const pathname = usePathname();
  const [pending, setPending] = useState(0);

  // Show teachers how many AI outputs wait for review.
  useEffect(() => {
    const load = () =>
      reviewCount()
        .then(setPending)
        .catch(() => setPending(0));
    load();
    window.addEventListener("prism:review-changed", load);
    return () => window.removeEventListener("prism:review-changed", load);
  }, [pathname]);

  const row = (
    item: { key: string; label: string; hint?: string; icon: IconSvgElement; badge?: number },
    props: object,
    selected = false,
  ) => (
    <Tooltip key={item.key} title={collapsed ? item.label : ""} placement="right" arrow>
      <ListItemButton
        selected={selected}
        aria-current={selected ? "page" : undefined}
        {...props}
        sx={(theme) => ({
          minHeight: 48,
          mx: 1.5,
          my: 0.25,
          px: collapsed ? 0 : 1.5,
          justifyContent: collapsed ? "center" : "flex-start",
          borderRadius: 2.5,
          color: "text.secondary",
          "&:hover": { color: "text.primary" },
          "&.Mui-selected": {
            color: "primary.main",
            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.16 : 0.09),
            "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.14) },
          },
        })}
      >
        <ListItemIcon sx={{ minWidth: 0, mr: collapsed ? 0 : 1.75, color: "inherit" }}>
          <Badge
            color="error"
            badgeContent={item.badge}
            invisible={!item.badge}
            slotProps={{ badge: { "aria-label": `${item.badge} waiting` } }}
          >
            <Icon icon={item.icon} size={22} />
          </Badge>
        </ListItemIcon>
        {!collapsed && (
          <ListItemText
            primary={item.label}
            secondary={item.hint}
            slotProps={{
              // Render as spans: these are link labels, not headings.
              primary: { variant: "subtitle1", component: "span", sx: { display: "block", color: selected ? "primary.main" : "text.primary" } },
              secondary: { variant: "caption", component: "span", noWrap: true, sx: { display: "block" } },
            }}
          />
        )}
      </ListItemButton>
    </Tooltip>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflowX: "hidden" }}>
      {/* Brand */}
      <Box
        component={Link}
        href="/"
        onClick={onNavigate}
        aria-label="Prism home"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          height: 72,
          px: collapsed ? 0 : 3,
          justifyContent: collapsed ? "center" : "flex-start",
          color: "text.primary",
          textDecoration: "none",
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2.5,
            display: "grid",
            placeItems: "center",
            color: "primary.contrastText",
            bgcolor: "primary.main",
            flexShrink: 0,
          }}
        >
          <Icon icon={PrismIcon} size={22} />
        </Box>
        {!collapsed && (
          <Typography variant="h4" component="span" sx={{ fontWeight: 800, letterSpacing: "-0.03em" }}>
            Prism
          </Typography>
        )}
      </Box>

      {/* Navigation */}
      <Box component="nav" aria-label="Main" sx={{ flex: 1, overflowY: "auto", py: 1 }}>
        {NAV_SECTIONS.map((section, i) => (
          <Fragment key={section.title ?? "top"}>
            {section.title &&
              (collapsed ? (
                <Divider sx={{ mx: 2, my: 1.5 }} />
              ) : (
                <Typography
                  variant="overline"
                  component="h2"
                  sx={{ display: "block", px: 3, pt: i ? 2.5 : 1, pb: 0.5, color: "text.secondary" }}
                >
                  {section.title}
                </Typography>
              ))}
            <List disablePadding>
              {section.items.map((item) =>
                row(
                  {
                    key: item.href,
                    label: item.label,
                    hint: item.hint,
                    icon: item.icon,
                    badge: item.href === "/review" ? pending : undefined,
                  },
                  { component: Link, href: item.href, onClick: onNavigate },
                  isActive(pathname, item.href),
                ),
              )}
            </List>
          </Fragment>
        ))}
      </Box>

      {/* Footer */}
      <Divider />
      <List sx={{ py: 1 }}>
        {row(
          { key: "settings", label: "Reading settings", hint: "Text, colours, voice", icon: AccessibilityIcon },
          { onClick: onOpenSettings },
        )}
        {onToggleCollapse &&
          row(
            {
              key: "collapse",
              label: collapsed ? "Expand sidebar" : "Collapse sidebar",
              icon: collapsed ? SidebarRight01Icon : SidebarLeft01Icon,
            },
            { onClick: onToggleCollapse, "aria-expanded": !collapsed },
          )}
      </List>
    </Box>
  );
}
