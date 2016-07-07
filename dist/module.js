'use strict';

System.register(['lodash', 'app/plugins/sdk', './heatmap_ctrl', './heatmap', './legend'], function (_export, _context) {
  var _, loadPluginCss, HeatmapEpochCtrl;

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_appPluginsSdk) {
      loadPluginCss = _appPluginsSdk.loadPluginCss;
    }, function (_heatmap_ctrl) {
      HeatmapEpochCtrl = _heatmap_ctrl.HeatmapEpochCtrl;
    }, function (_heatmap) {}, function (_legend) {}],
    execute: function () {

      loadPluginCss({
        dark: 'plugins/mtanda-heatmap-epoch-panel/bower_components/epoch/dist/css/epoch.min.css',
        light: 'plugins/mtanda-heatmap-epoch-panel/bower_components/epoch/dist/css/epoch.min.css'
      });
      loadPluginCss({
        dark: 'plugins/mtanda-heatmap-epoch-panel/css/heatmap-epoch.dark.css',
        light: 'plugins/mtanda-heatmap-epoch-panel/css/heatmap-epoch.light.css'
      });

      _export('PanelCtrl', HeatmapEpochCtrl);
    }
  };
});
//# sourceMappingURL=module.js.map
