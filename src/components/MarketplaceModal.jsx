import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Upload, X, Download, Check, Trash2, FolderOpen, Search, Moon, Sun, ChevronDown } from "lucide-react";
import { saveUserTheme, deleteUserTheme } from "../utils/electronApi";

const MARKETPLACE_BASE = "https://raw.githubusercontent.com/sreegjl/timelines-marketplace/refs/heads/main/";

export default function MarketplaceModal({
  isOpen,
  onClose,
  appThemes,
  userThemes,
  userThemeIds,
  bundledThemes,
  defaultThemeKey,
  appThemeKey,
  onAppThemeChange,
  onRefreshThemes,
}) {
  const [marketplaceThemes, setMarketplaceThemes] = useState([]);
  const [marketplaceError, setMarketplaceError] = useState("");
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [marketplaceBusyId, setMarketplaceBusyId] = useState("");
  const [installedThemeIds, setInstalledThemeIds] = useState(new Set());
  const [marketplaceSearch, setMarketplaceSearch] = useState("");
  const [marketplaceCollection, setMarketplaceCollection] = useState(null);
  const [marketplaceDarkLight, setMarketplaceDarkLight] = useState("all");
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);
  const [marketplaceTab, setMarketplaceTab] = useState("marketplace");
  const [localDragOver, setLocalDragOver] = useState(false);
  const localGridRef = useRef(null);
  const localDropHandlerRef = useRef(null);
  const [installedOriginFilter, setInstalledOriginFilter] = useState("all");

  const loadInstalledThemes = async () => {
    if (!window.electron?.listThemes) return;
    try {
      const themes = await window.electron.listThemes();
      const ids = new Set(Object.keys(themes || {}).map((key) => key.toLowerCase()));
      setInstalledThemeIds(ids);
    } catch (error) {
      console.error("Failed to load installed themes:", error);
    }
  };

  const loadMarketplace = async () => {
    setMarketplaceLoading(true);
    setMarketplaceError("");
    try {
      const response = await fetch(`${MARKETPLACE_BASE}index.json`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Failed to load marketplace (${response.status})`);
      const data = await response.json();
      setMarketplaceThemes(Array.isArray(data?.themes) ? data.themes : []);
    } catch (error) {
      console.error("Failed to load marketplace:", error);
      setMarketplaceError("Failed to load marketplace themes.");
      setMarketplaceThemes([]);
    } finally {
      setMarketplaceLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setMarketplaceThemes([]);
      setMarketplaceError("");
      return;
    }
    setMarketplaceSearch("");
    setMarketplaceCollection(null);
    setMarketplaceDarkLight("all");
    setMoreMenuOpen(false);
    setMarketplaceTab("marketplace");
    setInstalledOriginFilter("all");
    loadMarketplace();
    loadInstalledThemes();
  }, [isOpen]);

  useEffect(() => {
    if (!moreMenuOpen) return;
    const handler = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) setMoreMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreMenuOpen]);

  useEffect(() => {
    if (marketplaceTab !== "local") return;
    const onDragOver = (e) => { e.preventDefault(); setLocalDragOver(true); };
    const onDragLeave = (e) => { if (!e.relatedTarget) setLocalDragOver(false); };
    const onDrop = (e) => {
      const files = Array.from(e.dataTransfer?.files || []).filter(f => f.name.endsWith(".json"));
      if (!files.length) return;
      e.preventDefault();
      setLocalDragOver(false);
      localDropHandlerRef.current(files);
    };
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("drop", onDrop);
      setLocalDragOver(false);
    };
  }, [marketplaceTab]);

  const handleDownloadTheme = async (theme) => {
    if (!theme?.id || !theme?.paths?.theme) return;
    setMarketplaceBusyId(theme.id);
    try {
      const response = await fetch(`${MARKETPLACE_BASE}${theme.paths.theme}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Failed to download theme (${response.status})`);
      const content = await response.text();
      const result = await saveUserTheme({ id: theme.id, content });
      if (!result?.success) throw new Error(result?.error || "Failed to save theme");
      await onRefreshThemes?.();
      await loadInstalledThemes();
    } catch (error) {
      console.error("Failed to download theme:", error);
      setMarketplaceError("Failed to download theme.");
    } finally {
      setMarketplaceBusyId("");
    }
  };

  const handleImportResult = async (result) => {
    if (!result) return;
    const failed = (result?.results || []).filter(r => !r.success);
    if (failed.length > 0) {
      setMarketplaceError(`Failed to import ${failed.length} file(s). Make sure they are valid JSON theme files.`);
    }
    if ((result?.results || []).some(r => r.success)) {
      await onRefreshThemes?.();
      await loadInstalledThemes();
    }
  };

  const processThemeFiles = async (files) => {
    if (!files.length) return;
    for (const file of files) {
      try {
        const content = await file.text();
        JSON.parse(content);
        const id = file.name.replace(/\.json$/i, "");
        const result = await saveUserTheme({ id, content });
        if (!result?.success) throw new Error(result?.error || "Save failed");
      } catch {
        setMarketplaceError(`Failed to import "${file.name}". Make sure it's a valid JSON file.`);
      }
    }
    await onRefreshThemes?.();
    await loadInstalledThemes();
  };
  localDropHandlerRef.current = processThemeFiles;

  const handleDeleteTheme = async (theme) => {
    if (!theme?.id) return;
    setMarketplaceBusyId(theme.id);
    try {
      const result = await deleteUserTheme({ id: theme.id });
      if (!result?.success && result?.error !== "NOT_FOUND") {
        throw new Error(result?.error || "Failed to delete theme");
      }
      await onRefreshThemes?.();
      await loadInstalledThemes();
    } catch (error) {
      console.error("Failed to delete theme:", error);
      setMarketplaceError("Failed to delete theme.");
    } finally {
      setMarketplaceBusyId("");
    }
  };

  if (!isOpen) return null;

  const collectionCounts = {};
  marketplaceThemes.forEach((t) => {
    const c = t.collection || "other";
    collectionCounts[c] = (collectionCounts[c] || 0) + 1;
  });
  const allCollections = Object.entries(collectionCounts)
    .sort(([a, ca], [b, cb]) => {
      if (a === "featured") return -1;
      if (b === "featured") return 1;
      return cb - ca;
    })
    .map(([collection, count]) => ({ collection, count }));

  const mktIds = new Set(marketplaceThemes.map(t => String(t.id || "").toLowerCase()));

  const allInstalledThemes = [
    ...appThemes.map(([key, theme]) => ({
      id: key,
      name: theme.name || key,
      origin: "built-in",
      type: theme.type || null,
      author: "shipped",
      thumbnailUrl: bundledThemes[key]?.thumbnail || null,
      description: null,
    })),
    ...userThemes.map(([key, theme]) => {
      const tid = key.toLowerCase();
      const isMkt = marketplaceThemes.length > 0 && mktIds.has(tid);
      const mktData = isMkt ? marketplaceThemes.find(t => String(t.id || "").toLowerCase() === tid) : null;
      return {
        id: key,
        name: theme.name || mktData?.name || key,
        origin: isMkt ? "marketplace" : "local",
        type: theme.type || mktData?.type || null,
        author: mktData?.author || (isMkt ? null : "you"),
        thumbnailUrl: mktData?.paths?.thumbnail ? `${MARKETPLACE_BASE}${mktData.paths.thumbnail}` : null,
        description: mktData?.description || null,
      };
    }),
  ];

  const allLocalThemes = userThemes
    .filter(([key]) => marketplaceThemes.length === 0 || !mktIds.has(key.toLowerCase()))
    .map(([key, theme]) => ({
      id: key,
      name: theme.name || key,
      origin: "local",
      type: theme.type || null,
      author: "you",
      thumbnailUrl: null,
      description: null,
    }));

  const searchFilter = (theme) => {
    const q = marketplaceSearch.trim().toLowerCase();
    if (!q) return true;
    return [theme.name, theme.author, theme.description].filter(Boolean).join(" ").toLowerCase().includes(q);
  };
  const typeFilter = (theme) => marketplaceDarkLight === "all" || theme.type === marketplaceDarkLight;

  const filteredMarketplace = marketplaceThemes.filter((t) => {
    const q = marketplaceSearch.trim().toLowerCase();
    if (q) {
      const h = [t?.name, t?.id, t?.author, t?.description].filter(Boolean).join(" ").toLowerCase();
      if (!h.includes(q)) return false;
    }
    if (marketplaceCollection !== null && t.collection !== marketplaceCollection) return false;
    if (marketplaceDarkLight !== "all" && t.type !== marketplaceDarkLight) return false;
    return true;
  }).sort((a, b) => (a.id || "").localeCompare(b.id || ""));

  const filteredInstalled = allInstalledThemes.filter(t =>
    searchFilter(t) && typeFilter(t) &&
    (installedOriginFilter === "all" || t.origin === installedOriginFilter)
  ).sort((a, b) => (a.id || "").localeCompare(b.id || ""));
  const filteredLocal = allLocalThemes.filter(t => searchFilter(t) && typeFilter(t))
    .sort((a, b) => (a.id || "").localeCompare(b.id || ""));

  const originCounts = {
    all: allInstalledThemes.length,
    marketplace: allInstalledThemes.filter(t => t.origin === "marketplace").length,
    local: allInstalledThemes.filter(t => t.origin === "local").length,
    "built-in": allInstalledThemes.filter(t => t.origin === "built-in").length,
  };

  const renderCard = (theme, showEdit = false) => {
    const themeId = String(theme.id || "").toLowerCase();
    const isActive = String(appThemeKey || "").toLowerCase() === themeId;
    const isBuiltIn = theme.origin === "built-in";
    const isBusy = marketplaceBusyId === theme.id;
    return (
      <div key={theme.id} className="marketplace-card">
        <div className="marketplace-thumbnail">
          {theme.thumbnailUrl && <img src={theme.thumbnailUrl} alt={`${theme.name} preview`} />}
          <span className={`marketplace-origin-badge marketplace-origin-badge-${theme.origin}`}>
            {theme.origin === "built-in" ? "BUILT-IN" : theme.origin === "marketplace" ? "MARKET" : "LOCAL"}
          </span>
        </div>
        <div className="marketplace-card-body">
          <div className="marketplace-card-title-row">
            <div className="marketplace-card-title">{theme.name}</div>
            {theme.type && (
              <span className={`marketplace-card-type-tag marketplace-card-type-tag-${theme.type}`}>{theme.type}</span>
            )}
          </div>
          <div className="marketplace-card-author">
            {theme.author === "shipped" ? "shipped" : theme.author ? `by ${theme.author}` : ""}
          </div>
          {theme.description && <div className="marketplace-card-description">{theme.description}</div>}
        </div>
        <div className="marketplace-card-actions">
          <button
            className={`marketplace-button marketplace-button-secondary${isActive ? " marketplace-button-active" : ""}`}
            type="button"
            disabled={isBusy}
            onClick={() => onAppThemeChange?.(isActive ? defaultThemeKey || "parchment" : theme.id)}
          >
            {isActive ? (
              <>
                <span className="marketplace-btn-default"><Check size={13} strokeWidth={2.5} /> Enabled</span>
                <span className="marketplace-btn-hover"><X size={13} strokeWidth={2.5} /> Disable</span>
              </>
            ) : "Enable"}
          </button>
          {showEdit && !isBuiltIn && (
            <button
              className="marketplace-icon-button marketplace-button-danger"
              type="button"
              onClick={() => window.electron?.openThemesFolder?.()}
              aria-label="Open themes folder"
              title="Open themes folder"
            >
              <FolderOpen size={16} />
            </button>
          )}
          {!isBuiltIn && (
            <button
              className="marketplace-icon-button marketplace-button-danger"
              type="button"
              disabled={isBusy}
              onClick={() => handleDeleteTheme({ id: theme.id })}
              aria-label="Delete theme"
              title="Delete theme"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div className="marketplace-modal" onClick={(e) => e.stopPropagation()}>
        <div className="marketplace-header">
          <button className="settings-back-button" onClick={onClose} aria-label="Close marketplace">
            <ArrowLeft size={18} strokeWidth={2} />
          </button>
          <div className="marketplace-header-title">
            <h2 className="marketplace-title">Marketplace</h2>
          </div>
        </div>

        <div className="marketplace-search-row">
          <Search size={14} className="marketplace-search-icon" />
          <input
            className="marketplace-search"
            type="text"
            placeholder="Search themes..."
            value={marketplaceSearch}
            onChange={(e) => setMarketplaceSearch(e.target.value)}
            aria-label="Search marketplace themes"
          />
        </div>

        <div className="marketplace-tabs-row">
          <div className="marketplace-type-toggle">
            <button
              className={`marketplace-type-btn${marketplaceTab === "marketplace" ? " marketplace-type-btn-active" : ""}`}
              onClick={() => setMarketplaceTab("marketplace")}
            >
              Marketplace {marketplaceThemes.length > 0 && <span className="marketplace-tab-count">{marketplaceThemes.length}</span>}
            </button>
            <button
              className={`marketplace-type-btn${marketplaceTab === "installed" ? " marketplace-type-btn-active" : ""}`}
              onClick={() => setMarketplaceTab("installed")}
            >
              Installed <span className="marketplace-tab-count">{allInstalledThemes.length}</span>
            </button>
            <button
              className={`marketplace-type-btn${marketplaceTab === "local" ? " marketplace-type-btn-active" : ""}`}
              onClick={() => setMarketplaceTab("local")}
            >
              Local <span className="marketplace-tab-count">{allLocalThemes.length}</span>
            </button>
          </div>
          <div className="marketplace-type-toggle">
            <button className={`marketplace-type-btn${marketplaceDarkLight === "all" ? " marketplace-type-btn-active" : ""}`} onClick={() => setMarketplaceDarkLight("all")}>All</button>
            <button className={`marketplace-type-btn${marketplaceDarkLight === "dark" ? " marketplace-type-btn-active" : ""}`} onClick={() => setMarketplaceDarkLight("dark")}><Moon size={11} /> Dark</button>
            <button className={`marketplace-type-btn${marketplaceDarkLight === "light" ? " marketplace-type-btn-active" : ""}`} onClick={() => setMarketplaceDarkLight("light")}><Sun size={11} /> Light</button>
          </div>
        </div>

        {marketplaceTab === "marketplace" && (
          <div className="marketplace-controls">
            <div className="marketplace-collection-pills">
              {(() => {
                const PRIMARY_COUNT = 3;
                const primary = allCollections.slice(0, PRIMARY_COUNT);
                const overflow = allCollections.slice(PRIMARY_COUNT);
                const activeIsOverflow = overflow.some((c) => c.collection === marketplaceCollection);
                return (
                  <>
                    <button
                      className={`marketplace-pill${marketplaceCollection === null ? " marketplace-pill-active" : ""}`}
                      onClick={() => setMarketplaceCollection(null)}
                    >
                      All themes <span className="marketplace-pill-count">{marketplaceThemes.length}</span>
                    </button>
                    {primary.map(({ collection, count }) => (
                      <button
                        key={collection}
                        className={`marketplace-pill${marketplaceCollection === collection ? " marketplace-pill-active" : ""}`}
                        onClick={() => setMarketplaceCollection(collection)}
                      >
                        {collection.charAt(0).toUpperCase() + collection.slice(1)}{" "}
                        <span className="marketplace-pill-count">{count}</span>
                      </button>
                    ))}
                    {overflow.length > 0 && (
                      <div className="marketplace-more-wrap" ref={moreMenuRef}>
                        <button
                          className={`marketplace-pill marketplace-pill-more${activeIsOverflow ? " marketplace-pill-active" : ""}`}
                          onClick={() => setMoreMenuOpen((v) => !v)}
                        >
                          {activeIsOverflow
                            ? overflow.find((c) => c.collection === marketplaceCollection)?.collection.charAt(0).toUpperCase() +
                              overflow.find((c) => c.collection === marketplaceCollection)?.collection.slice(1)
                            : "More"}
                          {" "}<ChevronDown size={11} strokeWidth={2.5} />
                        </button>
                        {moreMenuOpen && (
                          <div className="marketplace-more-menu">
                            {overflow.map(({ collection, count }) => (
                              <button
                                key={collection}
                                className={`marketplace-more-item${marketplaceCollection === collection ? " is-active" : ""}`}
                                onClick={() => { setMarketplaceCollection(collection); setMoreMenuOpen(false); }}
                              >
                                <span>{collection.charAt(0).toUpperCase() + collection.slice(1)}</span>
                                <span className="marketplace-more-count">{count}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {marketplaceTab === "installed" && (
          <div className="marketplace-controls">
            <div className="marketplace-collection-pills">
              {[
                { key: "all", label: "All", count: originCounts.all },
                { key: "marketplace", label: "Marketplace", count: originCounts.marketplace },
                { key: "local", label: "Local", count: originCounts.local },
                { key: "built-in", label: "Built-in", count: originCounts["built-in"] },
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  className={`marketplace-pill${installedOriginFilter === key ? " marketplace-pill-active" : ""}`}
                  onClick={() => setInstalledOriginFilter(key)}
                >
                  {label} <span className="marketplace-pill-count">{count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {marketplaceError && <div className="marketplace-error">{marketplaceError}</div>}

        {marketplaceTab === "marketplace" && (
          marketplaceLoading ? (
            <div className="marketplace-loading">Loading themes...</div>
          ) : filteredMarketplace.length === 0 ? (
            <div className="marketplace-empty">No themes match</div>
          ) : (
            <div className="marketplace-grid">
              {filteredMarketplace.map((theme) => {
                const themeId = String(theme.id || "").toLowerCase();
                const isInstalled = installedThemeIds.has(themeId) || userThemeIds.has(themeId);
                const isActive = String(appThemeKey || "").toLowerCase() === themeId;
                const isBusy = marketplaceBusyId === theme.id;
                const thumbnailUrl = theme?.paths?.thumbnail ? `${MARKETPLACE_BASE}${theme.paths.thumbnail}` : "";
                return (
                  <div key={theme.id} className="marketplace-card">
                    <div className="marketplace-thumbnail">
                      {thumbnailUrl && <img src={thumbnailUrl} alt={`${theme.name} preview`} />}
                    </div>
                    <div className="marketplace-card-body">
                      <div className="marketplace-card-title-row">
                        <div className="marketplace-card-title">{theme.name || theme.id}</div>
                        {theme.type && (
                          <span className={`marketplace-card-type-tag marketplace-card-type-tag-${theme.type}`}>{theme.type}</span>
                        )}
                      </div>
                      <div className="marketplace-card-author">{theme.author ? `by ${theme.author}` : ""}</div>
                      <div className="marketplace-card-description">{theme.description}</div>
                    </div>
                    <div className="marketplace-card-actions">
                      {isInstalled ? (
                        <>
                          <button
                            className={`marketplace-button marketplace-button-secondary${isActive ? " marketplace-button-active" : ""}`}
                            type="button"
                            disabled={isBusy}
                            onClick={() => onAppThemeChange?.(isActive ? defaultThemeKey || "parchment" : theme.id)}
                          >
                            {isActive ? (
                              <>
                                <span className="marketplace-btn-default"><Check size={13} strokeWidth={2.5} /> Enabled</span>
                                <span className="marketplace-btn-hover"><X size={13} strokeWidth={2.5} /> Disable</span>
                              </>
                            ) : "Enable"}
                          </button>
                          <button
                            className="marketplace-icon-button marketplace-button-danger"
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDeleteTheme(theme)}
                            aria-label="Delete theme"
                            title="Delete theme"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : (
                        <button
                          className="marketplace-button"
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDownloadTheme(theme)}
                        >
                          {isBusy ? "Downloading..." : <><Download size={13} strokeWidth={2.5} /> Download</>}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {marketplaceTab === "installed" && (
          filteredInstalled.length === 0 ? (
            <div className="marketplace-empty">No themes match</div>
          ) : (
            <div className="marketplace-grid">
              {filteredInstalled.map((t) => renderCard(t, t.origin === "local"))}
            </div>
          )
        )}

        {marketplaceTab === "local" && (
          <>
            <input
              id="theme-import-input"
              type="file"
              accept=".json"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                const files = Array.from(e.target.files).filter(f => f.name.endsWith(".json"));
                if (files.length) localDropHandlerRef.current(files);
                e.target.value = "";
              }}
            />
            <div
              ref={localGridRef}
              className={`marketplace-grid${localDragOver ? " marketplace-grid-drag-over" : ""}`}
            >
              <div
                className={`marketplace-card marketplace-card-new marketplace-card-import${localDragOver ? " marketplace-card-import-active" : ""}`}
                onClick={async () => {
                  if (window.electron?.importThemeDialog) {
                    const result = await window.electron.importThemeDialog();
                    await handleImportResult(result);
                  } else {
                    document.getElementById("theme-import-input").click();
                  }
                }}
              >
                <div className="marketplace-thumbnail marketplace-thumbnail-new">
                  <Upload size={28} strokeWidth={1.5} className="marketplace-new-icon" />
                </div>
                <div className="marketplace-card-body">
                  <div className="marketplace-card-title">Import Theme</div>
                  <div className="marketplace-card-author">Drop or click to add .json</div>
                </div>
              </div>
              {filteredLocal.map((t) => renderCard(t, true))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
