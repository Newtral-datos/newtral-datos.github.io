import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import "./monitoreo.css";
import { MonitoreoHeader } from "./MonitoreoHeader";
import { MonitoreoControls } from "./MonitoreoControls";
import LoadingScreen from "./LoadingScreen";

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function tokenize(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean);
}

function highlightMatches(text: string, tokens: string[]): React.ReactNode {
  if (!text || tokens.length === 0) return text;
  const nText = normalize(text);
  const ranges: Array<{ start: number; end: number }> = [];

  tokens.forEach((tk) => {
    let idx = nText.indexOf(tk);
    while (idx !== -1) {
      ranges.push({ start: idx, end: idx + tk.length });
      idx = nText.indexOf(tk, idx + tk.length);
    }
  });

  if (ranges.length === 0) return text;

  ranges.sort((a, b) => a.start - b.start);
  const merged: typeof ranges = [];

  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (!last || r.start > last.end) {
      merged.push({ ...r });
    } else if (r.end > last.end) {
      last.end = r.end;
    }
  }

  const result: React.ReactNode[] = [];
  let lastIndex = 0;

  merged.forEach((r, i) => {
    if (r.start > lastIndex) {
      result.push(text.slice(lastIndex, r.start));
    }
    const original = text.slice(r.start, r.end);
    result.push(
      <mark key={`mark-${i}-${r.start}`} className="mon-mark">
        {original}
      </mark>
    );
    lastIndex = r.end;
  });

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}

function truncateText(text: string, maxChars: number): string {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + "...";
}

const CSV_PATH = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSwwMLRraqh9x8PINrFGorIvqQKotKX0VEb04y9MF9Z0NcrCjydvwEzU2-IM-JSH8mrHO85HPPIEsTL/pub?gid=906948988&single=true&output=csv";
const PAGE_SIZE = 18;

type Row = string[];

// const columns = [
//   { id: "A", label: "Fecha" },
//   { id: "B", label: "Tipo de norma" },
//   { id: "C", label: "Iniciativa legislativa" },
//   { id: "D", label: "Categoria" },
//   { id: "E", label: "Tematica" },
//   { id: "F", label: "Estatus" },
// ];

function letterToIndex(letter: string): number {
  return letter.charCodeAt(0) - "A".charCodeAt(0);
}

type EstatusFiltro = "all" | "tramitacion" | "decaida" | "concluida";
type Scope = "name" | "all";
type ViewMode = "cards" | "table" | "board";

function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}

function useStagger(baseDelay = 30) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);
  return (index: number) => (mounted ? index * baseDelay : 0);
}

function useRipple() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest("button, .ripple-target") as HTMLElement | null;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement("span");
      ripple.className = "mon-ripple";
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);
    }
    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, []);
  return containerRef;
}

type SortState = {
  col: string | null;
  dir: "asc" | "desc";
};

const renderTipoBadge = (estatus: string) => {
  const value = (estatus || "").trim().toLowerCase();
  let badgeClass = "mon-badge";

  if (value.includes("tramitacion") || value.includes("tramitación")) {
    // En tramitación -> amarillo
    badgeClass += " mon-badge-estatus-tramitacion";
  } else if (value.includes("decaida") || value.includes("decaída")) {
    // Decaída -> rojo
    badgeClass += " mon-badge-estatus-decaida";
  } else if (value.includes("concluida")) {
    // Concluida -> verde
    badgeClass += " mon-badge-estatus-concluida";
  }

  return (
    <span className={badgeClass}>
      {estatus || "Sin estatus"}
    </span>
  );
};

