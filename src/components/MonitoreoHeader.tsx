import React from "react";

interface MonitoreoHeaderProps {
  totalRows: number;
  currentPage: number;
  totalPages: number;
}

export const MonitoreoHeader: React.FC<MonitoreoHeaderProps> = ({
  totalRows,
  currentPage,
  totalPages,
}) => {
  return (
    <header className="mon-header reveal">
      <div className="mon-heading-row">
        <div className="mon-title-block">
          <div className="mon-eyebrow">Monitoreo de normativas</div>
          <h1 className="mon-title">
           Trazabilidad de las iniciativas legislativas con origen europeo
          </h1>
        </div>
        <div className="mon-stats-row">
          <div className="mon-stat-card">
            <div className="mon-stat-label">Total iniciativas</div>
            <div className="mon-stat-value">{totalRows}</div>
            <div className="mon-stat-chip">Datos en directo</div>
          </div>
          <div className="mon-stat-card">
            <div className="mon-stat-label">Página actual</div>
            <div className="mon-stat-value">
              {currentPage} / {totalPages}
            </div>
            <div className="mon-stat-chip">Paginación</div>
          </div>
        </div>
      </div>
    </header>
  );
};