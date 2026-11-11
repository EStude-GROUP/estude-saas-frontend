const React = require("react");

// Feature tests exercise filter state independently of DOM sizing and portals.
// The real layout and nested popovers are checked in the browser.
exports.filterToolbar = function filterToolbar(collapsed = false) {
  return function Toolbar({ search, filters, actions, onOpen, onReset, popupFooter }) {
    const [open, setOpen] = React.useState(false);
    const close = () => setOpen(false);
    const fields = (inPopup) => filters.map((filter) => React.createElement(
      "div", { key: filter.id },
      typeof filter.content === "function" ? filter.content(inPopup) : filter.content,
    ));
    return React.createElement("section", null,
      search,
      collapsed ? React.createElement("button", { onClick: () => { onOpen?.(); setOpen(true); } }, "Bộ lọc") : fields(false),
      actions,
      open ? React.createElement("section", { role: "dialog" },
        fields(true),
        onReset ? React.createElement("button", { onClick: onReset, "aria-label": "Đặt lại bộ lọc" }) : null,
        popupFooter?.(close),
      ) : null,
    );
  };
};
