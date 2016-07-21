import template from './template';
import angular from 'angular';
import moment from 'moment';
import kbn from 'app/core/utils/kbn';
import _ from 'lodash';
import config from 'app/core/config';
import TimeSeries from 'app/core/time_series2';
import * as fileExport from 'app/core/utils/file_export';
import {MetricsPanelCtrl} from 'app/plugins/sdk';

export class HeatmapEpochCtrl extends MetricsPanelCtrl {
  /** @ngInject */
  constructor($scope, $injector, $rootScope, annotationsSrv) {
    super($scope, $injector, annotationsSrv);
    this.$rootScope = $rootScope;

    var panelDefaults = {
      // datasource name, null = default datasource
      datasource: null,
      // heatmap options
      heatmapOptions: {
        type: 'time.heatmap',
        axes: ['left', 'bottom'],
        opacity: function(value, max) {
          return Math.pow((value/max), 0.7);
        },
        windowSize: 60,
        historySize: 120,
        buckets: 10,
        bucketRange: [0, 100],
        ticks: {
          left: 5,
          right: 5
        }
      },
      // legend options
      legend: {
        show: true, // disable/enable legend
        values: false, // disable/enable legend values
        min: false,
        max: false,
        current: false,
        total: false,
        avg: false
      },
      // time overrides
      timeFrom: null,
      timeShift: null,
      // metric queries
      targets: [{}],
    };

    _.defaults(this.panel, angular.copy(panelDefaults));
    _.defaults(this.panel.legend, panelDefaults.legend);

    this.hiddenSeries = {};
    this.seriesList = [];
    this.colors = $scope.$root.colors;
    this.theme = config.bootData.user.lightTheme ? 'epoch-theme-default' : 'epoch-theme-dark';

    this.events.on('render', this.onRender.bind(this));
    this.events.on('data-received', this.onDataReceived.bind(this));
    this.events.on('data-error', this.onDataError.bind(this));
    this.events.on('data-snapshot-load', this.onDataSnapshotLoad.bind(this));
    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('init-panel-actions', this.onInitPanelActions.bind(this));
  }

  onInitEditMode() {
    this.addEditorTab('Legend', 'public/app/plugins/panel/graph/tab_legend.html', 2);
    this.addEditorTab('Heatmap Options', 'public/plugins/mtanda-heatmap-epoch-panel/tab_options.html', 3);

    this.unitFormats = kbn.getUnitFormats();
  }

  onInitPanelActions(actions) {
    actions.push({text: 'Export CSV (series as rows)', click: 'ctrl.exportCsv()'});
    actions.push({text: 'Export CSV (series as columns)', click: 'ctrl.exportCsvColumns()'});
    actions.push({text: 'Toggle legend', click: 'ctrl.toggleLegend()'});
  }

  setUnitFormat(axis, subItem) {
    axis.format = subItem.value;
    this.render();
  }

  getEpochLabel(label) {
    return label.replace(/[ !"#$%&'()*+,.\/:;<=>?@\[\\\]^`{|}~]/g, ' ');
  }

  issueQueries(datasource) {
    if (!this.panel.targets || this.panel.targets.length === 0) {
      return this.$q.when([]);
    }

    this.panel.targets = _.map(this.panel.targets, function (target) {
      target.delta = true; // notify delta support
      return target;
    });

    return super.issueQueries(datasource);
  }

  zoomOut(evt) {
    this.publishAppEvent('zoom-out', evt);
  }

  onDataSnapshotLoad(snapshotData) {
    this.onDataReceived(snapshotData.data);
  }

  onDataError(err) {
    this.seriesList = [];
    this.render([]);
  }

  onDataReceived(dataList) {
    this.datapointsWarning = false;
    this.datapointsCount = 0;
    this.datapointsOutside = false;
    var maxTimeSeries = 56;
    if (dataList.length > maxTimeSeries) {
      var msg = 'heatmap epoch panel warning: exceed max time series (support' + maxTimeSeries + ' time series)';
      this.$rootScope.appEvent('alert-warning', [msg, '']);
      dataList = dataList.slice(0, maxTimeSeries); // TODO: support only 5 time series
    }
    this.seriesList = dataList.map(this.seriesHandler.bind(this));
    this.datapointsWarning = this.datapointsCount === 0 || this.datapointsOutside;

    this.loading = false;
    this.render(this.seriesList);
  }

  seriesHandler(seriesData, index) {
    var datapoints = seriesData.datapoints;
    var alias = seriesData.target;
    var colorIndex = index % this.colors.length;
    var color = this.colors[colorIndex];

    var series = new TimeSeries({
      datapoints: datapoints,
      alias: alias,
      color: color,
      unit: seriesData.delta || false // TODO: fix, use unit as delta temporaly
    });

    if (datapoints && datapoints.length > 0) {
      var last = moment.utc(datapoints[datapoints.length - 1][1]);
      var from = moment.utc(this.range.from);
      if (last - from < -10000) {
        this.datapointsOutside = true;
      }

      this.datapointsCount += datapoints.length;
    }

    return series;
  }

  onRender() {
    if (!this.seriesList) { return; }
  }

  toggleSeries(serie, event) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      if (this.hiddenSeries[serie.alias]) {
        delete this.hiddenSeries[serie.alias];
      } else {
        this.hiddenSeries[serie.alias] = true;
      }
    } else {
      this.toggleSeriesExclusiveMode(serie);
    }
    this.render();
  }

  toggleSeriesExclusiveMode (serie) {
    var hidden = this.hiddenSeries;

    if (hidden[serie.alias]) {
      delete hidden[serie.alias];
    }

    // check if every other series is hidden
    var alreadyExclusive = _.every(this.seriesList, value => {
      if (value.alias === serie.alias) {
        return true;
      }

      return hidden[value.alias];
    });

    if (alreadyExclusive) {
      // remove all hidden series
      _.each(this.seriesList, value => {
        delete this.hiddenSeries[value.alias];
      });
    } else {
      // hide all but this serie
      _.each(this.seriesList, value => {
        if (value.alias === serie.alias) {
          return;
        }

        this.hiddenSeries[value.alias] = true;
      });
    }
  }

  // Called from panel menu
  toggleLegend() {
    this.panel.legend.show = !this.panel.legend.show;
    this.refresh();
  }

  legendValuesOptionChanged() {
    var legend = this.panel.legend;
    legend.values = legend.min || legend.max || legend.avg || legend.current || legend.total;
    this.render();
  }

  exportCsv() {
    fileExport.exportSeriesListToCsv(this.seriesList);
  }

  exportCsvColumns() {
    fileExport.exportSeriesListToCsvColumns(this.seriesList);
  }
}

HeatmapEpochCtrl.template = template;