export function MonitoreoTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const debouncedSearch = useDebouncedValue(search, 200);
  const tokens = useMemo(() => tokenize(debouncedSearch), [debouncedSearch]);
  const [estatusFiltro, setEstatusFiltro] = useState<EstatusFiltro>("all");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("all");
  const [tipoFiltro, setTipoFiltro] = useState<string>("all");
  const [tematicaFiltro, setTematicaFiltro] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [sort, setSort] = useState<SortState>({ col: null, dir: "asc" });
  const [page, setPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRipple();
  const stagger = useStagger(30);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") setSearch("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setLoading(true);
    Papa.parse<string[]>(CSV_PATH, {
      download: true,
      skipEmptyLines: "greedy",
      complete: (res) => {
        try {
          const raw = res.data as Row[];
          const cleaned = raw.filter(
            (row) =>
              Array.isArray(row) &&
              row.some((cell) => (cell ?? "").toString().trim() !== "")
          );
          if (cleaned.length === 0) {
            setRows([]);
            setError(null);
            setTimeout(() => setLoading(false), 400);
            return;
          }
          const [, ...body] = cleaned;
          setRows(body);
          setError(null);
          
          // Esperar a que React renderice antes de ocultar loading
          requestAnimationFrame(() => {
            setTimeout(() => setLoading(false), 800);
          });
        } catch (err) {
          console.error(err);
          setError("No se pudo procesar el archivo CSV.");
          setTimeout(() => setLoading(false), 400);
        }
      },
      error: (err) => {
        console.error(err);
        setError("No se pudo cargar el archivo CSV.");
        setTimeout(() => setLoading(false), 400);
      },
    });
  }, []);

  const filteredRows = useMemo(() => {
    let result = [...rows];
    if (tokens.length > 0) {
      result = result.filter((row) => {
        const nombre = row[letterToIndex("C")] ?? "";
        const base =
          scope === "name"
            ? nombre
            : row.map((c) => c ?? "").join(" ");
        const nBase = normalize(base);
        return tokens.every((t) => nBase.includes(t));
      });
    }
    if (estatusFiltro !== "all") {
      result = result.filter((row) => {
        const estatus = (row[letterToIndex("F")] ?? "").toLowerCase();
        if (estatusFiltro === "tramitacion")
          return (
            estatus.includes("tramitacion") ||
            estatus.includes("tramitación")
          );
        if (estatusFiltro === "decaida")
          return estatus.includes("decaida") || estatus.includes("decaída");
        if (estatusFiltro === "concluida")
          return estatus.includes("concluida");
        return true;
      });
    }
    if (categoriaFiltro !== "all") {
      result = result.filter((row) => {
        const categoria = (row[letterToIndex("D")] ?? "").toLowerCase();
        return categoria.includes(categoriaFiltro.toLowerCase());
      });
    }
    if (tipoFiltro !== "all") {
      result = result.filter((row) => {
        const tipo = (row[letterToIndex("B")] ?? "").toLowerCase();
        return tipo.includes(tipoFiltro.toLowerCase());
      });
    }
    if (tematicaFiltro !== "all") {
      result = result.filter((row) => {
        const tematica = (row[letterToIndex("E")] ?? "").toLowerCase();
        return tematica.includes(tematicaFiltro.toLowerCase());
      });
    }
    if (sort.col) {
      const colIdx = letterToIndex(sort.col);
      result.sort((a, b) => {
        const va = a[colIdx];
        const vb = b[colIdx];
        if (!va && !vb) return 0;
        if (!va) return sort.dir === "asc" ? 1 : -1;
        if (!vb) return sort.dir === "asc" ? -1 : 1;
        return sort.dir === "asc"
          ? String(va).localeCompare(String(vb), "es", {
              sensitivity: "base",
            })
          : String(vb).localeCompare(String(va), "es", {
              sensitivity: "base",
            });
      });
    }

    // Ordenación por defecto por estatus: Concluida -> En tramitación -> Decaída
    if (!sort.col) {
      result.sort((a, b) => {
        const estatusA = (a[letterToIndex("F")] ?? "")
          .toLowerCase()
          .trim();
        const estatusB = (b[letterToIndex("F")] ?? "")
          .toLowerCase()
          .trim();

        const getPriority = (estatus: string) => {
          if (estatus.includes("concluida")) return 1;
          if (estatus.includes("tramitacion") || estatus.includes("tramitación"))
            return 2;
          if (estatus.includes("decaida") || estatus.includes("decaída"))
            return 3;
          return 4;
        };

        return getPriority(estatusA) - getPriority(estatusB);
      });
    }

    return result;
  }, [rows, tokens, estatusFiltro, categoriaFiltro, tipoFiltro, tematicaFiltro, scope, sort]);

  const totalItems = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filteredRows.slice(startIndex, startIndex + PAGE_SIZE);

  const totalTramitacion = rows.filter((r) => {
    const estatus = (r[letterToIndex("F")] ?? "").toLowerCase();
    return estatus.includes("tramitacion") || estatus.includes("tramitación");
  }).length;

  const totalDecaida = rows.filter((r) => {
    const estatus = (r[letterToIndex("F")] ?? "").toLowerCase();
    return estatus.includes("decaida") || estatus.includes("decaída");
  }).length;

  const totalConcluida = rows.filter((r) => {
    const estatus = (r[letterToIndex("F")] ?? "").toLowerCase();
    return estatus.includes("concluida");
  }).length;

  // Obtener opciones únicas para los filtros
  const categoriasUnicas = useMemo(() => {
    const cats = new Set<string>();
    rows.forEach((r) => {
      const cat = r[letterToIndex("D")] ?? "";
      if (cat && cat.trim()) cats.add(cat.trim());
    });
    return Array.from(cats).sort();
  }, [rows]);

  const tiposUnicos = useMemo(() => {
    const tipos = new Set<string>();
    rows.forEach((r) => {
      const tipo = r[letterToIndex("B")] ?? "";
      if (tipo && tipo.trim()) tipos.add(tipo.trim());
    });
    return Array.from(tipos).sort();
  }, [rows]);

  const tematicasUnicas = useMemo(() => {
    const temas = new Set<string>();
    rows.forEach((r) => {
      const tema = r[letterToIndex("E")] ?? "";
      if (tema && tema.trim()) temas.add(tema.trim());
    });
    return Array.from(temas).sort();
  }, [rows]);

  const toggleExpandRow = (rowId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const renderTematicaTag = (tematica: string) => {
    if (!tematica) return null;
    return (
      <div className="mon-card-tags">
        <span className="mon-card-tag">{tematica}</span>
      </div>
    );
  };

  const renderEmptyState = () => {
    if (pageRows.length > 0) return null;
    if (loading) {
      return (
        <div className="mon-empty">
          <div className="mon-empty-title reveal">
            Cargando monitoreos...
          </div>
          <div className="mon-empty-text">
            Estamos leyendo el archivo de seguimiento, un momento por
            favor.
          </div>
        </div>
      );
    }
    if (error) {
      return (
        <div className="mon-empty">
          <div className="mon-empty-title mon-empty-title-error">
            No se pudo cargar el CSV
          </div>
          <div className="mon-empty-text">
            Revisa la URL de la hoja o intentalo de nuevo en unos
            minutos.
          </div>
        </div>
      );
    }
    return (
      <div className="mon-empty">
        <div className="mon-empty-title">Sin resultados</div>
        <div className="mon-empty-text">
          Ajusta los filtros o amplia tu busqueda para ver mas
          iniciativas.
        </div>
      </div>
    );
  };

  const handleSortClick = (colId: string) => {
    setSort((prev) => {
      if (prev.col === colId) {
        return {
          col: colId,
          dir: prev.dir === "asc" ? "desc" : "asc",
        };
      }
      return {
        col: colId,
        dir: "asc",
      };
    });
  };

  const resetFilters = () => {
    setSearch("");
    setScope("all");
    setEstatusFiltro("all");
    setCategoriaFiltro("all");
    setTipoFiltro("all");
    setTematicaFiltro("all");
    setSort({ col: null, dir: "asc" });
    setPage(1);
  };

  const renderCards = () => {
    if (pageRows.length === 0) return renderEmptyState();
    return (
      <div className="mon-card-grid">
        {pageRows.map((row, idx) => {
          const fecha = row[letterToIndex("A")] ?? "";
          const tipoNorma = row[letterToIndex("B")] ?? "";
          const iniciativaRaw = row[letterToIndex("C")] ?? "";
          const categoria = row[letterToIndex("D")] ?? "";
          const tematica = row[letterToIndex("E")] ?? "";
          const estatus = row[letterToIndex("F")] ?? "";
          const boeRaw = row[14] ?? ""; // Posición 14 del array
          
          // Limpiar y normalizar enlace BOE
          let boe = "";
          if (boeRaw && boeRaw.trim()) {
            const cleanedBoe = boeRaw.replace(/^_+|_+$/g, '').trim();
            
            if (cleanedBoe.length > 0) {
              if (cleanedBoe.startsWith("http://") || cleanedBoe.startsWith("https://")) {
                boe = cleanedBoe;
              } else if (cleanedBoe.startsWith("www.")) {
                boe = "https://" + cleanedBoe;
              } else if (cleanedBoe.includes(".")) {
                boe = "https://" + cleanedBoe;
              }
            }
          }
          
          const cardId = `card-${currentPage}-${idx}`;
          const isExpanded = expandedRows.has(cardId);
          
          // Mostrar texto completo cuando está expandido, truncado cuando no
          const iniciativaDisplay = iniciativaRaw || "Sin titulo";
          const needsExpansion = iniciativaRaw && iniciativaRaw.length > 100;

          return (
            <article
              key={cardId}
              className="mon-card reveal"
              style={{ animationDelay: `${stagger(idx)}ms` }}
            >
              {/* Barra superior con gradiente */}
              <div className="mon-card-accent-bar"></div>
              
              {/* Header compacto con badge */}
              <div className="mon-card-header">
                <div style={{ flex: 1 }}></div>
                {renderTipoBadge(estatus)}
              </div>

              {/* Título con expansión condicional */}
              <div className="mon-card-title-section">
                <h3 
                  className={`mon-card-title-text ${isExpanded ? 'mon-card-title-expanded' : 'mon-card-title-collapsed'}`}
                >
                  {highlightMatches(iniciativaDisplay, tokens)}
                </h3>
                {needsExpansion && (
                  <button
                    className="mon-card-expand-btn"
                    onClick={() => toggleExpandRow(cardId)}
                    aria-label={isExpanded ? "Ver menos" : "Ver más"}
                  >
                    {isExpanded ? "Contraer ▲" : "Expandir ▼"}
                  </button>
                )}
              </div>

              {/* Grid de información en 2 columnas */}
              <div className="mon-card-info-grid">
                <div className="mon-card-info-item">
                  <span className="mon-card-info-label">Tipología</span>
                  <span className="mon-card-info-value">
                    {highlightMatches(categoria || "Sin categoría", tokens)}
                  </span>
                </div>

                <div className="mon-card-info-item">
                  <span className="mon-card-info-label">Tipo</span>
                  <span className="mon-card-info-value">
                    {highlightMatches(tipoNorma || "Sin tipo", tokens)}
                  </span>
                </div>
                
                {tematica && (
                  <div className="mon-card-info-item">
                    <span className="mon-card-info-label">Temática</span>
                    <span className="mon-card-info-value">
                      {highlightMatches(tematica, tokens)}
                    </span>
                  </div>
                )}

                {fecha && (
                  <div className="mon-card-info-item">
                    <span className="mon-card-info-label">Fecha</span>
                    <span className="mon-card-info-value">{fecha}</span>
                  </div>
                )}
              </div>

              {/* Enlace BOE solo si existe y es válido */}
              {boe && boe.length > 0 && (
                <div className="mon-card-boe-section">
                  <a 
                    href={boe} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mon-card-boe-link"
                  >
                    <span className="mon-card-boe-icon">📄</span>
                    Ver en BOE
                    <span className="mon-card-boe-arrow">→</span>
                  </a>
                </div>
              )}
            </article>
          );
        })}
      </div>
    );
  };

  const renderBoard = () => {
    const byTipo = {
      proyectoLey: [] as Row[],
      proyectoAcuerdo: [] as Row[],
      parlamentaria: [] as Row[],
      reglamentaria: [] as Row[],
      other: [] as Row[],
    };

    filteredRows.forEach((row) => {
      const tipo = (row[letterToIndex("B")] ?? "").toLowerCase();
      if (tipo.includes("proyecto de ley")) {
        byTipo.proyectoLey.push(row);
      } else if (tipo.includes("proyecto de acuerdo")) {
        byTipo.proyectoAcuerdo.push(row);
      } else if (tipo.includes("parlamentaria")) {
        byTipo.parlamentaria.push(row);
      } else if (tipo.includes("reglamentaria")) {
        byTipo.reglamentaria.push(row);
      } else {
        byTipo.other.push(row);
      }
    });

    const columns = [
      {
        key: "proyectoLey" as const,
        title: "Proyecto de ley",
        items: byTipo.proyectoLey,
        badgeClass: "mon-board-badge mon-board-badge-ley",
      },
      {
        key: "proyectoAcuerdo" as const,
        title: "Proyecto de acuerdo",
        items: byTipo.proyectoAcuerdo,
        badgeClass: "mon-board-badge mon-board-badge-acuerdo",
      },
      {
        key: "parlamentaria" as const,
        title: "Iniciativa parlamentaria",
        items: byTipo.parlamentaria,
        badgeClass:
          "mon-board-badge mon-board-badge-parlamentaria",
      },
      {
        key: "reglamentaria" as const,
        title: "Solo Reglamentaria",
        items: byTipo.reglamentaria,
        badgeClass: "mon-board-badge mon-board-badge-reg",
      },
      {
        key: "other" as const,
        title: "Otros / Sin clasificar",
        items: byTipo.other,
        badgeClass: "mon-board-badge",
      },
    ];

    return (
      <div className="mon-board-grid">
        {columns.map((col, idxCol) => (
          <section
            key={col.key}
            className="mon-board-column reveal"
            style={{ animationDelay: `${stagger(idxCol)}ms` }}
          >
            <div className="mon-board-column-header">
              <div className="mon-board-column-title">
                <span>{col.title}</span>
                <span className={col.badgeClass}>
                  {col.items.length}
                </span>
              </div>
            </div>
            <div className="mon-board-column-body">
              {col.items.length === 0 && (
                <div className="mon-board-empty-text">
                  No hay elementos en esta categoria.
                </div>
              )}
              {col.items.map((row, idx) => {
                const nombreRaw = row[letterToIndex("C")] ?? "";
                const categoria = row[letterToIndex("D")] ?? "";
                const tematica = row[letterToIndex("E")] ?? "";
                const estatus = row[letterToIndex("F")] ?? "";
                const fecha = row[letterToIndex("A")] ?? "";
                const nombre = truncateText(
                  nombreRaw || "Sin titulo",
                  140
                );
                const cardId = `board-${col.key}-${idx}-${nombreRaw ?? ""}`;

                return (
                  <article
                    key={cardId}
                    className="mon-board-card"
                  >
                    <div className="mon-board-card-header">
                      <div className="mon-board-card-title">
                        {highlightMatches(nombre, tokens)}
                      </div>
                      <div>{renderTipoBadge(estatus)}</div>
                    </div>
                    <div className="mon-board-card-body">
                      <div className="mon-board-card-line">
                        {categoria || "Sin categoria"}
                      </div>
                      <div className="mon-board-card-line mon-board-card-line-muted">
                        {tematica || "Sin tematica"}
                      </div>
                      {fecha && (
                        <div className="mon-board-card-date">
                          {fecha}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  };

  const renderTable = () => {
    if (pageRows.length === 0) return renderEmptyState();
    return (
      <div className="mon-table-scroll">
        <table className="mon-table">
          <thead className="mon-thead">
            <tr>
              <th
                className="mon-th mon-th-expand"
                aria-label="Expandir"
              ></th>
              <th
                className="mon-th mon-th-sortable"
                onClick={() => handleSortClick("C")}
              >
                Iniciativa legislativa
                {sort.col === "C" && (
                  <span className="mon-th-sort-icon">
                    {sort.dir === "asc" ? "▲" : "▼"}
                  </span>
                )}
              </th>
              <th
                className="mon-th mon-th-sortable"
                onClick={() => handleSortClick("B")}
              >
                Tipo de norma
                {sort.col === "B" && (
                  <span className="mon-th-sort-icon">
                    {sort.dir === "asc" ? "▲" : "▼"}
                  </span>
                )}
              </th>
              <th
                className="mon-th mon-th-sortable"
                onClick={() => handleSortClick("D")}
              >
                Tipología
                {sort.col === "D" && (
                  <span className="mon-th-sort-icon">
                    {sort.dir === "asc" ? "▲" : "▼"}
                  </span>
                )}
              </th>
              <th
                className="mon-th mon-th-sortable"
                onClick={() => handleSortClick("E")}
              >
                Tematica
                {sort.col === "E" && (
                  <span className="mon-th-sort-icon">
                    {sort.dir === "asc" ? "▲" : "▼"}
                  </span>
                )}
              </th>
              <th
                className="mon-th mon-th-sortable"
                onClick={() => handleSortClick("F")}
              >
                Estatus
                {sort.col === "F" && (
                  <span className="mon-th-sort-icon">
                    {sort.dir === "asc" ? "▲" : "▼"}
                  </span>
                )}
              </th>
              <th
                className="mon-th mon-th-sortable"
                onClick={() => handleSortClick("A")}
              >
                Fecha
                {sort.col === "A" && (
                  <span className="mon-th-sort-icon">
                    {sort.dir === "asc" ? "▲" : "▼"}
                  </span>
                )}
              </th>
              <th className="mon-th">BOE</th>
            </tr>
          </thead>
          <tbody className="mon-tbody">
            {pageRows.map((row, idx) => {
              const fecha = row[letterToIndex("A")] ?? "";
              const tipoNorma = row[letterToIndex("B")] ?? "";
              const iniciativaRaw = row[letterToIndex("C")] ?? "";
              const categoria = row[letterToIndex("D")] ?? "";
              const tematica = row[letterToIndex("E")] ?? "";
              const estatus = row[letterToIndex("F")] ?? "";
              const boeRaw = row[14] ?? ""; // Posición 14 del array
              
              // Limpiar y normalizar enlace BOE
              let boe = "";
              if (boeRaw && boeRaw.trim()) {
                const cleanedBoe = boeRaw.replace(/^_+|_+$/g, '').trim();
                
                if (cleanedBoe.length > 0) {
                  if (cleanedBoe.startsWith("http://") || cleanedBoe.startsWith("https://")) {
                    boe = cleanedBoe;
                  } else if (cleanedBoe.startsWith("www.")) {
                    boe = "https://" + cleanedBoe;
                  } else if (cleanedBoe.includes(".")) {
                    boe = "https://" + cleanedBoe;
                  }
                }
              }
              
              const iniciativa = truncateText(
                iniciativaRaw || "Sin titulo",
                150
              );
              const rowId = `row-${idx}-${iniciativa}`;
              const isExpanded = expandedRows.has(rowId);
              const shouldShowExpanded = isMobile || isExpanded;

              return (
                <React.Fragment key={rowId}>
                  <tr
                    className="mon-tr reveal"
                    style={{ animationDelay: `${stagger(idx)}ms` }}
                  >
                    <td className="mon-td mon-td-expand"><button
                        className="mon-row-toggle"
                        onClick={() => toggleExpandRow(rowId)}
                        aria-label={
                          isExpanded
                            ? "Cerrar detalles"
                            : "Ver detalles"
                        }
                        aria-expanded={isExpanded}
                      >{isExpanded ? "-" : "+"}</button></td>
                    <td className="mon-td">
                      <div className="mon-td-title">
                        {highlightMatches(iniciativa, tokens)}
                      </div>
                    </td>
                    <td className="mon-td mon-td-small">
                      {highlightMatches(
                        tipoNorma || "Sin tipo de norma",
                        tokens
                      )}
                    </td>
                    <td className="mon-td mon-td-small">
                      {highlightMatches(
                        categoria || "Sin categoria",
                        tokens
                      )}
                    </td>
                    <td className="mon-td mon-td-small mon-td-muted">
                      {highlightMatches(
                        tematica || "Sin tematica",
                        tokens
                      )}
                    </td>
                    <td className="mon-td mon-td-small">
                      {renderTipoBadge(estatus)}
                    </td>
                    <td className="mon-td mon-td-small mon-td-muted">
                      {fecha}
                    </td>
                    <td className="mon-td mon-td-small">
                      {boe && boe.length > 0 ? (
                        <a
                          href={boe}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mon-table-link"
                          title="Ver en BOE"
                        >
                          📄 BOE
                        </a>
                      ) : (
                        <span className="mon-td-empty">—</span>
                      )}
                    </td>
                  </tr>
                  {shouldShowExpanded && (
                    <tr className="mon-expanded-row">
                      <td colSpan={8}>
                        <div className="mon-expanded-content">
                          <div className="mon-expanded-body">
                            <div className="mon-expanded-section">
                              <div className="mon-expanded-label">
                                Iniciativa
                              </div>
                              <div className="mon-expanded-value">
                                {iniciativaRaw || "Sin informacion"}
                              </div>
                            </div>
                            <div className="mon-expanded-grid">
                              <div className="mon-expanded-section">
                                <div className="mon-expanded-label">
                                  Tipo de norma
                                </div>
                                <div className="mon-expanded-value">
                                  {tipoNorma || "Sin tipo de norma"}
                                </div>
                              </div>
                              <div className="mon-expanded-section">
                                <div className="mon-expanded-label">
                                  Tipología
                                </div>
                                <div className="mon-expanded-value">
                                  {categoria || "Sin categoria"}
                                </div>
                              </div>
                              <div className="mon-expanded-section">
                                <div className="mon-expanded-label">
                                  Tematica
                                </div>
                                <div className="mon-expanded-value">
                                  {tematica || "Sin tematica"}
                                </div>
                              </div>
                              <div className="mon-expanded-section">
                                <div className="mon-expanded-label">
                                  Estatus
                                </div>
                                <div className="mon-expanded-value">
                                  {estatus || "Sin estatus"}
                                </div>
                              </div>
                              <div className="mon-expanded-section">
                                <div className="mon-expanded-label">
                                  Fecha
                                </div>
                                <div className="mon-expanded-value">
                                  {fecha || "Sin fecha"}
                                </div>
                              </div>
                              {boe && boe.length > 0 && (
                                <div className="mon-expanded-section">
                                  <div className="mon-expanded-label">
                                    BOE
                                  </div>
                                  <div className="mon-expanded-value">
                                    <a
                                      href={boe}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mon-expanded-link"
                                    >
                                      Ver documento →
                                    </a>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Mostrar LoadingScreen mientras se cargan los datos
  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="mon-shell" ref={containerRef}>
      <div className="mon-shell-inner">
        <MonitoreoHeader
          totalRows={rows.length}
          currentPage={currentPage}
          totalPages={totalPages}
        />
        <MonitoreoControls
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchFocused={searchFocused}
          onSearchFocusedChange={setSearchFocused}
          searchInputRef={searchInputRef}
          scope={scope}
          onScopeChange={setScope}
          estatusFiltro={estatusFiltro}
          onEstatusFiltroChange={(value) => {
            setEstatusFiltro(value);
            setPage(1);
          }}
          categoriaFiltro={categoriaFiltro}
          onCategoriaFiltroChange={(value) => {
            setCategoriaFiltro(value);
            setPage(1);
          }}
          categoriasUnicas={categoriasUnicas}
          tipoFiltro={tipoFiltro}
          onTipoFiltroChange={(value) => {
            setTipoFiltro(value);
            setPage(1);
          }}
          tiposUnicos={tiposUnicos}
          tematicaFiltro={tematicaFiltro}
          onTematicaFiltroChange={(value) => {
            setTematicaFiltro(value);
            setPage(1);
          }}
          tematicasUnicas={tematicasUnicas}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onResetFilters={resetFilters}
        />
        <section className="mon-content-card reveal">
          <div className="mon-header-strip">
            <div className="mon-header-strip-left">
              <div className="mon-header-strip-title">
                {viewMode === "cards"
                  ? "Vista en cards"
                  : viewMode === "table"
                  ? "Vista en lista"
                  : "Vista tablero por tipo"}
              </div>
              <div className="mon-header-strip-hint">
                {totalItems} resultados filtrados de {rows.length} totales
              </div>
            </div>
            <div className="mon-header-strip-right">
              <span className="mon-header-strip-kpi">
                Tramitación: {totalTramitacion} - Concluida: {totalConcluida} - Decaída: {totalDecaida}
              </span>
            </div>
          </div>
          <div className="mon-content-inner">
            {viewMode === "cards"
              ? renderCards()
              : viewMode === "table"
              ? renderTable()
              : renderBoard()}
          </div>
          <footer className="mon-footer">
            <div>
              <span className="mon-footer-kpi">
                Pagina {currentPage} de {totalPages}
              </span>
              <span className="mon-footer-separator">·</span>
              <span className="mon-footer-kpi">
                Mostrando {pageRows.length} elementos
              </span>
            </div>
            <div className="mon-pagination">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={
                  "mon-pager-btn ripple-target" +
                  (currentPage === 1 ? " mon-pager-btn-disabled" : "")
                }
              >
                ◀
              </button>
              <div className="mon-pager-info">
                {currentPage} / {totalPages}
              </div>
              <button
                type="button"
                onClick={() =>
                  setPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className={
                  "mon-pager-btn ripple-target" +
                  (currentPage === totalPages
                    ? " mon-pager-btn-disabled"
                    : "")
                }
              >
                ▶
              </button>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}