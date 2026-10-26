import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import LocalePicker from "./LocalePicker/LocalePicker";
import { useEnvironment } from "./EnvironmentContext";
import ConfirmDialog from "./ConfirmDialog";
import { getInitials, useAuth } from "../auth/AuthContext";

export interface WorkspaceMetadata {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  initials?: string;
  plan?: "starter" | "growth" | "business";
  region?: string;
}

export interface TopAppBarProps {
  workspaces?: WorkspaceMetadata[];
  initialWorkspace?: string;
  initialEnvironment?: "testnet" | "mainnet";
  userName?: string;
  userInitials?: string;
  userAvatar?: string;
  userEmail?: string;
  onSidebarToggle?: () => void;
  sidebarOpen?: boolean;
  onSearchClick?: () => void;
  onWorkspaceQuickJump?: () => void;
  onWorkspaceChange?: (workspaceId: string) => void;
  /** When true the workspace switcher opens immediately in search/filter mode */
  openWorkspaceSwitcherInSearchMode?: boolean;
  /** Callback to notify parent that the workspace switcher has been opened/closed */
  onWorkspaceSwitcherOpenChange?: (open: boolean) => void;
}

const DEFAULT_WORKSPACES: WorkspaceMetadata[] = [
  { id: "acme-corp", name: "Acme Corp", initials: "AC", plan: "business", region: "us-east" },
  { id: "my-workspace", name: "My Workspace", initials: "MW", plan: "growth", region: "us-west" },
  { id: "test-org", name: "Test Org", initials: "TO", plan: "starter", region: "eu-west" },
];

const FOCUSABLE_SELECTORS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface CreateWorkspaceDraft {
  name: string;
  displayName: string;
  description: string;
  plan: "starter" | "growth" | "business";
  region: "us-east" | "us-west" | "eu-west" | "ap-southeast";
}

const EMPTY_DRAFT: CreateWorkspaceDraft = {
  name: "",
  displayName: "",
  description: "",
  plan: "growth",
  region: "us-east",
};

const DRAFT_STORAGE_KEY = "veritasor-create-workspace-draft";

function loadDraftFromStorage(): CreateWorkspaceDraft {
  try {
    const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (stored) return { ...EMPTY_DRAFT, ...JSON.parse(stored) };
  } catch {
    // Ignore storage errors
  }
  return { ...EMPTY_DRAFT };
}

