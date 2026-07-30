/**
 * A real (visually hidden) HTML table mirroring a chart's series values, so
 * keyboard and screen-reader users always have an equivalent data view
 * (D-INS-F4). `rows` is an array of arrays; the first cell of each row is a
 * row header.
 */
export function VisuallyHiddenTable({ caption, columns, rows }) {
  return (
    <table className="visually-hidden">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row[0]}>
            <th scope="row">{row[0]}</th>
            {row.slice(1).map((cell, cellIndex) => (
              <td key={`${row[0]}-${cellIndex}`}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
