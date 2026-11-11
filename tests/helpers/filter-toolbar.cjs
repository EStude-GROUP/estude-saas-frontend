const React = require("react");

// Feature tests exercise filter state independently of DOM sizing and portals.
// The real layout and nested popovers are checked in the browser.
exports.filterToolbar = function filterToolbar(collapsed = false) {
  return function Toolbar({ search, filters, actions, applyDisabled }) {
    const [open, setOpen] = React.useState(false);
    const [draft, setDraft] = React.useState({});
    const close = () => setOpen(false);
    const setValue = (id, value) => setDraft((current) => ({ ...current, [id]: value }));
    const fields = (inPopup) => filters.map((filter) => React.createElement(
      "div", { key: filter.id },
      filter.render(inPopup ? draft[filter.id] : filter.value, inPopup ? (value) => setValue(filter.id, value) : filter.apply, { inPopup, values: inPopup ? draft : Object.fromEntries(filters.map((f) => [f.id, f.value])), setValue }),
    ));
    return React.createElement("section", null,
      search,
      collapsed ? React.createElement("button", { onClick: () => { setDraft(Object.fromEntries(filters.map((f) => [f.id, f.value]))); setOpen(true); } }, "Bộ lọc") : fields(false),
      actions,
      open ? React.createElement("section", { role: "dialog" },
        fields(true),
        React.createElement("button", { onClick: close }, "Hủy"),
        React.createElement("button", { disabled: applyDisabled, onClick: () => { filters.forEach((filter) => { if (draft[filter.id] !== filter.value) filter.apply(draft[filter.id]); }); close(); } }, "Áp dụng"),
      ) : null,
    );
  };
};

exports.defineToolbarFilter = ({ onChange, ...config }) => ({ ...config, apply: onChange });
