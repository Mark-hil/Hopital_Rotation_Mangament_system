import React, { useEffect } from "react";

export function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [5, 10, 20],
  itemLabel = "entries",
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  useEffect(() => {
    if (totalPages >= 1 && currentPage > totalPages) {
      onPageChange(totalPages);
    }
  }, [currentPage, totalPages, onPageChange]);

  if (totalItems <= itemsPerPageOptions[0] && totalItems <= itemsPerPage && totalPages <= 1) {
    return (
      <div className="pagination-bar">
        <span style={{ fontSize: 13, color: "#64748B" }}>
          Showing all{" "}
          <span style={{ fontWeight: 700, color: "#0F172A" }}>{totalItems}</span>{" "}
          {totalItems === 1 ? itemLabel.replace(/s$/, "") : itemLabel}
        </span>
      </div>
    );
  }

  function getPageNumbers() {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return pages;
  }

  return (
    <div className="pagination-bar">
      <div className="pagination-info" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#64748B" }}>
          Showing{" "}
          <span style={{ fontWeight: 700, color: "#0F172A" }}>{startItem}</span>–
          <span style={{ fontWeight: 700, color: "#0F172A" }}>{endItem}</span> of{" "}
          <span style={{ fontWeight: 700, color: "#0F172A" }}>{totalItems}</span>{" "}
          {totalItems === 1 ? itemLabel.replace(/s$/, "") : itemLabel}
        </span>
        {onItemsPerPageChange && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#94A3B8" }}>Per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                onItemsPerPageChange(Number(e.target.value));
                onPageChange(1);
              }}
              style={{
                padding: "4px 8px",
                fontSize: 12,
                fontWeight: 600,
                color: "#334155",
                background: "#fff",
                border: "1px solid #CBD5E1",
                borderRadius: 6,
                cursor: "pointer",
                outline: "none",
              }}
            >
              {itemsPerPageOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="pagination-controls" style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 10px",
            borderRadius: 7,
            border: "1px solid #E2E8F0",
            background: currentPage === 1 ? "transparent" : "#fff",
            color: currentPage === 1 ? "#CBD5E1" : "#334155",
            fontSize: 12,
            fontWeight: 600,
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
            transition: "all 0.15s",
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Prev
        </button>

        {getPageNumbers().map((p, idx) => {
          if (p === "...") {
            return (
              <span key={`ellipsis-${idx}`} style={{ padding: "0 4px", color: "#94A3B8", fontSize: 13 }}>
                …
              </span>
            );
          }
          const isActive = p === currentPage;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              style={{
                minWidth: 28,
                height: 28,
                padding: "0 6px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 7,
                border: isActive ? "none" : "1px solid #E2E8F0",
                background: isActive ? "linear-gradient(135deg, #6366F1, #8B5CF6)" : "#fff",
                color: isActive ? "#fff" : "#334155",
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                cursor: "pointer",
                boxShadow: isActive ? "0 2px 6px rgba(99,102,241,0.3)" : "none",
                transition: "all 0.15s",
              }}
            >
              {p}
            </button>
          );
        })}

        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 10px",
            borderRadius: 7,
            border: "1px solid #E2E8F0",
            background: currentPage === totalPages ? "transparent" : "#fff",
            color: currentPage === totalPages ? "#CBD5E1" : "#334155",
            fontSize: 12,
            fontWeight: 600,
            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
            transition: "all 0.15s",
          }}
        >
          Next
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default Pagination;
