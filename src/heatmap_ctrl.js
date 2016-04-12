import {MetricsPanelCtrl} from 'app/plugins/sdk';
import {GraphCtrl} from 'app/plugins/panel/graph/module';
import template from './template';

export class HeatmapEpochCtrl extends GraphCtrl {
  /** @ngInject */
  constructor($scope, $injector, $rootScope, annotationsSrv) {
    super($scope, $injector, annotationsSrv);
    this.$rootScope = $rootScope;
  }

  onInitEditMode() {
    super.onInitEditMode();
    this.addEditorTab('Heatmap Options', 'public/plugins/grafana-heatmap-epoch-panel/tab_options.html');
  }
}

HeatmapEpochCtrl.template = template;
