import _ from 'lodash';
import {loadPluginCss} from 'app/plugins/sdk';
import {HeatmapEpochCtrl} from './heatmap_ctrl';
import './heatmap';
import './legend';

loadPluginCss({
  dark: 'plugins/mtanda-heatmap-epoch-panel/bower_components/epoch/dist/css/epoch.min.css',
  light: 'plugins/mtanda-heatmap-epoch-panel/bower_components/epoch/dist/css/epoch.min.css'
});
loadPluginCss({
  dark: 'plugins/mtanda-heatmap-epoch-panel/css/heatmap-epoch.dark.css',
  light: 'plugins/mtanda-heatmap-epoch-panel/css/heatmap-epoch.light.css'
});

export {
  HeatmapEpochCtrl as PanelCtrl
};
