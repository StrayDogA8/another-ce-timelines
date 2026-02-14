/**
 * Creates the API object passed to plugins.
 *
 * registerView(view) — register a layout view in the main content area.
 *   view.id             {string}           Unique identifier
 *   view.component      {React.Component}  Component to render
 *   view.name           {string}           Display name (shown in layout dropdown)
 *   view.showScrollbar  {boolean}          Keep the timeline scrollbar visible (default: false)
 *
 * registerAction(action) — add a button to the sidebar action bar.
 *   action.id      {string}           Unique identifier
 *   action.label   {string}           Tooltip text
 *   action.icon    {React.Component}  Icon component (rendered at 17px)
 *   action.onClick {function}         Called with (pluginApi) when clicked
 *
 * registerField(field) — add a custom field to the right panel element editor.
 *   field.id           {string}   Unique identifier (also the property key on the element)
 *   field.label        {string}   Display label
 *   field.type         {string}   "text" | "number" | "select" | "color" (default: "text")
 *   field.elementTypes {string[]} Which element types show this field: ["event","span","era"]
 *   field.options      {Array}    For "select" type: [{ value, label }]
 *   field.defaultValue {any}      Default value for new elements (default: "")
 */
export function createPluginApi({
  getTimeline,
  setTimeline,
  saveTimeline,
  getSelectedId,
  setSelectedId,
  getViewportInsets,
  registerView,
  unregisterView,
  registerAction,
  unregisterAction,
  registerField,
  unregisterField,
}) {
  return {
    getTimeline,
    setTimeline,
    saveTimeline,
    getSelectedId,
    setSelectedId,
    getViewportInsets,
    registerView,
    unregisterView,
    registerAction,
    unregisterAction,
    registerField,
    unregisterField,
  };
}