export default function TopAppBar({
  workspaces = DEFAULT_WORKSPACES,
  initialWorkspace = DEFAULT_WORKSPACES[0]?.id,
  initialEnvironment = "testnet",
  userName: userNameProp,
  userInitials: userInitialsProp,
  userAvatar,
  userEmail: userEmailProp,
  onSidebarToggle,
  sidebarOpen = false,
  onSearchClick,
  onWorkspaceQuickJump: _onWorkspaceQuickJump,
  onWorkspaceChange,
  openWorkspaceSwitcherInSearchMode = false,
  onWorkspaceSwitcherOpenChange,
}: TopAppBarProps) {
  const [workspaceId, setWorkspaceId] = useState(initialWorkspace);
  const [recentWorkspaceIds, setRecentWorkspaceIds] = useState<string[]>([
    initialWorkspace || "",
  ]);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [createWsOpen, setCreateWsOpen] = useState(false);
  const [createWsDraft, setCreateWsDraft] = useState<CreateWorkspaceDraft>(() =>
    loadDraftFromStorage(),
  );
  const [createWsSubmitting, setCreateWsSubmitting] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const intl = useIntl();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const userName = userNameProp ?? user?.name ?? "Joel Agboola";
  const userInitials = userInitialsProp ?? getInitials(userName);
  const userEmail = userEmailProp ?? user?.email;
  const { environment, setEnvironment } = useEnvironment();
  const [confirmMainnetOpen, setConfirmMainnetOpen] = useState(false);
  const confirmMainnetTriggerRef = useRef<HTMLButtonElement | null>(null);

  const currentWorkspace = useMemo(
    () => workspaces.find((ws) => ws.id === workspaceId) || workspaces[0] || DEFAULT_WORKSPACES[0],
    [workspaces, workspaceId],
  );

  const _recentWorkspaces = useMemo(
    () => recentWorkspaceIds
      .map((id) => workspaces.find((ws) => ws.id === id))
      .filter(Boolean) as WorkspaceMetadata[],
    [workspaces, recentWorkspaceIds],
  );

  const workspaceBtnRef = useRef<HTMLButtonElement>(null);
  const workspaceMenuRef = useRef<HTMLUListElement>(null);
  const workspaceSearchRef = useRef<HTMLInputElement>(null);
  const accountBtnRef = useRef<HTMLButtonElement>(null);
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLUListElement>(null);
  const createWsTriggerRef = useRef<HTMLElement | null>(null);
  const createWsModalRef = useRef<HTMLDivElement>(null);
  const createWsNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(createWsDraft));
    } catch {
      // Ignore storage errors
    }
  }, [createWsDraft]);

  // Open workspace switcher in search mode when triggered externally (e.g. Ctrl+K→W shortcut)
  useEffect(() => {
    if (openWorkspaceSwitcherInSearchMode) {
      setWorkspaceSearch("");
      setWorkspaceOpen(true);
      // Focus the search input once the dropdown mounts
      const t = window.setTimeout(() => workspaceSearchRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [openWorkspaceSwitcherInSearchMode, onWorkspaceSwitcherOpenChange]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as Node;
      // Refs are non-null while component is mounted
      if (
        workspaceOpen &&
        !workspaceBtnRef.current!.contains(target) &&
        !workspaceMenuRef.current!.contains(target)
      ) {
        setWorkspaceOpen(false);
      }
      if (
        accountOpen &&
        !accountBtnRef.current!.contains(target) &&
        !accountDropdownRef.current!.contains(target)
      ) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [workspaceOpen, accountOpen]);

  // Focus first option when workspace listbox opens (skip when search is active)
  useEffect(() => {
    onWorkspaceSwitcherOpenChange?.(workspaceOpen);
    if (workspaceOpen && !workspaceSearch) {
      workspaceMenuRef
        .current!.querySelectorAll<HTMLElement>('[role="option"]')[0]
        ?.focus();
    }
  }, [workspaceOpen, onWorkspaceSwitcherOpenChange, workspaceSearch]);

  // Focus first menuitem when account menu opens
  useEffect(() => {
    if (accountOpen) {
      accountMenuRef
        .current!.querySelectorAll<HTMLElement>('[role="menuitem"]')[0]
        ?.focus();
    }
  }, [accountOpen]);

  // Focus + scroll lock for create workspace modal
  useEffect(() => {
    if (createWsOpen) {
      createWsTriggerRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = "hidden";
      const t = window.setTimeout(() => createWsNameRef.current?.focus(), 20);
      return () => {
        window.clearTimeout(t);
        document.body.style.overflow = "";
      };
    } else {
      createWsTriggerRef.current?.focus();
    }
  }, [createWsOpen]);

  // Focus trap + Escape for create workspace modal
  useEffect(() => {
    if (!createWsOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !createWsSubmitting) {
        e.preventDefault();
        setCreateWsOpen(false);
        return;
      }
      if (e.key !== "Tab" || !createWsModalRef.current) return;
      const focusable = Array.from(
        createWsModalRef.current.querySelectorAll<HTMLElement>(
          FOCUSABLE_SELECTORS,
        ),
      ).filter((el) => (el as HTMLElement).offsetParent !== null);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [createWsOpen, createWsSubmitting]);

  const handleWorkspaceKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setWorkspaceOpen(false);
        workspaceBtnRef.current!.focus();
      } else if (!workspaceOpen && e.key === "ArrowDown") {
        e.preventDefault();
        setWorkspaceOpen(true);
      }
    },
    [workspaceOpen],
  );

  const handleWorkspaceMenuKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      const arr = Array.from(
        workspaceMenuRef.current!.querySelectorAll<HTMLElement>(
          '[role="option"]',
        ),
      );
      const idx = arr.indexOf(document.activeElement as HTMLElement);

      if (e.key === "Escape") {
        e.preventDefault();
        setWorkspaceOpen(false);
        workspaceBtnRef.current!.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        arr[(idx + 1) % arr.length]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        arr[idx <= 0 ? arr.length - 1 : idx - 1]?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        arr[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        arr[arr.length - 1]?.focus();
      }
    },
    [],
  );

  const handleAccountKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setAccountOpen(false);
        accountBtnRef.current!.focus();
      } else if (!accountOpen && e.key === "ArrowDown") {
        e.preventDefault();
        setAccountOpen(true);
      }
    },
    [accountOpen],
  );

  const handleAccountMenuKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      const arr = Array.from(
        accountMenuRef.current!.querySelectorAll<HTMLElement>(
          '[role="menuitem"]',
        ),
      );
      const idx = arr.indexOf(document.activeElement as HTMLElement);

      if (e.key === "Escape") {
        e.preventDefault();
        setAccountOpen(false);
        accountBtnRef.current!.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        arr[(idx + 1) % arr.length]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        arr[idx <= 0 ? arr.length - 1 : idx - 1]?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        arr[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        arr[arr.length - 1]?.focus();
      }
    },
    [],
  );

  function selectWorkspace(ws: WorkspaceMetadata) {
    setWorkspaceId(ws.id);
    onWorkspaceChange?.(ws.id);

    setRecentWorkspaceIds((prev) => {
      const updated = [ws.id, ...prev.filter((id) => id !== ws.id)];
      return updated.slice(0, 5);
    });

    setAnnouncement(`Switched to workspace: ${ws.name}`);
    setTimeout(() => setAnnouncement(""), 1000);

    setWorkspaceSearch("");
    setWorkspaceOpen(false);
    workspaceBtnRef.current?.focus();
  }

  function closeAccountMenu() {
    setAccountOpen(false);
    accountBtnRef.current?.focus();
  }

  function handleAccountNavigate(path: string) {
    closeAccountMenu();
    navigate(path);
  }

  function handleSignOut() {
    setAccountOpen(false);
    signOut();
    navigate("/login", { replace: true });
  }

  const hasDraftContent = useMemo(
    () =>
      createWsDraft.name.trim() !== "" ||
      createWsDraft.displayName.trim() !== "" ||
      createWsDraft.description.trim() !== "",
    [createWsDraft],
  );

  function openCreateWorkspace() {
    createWsTriggerRef.current = workspaceBtnRef.current;
    setWorkspaceOpen(false);
    setCreateWsOpen(true);
  }

  function _handleCreateWorkspaceSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreateWsSubmitting(true);
    setTimeout(() => {
      const newName =
        createWsDraft.displayName.trim() ||
        createWsDraft.name.trim() ||
        "New Workspace";
      const newId = newName.toLowerCase().replace(/\s+/g, "-");
      setWorkspaceId(newId);
      setRecentWorkspaceIds((prev) => [newId, ...prev].slice(0, 5));
      setCreateWsDraft({ ...EMPTY_DRAFT });
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
      setCreateWsSubmitting(false);
      setCreateWsOpen(false);
    }, 1400);
  }

  function _clearCreateWorkspaceDraft() {
    setCreateWsDraft({ ...EMPTY_DRAFT });
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }

  // Density mode is managed by DensityToggle via data attribute on root

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        style={{ position: "absolute", left: "-9999px" }}
      >
        {announcement}
      </div>
      <header className="app-bar" role="banner">
      <div className="app-bar-inner">
        <button
          type="button"
          className="app-bar-hamburger"
          aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={sidebarOpen}
          aria-controls="app-sidebar"
          onClick={onSidebarToggle}
        >
          <span aria-hidden="true">{sidebarOpen ? "✕" : "☰"}</span>
        </button>

        <span className="app-bar-brand">Veritasor</span>

        <div className="app-bar-workspace" style={{ position: "relative" }}>
          <button
            ref={workspaceBtnRef}
            type="button"
            className="workspace-trigger"
            aria-haspopup="listbox"
            aria-expanded={workspaceOpen}
            aria-label={`Workspace: ${currentWorkspace.name}. Change workspace. Press Ctrl+K then W for quick switch`}
            onClick={() => setWorkspaceOpen((o) => !o)}
            onKeyDown={handleWorkspaceKeyDown}
          >
            <span
              className="workspace-avatar"
              aria-hidden="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "1.75rem",
                height: "1.75rem",
                borderRadius: "var(--radius-sm)",
                background: currentWorkspace.avatar
                  ? `url(${currentWorkspace.avatar}) center/cover`
                  : "linear-gradient(135deg, var(--accent), var(--accent-secondary))",
                color: "white",
                fontSize: "0.75rem",
                fontWeight: 700,
                marginRight: "0.5rem",
              }}
            >
              {currentWorkspace.avatar ? "" : currentWorkspace.initials || currentWorkspace.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="workspace-name">{currentWorkspace.name}</span>
            <span aria-hidden="true" className="workspace-chevron">
              {workspaceOpen ? "▲" : "▼"}
            </span>
          </button>

          {workspaceOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 0.375rem)",
                left: 0,
                minWidth: "15rem",
                zIndex: 200,
              }}
            >
              {/* Quick-jump search input — shown when switcher opens in search mode */}
              <div
                style={{
                  padding: "0.375rem",
                  background: "var(--surface-strong)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  boxShadow: "var(--shadow-lg)",
                  marginBottom: "0.25rem",
                }}
              >
                <div style={{ position: "relative" }}>
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: "0.6rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "0.8rem",
                      color: "var(--muted)",
                      pointerEvents: "none",
                    }}
                  >
                    🔍
                  </span>
                  <input
                    ref={workspaceSearchRef}
                    type="search"
                    value={workspaceSearch}
                    onChange={(e) => setWorkspaceSearch(e.target.value)}
                    placeholder="Find workspace…"
                    aria-label="Search workspaces. Type to filter, use arrow keys to navigate, Enter to select"
                    aria-controls="workspace-listbox"
                    autoComplete="off"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setWorkspaceSearch("");
                        setWorkspaceOpen(false);
                        workspaceBtnRef.current?.focus();
                      } else if (e.key === "ArrowDown") {
                        e.preventDefault();
                        const first = workspaceMenuRef.current?.querySelector<HTMLElement>('[role="option"]');
                        first?.focus();
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        const filtered = workspaces.filter(
                          (ws) =>
                            workspaceSearch.trim() === "" ||
                            ws.name.toLowerCase().includes(workspaceSearch.toLowerCase()) ||
                            ws.description?.toLowerCase().includes(workspaceSearch.toLowerCase()),
                        );
                        if (filtered.length > 0) {
                          selectWorkspace(filtered[0]);
                        }
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.75rem 0.45rem 2rem",
                      borderRadius: "calc(var(--radius-sm) - 0.25rem)",
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      fontSize: "0.88rem",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      right: "0.5rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "0.65rem",
                      color: "var(--muted)",
                      pointerEvents: "none",
                      background: "var(--surface)",
                      padding: "0.1rem 0.3rem",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    <kbd style={{ fontFamily: "monospace" }}>↑↓</kbd> navigate
                  </div>
                </div>
              </div>
              <ul
                ref={workspaceMenuRef}
                id="workspace-listbox"
                role="listbox"
                aria-label="Select workspace"
                className="disclosure-menu"
                style={{ position: "static", minWidth: "100%" }}
                onKeyDown={handleWorkspaceMenuKeyDown}
              >
                {workspaces
                  .filter((ws) =>
                    workspaceSearch.trim() === "" ||
                    ws.name.toLowerCase().includes(workspaceSearch.toLowerCase()) ||
                    ws.description?.toLowerCase().includes(workspaceSearch.toLowerCase()),
                  )
                  .map((ws) => (
                    <li
                      key={ws.id}
                      role="option"
                      aria-selected={ws.id === currentWorkspace.id}
                      tabIndex={0}
                      className={`disclosure-item${ws.id === currentWorkspace.id ? " disclosure-item-active" : ""}`}
                      onClick={() => selectWorkspace(ws)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          selectWorkspace(ws);
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.6rem 0.9rem",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "2rem",
                          height: "2rem",
                          borderRadius: "var(--radius-sm)",
                          background: ws.avatar
                            ? `url(${ws.avatar}) center/cover`
                            : "linear-gradient(135deg, var(--accent), var(--accent-secondary))",
                          color: "white",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {ws.avatar ? "" : ws.initials || ws.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontWeight: 500, fontSize: "0.9rem" }}>{ws.name}</span>
                          {ws.plan && (
                            <span
                              aria-label={`Plan: ${ws.plan}`}
                              style={{
                                display: "inline-block",
                                padding: "0.1rem 0.4rem",
                                borderRadius: "999px",
                                fontSize: "0.65rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                                background:
                                  ws.plan === "business"
                                    ? "rgba(96, 165, 250, 0.15)"
                                    : ws.plan === "growth"
                                    ? "rgba(94, 234, 212, 0.15)"
                                    : "rgba(148, 163, 184, 0.15)",
                                color:
                                  ws.plan === "business"
                                    ? "var(--primary)"
                                    : ws.plan === "growth"
                                    ? "var(--accent)"
                                    : "var(--muted)",
                              }}
                            >
                              {ws.plan}
                            </span>
                          )}
                        </div>
                        {ws.description && (
                          <span
                            style={{
                              display: "block",
                              fontSize: "0.8rem",
                              color: "var(--muted)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {ws.description}
                          </span>
                        )}
                      </div>
                      {ws.id === currentWorkspace.id && (
                        <span
                          className="sr-only"
                          aria-live="polite"
                        >
                          (current)
                        </span>
                      )}
                      {ws.id === currentWorkspace.id && (
                        <span
                          aria-hidden="true"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "1rem",
                            height: "1rem",
                            borderRadius: "50%",
                            background: "var(--accent)",
                            color: "white",
                            fontSize: "0.6rem",
                            fontWeight: 700,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </li>
                  ))}
                {workspaceSearch.trim() !== "" &&
                  workspaces.filter((ws) =>
                    ws.name.toLowerCase().includes(workspaceSearch.toLowerCase()) ||
                    ws.description?.toLowerCase().includes(workspaceSearch.toLowerCase()),
                  ).length === 0 && (
                    <li
                      role="option"
                      aria-disabled="true"
                      tabIndex={-1}
                      style={{
                        padding: "0.6rem 0.9rem",
                        fontSize: "0.88rem",
                        color: "var(--muted)",
                        fontStyle: "italic",
                      }}
                    >
                      No workspaces match "{workspaceSearch}"
                    </li>
                  )}
                {workspaceSearch.trim() === "" && (
                  <li
                    role="none"
                    aria-hidden="true"
                    style={{
                      padding: "0.5rem 0.9rem",
                      borderTop: "1px solid var(--border)",
                      marginTop: "0.25rem",
                      fontSize: "0.75rem",
                      color: "var(--muted)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <kbd
                        style={{
                          fontFamily: "monospace",
                          fontSize: "0.7rem",
                          padding: "0.1rem 0.3rem",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--surface-strong)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        Ctrl+K
                      </kbd>
                      <span>then</span>
                      <kbd
                        style={{
                          fontFamily: "monospace",
                          fontSize: "0.7rem",
                          padding: "0.1rem 0.3rem",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--surface-strong)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        W
                      </kbd>
                      <span>for quick switch</span>
                    </div>
                  </li>
                )}
              </ul>
              <div
                style={{
                  marginTop: "0.375rem",
                  padding: "0.375rem",
                  background: "var(--surface-strong)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  boxShadow: "var(--shadow-lg)",
                }}
              >
                <button
                  type="button"
                  role="option"
                  tabIndex={0}
                  onClick={openCreateWorkspace}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openCreateWorkspace();
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    width: "100%",
                    minHeight: "2.5rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "calc(var(--radius-sm) - 0.25rem)",
                    border: "1px dashed rgba(94, 234, 212, 0.4)",
                    background:
                      "linear-gradient(135deg, rgba(94, 234, 212, 0.08), rgba(96, 165, 250, 0.08))",
                    color: "var(--text)",
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    cursor: "pointer",
                    transition:
                      "border-color 120ms ease, background-color 120ms ease, transform 120ms ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform =
                      "translateY(-1px)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      "var(--accent)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform =
                      "none";
                    (e.currentTarget as HTMLButtonElement).style.borderColor =
                      "rgba(94, 234, 212, 0.4)";
                  }}
                  aria-label={
                    hasDraftContent
                      ? "Create new workspace (resume draft)"
                      : "Create new workspace"
                  }
                >
                  <span aria-hidden="true" style={{ fontSize: "1rem" }}>
                    +
                  </span>
                  <span>Create workspace</span>
                  {hasDraftContent && (
                    <span
                      aria-label="Draft in progress"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: "1.4rem",
                        height: "1.2rem",
                        padding: "0 0.35rem",
                        borderRadius: 999,
                        background: "rgba(251, 191, 36, 0.18)",
                        color: "var(--warning)",
                        fontSize: "0.68rem",
                        fontWeight: 800,
                        letterSpacing: "0.04em",
                      }}
                    >
                      DRAFT
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="app-bar-search-trigger"
          aria-label="Search or type command"
          onClick={onSearchClick}
        >
          <span aria-hidden="true" className="search-icon">
            🔍
          </span>
          <span className="search-placeholder">Search...</span>
          <kbd className="search-kbd">Ctrl K</kbd>
        </button>

        <div className="app-bar-actions">
          <button
            ref={confirmMainnetTriggerRef}
            type="button"
            className={`env-badge env-badge-${environment}`}
            aria-label={`Environment: ${environment}. Toggle environment`}
            onClick={() => {
              if (environment === "testnet") {
                setConfirmMainnetOpen(true);
              } else {
                setEnvironment("testnet");
                setAnnouncement("Switched to testnet environment");
                setTimeout(() => setAnnouncement(""), 1000);
              }
            }}
          >
            <span aria-hidden="true" className="env-dot" />
            {environment}
          </button>

          <ConfirmDialog
            open={confirmMainnetOpen}
            title="Switch to mainnet?"
            description="Actions you take will publish attestations to the live Stellar mainnet network. This cannot be undone."
            confirmText="Confirm switch"
            cancelText="Cancel"
            tone="danger"
            onConfirm={() => {
              setEnvironment("mainnet");
              setConfirmMainnetOpen(false);
              setAnnouncement("Switched to mainnet environment");
              setTimeout(() => setAnnouncement(""), 1000);
            }}
            onClose={() => setConfirmMainnetOpen(false)}
          />

          <div style={{ position: "relative" }}>
            <button
              ref={accountBtnRef}
              type="button"
              className="account-trigger"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              aria-label={`Account menu for ${userName}${userEmail ? `, ${userEmail}` : ""}`}
              onClick={() => setAccountOpen((o) => !o)}
              onKeyDown={handleAccountKeyDown}
            >
              <span
                aria-hidden="true"
                className="account-avatar"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "50%",
                  background: userAvatar
                    ? `url(${userAvatar}) center/cover`
                    : "linear-gradient(135deg, var(--primary), var(--accent))",
                  color: "white",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                }}
              >
                {userAvatar ? "" : userInitials}
              </span>
              <span className="sr-only">{userName}</span>
              <span aria-hidden="true" className="workspace-chevron">
                {accountOpen ? "▲" : "▼"}
              </span>
            </button>

            {accountOpen && (
              <div
                ref={accountDropdownRef}
                className="disclosure-menu disclosure-menu-right"
              >
                <ul
                  ref={accountMenuRef}
                  role="menu"
                  aria-label="Account options"
                  style={{ listStyle: "none", margin: 0, padding: 0 }}
                  onKeyDown={handleAccountMenuKeyDown}
                >
                  <li
                    role="none"
                    aria-hidden="true"
                    style={{
                      padding: "0.75rem 0.9rem",
                      borderBottom: "1px solid var(--border)",
                      marginBottom: "0.25rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "2.5rem",
                          height: "2.5rem",
                          borderRadius: "50%",
                          background: userAvatar
                            ? `url(${userAvatar}) center/cover`
                            : "linear-gradient(135deg, var(--primary), var(--accent))",
                          color: "white",
                          fontSize: "0.9rem",
                          fontWeight: 700,
                        }}
                      >
                        {userAvatar ? "" : userInitials}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "0.95rem",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {userName}
                        </div>
                        {userEmail && (
                          <div
                            style={{
                              fontSize: "0.8rem",
                              color: "var(--muted)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {userEmail}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                  <li
                    role="menuitem"
                    tabIndex={0}
                    className="disclosure-item"
                    onClick={() => handleAccountNavigate("/settings")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleAccountNavigate("/settings");
                      }
                    }}
                  >
                    {intl.formatMessage({ id: "settings.title" })}
                  </li>
                  <li
                    role="menuitem"
                    tabIndex={0}
                    className="disclosure-item"
                    onClick={() => handleAccountNavigate("/api-keys")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleAccountNavigate("/api-keys");
                      }
                    }}
                  >
                    API keys
                  </li>
                  <li
                    role="separator"
                    aria-hidden="true"
                    className="disclosure-separator"
                  />
                  <li
                    role="menuitem"
                    tabIndex={0}
                    className="disclosure-item disclosure-item-danger"
                    onClick={handleSignOut}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSignOut();
                      }
                    }}
                  >
                    {intl.formatMessage({ id: "nav.signOut" })}
                  </li>
                </ul>
                <section
                  aria-label={intl.formatMessage({ id: "settings.locale.label" })}
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderTop: "1px solid var(--border)",
                    marginTop: "0.25rem",
                  }}
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">
                      {intl.formatMessage({ id: "settings.locale.label" })}
                    </span>
                    <LocalePicker compact />
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
    </>
  );
}
