'use strict';

System.register(['lodash', './heatmap_ctrl', './heatmap'], function (_export, _context) {
  var _, HeatmapEpochCtrl;

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_heatmap_ctrl) {
      HeatmapEpochCtrl = _heatmap_ctrl.HeatmapEpochCtrl;
    }, function (_heatmap) {}],
    execute: function () {
      _export('PanelCtrl', HeatmapEpochCtrl);
    }
  };
});
//# sourceMappingURL=module.js.map
