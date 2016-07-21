'use strict';

System.register(['./template', 'angular', 'moment', 'app/core/utils/kbn', 'lodash', 'app/core/config', 'app/core/time_series2', 'app/core/utils/file_export', 'app/plugins/sdk'], function (_export, _context) {
  var template, angular, moment, kbn, _, config, TimeSeries, fileExport, MetricsPanelCtrl, _createClass, _get, HeatmapEpochCtrl;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function _possibleConstructorReturn(self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  }

  return {
    setters: [function (_template) {
      template = _template.default;
    }, function (_angular) {
      angular = _angular.default;
    }, function (_moment) {
      moment = _moment.default;
    }, function (_appCoreUtilsKbn) {
      kbn = _appCoreUtilsKbn.default;
    }, function (_lodash) {
      _ = _lodash.default;
    }, function (_appCoreConfig) {
      config = _appCoreConfig.default;
    }, function (_appCoreTime_series) {
      TimeSeries = _appCoreTime_series.default;
    }, function (_appCoreUtilsFile_export) {
      fileExport = _appCoreUtilsFile_export;
    }, function (_appPluginsSdk) {
      MetricsPanelCtrl = _appPluginsSdk.MetricsPanelCtrl;
    }],
    execute: function () {
      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      _get = function get(object, property, receiver) {
        if (object === null) object = Function.prototype;
        var desc = Object.getOwnPropertyDescriptor(object, property);

        if (desc === undefined) {
          var parent = Object.getPrototypeOf(object);

          if (parent === null) {
            return undefined;
          } else {
            return get(parent, property, receiver);
          }
        } else if ("value" in desc) {
          return desc.value;
        } else {
          var getter = desc.get;

          if (getter === undefined) {
            return undefined;
          }

          return getter.call(receiver);
        }
      };

      _export('HeatmapEpochCtrl', HeatmapEpochCtrl = function (_MetricsPanelCtrl) {
        _inherits(HeatmapEpochCtrl, _MetricsPanelCtrl);

        /** @ngInject */

        function HeatmapEpochCtrl($scope, $injector, $rootScope, annotationsSrv) {
          _classCallCheck(this, HeatmapEpochCtrl);

          var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(HeatmapEpochCtrl).call(this, $scope, $injector, annotationsSrv));

          _this.$rootScope = $rootScope;

          var panelDefaults = {
            // datasource name, null = default datasource
            datasource: null,
            // heatmap options
            heatmapOptions: {
              type: 'time.heatmap',
              axes: ['left', 'bottom'],
              opacity: function opacity(value, max) {
                return Math.pow(value / max, 0.7);
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
            targets: [{}]
          };

          _.defaults(_this.panel, angular.copy(panelDefaults));
          _.defaults(_this.panel.legend, panelDefaults.legend);

          _this.hiddenSeries = {};
          _this.seriesList = [];
          _this.colors = $scope.$root.colors;
          _this.theme = config.bootData.user.lightTheme ? 'epoch-theme-default' : 'epoch-theme-dark';

          _this.events.on('render', _this.onRender.bind(_this));
          _this.events.on('data-received', _this.onDataReceived.bind(_this));
          _this.events.on('data-error', _this.onDataError.bind(_this));
          _this.events.on('data-snapshot-load', _this.onDataSnapshotLoad.bind(_this));
          _this.events.on('init-edit-mode', _this.onInitEditMode.bind(_this));
          _this.events.on('init-panel-actions', _this.onInitPanelActions.bind(_this));
          return _this;
        }

        _createClass(HeatmapEpochCtrl, [{
          key: 'onInitEditMode',
          value: function onInitEditMode() {
            this.addEditorTab('Legend', 'public/app/plugins/panel/graph/tab_legend.html', 2);
            this.addEditorTab('Heatmap Options', 'public/plugins/mtanda-heatmap-epoch-panel/tab_options.html', 3);

            this.unitFormats = kbn.getUnitFormats();
          }
        }, {
          key: 'onInitPanelActions',
          value: function onInitPanelActions(actions) {
            actions.push({ text: 'Export CSV (series as rows)', click: 'ctrl.exportCsv()' });
            actions.push({ text: 'Export CSV (series as columns)', click: 'ctrl.exportCsvColumns()' });
            actions.push({ text: 'Toggle legend', click: 'ctrl.toggleLegend()' });
          }
        }, {
          key: 'setUnitFormat',
          value: function setUnitFormat(axis, subItem) {
            axis.format = subItem.value;
            this.render();
          }
        }, {
          key: 'getEpochLabel',
          value: function getEpochLabel(label) {
            return label.replace(/[ !"#$%&'()*+,.\/:;<=>?@\[\\\]^`{|}~]/g, ' ');
          }
        }, {
          key: 'issueQueries',
          value: function issueQueries(datasource) {
            if (!this.panel.targets || this.panel.targets.length === 0) {
              return this.$q.when([]);
            }

            this.panel.targets = _.map(this.panel.targets, function (target) {
              target.delta = true; // notify delta support
              return target;
            });

            return _get(Object.getPrototypeOf(HeatmapEpochCtrl.prototype), 'issueQueries', this).call(this, datasource);
          }
        }, {
          key: 'zoomOut',
          value: function zoomOut(evt) {
            this.publishAppEvent('zoom-out', evt);
          }
        }, {
          key: 'onDataSnapshotLoad',
          value: function onDataSnapshotLoad(snapshotData) {
            this.onDataReceived(snapshotData.data);
          }
        }, {
          key: 'onDataError',
          value: function onDataError(err) {
            this.seriesList = [];
            this.render([]);
          }
        }, {
          key: 'onDataReceived',
          value: function onDataReceived(dataList) {
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
        }, {
          key: 'seriesHandler',
          value: function seriesHandler(seriesData, index) {
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
        }, {
          key: 'onRender',
          value: function onRender() {
            if (!this.seriesList) {
              return;
            }
          }
        }, {
          key: 'toggleSeries',
          value: function toggleSeries(serie, event) {
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
        }, {
          key: 'toggleSeriesExclusiveMode',
          value: function toggleSeriesExclusiveMode(serie) {
            var _this2 = this;

            var hidden = this.hiddenSeries;

            if (hidden[serie.alias]) {
              delete hidden[serie.alias];
            }

            // check if every other series is hidden
            var alreadyExclusive = _.every(this.seriesList, function (value) {
              if (value.alias === serie.alias) {
                return true;
              }

              return hidden[value.alias];
            });

            if (alreadyExclusive) {
              // remove all hidden series
              _.each(this.seriesList, function (value) {
                delete _this2.hiddenSeries[value.alias];
              });
            } else {
              // hide all but this serie
              _.each(this.seriesList, function (value) {
                if (value.alias === serie.alias) {
                  return;
                }

                _this2.hiddenSeries[value.alias] = true;
              });
            }
          }
        }, {
          key: 'toggleLegend',
          value: function toggleLegend() {
            this.panel.legend.show = !this.panel.legend.show;
            this.refresh();
          }
        }, {
          key: 'legendValuesOptionChanged',
          value: function legendValuesOptionChanged() {
            var legend = this.panel.legend;
            legend.values = legend.min || legend.max || legend.avg || legend.current || legend.total;
            this.render();
          }
        }, {
          key: 'exportCsv',
          value: function exportCsv() {
            fileExport.exportSeriesListToCsv(this.seriesList);
          }
        }, {
          key: 'exportCsvColumns',
          value: function exportCsvColumns() {
            fileExport.exportSeriesListToCsvColumns(this.seriesList);
          }
        }]);

        return HeatmapEpochCtrl;
      }(MetricsPanelCtrl));

      _export('HeatmapEpochCtrl', HeatmapEpochCtrl);

      HeatmapEpochCtrl.template = template;
    }
  };
});
//# sourceMappingURL=heatmap_ctrl.js.map
