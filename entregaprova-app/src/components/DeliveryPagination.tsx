interface DeliveryPaginationProps {
  page: number;
  previous?: () => void;
  next?: () => void;
  disabled?: boolean;
}

export default function DeliveryPagination({ page, previous, next, disabled }: DeliveryPaginationProps) {
  if (!previous && !next) return null;
  return (
    <nav aria-label="Paginação de entregas" className="form-actions">
      <button type="button" className="button secondary" disabled={disabled || !previous} onClick={previous}>Página anterior</button>
      <span className="hint">Página {page}</span>
      <button type="button" className="button secondary" disabled={disabled || !next} onClick={next}>Próxima página</button>
    </nav>
  );
}
