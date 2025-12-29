import type { RefObject, FC } from "react";

type EstatusFiltro = "all" | "tramitacion" | "decaida" | "concluida";
type Scope = "name" | "all";
type ViewMode = "cards" | "table" | "board";

interface MonitoreoControlsProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchFocused: boolean;
  onSearchFocusedChange: (focused: boolean) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  scope: Scope;
  onScopeChange: (scope: Scope) => void;
  estatusFiltro: EstatusFiltro;
  onEstatusFiltroChange: (estatus: EstatusFiltro) => void;
  categoriaFiltro: string;
  onCategoriaFiltroChange: (categoria: string) => void;
  categoriasUnicas: string[];
  tipoFiltro: string;
  onTipoFiltroChange: (tipo: string) => void;
  tiposUnicos: string[];
  tematicaFiltro: string;
  onTematicaFiltroChange: (tematica: string) => void;
  tematicasUnicas: string[];
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onResetFilters: () => void;
}

export const MonitoreoControls: FC<MonitoreoControlsProps> = (props) => {
  const {
    search,
    onSearchChange,
    searchFocused,
    onSearchFocusedChange,
    searchInputRef,
    estatusFiltro,
    onEstatusFiltroChange,
    categoriaFiltro,
    onCategoriaFiltroChange,
    categoriasUnicas,
    tipoFiltro,
    onTipoFiltroChange,
    tiposUnicos,
    tematicaFiltro,
    onTematicaFiltroChange,
    tematicasUnicas,
    viewMode,
    onViewModeChange,
  } = props;

  return (
    <section className="mon-controls-card reveal">
      {/* Fila superior: buscador */}
      <div className="mon-controls-row">
        <div className="mon-search-wrapper">
          <span className="mon-search-icon"></span>
          <input
            ref={searchInputRef}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => onSearchFocusedChange(true)}
            onBlur={() => onSearchFocusedChange(false)}
            className="mon-search-input"
            placeholder="Buscar por iniciativa, temática, estatus, tipología..."
          />
          <span className="mon-search-suffix">
            {searchFocused ? "Esc para limpiar" : "Ctrl/⌘ + K"}
          </span>
        </div>
      </div>

      {/* Fila de filtros por estatus */}
      <div
        className="mon-controls-row"
        style={{ alignItems: "center", gap: "12px" }}
      >
        <span
          style={{
            fontSize: "13px",
            color: "#6b7280",
            fontWeight: 500,
          }}
        >
          Filtrar por estatus:
        </span>

        {/* Orden: Concluida (verde), En tramitación (amarillo), Decaída (rojo) */}
        <div
          style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
        >
          {/* Todos */}
          <button
            type="button"
            onClick={() => onEstatusFiltroChange("all")}
            className={
              estatusFiltro === "all"
                ? "mon-chip-estatus mon-chip-estatus-active"
                : "mon-chip-estatus"
            }
          >
            Todos
          </button>

          {/* Concluida → VERDE */}
          <button
            type="button"
            onClick={() => onEstatusFiltroChange("concluida")}
            className={
              estatusFiltro === "concluida"
                ? "mon-chip-estatus mon-chip-estatus-concluida mon-chip-estatus-active"
                : "mon-chip-estatus mon-chip-estatus-concluida"
            }
          >
            Concluida
          </button>

          {/* En tramitación → AMARILLO */}
          <button
            type="button"
            onClick={() => onEstatusFiltroChange("tramitacion")}
            className={
              estatusFiltro === "tramitacion"
                ? "mon-chip-estatus mon-chip-estatus-tramitacion mon-chip-estatus-active"
                : "mon-chip-estatus mon-chip-estatus-tramitacion"
            }
          >
            En tramitación
          </button>

          {/* Decaída → ROJO */}
          <button
            type="button"
            onClick={() => onEstatusFiltroChange("decaida")}
            className={
              estatusFiltro === "decaida"
                ? "mon-chip-estatus mon-chip-estatus-decaida mon-chip-estatus-active"
                : "mon-chip-estatus mon-chip-estatus-decaida"
            }
          >
            Decaída
          </button>
        </div>
      </div>

      {/* Nueva fila: Filtros por Categoría, Tipo y Temática */}
      <div className="mon-controls-row" style={{ gap: "12px" }}>
        <div className="mon-filter-select-wrapper">
          <label htmlFor="categoria-filter" className="mon-filter-label">
            Tipología:
          </label>
          <select
            id="categoria-filter"
            value={categoriaFiltro}
            onChange={(e) => onCategoriaFiltroChange(e.target.value)}
            className="mon-filter-select"
          >
            <option value="all">Todas</option>
            {categoriasUnicas.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="mon-filter-select-wrapper">
          <label htmlFor="tipo-filter" className="mon-filter-label">
            Tipo:
          </label>
          <select
            id="tipo-filter"
            value={tipoFiltro}
            onChange={(e) => onTipoFiltroChange(e.target.value)}
            className="mon-filter-select"
          >
            <option value="all">Todos</option>
            {tiposUnicos.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </div>

        <div className="mon-filter-select-wrapper">
          <label htmlFor="tematica-filter" className="mon-filter-label">
            Temática:
          </label>
          <select
            id="tematica-filter"
            value={tematicaFiltro}
            onChange={(e) => onTematicaFiltroChange(e.target.value)}
            className="mon-filter-select"
          >
            <option value="all">Todas</option>
            {tematicasUnicas.map((tema) => (
              <option key={tema} value={tema}>
                {tema}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Fila inferior: selector de vista */}
      <div className="mon-toolbar-row">
        <div className="mon-toolbar-left" />
        <div className="mon-view-toggle-wrapper">
          <span className="mon-view-toggle-label">Vista:</span>
          <div className="mon-view-toggle">
            <button
              type="button"
              onClick={() => onViewModeChange("cards")}
              className={
                "mon-view-btn ripple-target" +
                (viewMode === "cards" ? " mon-view-btn-active" : "")
              }
            >
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("table")}
              className={
                "mon-view-btn ripple-target" +
                (viewMode === "table" ? " mon-view-btn-active" : "")
              }
            >
              <span>Lista</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};