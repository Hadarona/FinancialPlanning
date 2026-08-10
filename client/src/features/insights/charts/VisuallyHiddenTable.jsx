/**
 * A real (visually hidden) HTML table mirroring a chart's series values, so
 * keyboard and screen-reader users always have an equivalent data view
 * (D-INS-F4). `rows` is an array of arrays; the first cell of each row is a
 * row header.
 *
 * The `visually-hidden` class sits on a block wrapper, never on the <table>
 * itself: Chromium's automatic table layout treats an explicit 1px width on a
 * <table> as a minimum and expands it to its min-content width, which made
 * these hidden tables push the Insights page into real horizontal scroll at a
 * 320px viewport (DEV-SELFTEST-001). A 1px overflow-hidden <div> clips the
 * table out of the layout while leaving its accessible semantics intact.
 */
export function VisuallyHiddenTable({ caption, columns, rows }) {
  return (
    <div className="visually-hidden">
      <table>
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
    </div>
  );
}
