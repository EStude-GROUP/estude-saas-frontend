export function LoadingBar({
  label = "Đang tải dữ liệu",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div role="progressbar" aria-label={label} className={`table-loading-track ${className}`}>
      <span aria-hidden="true" className="table-loading-indicator" />
    </div>
  );
}
